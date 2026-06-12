import hashlib
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Query, status
from supabase import Client
from slowapi import Limiter
from slowapi.util import get_remote_address
from dependencies.db import get_db
from dependencies.auth import require_super_admin, AuthenticatedUser
from models.forensic import (
    ForensicUploadEnvelope,
    ForensicStatusEnvelope,
    ForensicReportsListEnvelope,
)
from services import forensic_service

router = APIRouter(prefix="/forensic", tags=["Forensic Intelligence"])

# Rate limiter instance — keyed by client IP
limiter = Limiter(key_func=get_remote_address)


@router.post("/upload", response_model=ForensicUploadEnvelope, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/hour")
async def upload_forensic_image(
    request: Request,
    file: UploadFile = File(...),
    description: str = Form(None),
    db: Client = Depends(get_db)
):
    """
    Public, anonymous endpoint for submitting suspected leaked exam paper images.
    Rate limited to 5 uploads per IP per hour.
    No authentication required.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Only JPEG and PNG images are accepted."
        )

    # Validate file size (10 MB max)
    file_bytes = await file.read()
    max_size = 10 * 1024 * 1024  # 10 MB
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size {len(file_bytes)} bytes exceeds the 10 MB limit."
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    try:
        # Extract client IP from request
        client_ip = get_remote_address(request) or "unknown"

        result = forensic_service.upload_forensic_image(
            db=db,
            file_bytes=file_bytes,
            original_filename=file.filename,
            description=description,
            client_ip=client_ip
        )

        return {
            "success": True,
            "data": result,
            "error": None
        }

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process forensic upload: {str(e)}"
        )


@router.get("/status/{job_id}", response_model=ForensicStatusEnvelope)
async def get_forensic_status(
    job_id: str,
    db: Client = Depends(get_db)
):
    """
    Public endpoint to check the status of a forensic analysis job.
    No authentication required.
    Returns the full report if processing is complete.
    """
    try:
        result = forensic_service.get_forensic_status(db, job_id)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Forensic job with ID '{job_id}' not found."
            )

        return {
            "success": True,
            "data": result,
            "error": None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve forensic status: {str(e)}"
        )


@router.get("/reports", response_model=ForensicReportsListEnvelope)
async def list_forensic_reports(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page"),
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: Client = Depends(get_db)
):
    """
    Admin-only paginated listing of all forensic reports.
    Requires Super Admin authentication.
    """
    try:
        result = forensic_service.list_forensic_reports(db, page=page, page_size=page_size)

        return {
            "success": True,
            "data": result,
            "error": None
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve forensic reports: {str(e)}"
        )
