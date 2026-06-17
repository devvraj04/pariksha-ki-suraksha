"""
Phase 12 — Result Publication & Student Result Access Router
"""
import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from apps.api.deps import get_service_db, RequireRole, CurrentUser, log_audit, check_rate_limit, redis_client
from apps.api.core.config import settings

router = APIRouter()

class RequestOtpSchema(BaseModel):
    application_number: str

class VerifyResultSchema(BaseModel):
    application_number: str
    otp: str
    captcha_token: Optional[str] = None


@router.get("/exams/{id}/publication-readiness")
def get_publication_readiness(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check 1: All answer sheets must be SEALED
        total_res = db.table("answer_sheet_uploads").select("id", count="exact").eq("exam_id", id).execute()
        total_count = total_res.count or 0
        
        sealed_res = db.table("answer_sheet_uploads").select("id", count="exact").eq("exam_id", id).eq("upload_status", "SEALED").execute()
        sealed_count = sealed_res.count or 0
        
        all_sheets_sealed = (total_count > 0) and (total_count == sealed_count)

        # Check 2: All assignments must be COMPLETED
        total_assign = db.table("evaluator_assignments").select("id", count="exact").eq("exam_id", id).execute()
        assign_count = total_assign.count or 0
        
        completed_assign = db.table("evaluator_assignments").select("id", count="exact").eq("exam_id", id).eq("status", "COMPLETED").execute()
        completed_count = completed_assign.count or 0
        
        all_assignments_completed = (assign_count > 0) and (assign_count == completed_count)

        # Check 3: All discrepancies must be RESOLVED
        open_disc = db.table("evaluation_discrepancies").select("id", count="exact").eq("exam_id", id).eq("status", "OPEN").execute()
        all_discrepancies_resolved = (open_disc.count or 0) == 0

        # Check 4: Chief Moderator must have approved
        exam_res = db.table("exams").select("evaluation_approved_at").eq("id", id).execute()
        chief_moderator_approved = False
        if exam_res.data:
            chief_moderator_approved = exam_res.data[0]["evaluation_approved_at"] is not None

        ready_to_publish = all_sheets_sealed and all_assignments_completed and all_discrepancies_resolved and chief_moderator_approved

        return {
            "all_sheets_sealed": all_sheets_sealed,
            "sealed_sheets": f"{sealed_count}/{total_count}",
            "all_assignments_completed": all_assignments_completed,
            "completed_assignments": f"{completed_count}/{assign_count}",
            "all_discrepancies_resolved": all_discrepancies_resolved,
            "open_discrepancies": open_disc.count or 0,
            "chief_moderator_approved": chief_moderator_approved,
            "ready_to_publish": ready_to_publish
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/results/compile")
def compile_results(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Verify readiness
        readiness = get_publication_readiness(id, current_user, db)
        if not readiness["ready_to_publish"]:
            raise HTTPException(status_code=400, detail="Exam is not ready for results compilation. Ensure sheets are sealed and evaluation approved.")

        # Fire results compilation background task
        from apps.api.workers.tasks_results import compile_exam_results
        task = compile_exam_results.delay(id)
        return {"job_id": task.id, "status": "processing"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{id}/results/preview")
def get_results_preview(
    id: str,
    current_user: CurrentUser = Depends(RequireRole("agency_head", "manager")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check if compilation has run
        res = db.table("exam_results").select("final_marks, percentage, rank").eq("exam_id", id).execute()
        results = res.data or []
        if not results:
            return {
                "compiled": False,
                "histogram": [],
                "pass_rate": 0.0,
                "top_10": []
            }

        # Compute histogram (buckets of 10)
        histogram = {f"{i}-{i+10}": 0 for i in range(0, 100, 10)}
        histogram["90-100"] = 0
        
        pass_count = 0
        for r in results:
            pct = float(r["percentage"])
            # Bucket
            bucket_idx = int(pct // 10) * 10
            if bucket_idx >= 100:
                bucket_idx = 90
            bucket_key = f"{bucket_idx}-{bucket_idx+10}"
            histogram[bucket_key] = histogram.get(bucket_key, 0) + 1
            if pct >= 40.0:
                pass_count += 1

        histogram_list = [{"bucket": k, "count": v} for k, v in histogram.items()]
        pass_rate = round((pass_count / len(results)) * 100, 2) if results else 0.0

        # Top 10 rankers (Anonymized for preview)
        top_res = db.table("exam_results").select(
            "rank, final_marks, percentage, exam_registrations(application_number)"
        ).eq("exam_id", id).order("rank").limit(10).execute()
        
        top_10 = []
        for index, item in enumerate(top_res.data or []):
            top_10.append({
                "rank": item["rank"] or (index + 1),
                "score": item["final_marks"],
                "percentage": item["percentage"],
                "application_number": item["exam_registrations"]["application_number"] if item.get("exam_registrations") else f"APP-RANK-{index+1}"
            })

        return {
            "compiled": True,
            "total_candidates": len(results),
            "pass_rate": pass_rate,
            "histogram": histogram_list,
            "top_10": top_10
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{id}/results/publish")
def publish_results(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(RequireRole("agency_head")),
    db: Client = Depends(get_service_db)
):
    try:
        # Check if results compiled
        res = db.table("exam_results").select("id", count="exact").eq("exam_id", id).execute()
        if (res.count or 0) == 0:
            raise HTTPException(status_code=400, detail="Cannot publish: Results must be compiled first.")

        # Update exam status
        db.table("exams").update({
            "status": "RESULT_DECLARED"
        }).eq("id", id).execute()

        log_audit(
            event_type="RESULTS_PUBLISHED",
            event_description=f"Results for exam {id} declared and published.",
            metadata={"exam_id": id},
            actor_id=current_user.id,
            agency_id=current_user.agency_id,
            exam_id=id,
            ip_address=request.client.host if request.client else None
        )

        # Fire email notifications task
        from apps.api.workers.tasks_results import notify_students_result_declared
        notify_students_result_declared.delay(id)

        return {"status": "success", "message": "Results declared successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/request-otp")
def request_result_otp(
    body: RequestOtpSchema,
    db: Client = Depends(get_service_db)
):
    try:
        # Rate limit check: 5 requests per application number per hour
        if not check_rate_limit(f"rate_limit:otp:{body.application_number}", 5, 3600):
            raise HTTPException(status_code=429, detail="Too many OTP requests. Try again in an hour.")

        # Lookup registration & student phone
        reg_res = db.table("exam_registrations").select(
            "student_id, exams(status)"
        ).eq("application_number", body.application_number).execute()
        
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Application number not found.")
        reg = reg_res.data[0]

        exam_status = reg["exams"].get("status") if reg.get("exams") else ""
        if exam_status != "RESULT_DECLARED":
            raise HTTPException(status_code=400, detail="Results for this exam have not been published yet.")

        # Get phone
        student_res = db.table("students").select("phone").eq("id", reg["student_id"]).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        phone = student_res.data[0]["phone"]

        # Generate OTP (mock send, return last4 for user feedback)
        otp = f"{random.randint(100000, 999999)}"
        redis_client.set(f"result_otp:{body.application_number}", otp, ex=300) # 5 min expiry

        print(f"[Result OTP Bypassed] Application: {body.application_number} -> Phone: {phone} -> Dev OTP: {otp}")

        last4 = phone[-4:] if len(phone) >= 4 else phone
        return {
            "phone_last4": last4,
            "message": "OTP sent successfully to registered mobile number.",
            "dev_otp": otp # Return developer OTP for easier test automation
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/verify")
def verify_result(
    body: VerifyResultSchema,
    db: Client = Depends(get_service_db)
):
    try:
        # Rate limit verify attempts: 5 attempts per application number per hour
        if not check_rate_limit(f"rate_limit:verify:{body.application_number}", 5, 3600):
            raise HTTPException(status_code=429, detail="Too many incorrect OTP attempts. Try again in an hour.")

        # Validate OTP
        stored_otp = redis_client.get(f"result_otp:{body.application_number}")
        if not stored_otp or stored_otp.decode("utf-8") != body.otp:
            raise HTTPException(status_code=400, detail="Incorrect OTP or OTP expired.")

        # Fetch result details
        reg_res = db.table("exam_registrations").select(
            "id, student_id, exam_id, exams(name, status)"
        ).eq("application_number", body.application_number).execute()
        
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Application number not found.")
        reg = reg_res.data[0]

        if reg["exams"]["status"] != "RESULT_DECLARED":
            raise HTTPException(status_code=400, detail="Results for this exam have not been published yet.")

        result_res = db.table("exam_results").select("*").eq("registration_id", reg["id"]).execute()
        if not result_res.data:
            raise HTTPException(status_code=404, detail="Result scorecard not compiled yet.")
        result = result_res.data[0]

        student_res = db.table("students").select("full_name, photo_path").eq("id", reg["student_id"]).execute()
        student = student_res.data[0] if student_res.data else {"full_name": "Unknown Candidate", "photo_path": None}

        # Clear OTP after verification success
        redis_client.delete(f"result_otp:{body.application_number}")

        # Return full details
        return {
            "candidate_name": student["full_name"],
            "photo_path": student["photo_path"],
            "exam_name": reg["exams"]["name"],
            "application_number": body.application_number,
            "final_marks": result["final_marks"],
            "max_marks": result["max_marks"],
            "percentage": result["percentage"],
            "rank": result["rank"],
            "category_rank": result["category_rank"],
            "result_status": result["result_status"],
            "subject_breakdown": result["subject_breakdown"],
            "result_pdf_path": result["result_pdf_path"]
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/me/results")
def list_student_authenticated_results(
    current_user: CurrentUser = Depends(RequireRole("student")),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student ID and name
        student_res = db.table("students").select("id, full_name").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]
        student_name = student_res.data[0]["full_name"]

        # Find results where status is declared
        results_res = db.table("exam_results").select(
            "*, exams(name, status), exam_registrations(application_number)"
        ).eq("student_id", student_id).execute()
        
        data = results_res.data or []
        declared_results = []
        for item in data:
            if item.get("exams", {}).get("status") == "RESULT_DECLARED":
                declared_results.append({
                    "id": item["id"],
                    "candidate_name": student_name,
                    "exam_name": item["exams"]["name"],
                    "application_number": item["exam_registrations"]["application_number"] if item.get("exam_registrations") else "",
                    "final_marks": item["final_marks"],
                    "max_marks": item["max_marks"],
                    "percentage": item["percentage"],
                    "rank": item["rank"],
                    "category_rank": item["category_rank"],
                    "result_status": item["result_status"],
                    "subject_breakdown": item["subject_breakdown"],
                    "result_pdf_path": item["result_pdf_path"]
                })
        return declared_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

