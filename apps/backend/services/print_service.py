import os
import time
import hashlib
import json
import tempfile
import subprocess
import logging
from uuid import uuid4
from datetime import datetime, timezone
import io
import qrcode
import fitz
from supabase import Client
from services.vault_cache import DECRYPTED_PAPER_CACHE
from services.realtime_service import broadcast_realtime_event
from models.print import PrintJobRequest

logger = logging.getLogger(__name__)

def generate_tmc_qr(payload: dict) -> bytes:
    """
    Generate a QR code image as PNG bytes from the TMC payload.
    """
    payload_str = json.dumps(payload, sort_keys=True)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=2,
        border=1
    )
    qr.add_data(payload_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    return img_bytes.getvalue()

def watermark_and_compile_pdf(
    pdf_bytes: bytes,
    job_id: str,
    session_id: str,
    center_id: str,
    printer_id: str,
    operator_id: str,
    watermark_batch_id: str,
    copies_requested: int,
    db: Client
) -> bytes:
    """
    Watermark each page of each copy with a unique QR code in the bottom-right corner.
    Inserts all records into watermark_registry in bulk and returns the combined watermarked PDF bytes.
    """
    master_doc = fitz.open()
    registry_rows = []
    
    for copy_index in range(1, copies_requested + 1):
        copy_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = copy_doc.page_count
        
        for page_index in range(page_count):
            tmc_payload = {
                "printer_id": printer_id,
                "operator_id": operator_id,
                "center_id": center_id,
                "batch_id": watermark_batch_id,
                "timestamp_unix": int(time.time()),
                "copy_index": copy_index,
                "page_index": page_index
            }
            payload_str = json.dumps(tmc_payload, sort_keys=True)
            tmc_code_hex = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()
            
            # Generate QR code
            qr_bytes = generate_tmc_qr(tmc_payload)
            
            # Stamp QR image in bottom-right corner: 1cm (28.3pt) margins, 40pt size
            page = copy_doc[page_index]
            page_w = page.rect.width
            page_h = page.rect.height
            
            margin = 28.3
            size = 40.0
            rect = fitz.Rect(
                page_w - margin - size,
                page_h - margin - size,
                page_w - margin,
                page_h - margin
            )
            page.insert_image(rect, stream=qr_bytes)
            
            # Prepare database record
            registry_rows.append({
                "print_job_id": job_id,
                "watermark_batch_id": watermark_batch_id,
                "copy_index": copy_index,
                "page_index": page_index,
                "tmc_payload": tmc_payload,
                "tmc_code_hex": tmc_code_hex
            })
            
        # Append this watermarked copy to master doc
        master_doc.insert_pdf(copy_doc)
        copy_doc.close()
        
    # Bulk insert into watermark_registry
    db.table("watermark_registry").insert(registry_rows).execute()
    
    # Save master document in memory
    watermarked_pdf = master_doc.write()
    master_doc.close()
    
    return watermarked_pdf

def execute_spool_print(pdf_bytes: bytes, printer_id: str):
    """
    Spool the PDF bytes to the printer.
    Writes PDF to a secure NamedTemporaryFile, runs the OS print command, and deletes the file.
    """
    if printer_id == "mock" or os.getenv("MOCK_PRINTER", "false").lower() == "true":
        logger.info(f"[MOCK PRINT] Successfully spooled print job to mock printer: {printer_id}")
        return
        
    tmp = tempfile.NamedTemporaryFile(prefix="leakguard_print_", suffix=".pdf", delete=False)
    try:
        tmp.write(pdf_bytes)
        tmp.close()
        
        import platform
        current_os = platform.system().lower()
        
        if "windows" in current_os:
            cmd = [
                "powershell.exe",
                "-Command",
                f"Start-Process -FilePath '{tmp.name}' -Verb PrintTo -ArgumentList '{printer_id}' -PassThru -Wait -WindowStyle Hidden"
            ]
            logger.info(f"Executing Windows print command: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, capture_output=True)
        else:
            cmd = ["lp", "-d", printer_id, "-n", "1", tmp.name]
            logger.info(f"Executing Linux print command: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, capture_output=True)
            
    except Exception as e:
        logger.error(f"Failed to spool print job to printer {printer_id}: {str(e)}")
        raise RuntimeError(f"Printer spooling failed: {str(e)}")
    finally:
        if os.path.exists(tmp.name):
            try:
                os.remove(tmp.name)
            except Exception as remove_err:
                logger.error(f"Failed to delete secure print temporary file {tmp.name}: {str(remove_err)}")

def create_print_job(db: Client, current_user, payload: PrintJobRequest) -> dict:
    # 1. Fetch and validate print session
    session_id_str = str(payload.session_id)
    session_resp = db.table("print_sessions").select("*").eq("id", session_id_str).execute()
    if not session_resp.data:
        raise ValueError("Print session not found.")
    session = session_resp.data[0]
    
    if not session["is_active"]:
        raise ValueError("Print session is no longer active.")
        
    expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        raise ValueError("Print session has expired.")
        
    # 2. Validate center assignment
    if str(payload.center_id) not in session["authorized_centers"]:
        raise ValueError(f"Exam center {payload.center_id} is not authorized for this print session.")
        
    # 3. Validate remaining copies limit
    jobs_resp = db.table("print_jobs").select("copies_requested").eq("print_session_id", session_id_str).neq("status", "aborted").execute()
    copies_printed = sum(job["copies_requested"] for job in jobs_resp.data)
    
    if copies_printed + payload.copies_requested > session["authorized_copies"]:
        raise ValueError(
            f"Requested {payload.copies_requested} copies exceeds print limit. "
            f"Authorized: {session['authorized_copies']}, Printed: {copies_printed}, Remaining: {session['authorized_copies'] - copies_printed}."
        )
        
    # 4. Check RAM cache for paper PDF
    if session_id_str not in DECRYPTED_PAPER_CACHE:
        raise KeyError("ERR_SESSION_EXPIRED")
        
    decrypted_pdf = DECRYPTED_PAPER_CACHE[session_id_str]
    
    # 5. Insert print job with status 'queued'
    job_id = str(uuid4())
    watermark_batch_id = str(uuid4())
    job_record = {
        "id": job_id,
        "paper_id": str(payload.paper_id),
        "print_session_id": session_id_str,
        "center_id": str(payload.center_id),
        "printer_id": payload.printer_id,
        "operator_id": current_user.id,
        "copies_requested": payload.copies_requested,
        "copies_printed": 0,
        "watermark_batch_id": watermark_batch_id,
        "status": "queued"
    }
    db.table("print_jobs").insert(job_record).execute()
    
    # 6. Watermark and compile PDF in memory
    try:
        db.table("print_jobs").update({"status": "printing"}).eq("id", job_id).execute()
        
        watermarked_pdf = watermark_and_compile_pdf(
            pdf_bytes=decrypted_pdf,
            job_id=job_id,
            session_id=session_id_str,
            center_id=str(payload.center_id),
            printer_id=payload.printer_id,
            operator_id=current_user.id,
            watermark_batch_id=watermark_batch_id,
            copies_requested=payload.copies_requested,
            db=db
        )
    except Exception as e:
        db.table("print_jobs").update({
            "status": "aborted",
            "aborted_reason": f"Watermarking/registry failed: {str(e)}"
        }).eq("id", job_id).execute()
        raise e
        
    # 7. Securely spool PDF to physical OS printer spooler
    try:
        execute_spool_print(watermarked_pdf, payload.printer_id)
    except Exception as e:
        db.table("print_jobs").update({
            "status": "aborted",
            "aborted_reason": f"Spooler error: {str(e)}"
        }).eq("id", job_id).execute()
        
        audit_log = {
            "user_id": current_user.id,
            "action_type": "print_job_aborted",
            "entity_type": "print_jobs",
            "entity_id": job_id,
            "metadata": {"reason": f"Spooler error: {str(e)}", "printer_id": payload.printer_id}
        }
        db.table("audit_logs").insert(audit_log).execute()
        
        broadcast_realtime_event("print_room", "print_job_aborted", {"job_id": job_id, "reason": str(e)})
        raise e
        
    # 8. Complete print job
    now_iso = datetime.now(timezone.utc).isoformat()
    db.table("print_jobs").update({
        "status": "completed",
        "copies_printed": payload.copies_requested,
        "completed_at": now_iso
    }).eq("id", job_id).execute()
    
    # 9. Update paper status to 'printed'
    db.table("papers").update({"status": "printed"}).eq("id", str(payload.paper_id)).execute()
    
    # 10. Write system audit log
    audit_log = {
        "user_id": current_user.id,
        "action_type": "print_job_created",
        "entity_type": "print_jobs",
        "entity_id": job_id,
        "metadata": {
            "paper_id": str(payload.paper_id),
            "copies_printed": payload.copies_requested,
            "printer_id": payload.printer_id
        }
    }
    db.table("audit_logs").insert(audit_log).execute()
    
    # 11. Broadcast realtime event
    broadcast_realtime_event("print_room", "print_job_completed", {"job_id": job_id})
    
    return {
        "job_id": job_id,
        "status": "completed",
        "copies_printed": payload.copies_requested,
        "completed_at": now_iso
    }

def abort_print_job(db: Client, current_user, job_id: str, reason: str):
    # Fetch print job
    job_resp = db.table("print_jobs").select("*").eq("id", job_id).execute()
    if not job_resp.data:
        raise ValueError(f"Print job with ID {job_id} not found.")
    job = job_resp.data[0]
    
    if job["status"] not in ["queued", "printing"]:
        raise ValueError(f"Print job in status '{job['status']}' cannot be aborted.")
        
    # Auth check: must be super_admin or the print_operator who created the job
    if current_user.role != "super_admin" and job["operator_id"] != current_user.id:
        raise PermissionError("Access denied. You do not have permission to abort this print job.")
        
    # Update print job
    db.table("print_jobs").update({
        "status": "aborted",
        "aborted_reason": reason
    }).eq("id", job_id).execute()
    
    # Write audit log
    audit_log = {
        "user_id": current_user.id,
        "action_type": "print_job_aborted",
        "entity_type": "print_jobs",
        "entity_id": job_id,
        "metadata": {"reason": reason}
    }
    db.table("audit_logs").insert(audit_log).execute()
    
    # Broadcast realtime event
    broadcast_realtime_event("print_room", "print_job_aborted", {"job_id": job_id, "reason": reason})
