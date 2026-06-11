from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from dependencies.db import get_db
from dependencies.auth import get_current_user, require_print_operator, AuthenticatedUser
from models.print import PrintJobRequest, PrintJobEnvelope, PrintJobAbortRequest
from services import print_service

router = APIRouter(prefix="/print", tags=["Print"])

@router.post("/jobs", response_model=PrintJobEnvelope, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: PrintJobRequest,
    current_user: AuthenticatedUser = Depends(require_print_operator),
    db: Client = Depends(get_db)
):
    """
    Create and execute a secure watermarked print job.
    Requires Print Operator privileges.
    """
    try:
        job_info = print_service.create_print_job(db, current_user, payload)
        return {
            "success": True,
            "data": job_info,
            "error": None
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except KeyError as e:
        if "ERR_SESSION_EXPIRED" in str(e):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=status.HTTP_410_GONE,
                content={
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "ERR_SESSION_EXPIRED",
                        "message": "The print session has expired and the decrypted PDF has been wiped from memory."
                    }
                }
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/jobs/{job_id}/abort")
async def abort_job(
    job_id: str,
    payload: PrintJobAbortRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Abort an active print job.
    Requires Super Admin or the Print Operator who created the job.
    """
    if current_user.role not in ["super_admin", "print_operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only Super Admin or Print Operator can abort print jobs."
        )
        
    try:
        print_service.abort_print_job(db, current_user, job_id, payload.reason)
        return {
            "success": True,
            "data": {"message": "Print job successfully aborted."},
            "error": None
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
