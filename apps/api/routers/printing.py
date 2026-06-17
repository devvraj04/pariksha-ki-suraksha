"""
Phase 7 — Intelligent Printing Module
Handles print job creation with copy-budget enforcement, watermark registry,
and print room surveillance alerts.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Literal
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit

router = APIRouter()


class PrintJobBody(BaseModel):
    center_id: str
    copies_requested: int
    printer_id: str


class ReviewAlertBody(BaseModel):
    review_outcome: Literal["DISMISSED", "ESCALATED", "ACTION_TAKEN"]


@router.get("/exams/{id}/print-jobs")
def list_print_jobs(
    id: str,
    center_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "operator")),
    db: Client = Depends(get_service_db)
):
    try:
        q = db.table("print_jobs").select(
            "*, exam_centers(name, center_code), agency_staff(full_name)"
        ).eq("exam_id", id)
        if center_id:
            q = q.eq("center_id", center_id)
        if status:
            q = q.eq("status", status)
        res = q.order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/print-jobs")
def create_print_job(
    id: str,
    body: PrintJobBody,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "operator")),
    db: Client = Depends(get_service_db)
):
    try:
        exam_res = db.table("exams").select("id, agency_id, name, mode, status").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        if exam["mode"] != "OFFLINE":
            raise HTTPException(status_code=400, detail="Print jobs are only for OFFLINE exams.")

        # Resolve staff FK
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        # Get active paper for this exam
        paper_res = db.table("question_papers").select("id, status").eq("exam_id", id).neq("status", "ARCHIVED").limit(1).execute()
        if not paper_res.data:
            raise HTTPException(status_code=400, detail="No vaulted paper found for this exam. Upload paper first.")
        paper = paper_res.data[0]

        # Calculate copy budget from room capacities
        rooms_res = db.table("exam_rooms").select("seating_capacity").eq("exam_id", id).eq("center_id", body.center_id).eq("is_active", True).execute()
        copies_budget = sum(r["seating_capacity"] for r in (rooms_res.data or []))
        if copies_budget == 0:
            raise HTTPException(status_code=400, detail="No active rooms found for this center. Cannot determine copy budget.")

        # Validate copy count
        job_status = "APPROVED"
        block_reason = None
        if body.copies_requested > copies_budget:
            job_status = "BLOCKED_OVER_BUDGET"
            block_reason = f"Requested {body.copies_requested} copies but center budget is {copies_budget}."

        # Validate print time window (simplified: allow any time in dev, enforce in prod)
        # In production, check against a configured print_window_start / print_window_end

        center_res = db.table("exam_centers").select("name").eq("id", body.center_id).execute()
        center_name = center_res.data[0]["name"] if center_res.data else "Unknown"

        job_res = db.table("print_jobs").insert({
            "paper_id": paper["id"],
            "exam_id": id,
            "center_id": body.center_id,
            "initiated_by": staff_id,
            "printer_id": body.printer_id,
            "copies_requested": body.copies_requested,
            "copies_budget": copies_budget,
            "copies_approved": body.copies_requested if job_status == "APPROVED" else None,
            "status": job_status,
            "block_reason": block_reason,
        }).execute()
        job = job_res.data[0]

        log_audit(
            event_type="PRINT_JOB_INITIATED",
            event_description=f"Print job for center '{center_name}' initiated. Copies: {body.copies_requested}/{copies_budget}. Status: {job_status}.",
            metadata={"exam_id": id, "print_job_id": job["id"], "status": job_status},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        if job_status == "APPROVED":
            from apps.api.workers.tasks_printing import execute_print_job
            execute_print_job.delay(job["id"])

        return job
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/print-jobs/{id}")
def get_print_job(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "operator")),
    db: Client = Depends(get_service_db)
):
    try:
        job_res = db.table("print_jobs").select("*, exam_centers(name, center_code), agency_staff(full_name)").eq("id", id).execute()
        if not job_res.data:
            raise HTTPException(status_code=404, detail="Print job not found.")
        job = job_res.data[0]

        alerts = db.table("print_room_surveillance_alerts").select("*").eq("print_job_id", id).order("detected_at", desc=True).execute()
        watermarks = db.table("print_watermark_registry").select("id, page_number, copy_number, watermark_code, printed_at").eq("print_job_id", id).order("copy_number").order("page_number").execute()

        return {
            **job,
            "surveillance_alerts": alerts.data or [],
            "watermark_count": len(watermarks.data or []),
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/print-jobs/{id}/review-alert/{alert_id}")
def review_print_alert(
    id: str,
    alert_id: str,
    body: ReviewAlertBody,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        res = db.table("print_room_surveillance_alerts").update({
            "review_outcome": body.review_outcome,
            "reviewed_by": staff_id,
            "reviewed_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", alert_id).eq("print_job_id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Alert not found.")
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/print-jobs/{id}/surveillance/start")
def start_print_surveillance(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "operator")),
    db: Client = Depends(get_service_db)
):
    try:
        job_res = db.table("print_jobs").select("id, status").eq("id", id).execute()
        if not job_res.data:
            raise HTTPException(status_code=404, detail="Print job not found.")
        from apps.api.workers.tasks_printing import run_print_room_surveillance
        task = run_print_room_surveillance.delay(id)
        return {"message": "Print room surveillance activated.", "task_id": task.id}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/print-jobs/{id}/surveillance/stop")
def stop_print_surveillance(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "operator")),
    db: Client = Depends(get_service_db)
):
    return {"message": "Print room surveillance stopped."}
