from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Any, List

class PaperUploadResponse(BaseModel):
    paper_id: UUID
    exam_id: UUID
    key_share_a_id: UUID
    key_share_b_id: UUID
    status: str

class PaperUploadEnvelope(BaseModel):
    success: bool
    data: Optional[PaperUploadResponse] = None
    error: Optional[Any] = None

class KeyShareData(BaseModel):
    share_id: UUID
    share_value: str
    paper_id: UUID

class KeyShareEnvelope(BaseModel):
    success: bool
    data: Optional[KeyShareData] = None
    error: Optional[Any] = None

class PrintAuthorizeRequest(BaseModel):
    share_a: str
    share_b: str
    authorized_copies: int
    authorized_centers: List[UUID]
    print_window_minutes: int

class PrintAuthorizeResponse(BaseModel):
    print_session_id: UUID
    expires_at: str
    authorized_copies: int

class PrintAuthorizeEnvelope(BaseModel):
    success: bool
    data: Optional[PrintAuthorizeResponse] = None
    error: Optional[Any] = None

class ViewTokenResponse(BaseModel):
    token: str

class ViewTokenEnvelope(BaseModel):
    success: bool
    data: Optional[ViewTokenResponse] = None
    error: Optional[Any] = None
