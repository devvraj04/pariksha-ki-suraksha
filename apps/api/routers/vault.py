"""
Phase 6 — Secure Question Paper Vault
Handles session-gated encrypted upload, split-key AES-256-GCM storage,
and vault access logging.  HSM calls are mocked for local development.
"""
import os
import secrets
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Header
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit, redis_client

router = APIRouter()

# Redis-based session store configuration
SESSION_TTL_SECONDS = 900  # 15 minutes


def _validate_session(token: str, user_id: str, exam_id: str) -> dict:
    import json
    session_bytes = redis_client.get(f"vault_session:{token}")
    if not session_bytes:
        raise HTTPException(status_code=401, detail="Upload session token is invalid or expired.")
    session = json.loads(session_bytes)
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Session token does not belong to this user.")
    if session["exam_id"] != exam_id:
        raise HTTPException(status_code=403, detail="Session token is for a different exam.")
    return session


def _encrypt_paper(data: bytes) -> tuple[bytes, str, str]:
    """
    AES-256-GCM encrypt the paper.
    Returns: (ciphertext_with_tag, key_share_1_vault_ref, key_share_2_hsm_ref)
    Key material is generated, split, and immediately discarded after returning refs.
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = os.urandom(32)  # AES-256
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = nonce + aesgcm.encrypt(nonce, data, None)

    # Split key: XOR with a random mask (Share 1); Share 2 = mask
    mask = os.urandom(32)
    share1 = bytes(a ^ b for a, b in zip(key, mask))
    share2 = mask

    # In production: share1 → Supabase Vault, share2 → HSM endpoint
    # For dev: store both as hex refs (never stored in DB as raw key material)
    vault_ref = f"vault:mock:{share1.hex()[:16]}"   # truncated ref only
    hsm_ref = f"hsm:mock:{share2.hex()[:16]}"

    # Securely zero key material from Python heap (best-effort)
    key = b"\x00" * 32

    return ciphertext, vault_ref, hsm_ref


# ── Phase 6 Endpoints ────────────────────────────────────────────────────────

@router.post("/exams/{id}/papers/upload-session/start")
def start_upload_session(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    """Issue a short-lived upload session token and begin surveillance monitoring."""
    try:
        exam_res = db.table("exams").select("id, agency_id, name").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]
        if exam["agency_id"] != current_user.agency_id:
            raise HTTPException(status_code=403, detail="Not authorized for this exam.")

        token = secrets.token_urlsafe(32)
        import json
        redis_client.set(f"vault_session:{token}", json.dumps({
            "user_id": current_user.id,
            "exam_id": id,
            "agency_id": current_user.agency_id
        }), ex=SESSION_TTL_SECONDS)

        # Log the session start
        log_audit(
            event_type="VAULT_UPLOAD_SESSION_STARTED",
            event_description=f"Secure upload session started for exam '{exam['name']}'.",
            metadata={"exam_id": id, "session_token_prefix": token[:8]},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        return {
            "session_token": token,
            "expires_in_seconds": SESSION_TTL_SECONDS,
            "message": "Upload session active. Webcam monitoring is now enabled."
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/papers")
async def upload_paper(
    id: str,
    request: Request,
    file: UploadFile = File(...),
    x_session_token: str = Header(..., alias="X-Session-Token"),
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    """
    Multipart PDF upload — validates session, encrypts with AES-256-GCM,
    splits the key, stores ciphertext to Supabase Storage, inserts question_papers row.
    Key material never touches the database.
    """
    try:
        # Validate session token
        _validate_session(x_session_token, current_user.id, id)

        exam_res = db.table("exams").select("id, agency_id, name, mode").eq("id", id).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]

        # Resolve staff profile for FK
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff_id = staff_res.data[0]["id"]

        # Read and encrypt
        pdf_bytes = await file.read()
        if len(pdf_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # File type validation [V-029]
        if not pdf_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")

        # File size validation (max 50MB)
        if len(pdf_bytes) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Uploaded file size exceeds the 50MB limit.")

        ciphertext, vault_ref, hsm_ref = _encrypt_paper(pdf_bytes)

        # Archive any existing active papers for this exam
        existing = db.table("question_papers").select("id").eq("exam_id", id).neq("status", "ARCHIVED").execute()
        if existing.data:
            for old in existing.data:
                db.table("question_papers").update({"status": "ARCHIVED", "paper_version": 0}).eq("id", old["id"]).execute()

        # Determine version number
        version_res = db.table("question_papers").select("paper_version").eq("exam_id", id).order("paper_version", desc=True).limit(1).execute()
        next_version = (version_res.data[0]["paper_version"] if version_res.data else 0) + 1

        # Upload ciphertext to Supabase Storage
        storage_path = f"{id}/paper_v{next_version}.enc"
        try:
            db.storage.from_("question-papers-vault").upload(storage_path, bytes(ciphertext), {"content-type": "application/octet-stream"})
        except Exception:
            try:
                db.storage.from_("question-papers-vault").update(storage_path, bytes(ciphertext), {"content-type": "application/octet-stream"})
            except Exception as se:
                raise HTTPException(status_code=500, detail=f"Storage upload failed: {se}")

        # Insert question_papers row — key references only, never raw key material
        paper_res = db.table("question_papers").insert({
            "exam_id": id,
            "uploaded_by": staff_id,
            "encrypted_storage_path": storage_path,
            "key_share_1_vault_ref": vault_ref,
            "key_share_2_hsm_ref": hsm_ref,
            "encryption_algorithm": "AES-256-GCM",
            "paper_version": next_version,
            "status": "VAULTED",
        }).execute()
        paper = paper_res.data[0]

        # Log vault access
        db.table("paper_vault_access_logs").insert({
            "paper_id": paper["id"],
            "accessed_by": staff_id,
            "access_type": "UPLOAD",
            "ip_address": request.client.host if request.client else "unknown",
        }).execute()

        log_audit(
            event_type="PAPER_UPLOADED_AND_VAULTED",
            event_description=f"Question paper v{next_version} uploaded and encrypted for exam '{exam['name']}'.",
            metadata={"exam_id": id, "paper_id": paper["id"], "version": next_version},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        # Fire background schedule task
        from apps.api.workers.tasks_vault import schedule_paper_decryption
        schedule_paper_decryption.delay(paper["id"], id)

        return {
            "status": "VAULTED",
            "paper_id": paper["id"],
            "paper_version": next_version,
            "encryption_algorithm": "AES-256-GCM",
            "message": "Paper encrypted and vaulted. Key shares distributed."
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/papers/upload-session/{token}/end")
def end_upload_session(
    token: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    """End the monitored upload session and invalidate the token."""
    import json
    session_bytes = redis_client.get(f"vault_session:{token}")
    if not session_bytes:
        raise HTTPException(status_code=404, detail="Session not found or already expired.")
    session = json.loads(session_bytes)
    if session["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session.")
    redis_client.delete(f"vault_session:{token}")
    return {"message": "Upload session ended. Monitoring deactivated."}


@router.get("/exams/{id}/papers")
def get_paper_status(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    """Return paper status only — never returns ciphertext, key shares, or storage paths."""
    try:
        papers = db.table("question_papers").select(
            "id, status, paper_version, uploaded_at, upload_session_recording_path"
        ).eq("exam_id", id).order("paper_version", desc=True).execute()

        return [
            {
                "id": p["id"],
                "status": p["status"],
                "paper_version": p["paper_version"],
                "uploaded_at": p["uploaded_at"],
            }
            for p in (papers.data or [])
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/papers/vault-access-log")
def get_vault_access_log(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    """Return access logs for all papers of this exam."""
    try:
        # Get paper IDs for this exam
        papers = db.table("question_papers").select("id").eq("exam_id", id).execute()
        if not papers.data:
            return []
        paper_ids = [p["id"] for p in papers.data]

        logs = []
        for pid in paper_ids:
            log_res = db.table("paper_vault_access_logs").select(
                "*, agency_staff(full_name, role)"
            ).eq("paper_id", pid).order("accessed_at", desc=True).execute()
            logs.extend(log_res.data or [])

        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
