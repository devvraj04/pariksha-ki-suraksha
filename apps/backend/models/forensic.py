from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Any, List
from datetime import datetime


# --- Upload ---

class ForensicUploadResponse(BaseModel):
    job_id: UUID
    status: str
    estimated_seconds: int


class ForensicUploadEnvelope(BaseModel):
    success: bool
    data: Optional[ForensicUploadResponse] = None
    error: Optional[Any] = None


# --- Status / Report ---

class CustodyChainEvent(BaseModel):
    event: str
    actor: Optional[str] = None
    timestamp: Optional[str] = None


class ForensicReportData(BaseModel):
    report_id: UUID
    upload_id: UUID
    tmc_decoded: Optional[dict] = None
    primary_suspect_operator_id: Optional[UUID] = None
    primary_suspect_operator_name: Optional[str] = None
    primary_suspect_printer_id: Optional[str] = None
    primary_suspect_center_id: Optional[UUID] = None
    primary_suspect_center_name: Optional[str] = None
    leaked_at: Optional[str] = None
    custody_chain: Optional[List[CustodyChainEvent]] = None
    confidence_score: Optional[float] = None
    processing_notes: Optional[str] = None
    created_at: Optional[str] = None


class ForensicStatusResponse(BaseModel):
    job_id: UUID
    status: str
    report: Optional[ForensicReportData] = None


class ForensicStatusEnvelope(BaseModel):
    success: bool
    data: Optional[ForensicStatusResponse] = None
    error: Optional[Any] = None


# --- Admin Reports List ---

class ForensicReportListItem(BaseModel):
    report_id: UUID
    upload_id: UUID
    original_filename: Optional[str] = None
    status: str
    confidence_score: Optional[float] = None
    primary_suspect_operator_name: Optional[str] = None
    primary_suspect_printer_id: Optional[str] = None
    created_at: Optional[str] = None


class ForensicReportsListResponse(BaseModel):
    reports: List[ForensicReportListItem]
    total: int
    page: int
    page_size: int


class ForensicReportsListEnvelope(BaseModel):
    success: bool
    data: Optional[ForensicReportsListResponse] = None
    error: Optional[Any] = None
