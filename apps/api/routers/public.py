from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from apps.api.deps import get_service_db
from supabase import Client

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/exams")
def get_public_exams(
    mode: Optional[str] = None,
    city: Optional[str] = None,
    upcoming: Optional[bool] = True,
    page: int = 1,
    limit: int = 20,
    db: Client = Depends(get_service_db)
):
    limit = min(limit, 100)
    offset = (page - 1) * limit
    
    # Query exams with agency information joined
    # Note: In postgrest, we can query relations by specifying the join path like "*, agencies(name, slug)"
    query = db.table("exams").select("*, agencies(name, slug)")
    
    # Filter by public statuses
    query = query.in_("status", ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"])
    
    if mode:
        query = query.eq("mode", mode.upper())
        
    # Apply limit and offset
    query = query.range(offset, offset + limit - 1)
    
    try:
        response = query.execute()
        exams_data = response.data or []
        
        # Filter upcoming if requested
        if upcoming:
            from datetime import date
            today_str = date.today().isoformat()
            exams_data = [e for e in exams_data if e.get("exam_date") >= today_str]
            
        return exams_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )

@router.get("/exams/{exam_id}")
def get_public_exam_detail(exam_id: str, db: Client = Depends(get_service_db)):
    try:
        exam_response = db.table("exams").select("*, agencies(name, slug)").eq("id", exam_id).execute()
        if not exam_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found"
            )
        exam = exam_response.data[0]
        
        # Check status is public
        if exam.get("status") not in ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "RESULT_DECLARED"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this exam is restricted"
            )
            
        # Get centers list (names and cities only, no GPS coords for security)
        centers_response = db.table("exam_centers").select("name, city, state").eq("exam_id", exam_id).eq("is_active", True).execute()
        exam["centers"] = centers_response.data or []
        
        # Generate a signed URL for the brochure PDF if available
        brochure_path = exam.get("brochure_pdf_path")
        if brochure_path:
            try:
                # brochure path usually stored as bucket relative path, e.g. "exam_brochure_xxx.pdf"
                signed_url_res = db.storage.from_("brochures").create_signed_url(brochure_path, 3600)
                exam["brochure_signed_url"] = signed_url_res.get("signedURL")
            except Exception as se:
                print(f"Failed to generate signed URL for brochure: {se}")
                exam["brochure_signed_url"] = None
        else:
            exam["brochure_signed_url"] = None
            
        return exam
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve exam details: {str(e)}"
        )

@router.get("/exams/by-slug/{slug}")
def get_public_exam_by_slug(slug: str, db: Client = Depends(get_service_db)):
    try:
        exam_response = db.table("exams").select("*, agencies(name, slug)").eq("slug", slug).execute()
        if not exam_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found"
            )
        exam = exam_response.data[0]
        
        # Check status is public
        if exam.get("status") not in ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "RESULT_DECLARED"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this exam is restricted"
            )
            
        # Get centers list (names and cities only, no GPS coords for security)
        centers_response = db.table("exam_centers").select("name, city, state").eq("exam_id", exam["id"]).eq("is_active", True).execute()
        exam["centers"] = centers_response.data or []
        
        # Generate a signed URL for the brochure PDF if available
        brochure_path = exam.get("brochure_pdf_path")
        if brochure_path:
            try:
                signed_url_res = db.storage.from_("brochures").create_signed_url(brochure_path, 3600)
                exam["brochure_signed_url"] = signed_url_res.get("signedURL")
            except Exception as se:
                print(f"Failed to generate signed URL for brochure: {se}")
                exam["brochure_signed_url"] = None
        else:
            exam["brochure_signed_url"] = None
            
        return exam
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve exam details: {str(e)}"
        )


from pydantic import BaseModel
class DevLoginSchema(BaseModel):
    email: str
    password: str
    slug: str

@router.post("/dev-login")
def dev_login(body: DevLoginSchema, db: Client = Depends(get_service_db)):
    from apps.api.core.config import settings
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Dev bypass login is disabled in production environment.")

    # DEV MODE: Skip Supabase auth — verify password directly against demo password
    DEMO_PASSWORD = "AdminPassword123"
    if body.password != DEMO_PASSWORD:
        raise HTTPException(status_code=400, detail="Invalid email or password credentials.")

    # Find agency by slug
    agency_res = db.table("agencies").select("*").eq("slug", body.slug).execute()
    if not agency_res.data:
        raise HTTPException(status_code=404, detail="Agency not found.")
    agency = agency_res.data[0]
    if agency["status"] != "ACTIVE":
        raise HTTPException(status_code=403, detail=f"Agency status is {agency['status']}. Portal access is restricted.")
    
    # Find staff by email and agency_id
    staff_res = db.table("agency_staff").select("*").eq("email", body.email).eq("agency_id", agency["id"]).execute()
    if not staff_res.data:
        raise HTTPException(status_code=404, detail="Staff member email is not registered under this agency.")
    staff = staff_res.data[0]
    if not staff["is_active"]:
        raise HTTPException(status_code=403, detail="Your staff account is currently deactivated. Please contact your administrator.")
    
    # Generate mock JWT carrying metadata claims
    import jwt
    claims = {
        "sub": staff["user_id"],
        "email": staff["email"],
        "role": staff["role"],
        "agency_id": agency["id"],
        "app_metadata": {
            "role": staff["role"],
            "agency_id": agency["id"]
        },
        "user_metadata": {
            "role": staff["role"],
            "agency_id": agency["id"]
        }
    }
    # HS256 mock token with signature ignored in deps
    token = jwt.encode(claims, "mock-secret-key", algorithm="HS256")
    
    return {
        "token": token,
        "role": staff["role"],
        "agency_id": agency["id"],
        "full_name": staff["full_name"]
    }


class StudentDevLoginSchema(BaseModel):
    email: str
    password: str

@router.post("/student-dev-login")
def student_dev_login(body: StudentDevLoginSchema, db: Client = Depends(get_service_db)):
    from apps.api.core.config import settings
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Dev bypass login is disabled in production environment.")

    # DEV MODE: Skip Supabase auth — verify password directly
    DEMO_PASSWORD = "AdminPassword123"
    if body.password != DEMO_PASSWORD:
        raise HTTPException(status_code=400, detail="Invalid email or password credentials.")

    # Look up student by email
    student_res = db.table("students").select("*").eq("email", body.email).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="No student account found with this email address.")
    student = student_res.data[0]

    # Generate mock JWT
    import jwt
    claims = {
        "sub": student["user_id"],
        "email": student["email"],
        "role": "student",
        "user_metadata": {"role": "student"},
        "app_metadata": {"role": "student"},
    }
    token = jwt.encode(claims, "mock-secret-key", algorithm="HS256")

    return {
        "token": token,
        "student_id": student["id"],
        "full_name": student["full_name"],
        "email": student["email"],
    }
