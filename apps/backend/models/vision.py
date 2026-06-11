from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Any

class VisionAlertRequest(BaseModel):
    agent_id: str
    location_type: str
    location_id: UUID
    detected_class: str
    confidence: float
    frame_jpeg_b64: str

class VisionAlertResponse(BaseModel):
    alert_id: UUID
    status: str
    triggered_abort: bool

class VisionAlertEnvelope(BaseModel):
    success: bool
    data: Optional[VisionAlertResponse] = None
    error: Optional[Any] = None
