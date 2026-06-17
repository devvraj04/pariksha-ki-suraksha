import os
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List
from apps.api.deps import CurrentUser, RequireRole, get_service_db, log_audit
from supabase import Client

router = APIRouter(prefix="/admin", tags=["Platform Admin"])

CONFIG_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core", "platform_config.json")

def get_platform_config():
    if os.path.exists(CONFIG_FILE_PATH):
        try:
            with open(CONFIG_FILE_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Defaults
    return {
        "default_visibility_threshold": 8.0,
        "default_geofence_radius_meters": 100,
        "watermark_master_key_ref": "WATERMARK_MASTER_KEY",
        "hsm_integration_mode": "Supabase Vault"
    }

def save_platform_config(config_data):
    os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
    with open(CONFIG_FILE_PATH, "w") as f:
        json.dump(config_data, f, indent=4)

@router.get("/agencies")
def get_agencies(
    status: Optional[str] = "PENDING",
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    limit = min(limit, 100)
    offset = (page - 1) * limit
    query = db.table("agencies").select("*")
    
    if status:
        query = query.eq("status", status.upper())
        
    if search:
        query = query.ilike("name", f"%{search}%")
        
    query = query.range(offset, offset + limit - 1)
    
    try:
        response = query.execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/agencies/{id}/approve")
def approve_agency(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get agency
        agency_res = db.table("agencies").select("*").eq("id", id).execute()
        if not agency_res.data:
            raise HTTPException(status_code=404, detail="Agency not found")
        agency = agency_res.data[0]
        
        # Approve
        import datetime
        from datetime import timezone
        
        # Generate slug
        slug = agency.get("slug")
        if not slug:
            # Slugify the name
            name = agency.get("name", "agency")
            slug = "".join(c for c in name.lower() if c.isalnum() or c.isspace()).replace(" ", "-")
            
        update_data = {
            "status": "ACTIVE",
            "slug": slug,
            "approved_at": datetime.datetime.now(timezone.utc).isoformat(),
            "approved_by": None # Will need platform_admins row, for now null or mock
        }
        
        # Check platform_admins id
        admin_res = db.table("platform_admins").select("id").eq("user_id", current_user.id).execute()
        if admin_res.data:
            update_data["approved_by"] = admin_res.data[0]["id"]
            
        update_res = db.table("agencies").update(update_data).eq("id", id).execute()
        
        # Provision Agency Head staff account if it doesn't exist
        staff_check = db.table("agency_staff").select("id").eq("agency_id", id).eq("role", "agency_head").execute()
        invite_token = None
        if not staff_check.data:
            import uuid
            invite_token = str(uuid.uuid4())
            temp_password = "TempPassword@" + str(uuid.uuid4())[:8]
            official_email = agency.get("official_email")
            
            # Create user in Supabase Auth
            auth_response = db.auth.admin.create_user({
                "email": official_email,
                "password": temp_password,
                "email_confirm": True,
                "user_metadata": {
                    "role": "agency_head",
                    "agency_id": id,
                    "invite_token": invite_token
                },
                "app_metadata": {
                    "role": "agency_head",
                    "agency_id": id
                }
            })
            
            auth_user = auth_response.user
            if auth_user:
                # Insert into agency_staff
                staff_data = {
                    "agency_id": id,
                    "user_id": auth_user.id,
                    "full_name": agency.get("name") + " Head",
                    "email": official_email,
                    "phone": agency.get("phone", ""),
                    "role": "agency_head",
                    "is_active": True,
                    "invited_at": datetime.datetime.now(timezone.utc).isoformat()
                }
                db.table("agency_staff").insert(staff_data).execute()
                print(f"[Admin] Provisioned agency head: {official_email} with invite token {invite_token}")

        # Log audit
        log_audit(
            event_type="AGENCY_APPROVED",
            event_description=f"Agency '{agency.get('name')}' approved by admin.",
            metadata={"agency_id": id, "slug": slug, "invite_token": invite_token},
            actor_id=current_user.id,
            ip_address=request.client.host
        )
        
        # Trigger actual Celery task
        try:
            from apps.api.workers.tasks_exam import send_agency_welcome_email
            send_agency_welcome_email.delay(id, agency.get("official_email"), agency.get("name"))
            if invite_token:
                # Also trigger staff invite task for the head to setup password
                from apps.api.workers.tasks_exam import send_staff_invite_email
                send_staff_invite_email.delay(agency.get("official_email"), agency.get("name") + " Head", slug, invite_token)
        except Exception as te:
            print(f"Failed to trigger welcome/invite email tasks: {te}")
        
        return update_res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/agencies/{id}/reject")
def reject_agency(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    try:
        agency_res = db.table("agencies").select("*").eq("id", id).execute()
        if not agency_res.data:
            raise HTTPException(status_code=404, detail="Agency not found")
        agency = agency_res.data[0]
        
        update_res = db.table("agencies").update({"status": "DEREGISTERED"}).eq("id", id).execute()
        
        log_audit(
            event_type="AGENCY_REJECTED",
            event_description=f"Agency '{agency.get('name')}' rejected by admin.",
            metadata={"agency_id": id},
            actor_id=current_user.id,
            ip_address=request.client.host
        )
        
        # Trigger actual Celery task
        try:
            from apps.api.workers.tasks_exam import send_agency_rejection_email
            send_agency_rejection_email.delay(id, agency.get("official_email"), "Submitted credentials did not meet verification criteria.")
        except Exception as te:
            print(f"Failed to trigger rejection email task: {te}")
            
        return update_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/agencies/{id}/suspend")
def suspend_agency(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    try:
        agency_res = db.table("agencies").select("*").eq("id", id).execute()
        if not agency_res.data:
            raise HTTPException(status_code=404, detail="Agency not found")
        agency = agency_res.data[0]
        
        update_res = db.table("agencies").update({"status": "SUSPENDED"}).eq("id", id).execute()
        
        log_audit(
            event_type="AGENCY_SUSPENDED",
            event_description=f"Agency '{agency.get('name')}' suspended by admin.",
            metadata={"agency_id": id},
            actor_id=current_user.id,
            ip_address=request.client.host
        )
        return update_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
def get_config(current_user: CurrentUser = Depends(RequireRole("platform_admin"))):
    return get_platform_config()

@router.put("/config")
def update_config(
    config_data: dict,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("platform_admin"))
):
    save_platform_config(config_data)
    log_audit(
        event_type="PLATFORM_CONFIG_UPDATED",
        event_description="Platform configuration settings updated by admin.",
        metadata=config_data,
        actor_id=current_user.id,
        ip_address=request.client.host
    )
    return {"status": "success", "config": config_data}

@router.get("/audit-logs")
def get_audit_logs(
    agency_id: Optional[str] = None,
    event_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    limit = min(limit, 100)
    offset = (page - 1) * limit
    query = db.table("audit_logs").select("*").order("occurred_at", desc=True)
    
    if agency_id:
        query = query.eq("agency_id", agency_id)
    if event_type:
        query = query.eq("event_type", event_type)
        
    query = query.range(offset, offset + limit - 1)
    
    try:
        response = query.execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_stats(
    current_user: CurrentUser = Depends(RequireRole("platform_admin")),
    db: Client = Depends(get_service_db)
):
    try:
        # Aggregation queries
        agencies_pending = db.table("agencies").select("id", count="exact").eq("status", "PENDING").execute()
        agencies_active = db.table("agencies").select("id", count="exact").eq("status", "ACTIVE").execute()
        exams_active = db.table("exams").select("id", count="exact").in_("status", ["REGISTRATION_OPEN", "ONGOING"]).execute()
        grievances_open = db.table("student_grievances").select("id", count="exact").eq("status", "OPEN").execute()
        
        return {
            "agencies_pending": agencies_pending.count or 0,
            "agencies_active": agencies_active.count or 0,
            "exams_active": exams_active.count or 0,
            "grievances_open": grievances_open.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
