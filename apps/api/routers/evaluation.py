"""
Phase 11 — Multi-Tier Anonymized Evaluation Router
"""
import hashlib
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit
from apps.api.core.config import settings

router = APIRouter()

def get_anonymized_code(upload_id: str) -> str:
    salt = settings.SUPABASE_SERVICE_ROLE_KEY or "default_salt"
    msg = f"{upload_id}:{salt}"
    return hashlib.sha256(msg.encode("utf-8")).hexdigest()[:12].upper()

class AssignmentCreateSchema(BaseModel):
    evaluator_id: str
    role: str
    upload_ids: List[str]

class SubmitMarksSchema(BaseModel):
    assignment_id: str
    upload_id: str
    marks_awarded: float
    max_marks: float
    subject_breakdown: Optional[dict] = None
    remarks: Optional[str] = None

class DiscrepancyResolveSchema(BaseModel):
    final_marks: float
    remarks: Optional[str] = None


@router.post("/exams/{id}/evaluation/anonymize")
def anonymize_evaluation(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Count sealed answer sheets for this exam
        res = db.table("answer_sheet_uploads").select("id").eq("exam_id", id).eq("upload_status", "SEALED").execute()
        total_sheets = len(res.data or [])
        # Group into mock batches of 10
        batches_ready = (total_sheets + 9) // 10

        log_audit(
            event_type="EVALUATION_ANONYMIZED",
            event_description=f"Evaluation anonymization executed. {total_sheets} sheets ready in {batches_ready} batches.",
            metadata={"exam_id": id, "total_sheets": total_sheets, "batches": batches_ready},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )
        return {"total_sheets": total_sheets, "batches_ready": batches_ready}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/evaluation/assignments")
def create_evaluation_assignment(
    id: str,
    body: AssignmentCreateSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get assigning staff ID
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        # Validate evaluator exists
        evaluator_res = db.table("agency_staff").select("id, role").eq("id", body.evaluator_id).execute()
        if not evaluator_res.data:
            raise HTTPException(status_code=404, detail="Evaluator profile not found.")
        evaluator = evaluator_res.data[0]

        # Generate a batch code
        batch_code = "BATCH-" + hashlib.md5(f"{id}:{body.evaluator_id}:{datetime.datetime.utcnow().timestamp()}".encode()).hexdigest()[:8].upper()

        # Insert evaluator assignment
        assign_res = db.table("evaluator_assignments").insert({
            "exam_id": id,
            "evaluator_id": body.evaluator_id,
            "role": body.role,
            "batch_code": batch_code,
            "upload_ids": body.upload_ids,
            "assigned_by": staff_id,
        }).execute()
        
        assignment = assign_res.data[0]

        log_audit(
            event_type="EVALUATION_ASSIGNMENT_CREATED",
            event_description=f"Batch {batch_code} assigned to evaluator {body.evaluator_id}.",
            metadata={"exam_id": id, "assignment_id": assignment["id"], "batch_code": batch_code},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        # Trigger background mail/notification task
        from apps.api.workers.tasks_evaluation import send_evaluator_assignment_email
        send_evaluator_assignment_email.delay(assignment["id"])

        return assignment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/evaluation/assignments")
def list_exam_assignments(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "chief_moderator")),
    db: Client = Depends(get_service_db)
):
    try:
        # Load assignments with evaluator staff details
        res = db.table("evaluator_assignments").select(
            "*, evaluator:agency_staff(full_name, email, role)"
        ).eq("exam_id", id).order("assigned_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/evaluation/assignments/me")
def list_my_assignments(
    current_user: CurrentUser = Depends(RequireRole("grading_teacher", "moderator", "chief_moderator", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        res = db.table("evaluator_assignments").select("*").eq("evaluator_id", staff_id).order("assigned_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/evaluation/assignments/{id}/papers")
def get_assignment_papers(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("grading_teacher", "moderator", "chief_moderator", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        assignment_res = db.table("evaluator_assignments").select("*").eq("id", id).execute()
        if not assignment_res.data:
            raise HTTPException(status_code=404, detail="Assignment not found.")
        assignment = assignment_res.data[0]

        # Verify caller is the assigned evaluator
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        if assignment["evaluator_id"] != staff_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this assignment.")

        # Check if access is revoked
        if assignment["access_revoked_at"]:
            raise HTTPException(status_code=403, detail="Access to this assignment has been revoked (assignment completed).")

        papers = []
        for upload_id in assignment["upload_ids"]:
            upload_res = db.table("answer_sheet_uploads").select("*").eq("id", upload_id).execute()
            if upload_res.data:
                upload = upload_res.data[0]
                # Generate signed URL
                try:
                    signed_url_res = db.storage.from_("answer-sheet-uploads").create_signed_url(upload["encrypted_pdf_path"], 3600)
                    signed_url = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl") or ""
                except Exception:
                    signed_url = ""
                
                papers.append({
                    "upload_id": upload["id"],
                    "anonymized_code": get_anonymized_code(upload["id"]),
                    "total_pages": upload["total_pages"],
                    "signed_url": signed_url
                })
        return papers
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluation/marks")
def submit_marks(
    body: SubmitMarksSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("grading_teacher", "moderator", "chief_moderator")),
    db: Client = Depends(get_service_db)
):
    try:
        # Fetch assignment
        assignment_res = db.table("evaluator_assignments").select("*").eq("id", body.assignment_id).execute()
        if not assignment_res.data:
            raise HTTPException(status_code=404, detail="Assignment not found.")
        assignment = assignment_res.data[0]

        # Verify evaluator
        staff_res = db.table("agency_staff").select("id, role").eq("user_id", current_user.id).execute()
        if not staff_res.data or staff_res.data[0]["id"] != assignment["evaluator_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to submit marks for this assignment.")
        staff = staff_res.data[0]

        if assignment["access_revoked_at"] or assignment["status"] == "COMPLETED":
            raise HTTPException(status_code=403, detail="Access revoked or assignment already completed.")

        if body.upload_id not in assignment["upload_ids"]:
            raise HTTPException(status_code=400, detail="Answer sheet is not part of this assignment.")

        # Get details from answer_sheet_uploads
        upload_res = db.table("answer_sheet_uploads").select("*").eq("id", body.upload_id).execute()
        if not upload_res.data:
            raise HTTPException(status_code=404, detail="Answer sheet not found.")
        upload = upload_res.data[0]

        role_tier_map = {
            "grading_teacher": 1,
            "moderator": 2,
            "chief_moderator": 3
        }
        tier = role_tier_map.get(assignment["role"], 1)

        # Check if already submitted for this assignment + upload_id to avoid duplicate rows
        existing_marks = db.table("evaluation_marks")\
            .select("id")\
            .eq("assignment_id", body.assignment_id)\
            .eq("upload_id", body.upload_id)\
            .execute()
        
        marks_data = {
            "exam_id": upload["exam_id"],
            "student_id": upload["student_id"],
            "upload_id": body.upload_id,
            "center_uid": upload["center_id"],
            "evaluator_id": staff["id"],
            "assignment_id": body.assignment_id,
            "evaluation_tier": tier,
            "marks_awarded": body.marks_awarded,
            "max_marks": body.max_marks,
            "subject_breakdown": body.subject_breakdown,
            "remarks": body.remarks
        }

        if existing_marks.data:
            marks_res = db.table("evaluation_marks").update(marks_data).eq("id", existing_marks.data[0]["id"]).execute()
        else:
            marks_res = db.table("evaluation_marks").insert(marks_data).execute()

        log_audit(
            event_type="MARKS_SUBMITTED",
            event_description=f"Marks submitted for paper {body.upload_id} in assignment {body.assignment_id}.",
            metadata={"assignment_id": body.assignment_id, "upload_id": body.upload_id, "marks": body.marks_awarded},
            actor_id=current_user.id,
            exam_id=upload["exam_id"],
            ip_address=request.client.host if request.client else None
        )
        return marks_res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluation/assignments/{id}/complete")
def complete_assignment(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("grading_teacher", "moderator", "chief_moderator")),
    db: Client = Depends(get_service_db)
):
    try:
        assignment_res = db.table("evaluator_assignments").select("*").eq("id", id).execute()
        if not assignment_res.data:
            raise HTTPException(status_code=404, detail="Assignment not found.")
        assignment = assignment_res.data[0]

        # Verify evaluator
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data or staff_res.data[0]["id"] != assignment["evaluator_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to complete this assignment.")

        if assignment["status"] == "COMPLETED" or assignment["access_revoked_at"]:
            raise HTTPException(status_code=400, detail="Assignment is already completed.")

        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        db.table("evaluator_assignments").update({
            "status": "COMPLETED",
            "completed_at": now_str,
            "access_revoked_at": now_str
        }).eq("id", id).execute()

        log_audit(
            event_type="EVALUATION_ACCESS_REVOKED",
            event_description=f"Evaluator completed assignment {id}. Access revoked.",
            metadata={"assignment_id": id},
            actor_id=current_user.id,
            exam_id=assignment["exam_id"],
            ip_address=request.client.host if request.client else None
        )

        # If moderator completes, run auto-comparison
        if assignment["role"] == "moderator":
            from apps.api.workers.tasks_evaluation import run_tier_comparison
            run_tier_comparison.delay(assignment["exam_id"], id)

        # Fire background completion notification
        from apps.api.workers.tasks_evaluation import send_evaluation_completion_notification
        send_evaluation_completion_notification.delay(id)

        return {"status": "COMPLETED", "message": "Assignment marked as completed. Access revoked."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/evaluation/discrepancies")
def list_discrepancies(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("chief_moderator", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Return discrepancies with Tier 1 and Tier 2 marks loaded
        res = db.table("evaluation_discrepancies").select(
            "*, answer_sheet_uploads(total_pages)"
        ).eq("exam_id", id).execute()
        
        data = res.data or []
        # Hydrate marks data manual join if needed
        hydrated = []
        for d in data:
            t1_res = db.table("evaluation_marks").select("*").eq("id", d["tier1_marks_id"]).execute()
            t2_res = db.table("evaluation_marks").select("*").eq("id", d["tier2_marks_id"]).execute()
            final_res = db.table("evaluation_marks").select("*").eq("id", d["final_marks_id"]).execute() if d.get("final_marks_id") else None
            hydrated.append({
                **d,
                "anonymized_code": get_anonymized_code(d["upload_id"]),
                "tier1_marks": t1_res.data[0] if t1_res.data else None,
                "tier2_marks": t2_res.data[0] if t2_res.data else None,
                "final_marks": final_res.data[0] if final_res and final_res.data else None
            })
        return hydrated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluation/discrepancies/{id}/resolve")
def resolve_discrepancy(
    id: str,
    body: DiscrepancyResolveSchema,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("chief_moderator", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        disc_res = db.table("evaluation_discrepancies").select("*").eq("id", id).execute()
        if not disc_res.data:
            raise HTTPException(status_code=404, detail="Discrepancy not found.")
        discrepancy = disc_res.data[0]

        if discrepancy["status"] == "RESOLVED":
            raise HTTPException(status_code=400, detail="Discrepancy is already resolved.")

        # Create Tier 3 marks record (Chief Moderator)
        # Fetch matching Tier 2 marks to copy assignment and max_marks/subject_breakdown if needed
        t2_res = db.table("evaluation_marks").select("*").eq("id", discrepancy["tier2_marks_id"]).execute()
        if not t2_res.data:
            raise HTTPException(status_code=500, detail="Tier 2 marks not found for comparison.")
        t2_marks = t2_res.data[0]

        marks_res = db.table("evaluation_marks").insert({
            "exam_id": discrepancy["exam_id"],
            "student_id": discrepancy["student_id"],
            "upload_id": discrepancy["upload_id"],
            "center_uid": t2_marks["center_uid"],
            "evaluator_id": staff_id,
            "assignment_id": t2_marks["assignment_id"],
            "evaluation_tier": 3,
            "marks_awarded": body.final_marks,
            "max_marks": t2_marks["max_marks"],
            "remarks": body.remarks or "Resolved by Chief Moderator"
        }).execute()
        final_marks_record = marks_res.data[0]

        # Update discrepancy row
        db.table("evaluation_discrepancies").update({
            "status": "RESOLVED",
            "resolved_by": staff_id,
            "final_marks_id": final_marks_record["id"],
            "resolved_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).eq("id", id).execute()

        log_audit(
            event_type="DISCREPANCY_RESOLVED",
            event_description=f"Discrepancy {id} resolved with final marks {body.final_marks}.",
            metadata={"discrepancy_id": id, "final_marks": body.final_marks},
            actor_id=current_user.id,
            exam_id=discrepancy["exam_id"],
            ip_address=request.client.host if request.client else None
        )

        return {"status": "RESOLVED", "final_marks_id": final_marks_record["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/evaluation/approve")
def approve_evaluation(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("chief_moderator", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Verify no open discrepancies remain
        open_res = db.table("evaluation_discrepancies").select("id", count="exact").eq("exam_id", id).eq("status", "OPEN").execute()
        if (open_res.count or 0) > 0:
            raise HTTPException(status_code=400, detail=f"{open_res.count} open discrepancies must be resolved before approval.")

        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        db.table("exams").update({
            "evaluation_approved_at": now_str
        }).eq("id", id).execute()

        log_audit(
            event_type="EVALUATION_APPROVED",
            event_description=f"Chief moderator approved evaluation results for exam {id}.",
            metadata={"exam_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        return {"status": "APPROVED", "message": "Evaluation batch approved successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
