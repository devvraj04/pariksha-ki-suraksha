import base64
import time
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from dependencies.db import get_db
from dependencies.auth import require_internal_worker
from models.vision import VisionAlertRequest, VisionAlertResponse, VisionAlertEnvelope
from services.realtime_service import broadcast_realtime_event

router = APIRouter(prefix="/vision", tags=["Vision Agent"])

@router.post("/alert", response_model=VisionAlertEnvelope, status_code=status.HTTP_201_CREATED)
async def fire_vision_alert(
    payload: VisionAlertRequest,
    internal_key: str = Depends(require_internal_worker),
    db: Client = Depends(get_db)
):
    """
    Submit a computer vision threat detection alert.
    Requires internal worker API key authorization.
    """
    try:
        # 1. Decode frame JPEG from base64
        try:
            image_bytes = base64.b64decode(payload.frame_jpeg_b64)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid base64 frame encoding: {str(e)}"
            )
            
        # 2. Upload to Supabase Storage
        timestamp = int(time.time())
        storage_path = f"{timestamp}_{payload.agent_id}.jpg"
        try:
            db.storage.from_("vision-alerts").upload(
                path=storage_path,
                file=image_bytes,
                file_options={"content-type": "image/jpeg"}
            )
        except Exception as e:
            # Continue even if storage upload fails, but use fallback name
            storage_path = f"error_fallback_{timestamp}.jpg"
            
        # 3. Determine if print job abortion is triggered (print_room mode only)
        triggered_abort = False
        aborted_job_id = None
        
        if payload.location_type == "print_room":
            # Search for active/queued print jobs at this location (center_id = location_id)
            active_jobs_resp = db.table("print_jobs") \
                .select("id, operator_id") \
                .eq("center_id", str(payload.location_id)) \
                .in_("status", ["queued", "printing"]) \
                .execute()
                
            if active_jobs_resp.data:
                # Abort the first active job
                target_job = active_jobs_resp.data[0]
                aborted_job_id = target_job["id"]
                
                db.table("print_jobs").update({
                    "status": "aborted",
                    "aborted_reason": "vision_alert"
                }).eq("id", aborted_job_id).execute()
                
                triggered_abort = True
                
                # Write print job abort audit log
                db.table("audit_logs").insert({
                    "user_id": target_job["operator_id"],
                    "action_type": "print_job_aborted",
                    "entity_type": "print_jobs",
                    "entity_id": aborted_job_id,
                    "metadata": {"reason": "vision_alert_triggered"}
                }).execute()
                
                # Broadcast job abortion realtime event
                broadcast_realtime_event(
                    "print_room", 
                    "print_job_aborted", 
                    {"job_id": aborted_job_id, "reason": "vision_alert"}
                )

        # 4. Insert vision alert record
        alert_id = str(uuid4())
        alert_record = {
            "id": alert_id,
            "agent_id": payload.agent_id,
            "location_type": payload.location_type,
            "location_id": str(payload.location_id),
            "detected_class": payload.detected_class,
            "confidence": payload.confidence,
            "frame_storage_path": storage_path,
            "triggered_abort": triggered_abort,
            "is_reviewed": False
        }
        
        if aborted_job_id:
            alert_record["linked_job_id"] = aborted_job_id
            
        db.table("vision_alerts").insert(alert_record).execute()
        
        # 5. Write vision alert system audit log
        db.table("audit_logs").insert({
            "action_type": "vision_alert_fired",
            "entity_type": "vision_alerts",
            "entity_id": alert_id,
            "metadata": {
                "agent_id": payload.agent_id,
                "location_type": payload.location_type,
                "location_id": str(payload.location_id),
                "detected_class": payload.detected_class,
                "confidence": payload.confidence,
                "triggered_abort": triggered_abort
            }
        }).execute()
        
        # 6. Broadcast realtime event to vision_alerts channel
        broadcast_realtime_event(
            "vision_alerts",
            "vision_alert_fired",
            {
                "alert_id": alert_id,
                "location_id": str(payload.location_id),
                "location_type": payload.location_type,
                "detected_class": payload.detected_class,
                "confidence": payload.confidence,
                "triggered_abort": triggered_abort,
                "frame_storage_path": storage_path
            }
        )
        
        return {
            "success": True,
            "data": {
                "alert_id": alert_id,
                "status": "alert_registered",
                "triggered_abort": triggered_abort
            },
            "error": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register vision alert: {str(e)}"
        )
