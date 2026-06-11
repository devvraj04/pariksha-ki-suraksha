from fastapi import APIRouter

router = APIRouter(tags=["System"])

@router.get("/health")
def health_check():
    """Return system health status."""
    return {
        "success": True,
        "data": {
            "status": "ok"
        }
    }
