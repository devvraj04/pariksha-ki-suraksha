# apps/backend/services/admit_card_service.py
import os
import hashlib
import time
from uuid import UUID, uuid4
from datetime import datetime, timezone

from jose import jwt, JWTError, ExpiredSignatureError
from supabase import Client

# ── helpers ──────────────────────────────────────────────────────────────────

def _get_private_key() -> str:
    raw = os.getenv("JWT_RS256_PRIVATE_KEY", "")
    # Handle \n stored as literal backslash-n in env
    return raw.replace("\\n", "\n")

def _get_public_key() -> str:
    raw = os.getenv("JWT_RS256_PUBLIC_KEY", "")
    return raw.replace("\\n", "\n")

def _hash_jwt(jwt_string: str) -> str:
    return hashlib.sha256(jwt_string.encode()).hexdigest()

# ── generate ──────────────────────────────────────────────────────────────────

async def generate_admit_cards(
    exam_id: str,
    center_id: str,
    issued_by: str,
    db: Client
) -> dict:
    """
    Bulk-generate RS256-signed JWTs for all students enrolled in exam at center.
    Returns list of { student_id, jwt_string }.
    """
    # 1. Fetch all enrolled students for this exam + center
    enrollments_resp = (
        db.table("exam_enrollments")
        .select("student_id, students(id, full_name, roll_number, photo_storage_path)")
        .eq("exam_id", exam_id)
        .eq("center_id", center_id)
        .execute()
    )
    enrollments = enrollments_resp.data
    if not enrollments:
        return {"exam_id": exam_id, "center_id": center_id, "generated_count": 0, "admit_cards": []}

    # 2. Fetch exam to get scheduled_at for expiry
    exam_resp = db.table("exams").select("scheduled_at, duration_minutes").eq("id", exam_id).single().execute()
    exam = exam_resp.data

    # Expiry = exam day end (scheduled_at + duration_minutes + 60 min buffer)
    scheduled_dt = datetime.fromisoformat(exam["scheduled_at"].replace("Z", "+00:00"))
    duration = exam.get("duration_minutes", 180)
    exp_unix = int(scheduled_dt.timestamp()) + (duration + 60) * 60

    private_key = _get_private_key()
    now_unix = int(time.time())

    results = []
    rows_to_insert = []

    for enrollment in enrollments:
        student = enrollment.get("students") or {}
        student_id = enrollment["student_id"]

        # 3. Construct JWT payload
        name_hash = hashlib.sha256(student.get("full_name", "").encode()).hexdigest()
        photo_hash = hashlib.sha256(student.get("photo_storage_path", "").encode()).hexdigest()

        payload = {
            "student_id": student_id,
            "exam_id": exam_id,
            "center_id": center_id,
            "name_hash": name_hash,
            "photo_hash": photo_hash,
            "iat": now_unix,
            "exp": exp_unix,
        }

        # 4. Sign with RS256
        jwt_string = jwt.encode(payload, private_key, algorithm="RS256")

        # 5. Hash the JWT (never store raw JWT)
        jwt_hash = _hash_jwt(jwt_string)

        rows_to_insert.append({
            "student_id": student_id,
            "exam_id": exam_id,
            "center_id": center_id,
            "jwt_payload_hash": jwt_hash,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": datetime.fromtimestamp(exp_unix, tz=timezone.utc).isoformat(),
            "is_revoked": False,
        })

        results.append({"student_id": student_id, "jwt_string": jwt_string})

    # 6. Upsert admit_cards rows (on conflict student+exam, update)
    db.table("admit_cards").upsert(rows_to_insert, on_conflict="student_id,exam_id").execute()

    # 7. Audit log
    db.table("audit_logs").insert({
        "user_id": issued_by,
        "action_type": "admit_cards_generated",
        "entity_type": "admit_cards",
        "entity_id": exam_id,
        "metadata": {"count": len(results), "center_id": center_id},
    }).execute()

    return {
        "exam_id": exam_id,
        "center_id": center_id,
        "generated_count": len(results),
        "admit_cards": results,
    }


# ── verify ────────────────────────────────────────────────────────────────────

async def verify_admit_card(
    qr_payload: str,
    center_id: str,
    verified_by: str,
    db: Client
) -> dict:
    """
    Verify a scanned admit card JWT. Returns is_valid + student info.
    """
    public_key = _get_public_key()

    # Step 1: Verify signature
    try:
        decoded = jwt.decode(qr_payload, public_key, algorithms=["RS256"])
    except ExpiredSignatureError:
        _insert_scan(db, qr_payload, center_id, verified_by, False, "expired")
        return {"is_valid": False, "failure_reason": "expired", "already_scanned": False}
    except JWTError:
        _insert_scan(db, qr_payload, center_id, verified_by, False, "invalid_signature")
        return {"is_valid": False, "failure_reason": "invalid_signature", "already_scanned": False}

    # Step 2: Check center_id claim
    if decoded.get("center_id") != center_id:
        _insert_scan(db, qr_payload, center_id, verified_by, False, "wrong_center")
        return {"is_valid": False, "failure_reason": "wrong_center", "already_scanned": False}

    # Step 3: Look up admit_card by jwt_payload_hash, check is_revoked
    jwt_hash = _hash_jwt(qr_payload)
    card_resp = (
        db.table("admit_cards")
        .select("id, is_revoked, student_id")
        .eq("jwt_payload_hash", jwt_hash)
        .single()
        .execute()
    )
    card = card_resp.data
    if not card:
        # Card was never generated through our system
        _insert_scan(db, qr_payload, center_id, verified_by, False, "not_found")
        return {"is_valid": False, "failure_reason": "not_found", "already_scanned": False}

    if card["is_revoked"]:
        _insert_scan(db, qr_payload, center_id, verified_by, False, "revoked", card["id"])
        return {"is_valid": False, "failure_reason": "revoked", "already_scanned": False}

    # Step 4: Check if already scanned (for duplicate detection)
    prev_scan = (
        db.table("admit_card_scans")
        .select("id")
        .eq("admit_card_id", card["id"])
        .eq("is_valid", True)
        .execute()
    )
    already_scanned = len(prev_scan.data) > 0

    # Step 5: Fetch student details
    student_resp = (
        db.table("students")
        .select("full_name, roll_number, photo_storage_path")
        .eq("id", card["student_id"])
        .single()
        .execute()
    )
    student = student_resp.data or {}

    # Step 6: Generate public URL for photo
    photo_url = None
    if student.get("photo_storage_path"):
        photo_url = (
            db.storage.from_("student-photos")
            .get_public_url(student["photo_storage_path"])
        )

    # Step 7: Insert scan record
    _insert_scan(db, qr_payload, center_id, verified_by, True, None, card["id"])

    return {
        "student_id": card["student_id"],
        "student_name": student.get("full_name"),
        "roll_number": student.get("roll_number"),
        "is_valid": True,
        "already_scanned": already_scanned,
        "failure_reason": None,
        "photo_url": photo_url,
    }


def _insert_scan(db: Client, qr_payload: str, center_id: str, scanned_by: str, is_valid: bool, failure_reason, admit_card_id=None):
    """Helper: insert admit_card_scans row."""
    from datetime import datetime, timezone
    try:
        db.table("admit_card_scans").insert({
            "admit_card_id": admit_card_id,
            "center_id": center_id,
            "scanned_by": scanned_by,
            "is_valid": is_valid,
            "failure_reason": failure_reason,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass  # scan log failure should not break the verification response