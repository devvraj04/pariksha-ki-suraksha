"""
Phase 15 — Student Grievance System & Auto-CCTV Attachment Router
"""
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit

router = APIRouter()

class ResolveGrievanceSchema(BaseModel):
    resolution_notes: str
    outcome: str # RESOLVED or REJECTED

class AssignGrievanceSchema(BaseModel):
    assigned_to: str # staff_id


@router.post("/exams/{examId}/grievances")
async def file_student_grievance(
    examId: str,
    request: Request,
    category: str = Form(...),
    description: str = Form(...),
    evidence_files: List[UploadFile] = File(None),
    current_user: CurrentUser = Depends(RequireRole("student")),
    db: Client = Depends(get_service_db)
):
    try:
        # Validate student profile
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        # 1. Validate student appeared for exam
        checkin_res = db.table("checkin_events").select("id").eq("student_id", student_id).eq("exam_id", examId).execute()
        if not checkin_res.data:
            raise HTTPException(status_code=400, detail="Student was marked absent. Grievances can only be filed by candidates who appeared for the exam.")

        # Resolve registration record
        reg_res = db.table("exam_registrations").select("id").eq("student_id", student_id).eq("exam_id", examId).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Exam registration not found.")
        registration_id = reg_res.data[0]["id"]

        # Validate category enum
        valid_cats = ('ANSWER_KEY_DISPUTE', 'QUESTION_PAPER_ERROR', 'CENTER_MISCONDUCT', 'PEER_CHEATING', 'CBT_TECHNICAL_ISSUE', 'MISPRINTED_PAPER', 'UNFAIR_EVALUATION', 'OTHER')
        if category not in valid_cats:
            raise HTTPException(status_code=400, detail="Invalid grievance category.")

        grievance_id = str(uuid.uuid4())

        # Process student files if any
        evidence_paths = []
        files_to_process = evidence_files or []
        if len(files_to_process) > 5:
            raise HTTPException(status_code=400, detail="Maximum of 5 evidence files are allowed.")

        for idx, file in enumerate(files_to_process):
            file_bytes = await file.read()
            if len(file_bytes) == 0:
                continue

            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Each evidence file must be less than 10MB.")

            filename = file.filename or "file"
            storage_path = f"grievances/{grievance_id}/{idx}_{filename}"
            try:
                db.storage.from_("evidence-uploads").upload(storage_path, bytes(file_bytes))
                evidence_paths.append(storage_path)
            except Exception as se:
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {se}")

        # Auto-assignment: Find first manager staff under this agency
        # Lookup agency of the exam
        exam_res = db.table("exams").select("agency_id").eq("id", examId).execute()
        agency_id = exam_res.data[0]["agency_id"] if exam_res.data else None
        
        manager_id = None
        if agency_id:
            managers = db.table("agency_staff").select("id").eq("agency_id", agency_id).eq("role", "manager").eq("is_active", True).execute()
            if managers.data:
                manager_id = managers.data[0]["id"]

        # Insert grievance
        g_res = db.table("student_grievances").insert({
            "id": grievance_id,
            "student_id": student_id,
            "exam_id": examId,
            "registration_id": registration_id,
            "category": category,
            "description": description,
            "evidence_paths": evidence_paths if evidence_paths else None,
            "priority": "HIGH",
            "status": "OPEN",
            "assigned_to": manager_id,
            "auto_cctv_attached": False
        }).execute()

        log_audit(
            event_type="GRIEVANCE_FILED",
            event_description=f"Candidate filed high-priority grievance {grievance_id} for exam {examId}.",
            metadata={"grievance_id": grievance_id, "category": category},
            actor_id=student_id,
            exam_id=examId,
            ip_address=request.client.host if request.client else None
        )

        # Trigger background CCTV clip pulling task
        from apps.api.workers.tasks_grievance import pull_cctv_for_grievance, send_grievance_filed_notification
        pull_cctv_for_grievance.delay(student_id, examId, grievance_id)
        
        # Fire email notification task
        send_grievance_filed_notification.delay(grievance_id)

        return {"grievance_id": grievance_id, "message": "Grievance filed successfully. Automated CCTV attachment in progress."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/me/grievances")
def list_student_grievances(
    current_user: CurrentUser = Depends(RequireRole("student")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student ID
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        res = db.table("student_grievances").select(
            "*, exams(name)"
        ).eq("student_id", student_id).order("submitted_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/me/grievances/{id}")
def get_student_grievance(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("student")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student ID
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        res = db.table("student_grievances").select(
            "*, exams(name)"
        ).eq("id", id).eq("student_id", student_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Grievance not found or unauthorized.")
        
        # Security: Never return CCTV attachment paths to the student
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{examId}/grievances")
def list_agency_grievances(
    examId: str,
    category: Optional[str] = None,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        q = db.table("student_grievances").select(
            "*, students(full_name), exam_registrations(application_number)"
        ).eq("exam_id", examId)
        if category:
            q = q.eq("category", category)
        if status:
            q = q.eq("status", status)

        res = q.order("submitted_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{examId}/grievances/{id}")
def get_agency_grievance_detail(
    examId: str,
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("student_grievances").select(
            "*, students(full_name), exam_registrations(application_number)"
        ).eq("id", id).eq("exam_id", examId).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Grievance not found.")
        grievance = res.data[0]

        # Generate signed URLs for student-uploaded files
        signed_urls = []
        evidence_paths = grievance.get("evidence_paths") or []
        for path in evidence_paths:
            try:
                signed_url_res = db.storage.from_("evidence-uploads").create_signed_url(path, 3600)
                url = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl") or ""
                signed_urls.append(url)
            except Exception:
                pass
        grievance["signed_evidence_urls"] = signed_urls

        # Get CCTV clip details if attached
        cctv_res = db.table("grievance_cctv_attachments").select("*").eq("grievance_id", id).execute()
        if cctv_res.data:
            cctv = cctv_res.data[0]
            # Generate signed URL for CCTV clip
            try:
                signed_cctv = db.storage.from_("cctv-clips").create_signed_url(cctv["footage_path"], 3600)
                cctv["signed_footage_url"] = signed_cctv.get("signedURL") or signed_cctv.get("signedUrl") or ""
            except Exception:
                cctv["signed_footage_url"] = ""
            grievance["cctv_attachment"] = cctv
        else:
            grievance["cctv_attachment"] = None

        return grievance
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/grievances/{id}/assign")
def assign_grievance(
    id: str,
    body: AssignGrievanceSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("student_grievances").select("id, exam_id").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Grievance not found.")
        g = res.data[0]

        # Verify manager exists
        m_res = db.table("agency_staff").select("id").eq("id", body.assigned_to).execute()
        if not m_res.data:
            raise HTTPException(status_code=404, detail="Assigned staff not found.")

        db.table("student_grievances").update({
            "assigned_to": body.assigned_to,
            "status": "UNDER_REVIEW"
        }).eq("id", id).execute()

        log_audit(
            event_type="GRIEVANCE_ASSIGNED",
            event_description=f"Grievance {id} assigned to staff member {body.assigned_to}.",
            metadata={"grievance_id": id, "assigned_to": body.assigned_to},
            actor_id=current_user.id,
            exam_id=g["exam_id"]
        )

        return {"status": "UNDER_REVIEW"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/grievances/{id}/resolve")
def resolve_grievance(
    id: str,
    body: ResolveGrievanceSchema,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        if body.outcome not in ("RESOLVED", "REJECTED"):
            raise HTTPException(status_code=400, detail="Invalid outcome. Must be RESOLVED or REJECTED.")

        res = db.table("student_grievances").select("id, exam_id").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Grievance not found.")
        g = res.data[0]

        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        db.table("student_grievances").update({
            "status": body.outcome,
            "resolution_notes": body.resolution_notes,
            "resolved_at": now_str
        }).eq("id", id).execute()

        log_audit(
            event_type="GRIEVANCE_RESOLVED",
            event_description=f"Grievance {id} marked {body.outcome}. Resolution: {body.resolution_notes[:100]}",
            metadata={"grievance_id": id, "outcome": body.outcome},
            actor_id=current_user.id,
            exam_id=g["exam_id"]
        )

        # Trigger notification
        from apps.api.workers.tasks_grievance import send_grievance_resolution_notification
        send_grievance_resolution_notification.delay(id)

        return {"status": body.outcome}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
