# apps/backend/models/centers_models.py
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

# --- Admit Card Models ---

class GenerateAdmitCardsRequest(BaseModel):
    exam_id: UUID
    center_id: UUID

class AdmitCardJWT(BaseModel):
    student_id: str
    jwt_string: str

class GenerateAdmitCardsResponse(BaseModel):
    exam_id: str
    center_id: str
    generated_count: int
    admit_cards: list[AdmitCardJWT]

class VerifyAdmitCardRequest(BaseModel):
    qr_payload: str          # the JWT string scanned from QR
    center_id: UUID
    verified_by: UUID

class VerifyAdmitCardResponse(BaseModel):
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    is_valid: bool
    already_scanned: bool = False
    failure_reason: Optional[str] = None   # 'invalid_signature' | 'expired' | 'wrong_center' | 'revoked'
    photo_url: Optional[str] = None

# --- Batch Reception Models ---

class ReceiveBatchRequest(BaseModel):
    batch_id: UUID
    qr_seal_payload: str
    paper_count_received: int

class ReceiveBatchResponse(BaseModel):
    reception_id: str
    count_mismatch: bool
    qr_seal_verified: bool