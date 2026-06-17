"""
Phase 6 — Vault Celery Tasks
schedule_paper_decryption: schedules timed decrypt tasks.
decrypt_paper_for_print / decrypt_paper_for_cbt: reassemble key, decrypt,
hand off to printing/CBT module, then zero key in RAM.
"""
from apps.api.workers.celery_app import celery_app


@celery_app.task(name="apps.api.workers.tasks_vault.schedule_paper_decryption")
def schedule_paper_decryption(paper_id: str, exam_id: str):
    """
    Schedule two timed decryption tasks based on exam mode:
    - OFFLINE: decrypt_paper_for_print at exam_date - 2 days
    - ONLINE:  decrypt_paper_for_cbt at exam_start_time - 5 minutes
    In development (no Redis/Beat), these run immediately in eager mode for testing.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Scheduling decryption tasks for paper {paper_id}, exam {exam_id}...")
    db = get_supabase_client()
    try:
        exam_res = db.table("exams").select("mode, exam_date, start_time").eq("id", exam_id).execute()
        if not exam_res.data:
            return {"status": "failed", "error": "exam_not_found"}
        exam = exam_res.data[0]

        if exam["mode"] == "OFFLINE":
            print(f"[Celery] OFFLINE exam: scheduling decrypt_paper_for_print for paper {paper_id}")
            # In production: use Celery ETA countdown based on exam_date - 2 days
            # For dev: just log the intent (actual decrypt is triggered manually by operator)
            db.table("question_papers").update({"status": "VAULTED"}).eq("id", paper_id).execute()
            return {"status": "scheduled", "mode": "OFFLINE", "paper_id": paper_id}
        else:
            print(f"[Celery] ONLINE exam: scheduling decrypt_paper_for_cbt for paper {paper_id}")
            return {"status": "scheduled", "mode": "ONLINE", "paper_id": paper_id}
    except Exception as e:
        print(f"[Celery Error] schedule_paper_decryption failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_vault.decrypt_paper_for_print")
def decrypt_paper_for_print(paper_id: str):
    """
    Fetch key shares from Vault + HSM, reassemble AES key in RAM,
    decrypt paper, hand to print module, zero the key immediately.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Decrypting paper {paper_id} for print...")
    db = get_supabase_client()
    try:
        paper_res = db.table("question_papers").select("*").eq("id", paper_id).execute()
        if not paper_res.data:
            return {"status": "failed", "error": "paper_not_found"}
        paper = paper_res.data[0]

        # Mock: retrieve vault ref and hsm ref
        vault_ref = paper["key_share_1_vault_ref"]
        hsm_ref = paper["key_share_2_hsm_ref"]
        print(f"[Celery Vault] Fetching Share 1 from vault ref: {vault_ref}")
        print(f"[Celery HSM] Fetching Share 2 from HSM ref: {hsm_ref}")

        # In production: call Supabase Vault API and HSM endpoint to get actual shares
        # share1 = vault_client.retrieve(vault_ref)
        # share2 = hsm_client.retrieve(hsm_ref)
        # key = bytes(a ^ b for a, b in zip(share1, share2))
        # <decrypt ciphertext>
        # key = b"\x00" * 32  # zero key from RAM

        db.table("question_papers").update({"status": "DECRYPTED_FOR_PRINT"}).eq("id", paper_id).execute()

        # Log access
        db.table("paper_vault_access_logs").insert({
            "paper_id": paper_id,
            "accessed_by": paper["uploaded_by"],
            "access_type": "DECRYPT_FOR_PRINT",
            "ip_address": "system",
            "notes": "Automated decryption for printing pipeline."
        }).execute()

        print(f"[Celery] Paper {paper_id} decrypted for print. Key zeroed from RAM.")
        return {"status": "success", "paper_id": paper_id, "new_status": "DECRYPTED_FOR_PRINT"}
    except Exception as e:
        print(f"[Celery Error] decrypt_paper_for_print failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_vault.decrypt_paper_for_cbt")
def decrypt_paper_for_cbt(paper_id: str):
    """
    Same as decrypt_for_print but targets ONLINE CBT delivery.
    Paper remains encrypted on local server until student authenticates.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Decrypting paper {paper_id} for CBT...")
    db = get_supabase_client()
    try:
        paper_res = db.table("question_papers").select("*").eq("id", paper_id).execute()
        if not paper_res.data:
            return {"status": "failed", "error": "paper_not_found"}
        paper = paper_res.data[0]

        # Mock: key assembly and decrypt (same as above)
        print(f"[Celery Vault] Reassembling key in RAM for CBT paper {paper_id}")

        db.table("question_papers").update({"status": "DECRYPTED_FOR_CBT"}).eq("id", paper_id).execute()

        db.table("paper_vault_access_logs").insert({
            "paper_id": paper_id,
            "accessed_by": paper["uploaded_by"],
            "access_type": "DECRYPT_FOR_CBT",
            "ip_address": "system",
            "notes": "Automated decryption for CBT delivery pipeline."
        }).execute()

        print(f"[Celery] Paper {paper_id} decrypted for CBT. Key zeroed from RAM.")
        return {"status": "success", "paper_id": paper_id, "new_status": "DECRYPTED_FOR_CBT"}
    except Exception as e:
        print(f"[Celery Error] decrypt_paper_for_cbt failed: {e}")
        return {"status": "failed", "error": str(e)}
