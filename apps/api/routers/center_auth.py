import datetime
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client
from apps.api.deps import CurrentUser, get_service_db, get_current_user

router = APIRouter(prefix="/center", tags=["Center Portal Auth"])

class CenterLoginSchema(BaseModel):
    email: str
    password: str
    center_slug: str

@router.post("/login")
def center_login(body: CenterLoginSchema, db: Client = Depends(get_service_db)):
    # 1. Verify credentials against Supabase Auth using a temporary client connection
    from supabase import create_client
    from supabase.lib.client_options import ClientOptions
    from apps.api.core.config import settings
    
    options = ClientOptions(persist_session=False)
    anon_client = create_client(
        settings.NEXT_PUBLIC_SUPABASE_URL,
        settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        options=options
    )
    try:
        anon_client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid email or password credentials."
        )

    # 2. Find center by slug
    center_res = db.table("exam_centers").select("*").eq("slug", body.center_slug).execute()
    if not center_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Center with slug '{body.center_slug}' not found."
        )
    center = center_res.data[0]
    if not center["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="This exam center is currently inactive."
        )

    # 3. Find staff by email and center_id
    staff_res = db.table("agency_staff").select("*").eq("email", body.email).eq("center_id", center["id"]).execute()
    if not staff_res.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Staff email is not assigned/registered for this exam center."
        )
    staff = staff_res.data[0]
    if not staff["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Your staff account is currently deactivated."
        )

    # 4. Generate center-scoped JWT token
    claims = {
        "sub": staff["user_id"],
        "email": staff["email"],
        "role": staff["role"],
        "agency_id": staff["agency_id"],
        "center_id": center["id"],
        "center_slug": center["slug"],
        "app_metadata": {
            "role": staff["role"],
            "agency_id": staff["agency_id"],
            "center_id": center["id"]
        },
        "user_metadata": {
            "role": staff["role"],
            "agency_id": staff["agency_id"],
            "center_id": center["id"]
        }
    }
    
    # Generate center-scoped JWT token using RS256 and private key
    from apps.api.core.config import settings
    private_key = settings.ADMIT_CARD_JWT_PRIVATE_KEY.replace("\\n", "\n")
    if private_key.strip():
        token = jwt.encode(claims, private_key, algorithm="RS256")
    else:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=500, detail="JWT private key not configured.")
        token = jwt.encode(claims, "mock-secret-key", algorithm="HS256")
    
    return {
        "token": token,
        "role": staff["role"],
        "center_id": center["id"],
        "center_name": center["name"],
        "full_name": staff["full_name"]
    }

@router.get("/me")
def get_current_center(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    if not current_user.center_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Authenticated user is not assigned to any exam center."
        )
    try:
        # Query exam_centers and join exams table to get basic exam details
        center_res = db.table("exam_centers").select("*, exams(id, name, slug, exam_date, start_time, duration_minutes, status)").eq("id", current_user.center_id).execute()
        if not center_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Assigned center not found."
            )
        return center_res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))
