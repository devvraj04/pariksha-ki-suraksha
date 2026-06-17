"""
Phase 7 — Printing Celery Tasks
execute_print_job: generate watermark codes per page×copy, insert registry rows.
run_print_room_surveillance: mock YOLO phone/behavior detection in print room.
"""
from apps.api.workers.celery_app import celery_app


@celery_app.task(name="apps.api.workers.tasks_printing.execute_print_job")
def execute_print_job(job_id: str):
    """
    Mark job PRINTING, generate a Tracking Matrix watermark code for every
    page × copy, insert print_watermark_registry rows, mark COMPLETED.
    """
    import datetime
    import secrets
    from apps.api.core.supabase_client import get_supabase_client

    print(f"[Celery] Executing print job {job_id}...")
    db = get_supabase_client()
    try:
        job_res = db.table("print_jobs").select(
            "*, exam_centers(center_code), agency_staff(id)"
        ).eq("id", job_id).execute()
        if not job_res.data:
            return {"status": "failed", "error": "print_job_not_found"}
        job = job_res.data[0]

        db.table("print_jobs").update({
            "status": "PRINTING",
            "print_started_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", job_id).execute()

        # Estimate pages from paper size (mock: 12 pages per paper)
        MOCK_PAGES = 12
        copies = job["copies_requested"]
        center_code = (job.get("exam_centers") or {}).get("center_code", "CTR")
        operator_id = job["initiated_by"]
        printer_id = job["printer_id"]

        watermarks = []
        for copy_num in range(1, copies + 1):
            for page_num in range(1, MOCK_PAGES + 1):
                timestamp = datetime.datetime.utcnow()
                # Tracking Matrix Code: encodes center|printer|operator|timestamp|page|copy
                code = (
                    f"{center_code}|{printer_id[:8]}|{operator_id[:8]}|"
                    f"{timestamp.strftime('%Y%m%d%H%M%S')}|P{page_num:03d}|C{copy_num:04d}|"
                    f"{secrets.token_hex(4).upper()}"
                )
                watermarks.append({
                    "print_job_id": job_id,
                    "center_code": center_code,
                    "printer_id": printer_id,
                    "operator_id": operator_id,
                    "page_number": page_num,
                    "copy_number": copy_num,
                    "watermark_code": code,
                    "printed_at": timestamp.isoformat() + "Z",
                })

        # Bulk insert (chunked to avoid Supabase row limit)
        chunk_size = 500
        for i in range(0, len(watermarks), chunk_size):
            db.table("print_watermark_registry").insert(watermarks[i:i + chunk_size]).execute()

        db.table("print_jobs").update({
            "status": "COMPLETED",
            "print_completed_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", job_id).execute()

        # Log audit
        from apps.api.deps import log_audit
        log_audit(
            event_type="PRINT_JOB_COMPLETED",
            event_description=f"Print job {job_id} completed. {copies} copies × {MOCK_PAGES} pages = {len(watermarks)} watermarks registered.",
            metadata={"job_id": job_id, "watermark_count": len(watermarks)},
            exam_id=job.get("exam_id")
        )

        print(f"[Celery] Print job {job_id} completed. {len(watermarks)} watermark records inserted.")
        return {"status": "success", "job_id": job_id, "watermark_count": len(watermarks)}
    except Exception as e:
        db.table("print_jobs").update({"status": "BLOCKED_ANOMALOUS_TIME", "block_reason": str(e)}).eq("id", job_id).execute()
        print(f"[Celery Error] execute_print_job failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_printing.run_print_room_surveillance")
def run_print_room_surveillance(job_id: str):
    """
    Mock YOLOv8 surveillance scan for the print room.
    In production: subscribes to RTSP/WebRTC feed, runs phone/behavior detectors.
    For dev: simulates one detection event per run.
    """
    import random
    import datetime
    from apps.api.core.supabase_client import get_supabase_client

    print(f"[Celery] Running print room surveillance for job {job_id}...")
    db = get_supabase_client()
    try:
        # Simulate a low-probability detection (10% chance of alert in dev)
        if random.random() < 0.10:
            alert_types = ["MOBILE_PHONE_DETECTED", "UNAUTHORIZED_PERSON", "EXTRA_PAGES_TAKEN", "ANOMALOUS_BEHAVIOR"]
            alert_type = random.choice(alert_types)
            confidence = round(random.uniform(0.75, 0.98), 4)
            db.table("print_room_surveillance_alerts").insert({
                "print_job_id": job_id,
                "camera_id": "PRINT-CAM-01",
                "alert_type": alert_type,
                "confidence_score": confidence,
                "snapshot_path": f"surveillance/print/{job_id}/{datetime.datetime.utcnow().strftime('%H%M%S')}.jpg",
            }).execute()
            print(f"[Celery Surveillance] ALERT: {alert_type} detected with confidence {confidence}")

        return {"status": "success", "job_id": job_id}
    except Exception as e:
        print(f"[Celery Error] run_print_room_surveillance failed: {e}")
        return {"status": "failed", "error": str(e)}
