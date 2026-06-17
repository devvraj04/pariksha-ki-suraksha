import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from supabase import Client
from apps.api.deps import CurrentUser, RequireRole, get_service_db, get_agency_scoped_db, log_audit, get_current_user
from apps.api.core.config import settings

router = APIRouter(prefix="", tags=["Agencies & Staff"])

# Pydantic Schemas
class AgencyRegisterSchema(BaseModel):
    organization_name: str
    official_email: EmailStr
    pan_number: str
    address: str
    city: str
    state: str
    pincode: str
    phone: str

class AgencyUpdateSchema(BaseModel):
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None

class StaffCreateSchema(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    role: str # 'agency_head', 'manager', 'operator', 'transit_manager', 'center_officer', 'chief_moderator', 'moderator', 'grading_teacher'
    center_id: Optional[str] = None

class StaffUpdateSchema(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    center_id: Optional[str] = None

class AcceptInviteSchema(BaseModel):
    invite_token: str
    new_password: str


# Endpoints
@router.post("/agencies/register")
def register_agency(
    body: AgencyRegisterSchema,
    request: Request,
    db: Client = Depends(get_service_db)
):
    try:
        # Check if email or PAN already exists
        exist_res = db.table("agencies").select("id").or_(f"official_email.eq.{body.official_email},pan_number.eq.{body.pan_number}").execute()
        if exist_res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An agency with this official email or PAN identifier already exists."
            )

        # Generate custom slug
        base_slug = "".join(c for c in body.organization_name.lower() if c.isalnum() or c.isspace()).replace(" ", "-")
        slug = base_slug
        import random
        # Check slug uniqueness in DB (remediates V-016)
        slug_check = db.table("agencies").select("id").eq("slug", slug).execute()
        while slug_check.data:
            suffix = f"{random.randint(0x1000, 0xffff):x}"
            slug = f"{base_slug}-{suffix}"
            slug_check = db.table("agencies").select("id").eq("slug", slug).execute()

        # Insert PENDING agency
        agency_data = {
            "name": body.organization_name,
            "official_email": body.official_email,
            "pan_number": body.pan_number,
            "address": body.address,
            "city": body.city,
            "state": body.state,
            "pincode": body.pincode,
            "phone": body.phone,
            "status": "PENDING",
            "slug": slug
        }
        
        insert_res = db.table("agencies").insert(agency_data).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to register agency profile.")
        
        agency = insert_res.data[0]
        
        # Log Audit Trail
        log_audit(
            event_type="AGENCY_REGISTRATION_REQUESTED",
            event_description=f"New agency registration requested: '{body.organization_name}'.",
            metadata={"agency_id": agency["id"], "slug": slug},
            ip_address=request.client.host
        )
        
        return {
            "id": agency["id"],
            "status": "PENDING",
            "message": "Registration submitted successfully. The platform administrator will verify your profile."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agency/me")
def get_my_agency(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    if not current_user.agency_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user is not linked to any agency."
        )
        
    try:
        # Fetch agency profile
        agency_res = db.table("agencies").select("*").eq("id", current_user.agency_id).execute()
        if not agency_res.data:
            raise HTTPException(status_code=404, detail="Agency profile not found.")
            
        agency = agency_res.data[0]
        if agency["status"] != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Agency portal access is forbidden. Agency status: {agency['status']}"
            )

        # Fetch own staff record
        staff_res = db.table("agency_staff").select("*").eq("user_id", current_user.id).execute()
        staff_profile = staff_res.data[0] if staff_res.data else None
        
        return {
            "agency": agency,
            "profile": staff_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/agency/me")
def update_my_agency(
    body: AgencyUpdateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check active status of agency
        agency_res = db.table("agencies").select("status").eq("id", current_user.agency_id).execute()
        if not agency_res.data or agency_res.data[0]["status"] != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Agency portal is suspended or pending approval."
            )
            
        update_data = {}
        if body.address is not None:
            update_data["address"] = body.address
        if body.phone is not None:
            update_data["phone"] = body.phone
            
        # Update
        res = db.table("agencies").update(update_data).eq("id", current_user.agency_id).execute()
        
        # Log Audit
        log_audit(
            event_type="AGENCY_PROFILE_UPDATED",
            event_description="Agency profile details updated.",
            metadata=update_data,
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agency/centers")
def get_agency_centers(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    if not current_user.agency_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user is not linked to any agency."
        )
    try:
        res = db.table("exam_centers").select("*, exams(name)").eq("agency_id", current_user.agency_id).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agency/staff")
def get_agency_staff(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        query = db.table("agency_staff").select("*").eq("agency_id", current_user.agency_id)
        if role:
            query = query.eq("role", role)
        if is_active is not None:
            query = query.eq("is_active", is_active)
            
        res = query.execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agency/staff")
def invite_staff_member(
    body: StaffCreateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    # Allowed roles
    allowed_roles = [
        "agency_head", "manager", "operator", "transit_manager", 
        "center_officer", "chief_moderator", "moderator", "grading_teacher"
    ]
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid staff role option.")

    try:
        # Check if email already registered
        staff_check = db.table("agency_staff").select("id").eq("email", body.email).execute()
        if staff_check.data:
            raise HTTPException(status_code=400, detail="Email is already registered under this or another agency.")

        # Generate temporary invite parameters
        invite_token = str(uuid.uuid4())
        temp_password = "TempPassword@" + str(uuid.uuid4())[:8]

        # 1. Create User in Supabase Auth via Admin Client
        auth_response = db.auth.admin.create_user({
            "email": body.email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {
                "role": body.role,
                "agency_id": current_user.agency_id,
                "invite_token": invite_token,
                "center_id": body.center_id
            },
            "app_metadata": {
                "role": body.role,
                "agency_id": current_user.agency_id,
                "center_id": body.center_id
            }
        })
        
        auth_user = auth_response.user
        if not auth_user:
            raise HTTPException(status_code=500, detail="Failed to create auth user record.")

        # Get own staff profile ID for audit log
        inviter_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        inviter_id = inviter_res.data[0]["id"] if inviter_res.data else None

        # 2. Insert into agency_staff
        staff_data = {
            "agency_id": current_user.agency_id,
            "user_id": auth_user.id,
            "full_name": body.full_name,
            "email": body.email,
            "phone": body.phone,
            "role": body.role,
            "is_active": True,
            "invited_at": datetime.datetime.utcnow().isoformat() + "Z",
            "created_by": inviter_id,
            "center_id": body.center_id,
            "invite_token": invite_token
        }
        
        insert_res = db.table("agency_staff").insert(staff_data).execute()
        if not insert_res.data:
            # Cleanup user if database insert fails
            db.auth.admin.delete_user(auth_user.id)
            raise HTTPException(status_code=500, detail="Failed to write staff registry record.")

        # Fetch agency slug to construct invite link
        agency_res = db.table("agencies").select("slug").eq("id", current_user.agency_id).execute()
        slug = agency_res.data[0]["slug"] if agency_res.data else "portal"

        # 3. Trigger Async Invitation Mail Worker
        try:
            from apps.api.workers.tasks_exam import send_staff_invite_email
            send_staff_invite_email.delay(body.email, body.full_name, slug, invite_token)
        except Exception as te:
            print(f"Failed to queue invitation task: {te}")

        # Log Audit
        log_audit(
            event_type="STAFF_MEMBER_ADDED",
            event_description=f"Staff member '{body.full_name}' invited as '{body.role}'.",
            metadata={"invited_email": body.email, "role": body.role},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )

        response_data = {
            "status": "success",
            "message": "Staff member invited successfully."
        }
        if settings.ENVIRONMENT != "production":
            response_data["invite_token"] = invite_token
            response_data["temp_password"] = temp_password
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agency/staff/{id}")
def get_staff_member_detail(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("agency_staff").select("*").eq("id", id).eq("agency_id", current_user.agency_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Staff member record not found.")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/agency/staff/{id}")
def update_staff_member(
    id: str,
    body: StaffUpdateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get existing staff member
        staff_res = db.table("agency_staff").select("*").eq("id", id).eq("agency_id", current_user.agency_id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=404, detail="Staff member record not found.")
        staff = staff_res.data[0]

        update_data = {}
        if body.role is not None:
            update_data["role"] = body.role
        if body.is_active is not None:
            update_data["is_active"] = body.is_active
        if body.center_id is not None:
            update_data["center_id"] = body.center_id or None

        # Update SQL
        res = db.table("agency_staff").update(update_data).eq("id", id).execute()
        
        # Update user in Supabase Auth metadata
        auth_update = {
            "app_metadata": {
                "role": body.role if body.role else staff["role"],
                "agency_id": current_user.agency_id,
                "center_id": body.center_id if body.center_id is not None else staff.get("center_id")
            },
            "user_metadata": {
                "role": body.role if body.role else staff["role"],
                "center_id": body.center_id if body.center_id is not None else staff.get("center_id")
            }
        }
        
        # Suspend auth access by updating ban status or user_metadata if deactivated
        if body.is_active is False:
            # Deactivation flow
            db.auth.admin.update_user_by_id(staff["user_id"], {
                "ban_duration": "100y", # Effectively suspends login sessions in Supabase Auth
                **auth_update
            })
            
            # Trigger deactivation notification email
            try:
                from apps.api.workers.tasks_exam import send_staff_deactivation_email
                send_staff_deactivation_email.delay(staff["email"], staff["full_name"])
            except Exception as te:
                print(f"Failed to queue deactivation task: {te}")
                
            log_audit(
                event_type="STAFF_DEACTIVATED",
                event_description=f"Staff member '{staff['full_name']}' deactivated.",
                metadata={"staff_id": id},
                actor_id=current_user.id,
                agency_id=current_user.agency_id,
                ip_address=request.client.host
            )
        elif body.is_active is True:
            # Lift ban
            db.auth.admin.update_user_by_id(staff["user_id"], {
                "ban_duration": "none",
                **auth_update
            })
        elif body.role or body.center_id is not None:
            # Just role/center update
            db.auth.admin.update_user_by_id(staff["user_id"], auth_update)
            
            log_audit(
                event_type="STAFF_ROLE_UPDATED",
                event_description=f"Staff member '{staff['full_name']}' role updated to '{body.role or staff['role']}' and center to '{body.center_id}'.",
                metadata={"staff_id": id, "new_role": body.role, "center_id": body.center_id},
                actor_id=current_user.id,
                agency_id=current_user.agency_id,
                ip_address=request.client.host
            )

        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/agency/staff/{id}")
def delete_staff_member(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get staff member
        staff_res = db.table("agency_staff").select("*").eq("id", id).eq("agency_id", current_user.agency_id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=404, detail="Staff member record not found.")
        staff = staff_res.data[0]

        # Soft delete: is_active = false
        res = db.table("agency_staff").update({"is_active": False}).eq("id", id).execute()
        
        # Suspend Auth User
        db.auth.admin.update_user_by_id(staff["user_id"], {"ban_duration": "100y"})
        
        log_audit(
            event_type="STAFF_DEACTIVATED",
            event_description=f"Staff member '{staff['full_name']}' soft-deleted.",
            metadata={"staff_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        return {"status": "success", "message": "Staff member access revoked and soft-deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agency/staff/accept-invite")
def accept_staff_invitation(
    body: AcceptInviteSchema,
    db: Client = Depends(get_service_db)
):
    try:
        # Query agency_staff for the record having this invite_token directly (remediates V-009)
        staff_res = db.table("agency_staff").select("user_id, email, role").eq("invite_token", body.invite_token).execute()
        if not staff_res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token."
            )
        staff_record = staff_res.data[0]
        user_id = staff_record["user_id"]
        email = staff_record["email"]
        role = staff_record["role"]

        # Update Auth password and confirm invitation
        db.auth.admin.update_user_by_id(user_id, {
            "password": body.new_password,
            "user_metadata": {
                "invite_token": None, # clear token in auth too
                "role": role
            }
        })

        # Update joined_at in agency_staff table and clear invite_token
        db.table("agency_staff").update({
            "invite_token": None,
            "joined_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).eq("user_id", user_id).execute()

        # Log audit
        log_audit(
            event_type="STAFF_INVITATION_ACCEPTED",
            event_description=f"Staff member invitation accepted for email: '{email}'.",
            metadata={"user_id": user_id},
            ip_address="0.0.0.0" # Public route, no actor_id session yet
        )

        return {"status": "success", "message": "Password registered. You can now log into your agency portal."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
