"""
Phase 13 — Leak Investigation Engine (Agent 7) Router
"""
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import Response
from typing import Optional, List
from pydantic import BaseModel
from supabase import Client
from fpdf import FPDF
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit
from apps.api.core.security import decode_token_claims

router = APIRouter()

def get_optional_user_id(request: Request, db: Client) -> Optional[str]:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    claims = decode_token_claims(token)
    if not claims:
        return None
    user_uid = claims.get("sub")
    if not user_uid:
        return None
    # Lookup staff record
    staff_res = db.table("agency_staff").select("id").eq("user_id", user_uid).execute()
    if staff_res.data:
        return staff_res.data[0]["id"]
    return None


@router.post("/leaks/report")
async def report_leak(
    request: Request,
    file: UploadFile = File(...),
    exam_id: Optional[str] = Form(None),
    source_type: str = Form(...),
    description: str = Form(...),
    db: Client = Depends(get_service_db)
):
    try:
        # Validate source_type enum
        if source_type not in ("INTERNAL", "WHISTLEBLOWER", "PUBLIC_MEDIA"):
            raise HTTPException(status_code=400, detail="Invalid source type. Must be INTERNAL, WHISTLEBLOWER, or PUBLIC_MEDIA.")

        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # File type validation: JPEG or PNG magic bytes
        is_jpeg = image_bytes.startswith(b"\xff\xd8\xff")
        is_png = image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        if not (is_jpeg or is_png):
            raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed.")

        # File size limit (10MB)
        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")

        report_id = str(uuid.uuid4())
        
        # Save image to evidence-uploads bucket
        ext = "png" if is_png else "jpg"
        storage_path = f"leaks/{report_id}/leak_image.{ext}"
        try:
            db.storage.from_("evidence-uploads").upload(storage_path, bytes(image_bytes), {"content-type": f"image/{ext}"})
        except Exception:
            try:
                db.storage.from_("evidence-uploads").update(storage_path, bytes(image_bytes), {"content-type": f"image/{ext}"})
            except Exception as se:
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {se}")

        reported_by_id = get_optional_user_id(request, db)

        # Insert leak report row
        # Clean empty exam_id string
        clean_exam_id = exam_id if (exam_id and exam_id.strip()) else None
        
        report_res = db.table("leak_reports").insert({
            "id": report_id,
            "exam_id": clean_exam_id,
            "reported_by": reported_by_id,
            "source_type": source_type,
            "uploaded_image_path": storage_path,
            "investigation_status": "RECEIVED"
        }).execute()

        report = report_res.data[0]

        log_audit(
            event_type="LEAK_REPORTED",
            event_description=f"Suspected leak reported (Report ID: {report_id}). Source: {source_type}.",
            metadata={"report_id": report_id, "exam_id": clean_exam_id},
            actor_id=reported_by_id,
            exam_id=clean_exam_id,
            ip_address=request.client.host if request.client else None
        )

        # Fire background leak investigation task
        from apps.api.workers.tasks_leaks import run_leak_investigation
        run_leak_investigation.delay(report_id)

        return {"report_id": report_id}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaks/reports")
def list_leak_reports(
    exam_id: Optional[str] = None,
    investigation_status: Optional[str] = None,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        q = db.table("leak_reports").select(
            "*, exams(name), reporter:agency_staff!reported_by(full_name)"
        )
        if exam_id:
            q = q.eq("exam_id", exam_id)
        if investigation_status:
            q = q.eq("investigation_status", investigation_status)
            
        res = q.order("reported_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaks/reports/{id}")
def get_leak_report(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("leak_reports").select(
            "*, exams(name), reporter:agency_staff!reported_by(full_name), extracted_operator:agency_staff!extracted_operator_id(full_name)"
        ).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Leak report not found.")
        report = res.data[0]

        # Get signed URL for leak image
        try:
            signed_url_res = db.storage.from_("evidence-uploads").create_signed_url(report["uploaded_image_path"], 3600)
            report["signed_url"] = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl") or ""
        except Exception:
            report["signed_url"] = ""

        return report
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leaks/reports/{id}/evidence")
def download_leak_evidence(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("leak_reports").select(
            "*, exams(name), reporter:agency_staff!reported_by(full_name), extracted_operator:agency_staff!extracted_operator_id(full_name)"
        ).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Leak report not found.")
        report = res.data[0]

        # Compile PDF evidence package using FPDF
        pdf = FPDF()
        pdf.add_page()

        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "PARIKSHASETU AI SECURE SYSTEMS", border=0, ln=1, align="C")
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "LEAK EVIDENCE PACKAGE & INVESTIGATION REPORT", border=0, ln=1, align="C")
        pdf.line(10, 28, 200, 28)
        pdf.ln(10)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Report ID:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report["id"]), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Report Date:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report["reported_at"]), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Exam Name:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report.get("exams", {}).get("name") or "Unspecified Exam"), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Status:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report["investigation_status"]), ln=1)
        pdf.ln(5)

        # Watermark details
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Extracted Watermark Metadata", ln=1)
        pdf.line(10, pdf.get_y(), 100, pdf.get_y())
        pdf.ln(2)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Watermark String:")
        pdf.set_font("Courier", "", 10)
        pdf.cell(0, 6, str(report["watermark_extracted"] or "NONE EXTRACTED"), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Center Code:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report["extracted_center_code"] or "N/A"), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Printer ID:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, str(report["extracted_printer_id"] or "N/A"), ln=1)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, "Operator Name:")
        pdf.set_font("Helvetica", "", 10)
        operator_name = report.get("extracted_operator", {}).get("full_name") if report.get("extracted_operator") else None
        pdf.cell(0, 6, str(operator_name or "N/A"), ln=1)
        pdf.ln(5)

        # Suspect lists
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Leak Source Attribution Probability List", ln=1)
        pdf.line(10, pdf.get_y(), 100, pdf.get_y())
        pdf.ln(2)

        prob_report = report.get("probability_report") or {}
        suspects = prob_report.get("suspects", [])
        if suspects:
            for s in suspects:
                pdf.set_font("Helvetica", "B", 10)
                pdf.cell(0, 6, f"Suspect: {s.get('name')} (Role: {s.get('role', 'N/A')}) - Probability: {s.get('probability') * 100:.1f}%", ln=1)
                pdf.set_font("Helvetica", "", 9)
                pdf.cell(10)
                evidence_items = s.get("evidence", [])
                evidence_text = "; ".join(evidence_items) if evidence_items else "No supporting evidence"
                pdf.multi_cell(0, 5, f"Evidence: {evidence_text}")
                pdf.ln(2)
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, "No suspects attributed in probability model.", ln=1)

        pdf_bytes = bytes(pdf.output(dest='S'))

        headers = {
            "Content-Disposition": f"attachment; filename=leak_evidence_{id}.pdf"
        }
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
