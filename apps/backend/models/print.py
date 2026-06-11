from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Any, List

class PrintJobRequest(BaseModel):
    paper_id: UUID
    session_id: UUID
    center_id: UUID
    printer_id: str
    copies_requested: int

class PrintJobResponse(BaseModel):
    job_id: UUID
    status: str
    copies_printed: int
    completed_at: Optional[str] = None

class PrintJobEnvelope(BaseModel):
    success: bool
    data: Optional[PrintJobResponse] = None
    error: Optional[Any] = None

class PrintJobAbortRequest(BaseModel):
    reason: str
