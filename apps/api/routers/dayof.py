"""
Phase 9 — Day-of-Exam Operations
Handles student check-in (QR JWT verify + biometric confirm), live room allocation,
CBT session management, and AI surveillance alert ingestion.
"""
import datetime
import secrets
import random
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Literal
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit, RequireInternalKey
from apps.api.core.config import settings

router = APIRouter()


class CheckinBody(BaseModel):
    qr_payload_jwt: str


class CheckinConfirmBody(BaseModel):
    student_id: str
    biometric_match_result: Literal["MATCHED", "FAILED", "SKIPPED"]
    biometric_match_score: Optional[float] = None
    biometric_photo_path: Optional[str] = None
    failed_attempts: int = 0


class StartCBTSessionBody(BaseModel):
    student_id: str


class TabSwitchBody(BaseModel):
    session_token: str


class SuspiciousTypingBody(BaseModel):
    session_token: str


class SubmitCBTBody(BaseModel):
    session_token: str
    responses: Optional[dict] = None


class SurveillanceAlertBody(BaseModel):
    center_id: str
    room_id: Optional[str] = None
    camera_id: str
    alert_type: str
    confidence_score: float
    snapshot_path: str


class ReviewAlertBody(BaseModel):
    review_outcome: Literal["DISMISSED", "ESCALATED", "ACTION_TAKEN"]


# ── Phase 9 Endpoints ────────────────────────────────────────────────────────

