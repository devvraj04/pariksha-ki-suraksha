from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from supabase import Client
from dependencies.db import get_db
from dependencies.auth import require_super_admin, require_authority, AuthenticatedUser, get_current_user
from services import vault_service
from models.vault import PaperUploadEnvelope, KeyShareEnvelope, PrintAuthorizeRequest, PrintAuthorizeEnvelope, ViewTokenEnvelope
from fastapi.responses import Response

router = APIRouter(prefix="/vault", tags=["Vault"])

@router.post("/papers", response_model=PaperUploadEnvelope, status_code=status.HTTP_201_CREATED)
async def upload_paper(
    file: UploadFile = File(...),
    exam_id: str = Form(...),
    title: str = Form(...),
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: Client = Depends(get_db)
):
    """
    Upload and encrypt a question paper.
    Requires Super Admin privileges.
    """
    # Validate PDF content type
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF documents are allowed."
        )
        
    # Check if exam_id exists in the database
    try:
        exam_check = db.table("exams").select("id").eq("id", exam_id).execute()
        if not exam_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exam with ID {exam_id} does not exist."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database lookup failed: {str(e)}"
        )
        
    # Read PDF bytes
    try:
        pdf_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file upload: {str(e)}"
        )
        
    # Process encryption, sharing, upload, and database logging
    try:
        upload_resp = vault_service.upload_and_register_paper(
            db=db,
            pdf_bytes=pdf_bytes,
            exam_id=exam_id,
            title=title,
            uploader_id=current_user.id
        )
        return {
            "success": True,
            "data": upload_resp,
            "error": None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vault registration failed: {str(e)}"
        )

@router.get("/key-shares/{share_id}", response_model=KeyShareEnvelope)
async def get_key_share(
    share_id: str,
    current_user: AuthenticatedUser = Depends(require_authority),
    db: Client = Depends(get_db)
):
    """
    Retrieve and decrypt a key share. Single-use endpoint.
    Only the assigned Authority A/B can retrieve their respective share.
    """
    try:
        # 1. Fetch share details from DB
        share_check = db.table("key_shares").select("*").eq("id", share_id).execute()
        if not share_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Key share with ID {share_id} not found."
            )
        share = share_check.data[0]
        
        # 2. Enforce authority role match
        if current_user.role != share["authority_role"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Only {share['authority_role']} can retrieve this share."
            )
            
        # 3. Check if already retrieved
        if share["is_retrieved"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ERR_SHARE_ALREADY_USED"
            )
            
        # 4. Decrypt the share
        share_value = vault_service.decrypt_share(share["share_value_encrypted"], share["authority_role"])
        
        # 5. Update the retrieved status in DB
        db.table("key_shares").update({
            "is_retrieved": True,
            "retrieved_at": "now()",
            "retrieved_by": current_user.id
        }).eq("id", share_id).execute()
        
        # 6. Log the retrieval to system audit logs
        audit_log = {
            "user_id": current_user.id,
            "action_type": "key_share_retrieved",
            "entity_type": "key_shares",
            "entity_id": share_id,
            "metadata": {"paper_id": share["paper_id"]}
        }
        db.table("audit_logs").insert(audit_log).execute()
        
        return {
            "success": True,
            "data": {
                "share_id": share_id,
                "share_value": share_value,
                "paper_id": share["paper_id"]
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve key share: {str(e)}"
        )

@router.post("/papers/{paper_id}/authorize-print", response_model=PrintAuthorizeEnvelope)
async def authorize_print(
    paper_id: str,
    payload: PrintAuthorizeRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_super_admin),
    db: Client = Depends(get_db)
):
    """
    Assemble the Shamir key shares, decrypt the question paper PDF,
    update DB status, and initialize print session in cache.
    Requires Super Admin privileges.
    """
    try:
        session_info = vault_service.authorize_print_session(
            db=db,
            paper_id=paper_id,
            share_a_hex=payload.share_a,
            share_b_hex=payload.share_b,
            authorized_copies=payload.authorized_copies,
            authorized_centers=[str(cid) for cid in payload.authorized_centers],
            print_window_minutes=payload.print_window_minutes,
            background_tasks=background_tasks
        )
        return {
            "success": True,
            "data": session_info,
            "error": None
        }
    except ValueError as e:
        detail_msg = str(e)
        if "Decryption failed" in detail_msg:
            detail_msg = "ERR_DECRYPTION_FAILED"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authorize print session: {str(e)}"
        )

@router.get("/papers/{paper_id}/view-token", response_model=ViewTokenEnvelope)
async def get_view_token(
    paper_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Generate a 60-second, single-use view token for replay-attack protection.
    Requires print_operator or super_admin role.
    """
    if current_user.role not in ["print_operator", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Print Operator or Super Admin credentials required."
        )
        
    try:
        # Check if the paper exists
        paper_check = db.table("papers").select("id").eq("id", paper_id).execute()
        if not paper_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Paper with ID {paper_id} not found."
            )
            
        token = vault_service.generate_view_token(db, paper_id)
        return {
            "success": True,
            "data": {"token": token},
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate view token: {str(e)}"
        )

@router.get("/papers/{paper_id}/view")
async def view_paper_pdf(
    paper_id: str,
    token: str,
    db: Client = Depends(get_db)
):
    """
    Stream the decrypted PDF bytes. Bypasses standard user auth headers,
    relying entirely on the single-use 60s view token query parameter.
    """
    try:
        pdf_bytes = vault_service.get_decrypted_paper_by_token(db, paper_id, token)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=paper.pdf",
                "Cache-Control": "no-store, no-cache, must-revalidate"
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except KeyError as e:
        if "ERR_SESSION_EXPIRED" in str(e):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="ERR_SESSION_EXPIRED"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decrypted view retrieval failed: {str(e)}"
        )

