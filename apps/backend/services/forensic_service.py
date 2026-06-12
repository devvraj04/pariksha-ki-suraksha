import hashlib
import logging
import os
from uuid import uuid4
from typing import Optional
from supabase import Client

logger = logging.getLogger(__name__)

IP_HASH_SALT = os.getenv("IP_HASH_SALT", "default-insecure-salt")


def upload_forensic_image(
    db: Client,
    file_bytes: bytes,
    original_filename: str,
    description: Optional[str],
    client_ip: str
) -> dict:
    """
    Handles a public forensic image upload:
      1. Hash the client IP (never store raw IP).
      2. Upload image to Supabase Storage.
      3. Insert forensic_uploads row with status='processing'.
      4. Write audit log.
      5. Return job_id and status.
    """
    # 1. Hash client IP with SHA-256
    salt_encoded = IP_HASH_SALT.encode('utf-8')
    ip_encoded = client_ip.encode('utf-8')
    ip_hash = hashlib.sha256(salt_encoded + ip_encoded).hexdigest()

    # 2. Upload to Supabase Storage
    upload_id = str(uuid4())
    storage_path = f"{upload_id}.jpg"

    try:
        # Determine content type from filename
        content_type = "image/jpeg"
        if original_filename and original_filename.lower().endswith(".png"):
            content_type = "image/png"
            storage_path = f"{upload_id}.png"

        db.storage.from_("forensic-uploads").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type}
        )
    except Exception as e:
        logger.error(f"Failed to upload forensic image to storage: {e}")
        raise RuntimeError(f"Storage upload failed: {str(e)}")

    # 3. Insert forensic_uploads row
    upload_record = {
        "id": upload_id,
        "storage_path": storage_path,
        "file_size_bytes": len(file_bytes),
        "original_filename": original_filename,
        "description": description,
        "uploader_ip_hash": ip_hash,
        "status": "processing"
    }
    db.table("forensic_uploads").insert(upload_record).execute()

    # 4. Write audit log
    db.table("audit_logs").insert({
        "action_type": "forensic_upload",
        "entity_type": "forensic_uploads",
        "entity_id": upload_id,
        "metadata": {
            "original_filename": original_filename,
            "file_size_bytes": len(file_bytes),
            "ip_hash_prefix": ip_hash[:8]
        }
    }).execute()

    # 5. Return job info
    return {
        "job_id": upload_id,
        "status": "processing",
        "estimated_seconds": 15
    }


def get_forensic_status(db: Client, job_id: str) -> dict:
    """
    Fetch the status of a forensic upload job.
    If completed, join with forensic_reports to return the full report.
    """
    # Query forensic_uploads
    upload_resp = db.table("forensic_uploads").select("*").eq("id", job_id).execute()
    if not upload_resp.data:
        return None

    upload = upload_resp.data[0]
    status = upload["status"]

    result = {
        "job_id": upload["id"],
        "status": status,
        "report": None
    }

    if status == "completed":
        # Join with forensic_reports
        report_resp = db.table("forensic_reports").select("*").eq("upload_id", job_id).execute()
        if report_resp.data:
            report = report_resp.data[0]

            # Resolve operator name
            operator_name = None
            if report.get("primary_suspect_operator_id"):
                profile_resp = db.table("user_profiles").select("full_name").eq(
                    "id", report["primary_suspect_operator_id"]
                ).execute()
                if profile_resp.data:
                    operator_name = profile_resp.data[0]["full_name"]

            # Resolve center name
            center_name = None
            if report.get("primary_suspect_center_id"):
                center_resp = db.table("exam_centers").select("name").eq(
                    "id", report["primary_suspect_center_id"]
                ).execute()
                if center_resp.data:
                    center_name = center_resp.data[0]["name"]

            result["report"] = {
                "report_id": report["id"],
                "upload_id": report["upload_id"],
                "tmc_decoded": report.get("tmc_decoded"),
                "primary_suspect_operator_id": report.get("primary_suspect_operator_id"),
                "primary_suspect_operator_name": operator_name,
                "primary_suspect_printer_id": report.get("primary_suspect_printer_id"),
                "primary_suspect_center_id": report.get("primary_suspect_center_id"),
                "primary_suspect_center_name": center_name,
                "leaked_at": report.get("leaked_at"),
                "custody_chain": report.get("custody_chain"),
                "confidence_score": report.get("confidence_score"),
                "processing_notes": report.get("processing_notes"),
                "created_at": report.get("created_at")
            }

    return result


def list_forensic_reports(db: Client, page: int = 1, page_size: int = 20) -> dict:
    """
    Return a paginated list of all forensic reports joined with their uploads.
    Only accessible by super_admin.
    """
    offset = (page - 1) * page_size

    # Get total count
    count_resp = db.table("forensic_reports").select("id", count="exact").execute()
    total = count_resp.count if count_resp.count is not None else len(count_resp.data)

    # Get paginated reports
    reports_resp = (
        db.table("forensic_reports")
        .select("*, forensic_uploads!inner(original_filename, status)")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = []
    for report in reports_resp.data:
        # Resolve operator name for list view
        operator_name = None
        if report.get("primary_suspect_operator_id"):
            profile_resp = db.table("user_profiles").select("full_name").eq(
                "id", report["primary_suspect_operator_id"]
            ).execute()
            if profile_resp.data:
                operator_name = profile_resp.data[0]["full_name"]

        upload_data = report.get("forensic_uploads", {})

        items.append({
            "report_id": report["id"],
            "upload_id": report["upload_id"],
            "original_filename": upload_data.get("original_filename") if upload_data else None,
            "status": upload_data.get("status", "unknown") if upload_data else "unknown",
            "confidence_score": report.get("confidence_score"),
            "primary_suspect_operator_name": operator_name,
            "primary_suspect_printer_id": report.get("primary_suspect_printer_id"),
            "created_at": report.get("created_at")
        })

    return {
        "reports": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
