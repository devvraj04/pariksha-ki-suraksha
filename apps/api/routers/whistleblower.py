"""
Phase 14 — Anonymous Whistleblower Portal Router
"""
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit

router = APIRouter()


@router.post("/whistleblower/reports")
async def submit_whistleblower_report(
    request: Request,
    category: str = Form(...),
    description: str = Form(...),
    exam_id: Optional[str] = Form(None),
    location_text: Optional[str] = Form(None),
    evidence_files: List[UploadFile] = File(None),
    db: Client = Depends(get_service_db)
):
    try:
        # Validate category enum
        valid_categories = ('PAPER_LEAK', 'BRIBERY', 'IMPERSONATION', 'INVIGILATOR_MISCONDUCT', 'OTHER')
        if category not in valid_categories:
            raise HTTPException(status_code=400, detail="Invalid whistleblower category.")

        # Description length validation
        if len(description) < 10 or len(description) > 3000:
            raise HTTPException(status_code=400, detail="Description must be between 10 and 3000 characters.")

        # Process evidence files if any (max 5 files)
        evidence_paths = []
        files_to_process = evidence_files or []
        if len(files_to_process) > 5:
            raise HTTPException(status_code=400, detail="Maximum of 5 evidence files are allowed.")

        report_id = str(uuid.uuid4())

        for idx, file in enumerate(files_to_process):
            file_bytes = await file.read()
            if len(file_bytes) == 0:
                continue

            # Verify size (max 10MB per file)
            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Each evidence file must be less than 10MB.")

            # Basic extension verification to prevent uploading executable scripts
            filename = file.filename or "file"
            lower_name = filename.lower()
            if lower_name.endswith((".exe", ".bat", ".sh", ".py", ".js", ".php")):
                raise HTTPException(status_code=400, detail="File type not allowed for security reasons.")

            # Upload to evidence-uploads bucket under random path (unlinked to user)
            storage_path = f"whistleblower/{report_id}/{idx}_{filename}"
            try:
                db.storage.from_("evidence-uploads").upload(storage_path, bytes(file_bytes))
                evidence_paths.append(storage_path)
            except Exception as se:
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {se}")

        # Insert whistleblower report row
        # VERY IMPORTANT: We NEVER record IP address, device fingerprints, or user_id for anonymity.
        clean_exam_id = exam_id if (exam_id and exam_id.strip()) else None
        
        db.table("whistleblower_reports").insert({
            "id": report_id,
            "exam_id": clean_exam_id,
            "category": category,
            "description": description,
            "evidence_paths": evidence_paths if evidence_paths else None,
            "location_text": location_text,
            "routing_status": "RECEIVED"
        }).execute()

        # Log audit log: actor_id and ip_address are NULL to protect anonymity!
        log_audit(
            event_type="WHISTLEBLOWER_REPORT_SUBMITTED",
            event_description=f"Anonymous whistleblower report submitted (Report ID: {report_id}).",
            metadata={"report_id": report_id, "category": category},
            actor_id=None,
            exam_id=clean_exam_id,
            ip_address=None
        )

        # Trigger background LLM scoring task
        from apps.api.workers.tasks_whistleblower import score_whistleblower_report
        score_whistleblower_report.delay(report_id)

        # UUID is used as the tracking code
        return {"tracking_code": report_id}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/whistleblower/reports/status/{tracking_code}")
def get_whistleblower_report_status(
    tracking_code: str,
    db: Client = Depends(get_service_db)
):
    try:
        # Verify it's a valid UUID
        try:
            uuid.UUID(tracking_code)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid tracking code format.")

        res = db.table("whistleblower_reports").select("routing_status").eq("id", tracking_code).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Whistleblower report not found.")
        
        # Security: Return ONLY the status badge, never the details or files to prevent leaking content
        return {"routing_status": res.data[0]["routing_status"]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/whistleblower-reports")
def list_whistleblower_reports(
    category: Optional[str] = None,
    routing_status: Optional[str] = None,
    exam_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        limit = min(limit, 100)
        offset = (page - 1) * limit

        q = db.table("whistleblower_reports").select(
            "*, exams(name)", count="exact"
        )
        if category:
            q = q.eq("category", category)
        if routing_status:
            q = q.eq("routing_status", routing_status)
        if exam_id:
            q = q.eq("exam_id", exam_id)
            
        res = q.order("ai_risk_score", desc=True).range(offset, offset + limit - 1).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/whistleblower-reports/{id}")
def get_whistleblower_report(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("whistleblower_reports").select(
            "*, exams(name)"
        ).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Report not found.")
        report = res.data[0]

        # Generate signed URLs for evidence files
        signed_urls = []
        evidence_paths = report.get("evidence_paths") or []
        for path in evidence_paths:
            try:
                signed_url_res = db.storage.from_("evidence-uploads").create_signed_url(path, 3600)
                url = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl") or ""
                signed_urls.append(url)
            except Exception:
                pass
        report["signed_evidence_urls"] = signed_urls
        return report
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/admin/whistleblower-reports/{id}/close")
def close_whistleblower_report(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("whistleblower_reports").select("id, exam_id").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Report not found.")
        report = res.data[0]

        db.table("whistleblower_reports").update({
            "routing_status": "CLOSED"
        }).eq("id", id).execute()

        log_audit(
            event_type="WHISTLEBLOWER_REPORT_CLOSED",
            event_description=f"Platform admin closed whistleblower report {id}.",
            metadata={"report_id": id},
            actor_id=current_user.id,
            exam_id=report.get("exam_id")
        )
        return {"status": "CLOSED"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
