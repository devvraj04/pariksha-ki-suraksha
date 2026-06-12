# apps/backend/api/v1/centers.py
from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID

from dependencies.auth import require_super_admin, require_supervisor, get_current_user
from dependencies.db import get_db
from models.centers_models import (
    GenerateAdmitCardsRequest,
    VerifyAdmitCardRequest,
    ReceiveBatchRequest,
)
from services.admit_card_service import generate_admit_cards, verify_admit_card
from services.centers_service import receive_batch

router = APIRouter(tags=["centers"])


# ──────────────────────────────────────────────────
# POST /admit-cards/generate
# Auth: super_admin
# ──────────────────────────────────────────────────
@router.post("/admit-cards/generate")
async def generate_admit_cards_endpoint(
    body: GenerateAdmitCardsRequest,
    current_user=Depends(require_super_admin),
    db=Depends(get_db),
):
    try:
        result = await generate_admit_cards(
            exam_id=str(body.exam_id),
            center_id=str(body.center_id),
            issued_by=current_user["id"],
            db=db,
        )
        return {"success": True, "data": result, "error": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────
# POST /admit-cards/verify
# Auth: supervisor
# ──────────────────────────────────────────────────
@router.post("/admit-cards/verify")
async def verify_admit_card_endpoint(
    body: VerifyAdmitCardRequest,
    current_user=Depends(require_supervisor),
    db=Depends(get_db),
):
    result = await verify_admit_card(
        qr_payload=body.qr_payload,
        center_id=str(body.center_id),
        verified_by=str(body.verified_by),
        db=db,
    )
    return {"success": True, "data": result, "error": None}


# ──────────────────────────────────────────────────
# POST /centers/{center_id}/receive-batch
# Auth: supervisor
# ──────────────────────────────────────────────────
@router.post("/centers/{center_id}/receive-batch")
async def receive_batch_endpoint(
    center_id: UUID,
    body: ReceiveBatchRequest,
    current_user=Depends(require_supervisor),
    db=Depends(get_db),
):
    try:
        result = await receive_batch(
            center_id=str(center_id),
            batch_id=str(body.batch_id),
            qr_seal_payload=body.qr_seal_payload,
            paper_count_received=body.paper_count_received,
            received_by=current_user["id"],
            db=db,
        )
        return {"success": True, "data": result, "error": None}
    except ValueError as e:
        code = str(e)
        return {"success": False, "data": None, "error": {"code": code, "message": code}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))