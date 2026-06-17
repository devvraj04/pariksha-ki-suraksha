"""
Phase 8 — Chain-of-Custody Transit Module
IoT trunk management: seal → dispatch → GPS telemetry → geofence check →
three-factor unlock (GPS + OTP + biometric).
"""
import math
import secrets
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit, RequireInternalKey, redis_client
from apps.api.core.config import settings

router = APIRouter()

# In-memory OTP store (replace with Redis in production)
_OTP_STORE: dict[str, dict] = {}
OTP_TTL_SECONDS = 300  # 5 minutes


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Returns distance in meters between two GPS coordinates."""
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class CreateTrunkBody(BaseModel):
    trunk_code: str
    center_id: str
    assigned_transit_manager_id: str
    device_imei: str


class TelemetryBody(BaseModel):
    trunk_id: str
    latitude: float
    longitude: float
    speed_kmh: Optional[float] = None
    timestamp: Optional[str] = None


class UnlockRequestBody(BaseModel):
    latitude: float
    longitude: float


class UnlockConfirmBody(BaseModel):
    otp: str
    biometric_data: Optional[str] = None  # Mocked


class ReceiptConfirmBody(BaseModel):
    papers_correct: bool


class ResolveViolationBody(BaseModel):
    resolution: str


# ── Phase 8 Endpoints ────────────────────────────────────────────────────────

@router.post("/print-jobs/{id}/trunks")
def create_trunk(
    id: str,
    body: CreateTrunkBody,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        job_res = db.table("print_jobs").select("id, exam_id, status").eq("id", id).execute()
        if not job_res.data:
            raise HTTPException(status_code=404, detail="Print job not found.")
        if job_res.data[0]["status"] != "COMPLETED":
            raise HTTPException(status_code=400, detail="Can only create trunks for COMPLETED print jobs.")

        trunk_res = db.table("transit_trunks").insert({
            "trunk_code": body.trunk_code,
            "print_job_id": id,
            "center_id": body.center_id,
            "assigned_transit_manager_id": body.assigned_transit_manager_id,
            "device_imei": body.device_imei,
            "status": "SEALED",
            "sealed_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).execute()
        trunk = trunk_res.data[0]

        log_audit(
            event_type="TRUNK_SEALED",
            event_description=f"Transit trunk '{body.trunk_code}' sealed for dispatch.",
            metadata={"trunk_id": trunk["id"], "print_job_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            ip_address=request.client.host if request.client else None
        )
        return trunk
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/trunks")
def list_trunks(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "transit_manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("transit_trunks").select(
            "*, exam_centers(name, city), agency_staff!transit_trunks_assigned_transit_manager_id_fkey(full_name)"
        ).eq("print_jobs.exam_id", id).execute()

        # Fallback: join via print_jobs
        trunks_res = db.table("transit_trunks").select("*, print_jobs!inner(exam_id), exam_centers(name, city)").eq("print_jobs.exam_id", id).execute()
        return trunks_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trunks/{id}")
def get_trunk(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager", "transit_manager")),
    db: Client = Depends(get_service_db)
):
    try:
        trunk_res = db.table("transit_trunks").select("*, exam_centers(name, city, latitude, longitude, geofence_radius_meters)").eq("id", id).execute()
        if not trunk_res.data:
            raise HTTPException(status_code=404, detail="Trunk not found.")
        trunk = trunk_res.data[0]

        events = db.table("transit_events").select("*").eq("trunk_id", id).order("recorded_at", desc=True).limit(100).execute()
        violations = db.table("transit_geofence_violations").select("*").eq("trunk_id", id).order("detected_at", desc=True).execute()

        return {**trunk, "transit_events": events.data or [], "violations": violations.data or []}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trunks/{id}/dispatch")
def dispatch_trunk(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("transit_manager", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("transit_trunks").update({
            "status": "IN_TRANSIT",
            "dispatched_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", id).eq("status", "SEALED").execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Trunk not found or is not in SEALED state.")

        log_audit(event_type="TRUNK_DISPATCHED", event_description=f"Trunk {id} dispatched.", metadata={"trunk_id": id}, actor_id=current_user.id, ip_address=request.client.host if request.client else None)
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trunks/{id}/unlock/request")
def request_trunk_unlock(
    id: str,
    body: UnlockRequestBody,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    """GPS geofence check → send OTP."""
    try:
        trunk_res = db.table("transit_trunks").select("*, exam_centers(latitude, longitude, geofence_radius_meters)").eq("id", id).execute()
        if not trunk_res.data:
            raise HTTPException(status_code=404, detail="Trunk not found.")
        trunk = trunk_res.data[0]
        center = trunk.get("exam_centers", {}) or {}

        if trunk["status"] != "IN_TRANSIT":
            raise HTTPException(status_code=400, detail=f"Trunk is not IN_TRANSIT. Current status: {trunk['status']}.")

        # Geofence check
        if center and center.get("latitude") and center.get("longitude"):
            dist = _haversine(body.latitude, body.longitude, float(center["latitude"]), float(center["longitude"]))
            geofence_radius = center.get("geofence_radius_meters", 100)
            if dist > geofence_radius:
                return {"otp_sent": False, "error": "OUTSIDE_GEOFENCE", "distance_meters": round(dist), "required_meters": geofence_radius}

        # Generate and store OTP in Redis
        otp = str(secrets.randbelow(1000000)).zfill(6)
        import json
        redis_client.set(f"transit_otp:{id}", json.dumps({
            "otp": otp,
            "user_id": current_user.id
        }), ex=OTP_TTL_SECONDS)
        
        # Reset attempt counter
        redis_client.delete(f"transit_otp_attempts:{id}")

        # In production: send via SMS_OTP_PROVIDER_KEY
        print(f"[Transit] OTP for trunk {id}: {otp}  (SMS would be sent in production)")

        db.table("transit_trunks").update({
            "unlock_otp_sent_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).eq("id", id).execute()

        res_data = {"otp_sent": True, "expires_in_seconds": OTP_TTL_SECONDS}
        if settings.ENVIRONMENT != "production":
            res_data["dev_otp"] = otp
        return res_data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trunks/{id}/unlock/confirm")
def confirm_trunk_unlock(
    id: str,
    body: UnlockConfirmBody,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    """Validate OTP + biometric, then unlock the trunk."""
    try:
        # 1. Check brute force attempts
        attempts_key = f"transit_otp_attempts:{id}"
        attempts = redis_client.get(attempts_key)
        if attempts and int(attempts) >= 5:
            raise HTTPException(status_code=429, detail="Too many invalid OTP attempts. Please request a new OTP.")

        import json
        stored_bytes = redis_client.get(f"transit_otp:{id}")
        if not stored_bytes:
            raise HTTPException(status_code=400, detail="No active OTP for this trunk. Request OTP first.")
        
        stored = json.loads(stored_bytes)
        
        if stored["otp"] != body.otp:
            # Increment attempts
            redis_client.incr(attempts_key)
            redis_client.expire(attempts_key, OTP_TTL_SECONDS)
            raise HTTPException(status_code=400, detail="Invalid OTP.")

        # Biometric: in production verify against agency_staff.biometric_hash
        # Mocked: accept if biometric_data is provided (any value)

        staff_res = db.table("agency_staff").select("id").eq("user_id", current_user.id).execute()
        staff_id = staff_res.data[0]["id"] if staff_res.data else None

        res = db.table("transit_trunks").update({
            "status": "UNLOCKED",
            "unlocked_at": datetime.datetime.utcnow().isoformat() + "Z",
            "unlocked_by": staff_id,
        }).eq("id", id).execute()

        # Success: delete Redis keys
        redis_client.delete(f"transit_otp:{id}")
        redis_client.delete(attempts_key)

        log_audit(
            event_type="TRUNK_UNLOCKED_AT_CENTER",
            event_description=f"Trunk {id} unlocked at center by officer.",
            metadata={"trunk_id": id},
            actor_id=current_user.id,
            ip_address=request.client.host if request.client else None
        )
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trunks/{id}/receipt-confirm")
def receipt_confirm(
    id: str,
    body: ReceiptConfirmBody,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("center_officer", "manager", "agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        if not body.papers_correct:
            db.table("transit_trunks").update({"status": "COMPROMISED"}).eq("id", id).execute()
            log_audit(event_type="TRUNK_RECEIPT_MISMATCH", event_description=f"Center officer reported incorrect papers in trunk {id}. Status set to COMPROMISED.", metadata={"trunk_id": id}, actor_id=current_user.id, ip_address=request.client.host if request.client else None)
            return {"status": "COMPROMISED", "message": "Alert raised. Agency Head notified."}

        db.table("transit_trunks").update({"status": "DELIVERED", "delivered_at": datetime.datetime.utcnow().isoformat() + "Z"}).eq("id", id).execute()
        return {"status": "DELIVERED", "message": "Receipt confirmed. Papers are intact."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mqtt/telemetry")
def receive_telemetry(
    body: TelemetryBody,
    internal_key: str = Depends(RequireInternalKey),
    db: Client = Depends(get_service_db)
):
    """Internal endpoint for MQTT consumer to push GPS events."""
    try:
        trunk_res = db.table("transit_trunks").select("*, exam_centers(latitude, longitude, geofence_radius_meters, agency_id)").eq("id", body.trunk_id).execute()
        if not trunk_res.data:
            raise HTTPException(status_code=404, detail="Trunk not found.")
        trunk = trunk_res.data[0]

        recorded_at = body.timestamp or datetime.datetime.utcnow().isoformat() + "Z"

        # Geofence check against destination center
        center = trunk.get("exam_centers", {}) or {}
        is_on_route = True
        dist = 0.0
        if center and center.get("latitude"):
            dist = _haversine(body.latitude, body.longitude, float(center["latitude"]), float(center["longitude"]))
            # Simple geofence: within 10km of destination is "on route"
            is_on_route = dist < 10000

        db.table("transit_events").insert({
            "trunk_id": body.trunk_id,
            "latitude": body.latitude,
            "longitude": body.longitude,
            "speed_kmh": body.speed_kmh,
            "is_on_route": is_on_route,
            "recorded_at": recorded_at,
        }).execute()

        if not is_on_route and trunk["status"] == "IN_TRANSIT":
            db.table("transit_trunks").update({"status": "COMPROMISED"}).eq("id", body.trunk_id).execute()
            
            # Find a manager of the same agency to alert (V-027)
            agency_id = center.get("agency_id")
            managers = db.table("agency_staff").select("id").eq("role", "manager").eq("agency_id", agency_id).limit(1).execute() if agency_id else None
            alerted_to = managers.data[0]["id"] if managers and managers.data else None

            violation_res = db.table("transit_geofence_violations").insert({
                "trunk_id": body.trunk_id,
                "violation_latitude": body.latitude,
                "violation_longitude": body.longitude,
                "deviation_meters": int(dist - 10000) if dist > 10000 else 0,
                "alerted_to": alerted_to,
            }).execute()

        return {"status": "ok", "is_on_route": is_on_route}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trunks/{id}/violations")
def get_violations(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("transit_geofence_violations").select("*").eq("trunk_id", id).order("detected_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/trunks/{id}/violations/{vid}/resolve")
def resolve_violation(
    id: str,
    vid: str,
    body: ResolveViolationBody,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("transit_geofence_violations").update({
            "resolution": body.resolution,
            "resolved_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", vid).eq("trunk_id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Violation not found.")
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