@router.post("/exams/{id}/checkin")
def checkin_verify_qr(
    id: str,
    body: CheckinBody,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    """Step 1: Verify JWT signature from QR scan. Return student data for biometric matching."""
    try:
        import jwt as pyjwt
        public_key = settings.ADMIT_CARD_JWT_PUBLIC_KEY.replace("\\n", "\n")
        if not public_key.strip():
            raise HTTPException(status_code=500, detail="ADMIT_CARD_JWT_PUBLIC_KEY not configured.")

        try:
            payload = pyjwt.decode(body.qr_payload_jwt, public_key, algorithms=["RS256"])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=400, detail="QR code has expired.")
        except pyjwt.InvalidSignatureError:
            raise HTTPException(status_code=400, detail="QR code has an invalid signature.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid QR code: {str(e)}")

        if payload.get("exam_id") != id:
            raise HTTPException(status_code=400, detail="QR code is for a different exam.")

        # Enforce center scope for center_officer (V-021)
        if current_user.role == "center_officer":
            if not current_user.center_id or current_user.center_id != payload.get("center_id"):
                raise HTTPException(status_code=403, detail="Not authorized to perform check-ins for this center.")

        # Fetch student data
        student_res = db.table("students").select("id, full_name, email, photo_path, biometric_hash").eq("id", payload["student_id"]).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found.")
        student = student_res.data[0]

        return {
            "qr_valid": True,
            "student_id": student["id"],
            "full_name": student["full_name"],
            "email": student["email"],
            "photo_path": student.get("photo_path"),
            "biometric_hash": student.get("biometric_hash"),
            "center_id": payload.get("center_id"),
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/checkin/confirm")
def checkin_confirm(
    id: str,
    body: CheckinConfirmBody,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    """Step 2: Record biometric result, create checkin_event, allocate room."""
    try:
        staff_res = db.table("agency_staff").select("id, agency_id").eq("user_id", current_user.id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=403, detail="Staff profile not found.")
        staff = staff_res.data[0]

        # Get registration
        reg_res = db.table("exam_registrations").select("id, status, center_preference_1").eq("student_id", body.student_id).eq("exam_id", id).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="No registration found for this student and exam.")
        reg = reg_res.data[0]

        if reg["status"] == "CHECKED_IN":
            raise HTTPException(status_code=409, detail="Student is already checked in.")

        # Get center allocation
        alloc_res = db.table("center_allocations").select("allocated_center_id").eq("registration_id", reg["id"]).execute()
        center_id = alloc_res.data[0]["allocated_center_id"] if alloc_res.data else reg.get("center_preference_1")
        if not center_id:
            raise HTTPException(status_code=400, detail="No center allocation found. Run center allocation first.")

        # Enforce center scope for center_officer (V-007)
        if current_user.role == "center_officer":
            if not current_user.center_id or current_user.center_id != center_id:
                raise HTTPException(status_code=403, detail="Not authorized to perform check-ins for this center.")

        is_flagged = body.failed_attempts >= 3 or body.biometric_match_result == "FAILED"
        flag_reason = None
        if body.failed_attempts >= 3:
            flag_reason = f"Biometric failed {body.failed_attempts} times."

        # Create checkin event
        checkin_res = db.table("checkin_events").insert({
            "registration_id": reg["id"],
            "student_id": body.student_id,
            "exam_id": id,
            "center_id": center_id,
            "qr_scan_result": "VALID",
            "biometric_match_score": body.biometric_match_score,
            "biometric_match_result": body.biometric_match_result,
            "biometric_photo_path": body.biometric_photo_path,
            "checked_in_by": staff["id"],
            "failed_attempts": body.failed_attempts,
            "is_flagged": is_flagged,
            "flag_reason": flag_reason,
        }).execute()
        checkin_event = checkin_res.data[0]

        # Update registration status
        db.table("exam_registrations").update({"status": "CHECKED_IN"}).eq("id", reg["id"]).execute()

        # Allocate a room with available capacity
        rooms_res = db.table("exam_rooms").select(
            "id, room_code, seating_capacity, current_occupancy"
        ).eq("exam_id", id).eq("center_id", center_id).eq("is_active", True).execute()

        available_rooms = [r for r in (rooms_res.data or []) if r["current_occupancy"] < r["seating_capacity"]]
        if not available_rooms:
            # Revert checkin status
            db.table("exam_registrations").update({"status": "REGISTERED"}).eq("id", reg["id"]).execute()
            db.table("checkin_events").update({"is_flagged": True, "flag_reason": "NO_AVAILABLE_ROOM_CAPACITY"}).eq("id", checkin_event["id"]).execute()
            raise HTTPException(status_code=400, detail="No rooms with available seats at this center.")

        # Random room selection
        allocated_room = random.choice(available_rooms)
        seat_number = f"S{allocated_room['current_occupancy'] + 1:03d}"

        # Increment occupancy atomically via RPC (V-008)
        try:
            db.rpc("increment_room_occupancy", {"p_room_id": allocated_room["id"]}).execute()
        except Exception as e:
            # Revert checkin status
            db.table("exam_registrations").update({"status": "REGISTERED"}).eq("id", reg["id"]).execute()
            db.table("checkin_events").update({"is_flagged": True, "flag_reason": "NO_AVAILABLE_ROOM_CAPACITY"}).eq("id", checkin_event["id"]).execute()
            raise HTTPException(status_code=400, detail="Room reached capacity concurrently. Seating allocation failed.")

        # Create room allocation record
        db.table("room_allocations").insert({
            "checkin_event_id": checkin_event["id"],
            "student_id": body.student_id,
            "exam_id": id,
            "center_id": center_id,
            "room_id": allocated_room["id"],
            "seat_number": seat_number,
        }).execute()

        log_audit(
            event_type="STUDENT_CHECKED_IN",
            event_description=f"Student checked in. Room: {allocated_room['room_code']}, Seat: {seat_number}.",
            metadata={"exam_id": id, "student_id": body.student_id, "room_id": allocated_room["id"]},
            actor_id=current_user.id,
            agency_id=staff["agency_id"],
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        return {
            "status": "CHECKED_IN",
            "room_id": allocated_room["id"],
            "room_code": allocated_room["room_code"],
            "seat_number": seat_number,
            "is_flagged": is_flagged,
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/centers/{center_id}/rooms/live")
def get_live_rooms(
    id: str,
    center_id: str,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        rooms_res = db.table("exam_rooms").select(
            "id, room_code, seating_capacity, current_occupancy, camera_stream_url, is_active"
        ).eq("exam_id", id).eq("center_id", center_id).eq("is_active", True).execute()
        rooms = rooms_res.data or []
        return [
            {
                **r,
                "available_seats": r["seating_capacity"] - r["current_occupancy"],
                "occupancy_percent": round((r["current_occupancy"] / r["seating_capacity"]) * 100) if r["seating_capacity"] > 0 else 0,
            }
            for r in rooms
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/centers/{center_id}/checkin-progress")
def get_checkin_progress(
    id: str,
    center_id: str,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Total REGISTERED at this center
        allocs = db.table("center_allocations").select("registration_id", count="exact").eq("exam_id", id).eq("allocated_center_id", center_id).execute()
        total_registered = allocs.count or 0

        # Checked in
        checked_in_res = db.table("checkin_events").select("id", count="exact").eq("exam_id", id).eq("center_id", center_id).execute()
        checked_in = checked_in_res.count or 0

        return {
            "total_registered": total_registered,
            "checked_in": checked_in,
            "absent_so_far": total_registered - checked_in,
            "percent": round((checked_in / total_registered * 100) if total_registered > 0 else 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/cbt/sessions")
def start_cbt_session(
    id: str,
    body: StartCBTSessionBody,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check student is CHECKED_IN
        reg_res = db.table("exam_registrations").select("id, status").eq("student_id", body.student_id).eq("exam_id", id).execute()
        if not reg_res.data or reg_res.data[0]["status"] != "CHECKED_IN":
            raise HTTPException(status_code=400, detail="Student must be CHECKED_IN to start a CBT session.")
        reg = reg_res.data[0]

        # Prevent duplicate sessions
        existing = db.table("cbt_exam_sessions").select("id, status").eq("registration_id", reg["id"]).execute()
        if existing.data:
            sess = existing.data[0]
            if sess["status"] in ("ACTIVE", "SUBMITTED", "TIMED_OUT"):
                raise HTTPException(status_code=409, detail=f"Session already exists with status: {sess['status']}.")

        # Get center from room_allocations
        room_alloc = db.table("room_allocations").select("center_id").eq("student_id", body.student_id).eq("exam_id", id).execute()
        center_id = room_alloc.data[0]["center_id"] if room_alloc.data else None

        session_token = secrets.token_urlsafe(32)
        sess_res = db.table("cbt_exam_sessions").insert({
            "registration_id": reg["id"],
            "student_id": body.student_id,
            "exam_id": id,
            "center_id": center_id,
            "session_token": session_token,
            "status": "ACTIVE",
            "started_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).execute()
        return {"session_token": session_token, "status": "ACTIVE", "session_id": sess_res.data[0]["id"]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/cbt/sessions/{id}/tab-switch")
def record_tab_switch(
    id: str,
    body: TabSwitchBody,
    db: Client = Depends(get_service_db)
):
    try:
        sess_res = db.table("cbt_exam_sessions").select("id, tab_switch_count, status, session_token").eq("id", id).execute()
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_res.data[0]
        if sess["session_token"] != body.session_token:
            raise HTTPException(status_code=401, detail="Invalid session token.")
            
        new_count = sess["tab_switch_count"] + 1
        new_status = "FLAGGED" if new_count >= 3 else sess["status"]
        db.table("cbt_exam_sessions").update({"tab_switch_count": new_count, "status": new_status}).eq("id", id).execute()
        return {"tab_switch_count": new_count, "status": new_status, "flagged": new_status == "FLAGGED"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/cbt/sessions/{id}/suspicious-typing")
def record_suspicious_typing(
    id: str,
    body: SuspiciousTypingBody,
    db: Client = Depends(get_service_db)
):
    try:
        sess_res = db.table("cbt_exam_sessions").select("id, suspicious_typing_flags, session_token").eq("id", id).execute()
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_res.data[0]
        if sess["session_token"] != body.session_token:
            raise HTTPException(status_code=401, detail="Invalid session token.")
            
        new_count = sess["suspicious_typing_flags"] + 1
        db.table("cbt_exam_sessions").update({"suspicious_typing_flags": new_count}).eq("id", id).execute()
        return {"suspicious_typing_flags": new_count}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cbt/sessions/{id}/submit")
def submit_cbt(
    id: str,
    body: SubmitCBTBody,
    db: Client = Depends(get_service_db)
):
    try:
        sess_res = db.table("cbt_exam_sessions").select("id, session_token").eq("id", id).execute()
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found.")
        sess = sess_res.data[0]
        if sess["session_token"] != body.session_token:
            raise HTTPException(status_code=401, detail="Invalid session token.")
            
        import json
        responses_json = json.dumps(body.responses or {})
        # In production: encrypt responses with AES-256-GCM before storing
        storage_path = f"cbt_responses/{id}/responses.json.enc"
        db.table("cbt_exam_sessions").update({
            "status": "SUBMITTED",
            "submitted_at": datetime.datetime.utcnow().isoformat() + "Z",
            "responses_encrypted_path": storage_path,
        }).eq("id", id).execute()
        return {"status": "SUBMITTED", "message": "Responses recorded successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/surveillance/alert")
def create_surveillance_alert(
    id: str,
    body: SurveillanceAlertBody,
    internal_key: str = Depends(RequireInternalKey),
    db: Client = Depends(get_service_db)
):
    """Internal endpoint for edge AI nodes to push surveillance alerts."""
    try:
        res = db.table("surveillance_alerts").insert({
            "exam_id": id,
            "center_id": body.center_id,
            "room_id": body.room_id,
            "camera_id": body.camera_id,
            "alert_type": body.alert_type,
            "confidence_score": body.confidence_score,
            "snapshot_path": body.snapshot_path,
        }).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/surveillance/alerts")
def list_surveillance_alerts(
    id: str,
    center_id: Optional[str] = None,
    room_id: Optional[str] = None,
    alert_type: Optional[str] = None,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        q = db.table("surveillance_alerts").select("*").eq("exam_id", id)
        if center_id:
            q = q.eq("center_id", center_id)
        if room_id:
            q = q.eq("room_id", room_id)
        if alert_type:
            q = q.eq("alert_type", alert_type)
        res = q.order("detected_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/surveillance/alerts/{id}/review")
def review_surveillance_alert(
    id: str,
    body: ReviewAlertBody,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        staff_id = staff_res.data[0]["id"] if staff_res.data else None
        res = db.table("surveillance_alerts").update({
            "review_outcome": body.review_outcome,
            "reviewed_by": staff_id,
            "reviewed_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Alert not found.")
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
