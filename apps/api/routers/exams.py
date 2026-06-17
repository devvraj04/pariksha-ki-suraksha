import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from supabase import Client
from apps.api.deps import CurrentUser, RequireRole, get_service_db, log_audit, get_current_user

router = APIRouter(prefix="", tags=["Examinations"])

# Pydantic Schemas
class ExamCreateSchema(BaseModel):
    name: str
    slug: str
    mode: str # 'ONLINE' or 'OFFLINE'
    exam_date: str # YYYY-MM-DD
    start_time: str # HH:MM:SS
    duration_minutes: int
    fee_inr: float
    total_seats: int
    eligibility_criteria: Dict[str, Any]
    syllabus: Optional[str] = None
    visibility_score_threshold: float = 8.0

class ExamUpdateSchema(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    mode: Optional[str] = None
    exam_date: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    fee_inr: Optional[float] = None
    total_seats: Optional[int] = None
    eligibility_criteria: Optional[Dict[str, Any]] = None
    syllabus: Optional[str] = None
    visibility_score_threshold: Optional[float] = None

class CenterCreateSchema(BaseModel):
    name: str
    address: str
    city: str
    state: str
    pincode: str
    latitude: float
    longitude: float
    geofence_radius_meters: int = 100
    center_code: str
    center_officer_id: Optional[str] = None

class CenterUpdateSchema(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius_meters: Optional[int] = None
    center_officer_id: Optional[str] = None

class RoomCreateSchema(BaseModel):
    room_code: str
    seating_capacity: int
    camera_stream_url: Optional[str] = None

class RoomUpdateSchema(BaseModel):
    room_code: Optional[str] = None
    seating_capacity: Optional[int] = None
    camera_stream_url: Optional[str] = None


# Endpoints
@router.post("/exams")
def create_exam(
    body: ExamCreateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check active status of agency
        agency_res = db.table("agencies").select("status").eq("id", current_user.agency_id).execute()
        if not agency_res.data or agency_res.data[0]["status"] != "ACTIVE":
            raise HTTPException(status_code=403, detail="Agency is not active.")

        # Check staff profile ID for created_by
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        # Insert exam in DRAFT
        exam_data = {
            "agency_id": current_user.agency_id,
            "created_by": staff_id,
            "name": body.name,
            "slug": body.slug,
            "mode": body.mode.upper(),
            "exam_date": body.exam_date,
            "start_time": body.start_time,
            "duration_minutes": body.duration_minutes,
            "fee_inr": body.fee_inr,
            "total_seats": body.total_seats,
            "eligibility_criteria": body.eligibility_criteria,
            "syllabus": body.syllabus,
            "status": "DRAFT",
            "visibility_score_threshold": body.visibility_score_threshold
        }
        
        insert_res = db.table("exams").insert(exam_data).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create exam record.")
            
        exam = insert_res.data[0]
        
        # Trigger Celery Brochure task
        try:
            from apps.api.workers.tasks_exam import generate_exam_brochure
            generate_exam_brochure.delay(exam["id"])
        except Exception as te:
            print(f"Failed to queue brochure generation: {te}")
            
        log_audit(
            event_type="EXAM_CREATED",
            event_description=f"Exam '{body.name}' created in DRAFT.",
            metadata={"exam_id": exam["id"]},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        
        return exam
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams")
def list_exams(
    status: Optional[str] = None,
    mode: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        limit = min(limit, 100)
        offset = (page - 1) * limit
        
        # Build query
        query = db.table("exams").select("*")
        
        # Scope to user agency if they are staff
        if current_user.role != "platform_admin" and current_user.agency_id:
            query = query.eq("agency_id", current_user.agency_id)
            
        if status:
            query = query.eq("status", status.upper())
        if mode:
            query = query.eq("mode", mode.upper())
            
        query = query.range(offset, offset + limit - 1)
        res = query.execute()
        exams = res.data or []
        
        # Enrich exams with center count and registration count
        enriched_exams = []
        for e in exams:
            center_res = db.table("exam_centers").select("id", count="exact").eq("exam_id", e["id"]).execute()
            reg_res = db.table("exam_registrations").select("id", count="exact").eq("exam_id", e["id"]).eq("status", "REGISTERED").execute()
            
            e["center_count"] = center_res.count if center_res.count is not None else 0
            e["registration_count"] = reg_res.count if reg_res.count is not None else 0
            enriched_exams.append(e)
            
        return enriched_exams
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/by-slug/{slug}")
def get_exam_by_slug(
    slug: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("slug", slug).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
            
        exam = exam_res.data[0]
        
        # Enforce agency scope
        if current_user.role != "platform_admin" and exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this exam.")
            
        # Get Centers
        centers_res = db.table("exam_centers").select("*").eq("exam_id", exam["id"]).execute()
        centers = centers_res.data or []
        
        # Enrich centers with room lists
        for c in centers:
            rooms_res = db.table("exam_rooms").select("*").eq("center_id", c["id"]).execute()
            c["rooms"] = rooms_res.data or []
            
        exam["centers"] = centers
        return exam
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}")
def get_exam_detail(
    id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
            
        exam = exam_res.data[0]
        
        # Enforce agency scope
        if current_user.role != "platform_admin" and exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this exam.")
            
        # Get Centers
        centers_res = db.table("exam_centers").select("*").eq("exam_id", id).execute()
        centers = centers_res.data or []
        
        # Get Rooms for each center
        for c in centers:
            rooms_res = db.table("exam_rooms").select("*").eq("center_id", c["id"]).execute()
            c["rooms"] = rooms_res.data or []
            
        exam["centers"] = centers
        return exam
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/exams/{id}")
def update_exam(
    id: str,
    body: ExamUpdateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this exam.")
            
        if exam["status"] not in ["DRAFT", "PUBLISHED"]:
            raise HTTPException(status_code=400, detail="Cannot edit exam once registration or Day-of-Exam lifecycle starts.")
            
        update_data = {}
        for k, v in body.model_dump(exclude_unset=True).items():
            update_data[k] = v
            
        if not update_data:
            return exam

        # Check slug uniqueness in DB if it's changing (remediates V-019)
        if "slug" in update_data and update_data["slug"] != exam.get("slug"):
            new_slug = update_data["slug"]
            slug_check = db.table("exams").select("id").eq("slug", new_slug).neq("id", id).execute()
            if slug_check.data:
                raise HTTPException(status_code=400, detail="An examination with this slug already exists.")
            
        res = db.table("exams").update(update_data).eq("id", id).execute()
        updated_exam = res.data[0]
        
        # Re-fire brochure generation if key fields change
        brochure_trigger_keys = {"name", "exam_date", "start_time", "duration_minutes", "fee_inr", "eligibility_criteria", "syllabus"}
        if set(update_data.keys()) & brochure_trigger_keys:
            try:
                from apps.api.workers.tasks_exam import generate_exam_brochure
                generate_exam_brochure.delay(id)
            except Exception as te:
                print(f"Failed to queue brochure regeneration: {te}")
                
        return updated_exam
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/centers")
def add_center(
    id: str,
    body: CenterCreateSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("agency_id, status").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        # Generate custom unique slug for center auth and portal access
        base_slug = "".join(c for c in f"{body.name}-{body.center_code}".lower() if c.isalnum() or c.isspace() or c == "-").replace(" ", "-")
        slug = base_slug
        slug_check = db.table("exam_centers").select("id").eq("slug", slug).execute()
        while slug_check.data:
            suffix = str(uuid.uuid4())[:8]
            slug = f"{base_slug}-{suffix}"
            slug_check = db.table("exam_centers").select("id").eq("slug", slug).execute()

        center_data = {
            "exam_id": id,
            "agency_id": current_user.agency_id,
            "name": body.name,
            "slug": slug,
            "address": body.address,
            "city": body.city,
            "state": body.state,
            "pincode": body.pincode,
            "latitude": body.latitude,
            "longitude": body.longitude,
            "geofence_radius_meters": body.geofence_radius_meters,
            "center_code": body.center_code,
            "total_capacity": 0,
            "center_officer_id": body.center_officer_id,
            "is_active": True
        }
        
        res = db.table("exam_centers").insert(center_data).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/exams/{id}/centers/{center_id}")
def update_center(
    id: str,
    center_id: str,
    body: CenterUpdateSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        center_res = db.table("exam_centers").select("*").eq("id", center_id).eq("exam_id", id).execute()
        if not center_res.data:
            raise HTTPException(status_code=404, detail="Center not found under this exam.")
        center = center_res.data[0]
        
        if center["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        update_data = {}
        for k, v in body.model_dump(exclude_unset=True).items():
            update_data[k] = v
            
        if not update_data:
            return center
            
        res = db.table("exam_centers").update(update_data).eq("id", center_id).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/exams/{id}/centers/{center_id}")
def delete_center(
    id: str,
    center_id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("status").eq("id", id).execute()
        if not exam_res.data or exam_res.data[0]["status"] != "DRAFT":
            raise HTTPException(status_code=400, detail="Can only delete centers when exam is in DRAFT status.")
            
        center_res = db.table("exam_centers").select("agency_id").eq("id", center_id).eq("exam_id", id).execute()
        if not center_res.data or center_res.data[0]["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        db.table("exam_centers").delete().eq("id", center_id).execute()
        return {"status": "success", "message": "Center deleted successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/centers/{center_id}/rooms")
def add_room(
    center_id: str,
    body: RoomCreateSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        center_res = db.table("exam_centers").select("*").eq("id", center_id).execute()
        if not center_res.data:
            raise HTTPException(status_code=404, detail="Center not found.")
        center = center_res.data[0]
        
        if center["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        room_data = {
            "center_id": center_id,
            "exam_id": center["exam_id"],
            "room_code": body.room_code,
            "seating_capacity": body.seating_capacity,
            "current_occupancy": 0,
            "camera_stream_url": body.camera_stream_url,
            "is_active": True
        }
        
        res = db.table("exam_rooms").insert(room_data).execute()
        room = res.data[0]
        
        # Update center total_capacity
        new_cap = center["total_capacity"] + body.seating_capacity
        db.table("exam_centers").update({"total_capacity": new_cap}).eq("id", center_id).execute()
        
        return room
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/centers/{center_id}/rooms/{room_id}")
def update_room(
    center_id: str,
    room_id: str,
    body: RoomUpdateSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        center_res = db.table("exam_centers").select("agency_id, total_capacity").eq("id", center_id).execute()
        if not center_res.data or center_res.data[0]["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        room_res = db.table("exam_rooms").select("*").eq("id", room_id).eq("center_id", center_id).execute()
        if not room_res.data:
            raise HTTPException(status_code=404, detail="Room not found.")
        room = room_res.data[0]
        
        update_data = {}
        for k, v in body.model_dump(exclude_unset=True).items():
            update_data[k] = v
            
        if not update_data:
            return room
            
        res = db.table("exam_rooms").update(update_data).eq("id", room_id).execute()
        updated_room = res.data[0]
        
        # Recalculate center capacity if seating capacity changed
        if body.seating_capacity is not None and body.seating_capacity != room["seating_capacity"]:
            diff = body.seating_capacity - room["seating_capacity"]
            new_cap = center_res.data[0]["total_capacity"] + diff
            db.table("exam_centers").update({"total_capacity": new_cap}).eq("id", center_id).execute()
            
        return updated_room
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/centers/{center_id}/rooms/{room_id}")
def delete_room(
    center_id: str,
    room_id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        center_res = db.table("exam_centers").select("*").eq("id", center_id).execute()
        if not center_res.data or center_res.data[0]["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
        center = center_res.data[0]
        
        # Check exam state
        exam_res = db.table("exams").select("status").eq("id", center["exam_id"]).execute()
        if not exam_res.data or exam_res.data[0]["status"] != "DRAFT":
            raise HTTPException(status_code=400, detail="Can only delete rooms when exam is in DRAFT status.")
            
        room_res = db.table("exam_rooms").select("seating_capacity").eq("id", room_id).eq("center_id", center_id).execute()
        if not room_res.data:
            raise HTTPException(status_code=404, detail="Room not found.")
        cap = room_res.data[0]["seating_capacity"]
        
        db.table("exam_rooms").delete().eq("id", room_id).execute()
        
        # Decrement center capacity
        new_cap = max(0, center["total_capacity"] - cap)
        db.table("exam_centers").update({"total_capacity": new_cap}).eq("id", center_id).execute()
        
        return {"status": "success", "message": "Room deleted successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/publish")
def publish_exam(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        # Verify center and room configuration
        centers_res = db.table("exam_centers").select("id").eq("exam_id", id).execute()
        if not centers_res.data:
            raise HTTPException(status_code=400, detail="Cannot publish exam without at least one exam center.")
            
        center_ids = [c["id"] for c in centers_res.data]
        rooms_res = db.table("exam_rooms").select("id").in_("center_id", center_ids).execute()
        if not rooms_res.data:
            raise HTTPException(status_code=400, detail="Cannot publish exam. At least one exam center must contain a room allocation.")
            
        res = db.table("exams").update({"status": "PUBLISHED"}).eq("id", id).execute()
        
        log_audit(
            event_type="EXAM_PUBLISHED",
            event_description=f"Exam '{exam['name']}' status promoted from DRAFT to PUBLISHED.",
            metadata={"exam_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/open-registration")
def open_registration(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        res = db.table("exams").update({
            "status": "REGISTRATION_OPEN",
            "registration_open_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).eq("id", id).execute()
        
        log_audit(
            event_type="REGISTRATION_OPENED",
            event_description=f"Exam '{exam['name']}' registration opened to candidates.",
            metadata={"exam_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/close-registration")
def close_registration(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("*").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        res = db.table("exams").update({
            "status": "REGISTRATION_CLOSED",
            "registration_close_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).eq("id", id).execute()
        
        log_audit(
            event_type="REGISTRATION_CLOSED",
            event_description=f"Exam '{exam['name']}' registration closed.",
            metadata={"exam_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host
        )
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/allocate-centers")
def run_allocation(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Resolve the agency_staff.id for the calling user (FK in center_allocations.allocated_by)
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found for the current user.")
        staff_id = staff_res.data[0]["id"]

        # Trigger Celery center allocation task (pass staff_id, not auth user UUID)
        from apps.api.workers.tasks_exam import allocate_centers
        task = allocate_centers.delay(id, staff_id)
        return {"job_id": task.id, "status": "QUEUED"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/allocation-status")
def get_allocation_status(
    id: str,
    job_id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # ------------------------------------------------------------------
        # Always query the DB first – this is the ground truth regardless of
        # whether Celery is running with Redis or in eager/in-process mode.
        # ------------------------------------------------------------------
        total_allocated = db.table("center_allocations").select("id", count="exact").eq("exam_id", id).execute().count or 0
        total_fallback = db.table("center_allocations").select("id", count="exact").eq("exam_id", id).eq("preference_rank_matched", 0).execute().count or 0

        # ------------------------------------------------------------------
        # Best-effort: try to get the Celery task state.  In eager/no-Redis
        # mode this may raise a RuntimeWarning or return None – we handle it
        # gracefully and derive the state from the DB counts instead.
        # ------------------------------------------------------------------
        state = "SUCCESS" if total_allocated > 0 else "PENDING"
        result = None

        try:
            import warnings
            from celery.result import AsyncResult
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                res = AsyncResult(job_id)
                celery_state = res.state
                raw_result = res.result if celery_state in ["SUCCESS", "FAILURE"] else None

            # Override DB-derived state only if Celery gives us concrete info
            if celery_state in ("SUCCESS", "FAILURE", "STARTED"):
                state = celery_state

            if isinstance(raw_result, Exception):
                result = {"error": str(raw_result)}
                state = "FAILURE"
            elif isinstance(raw_result, dict) and raw_result.get("status") == "failed":
                result = raw_result
                state = "FAILURE"
            else:
                result = raw_result
        except Exception:
            # Celery backend unavailable – state already set from DB above
            pass

        return {
            "status": state,
            "allocated_count": total_allocated,
            "fallback_count": total_fallback,
            "unallocated_count": 0,
            "result": result
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/allocations")
def get_exam_allocations(
    id: str,
    page: int = 1,
    limit: int = 50,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        limit = min(limit, 100)
        offset = (page - 1) * limit
        res = db.table("center_allocations").select("*, students(*), exam_centers(*)").eq("exam_id", id).range(offset, offset + limit - 1).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/generate-admit-cards")
def run_generate_admit_cards(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check that all registered candidates have center allocations
        regs = db.table("exam_registrations").select("id", count="exact").eq("exam_id", id).eq("status", "REGISTERED").execute()
        allocs = db.table("center_allocations").select("id", count="exact").eq("exam_id", id).execute()
        
        if (regs.count or 0) > (allocs.count or 0):
            raise HTTPException(status_code=400, detail="Cannot generate admit cards. Some registered candidates are missing center allocations.")
            
        from apps.api.workers.tasks_exam import generate_admit_cards
        task = generate_admit_cards.delay(id)
        return {"job_id": task.id, "status": "QUEUED"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/admit-cards-status")
def get_admit_cards_status(
    id: str,
    job_id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        from celery.result import AsyncResult
        res = AsyncResult(job_id)
        state = res.state
        
        total_count = db.table("center_allocations").select("id", count="exact").eq("exam_id", id).execute().count or 0
        generated_count = db.table("admit_cards").select("id", count="exact").eq("exam_id", id).execute().count or 0
        
        return {
            "status": state,
            "generated_count": generated_count,
            "total_count": total_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/regenerate-brochure")
def regenerate_brochure(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        from apps.api.workers.tasks_exam import generate_exam_brochure
        task = generate_exam_brochure.delay(id)
        return {"job_id": task.id, "status": "QUEUED"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/brochure-status")
def get_brochure_status(
    id: str,
    job_id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        from celery.result import AsyncResult
        res = AsyncResult(job_id)
        return {
            "status": res.state,
            "result": res.result if res.state in ["SUCCESS", "FAILURE"] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
