# apps/backend/services/centers_service.py
import json
import hashlib
from datetime import datetime, timezone
from supabase import Client


async def receive_batch(
    center_id: str,
    batch_id: str,
    qr_seal_payload: str,
    paper_count_received: int,
    received_by: str,
    db: Client,
) -> dict:
    """
    Supervisor confirms physical box received at center.
    Verifies QR seal, counts papers, records reception.
    """
    # 1. Fetch the transit batch
    batch_resp = (
        db.table("transit_batches")
        .select("id, center_id, qr_seal_payload, print_job_id, status")
        .eq("id", batch_id)
        .single()
        .execute()
    )
    batch = batch_resp.data
    if not batch:
        raise ValueError("BATCH_NOT_FOUND")

    # 2. Verify QR seal payload matches
    qr_seal_verified = (batch["qr_seal_payload"] == qr_seal_payload)

    # 3. Get expected paper count from print job
    job_resp = (
        db.table("print_jobs")
        .select("copies_printed")
        .eq("id", batch["print_job_id"])
        .single()
        .execute()
    )
    job = job_resp.data or {}
    paper_count_expected = job.get("copies_printed", 0)

    # 4. count_mismatch — compute in service layer (F-04: avoid GENERATED ALWAYS AS)
    count_mismatch = (paper_count_expected != paper_count_received)

    # 5. Insert batch_receptions row
    reception_resp = db.table("batch_receptions").insert({
        "batch_id": batch_id,
        "center_id": center_id,
        "received_by": received_by,
        "paper_count_expected": paper_count_expected,
        "paper_count_received": paper_count_received,
        "count_mismatch": count_mismatch,
        "qr_seal_verified": qr_seal_verified,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    reception = reception_resp.data[0]

    # 6. Update batch status to 'delivered' if qr is verified and no mismatch
    if qr_seal_verified and not count_mismatch:
        db.table("transit_batches").update({
            "status": "delivered",
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", batch_id).execute()

    # 7. Audit log
    db.table("audit_logs").insert({
        "user_id": received_by,
        "action_type": "batch_received",
        "entity_type": "transit_batches",
        "entity_id": batch_id,
        "metadata": {
            "count_mismatch": count_mismatch,
            "qr_seal_verified": qr_seal_verified,
            "paper_count_received": paper_count_received,
        },
    }).execute()

    return {
        "reception_id": str(reception["id"]),
        "count_mismatch": count_mismatch,
        "qr_seal_verified": qr_seal_verified,
    }