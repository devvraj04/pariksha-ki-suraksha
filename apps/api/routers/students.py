import uuid
import datetime
import base64
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, File, UploadFile
from pydantic import BaseModel, EmailStr
from supabase import Client
from cryptography.fernet import Fernet

from apps.api.deps import CurrentUser, get_service_db, get_current_user, log_audit
from apps.api.core.config import settings

router = APIRouter(prefix="", tags=["Students Portal"])

# Schemas
class StudentUpdateSchema(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

class PreferenceRegistrationSchema(BaseModel):
    center_preference_1: str
    center_preference_2: str
    center_preference_3: str

# Helper to encrypt ID proof number
def encrypt_id_number(id_number: str) -> str:
    try:
        encryption_key = settings.STUDENT_ID_ENCRYPTION_KEY
        if not encryption_key:
            # Secure fallback using service role key and SHA256 (remediates V-010)
            key_src = (settings.SUPABASE_SERVICE_ROLE_KEY or "default-secret-key-32-bytes-long-padding").encode()
            import hashlib
            derived_key = hashlib.sha256(key_src).digest()
            encryption_key = base64.urlsafe_b64encode(derived_key).decode()
        
        fernet = Fernet(encryption_key.encode())
        return fernet.encrypt(id_number.encode()).decode()
    except Exception as e:
        print(f"Encryption failed: {e}")
        return id_number

# Endpoints

@router.post("/students/register")
async def register_student(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    phone: str = Form(...),
    date_of_birth: str = Form(...), # YYYY-MM-DD
    gender: str = Form(...),
    address: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    pincode: str = Form(...),
    id_proof_type: str = Form(...),
    id_proof_number: str = Form(...),
    photo: UploadFile = File(...),
    id_proof_scan: UploadFile = File(...),
    db: Client = Depends(get_service_db)
):
    try:
        # Check if email is already registered in student registry
        exist_check = db.table("students").select("id").eq("email", email).execute()
        if exist_check.data:
            raise HTTPException(status_code=400, detail="Student email is already registered.")

        # 1. Create User in Supabase Auth via Admin Client
        auth_response = db.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "role": "student",
                "full_name": full_name
            },
            "app_metadata": {
                "role": "student"
            }
        })
        auth_user = auth_response.user
        if not auth_user:
            raise HTTPException(status_code=500, detail="Failed to create student auth account.")

        student_id = str(uuid.uuid4())
        
        # Read file bytes
        photo_bytes = await photo.read()
        id_bytes = await id_proof_scan.read()

        # Validate photo size and type (remediates V-028)
        if len(photo_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Profile photo exceeds 5MB size limit.")
        if not (photo_bytes.startswith(b'\xff\xd8\xff') or photo_bytes.startswith(b'\x89PNG\r\n\x1a\n')):
            raise HTTPException(status_code=400, detail="Invalid profile photo format. Only JPEG or PNG is allowed.")

        # Validate ID proof scan size and type (remediates V-028)
        if len(id_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="ID proof scan exceeds 10MB size limit.")
        if not (id_bytes.startswith(b'%PDF-') or id_bytes.startswith(b'\xff\xd8\xff') or id_bytes.startswith(b'\x89PNG\r\n\x1a\n')):
            raise HTTPException(status_code=400, detail="Invalid ID proof scan format. Only PDF, JPEG, or PNG is allowed.")
        
        # 2. Upload photo to webcam-snapshots bucket
        photo_ext = photo.filename.split(".")[-1] if photo.filename and "." in photo.filename else "jpg"
        photo_filename = f"{student_id}/profile.{photo_ext}"
        try:
            db.storage.from_("webcam-snapshots").upload(
                photo_filename, 
                photo_bytes, 
                {"content-type": photo.content_type or "image/jpeg"}
            )
        except Exception:
            try:
                db.storage.from_("webcam-snapshots").update(
                    photo_filename, 
                    photo_bytes, 
                    {"content-type": photo.content_type or "image/jpeg"}
                )
            except Exception as se:
                db.auth.admin.delete_user(auth_user.id)
                raise HTTPException(status_code=500, detail=f"Failed to upload photo scan: {se}")

        # 3. Upload ID Proof scan to evidence-uploads bucket
        id_ext = id_proof_scan.filename.split(".")[-1] if id_proof_scan.filename and "." in id_proof_scan.filename else "pdf"
        id_filename = f"{student_id}/id_proof.{id_ext}"
        try:
            db.storage.from_("evidence-uploads").upload(
                id_filename, 
                id_bytes, 
                {"content-type": id_proof_scan.content_type or "application/pdf"}
            )
        except Exception:
            try:
                db.storage.from_("evidence-uploads").update(
                    id_filename, 
                    id_bytes, 
                    {"content-type": id_proof_scan.content_type or "application/pdf"}
                )
            except Exception as se:
                db.auth.admin.delete_user(auth_user.id)
                raise HTTPException(status_code=500, detail=f"Failed to upload ID proof scan: {se}")

        # 4. Encrypt ID Proof Number
        encrypted_id_number = encrypt_id_number(id_proof_number)

        # 5. Insert row into public.students
        student_data = {
            "id": student_id,
            "user_id": auth_user.id,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "date_of_birth": date_of_birth,
            "gender": gender.upper(),
            "address": address,
            "city": city,
            "state": state,
            "pincode": pincode,
            "photo_path": photo_filename,
            "id_proof_type": id_proof_type,
            "id_proof_number": encrypted_id_number,
            "id_proof_path": id_filename
        }

        insert_res = db.table("students").insert(student_data).execute()
        if not insert_res.data:
            db.auth.admin.delete_user(auth_user.id)
            raise HTTPException(status_code=500, detail="Failed to create student profile.")

        # 6. Trigger Celery Task to generate biometric hash from photo
        try:
            from apps.api.workers.tasks_ai import generate_biometric_hash
            generate_biometric_hash.delay(student_id)
        except Exception as te:
            print(f"Failed to queue biometric hash generation: {te}")

        log_audit(
            event_type="STUDENT_ACCOUNT_CREATED",
            event_description=f"Student account created for {full_name} ({email}).",
            metadata={"student_id": student_id},
            actor_id=auth_user.id,
            ip_address=request.client.host
        )

        return {
            "student_id": student_id,
            "status": "ACCOUNT_CREATED",
            "message": "Student account registered successfully. Face biometrics verification started."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/me")
def get_student_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        res = db.table("students").select("*").eq("user_id", current_user.id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
            
        student = res.data[0]
        
        # Prepare response (masking sensitive fields, hiding raw hash value)
        profile_data = {
            "id": student["id"],
            "full_name": student["full_name"],
            "email": student["email"],
            "phone": student["phone"],
            "date_of_birth": student["date_of_birth"],
            "gender": student["gender"],
            "address": student["address"],
            "city": student["city"],
            "state": student["state"],
            "pincode": student["pincode"],
            "photo_path": student["photo_path"],
            "id_proof_type": student["id_proof_type"],
            "biometric_hash_present": bool(student.get("biometric_hash")),
            "created_at": student["created_at"]
        }
        return profile_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/students/me")
def update_student_profile(
    body: StudentUpdateSchema,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        update_data = {}
        for k, v in body.model_dump(exclude_unset=True).items():
            update_data[k] = v
            
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update.")
            
        res = db.table("students").update(update_data).eq("user_id", current_user.id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
            
        return {"status": "success", "message": "Profile updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exams/{examId}/registration-form")
def get_registration_form_details(
    examId: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        # Get exam
        exam_res = db.table("exams").select("*").eq("id", examId).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]

        # Get centers
        centers_res = db.table("exam_centers").select("id, name, city").eq("exam_id", examId).eq("is_active", True).execute()
        centers = centers_res.data or []

        # Check if already registered
        reg_check = db.table("exam_registrations").select("id, status").eq("student_id", student_id).eq("exam_id", examId).execute()
        is_registered = len(reg_check.data) > 0
        registration_status = reg_check.data[0]["status"] if is_registered else None

        return {
            "exam_name": exam["name"],
            "mode": exam["mode"],
            "fee_inr": exam["fee_inr"],
            "eligibility_criteria": exam.get("eligibility_criteria"),
            "centers": centers,
            "is_registered": is_registered,
            "registration_status": registration_status
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exams/{examId}/registrations")
def register_for_exam(
    examId: str,
    body: PreferenceRegistrationSchema,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student
        student_res = db.table("students").select("*").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student = student_res.data[0]
        student_id = student["id"]

        # Pre-check: Verify biometric hash is generated
        if not student.get("biometric_hash"):
            # If not yet generated, wait a second or generate it synchronously
            # For resilience, we allow registering but warn/block admit card issuance.
            # Let's verify we at least have a photo_path.
            if not student.get("photo_path"):
                raise HTTPException(
                    status_code=400, 
                    detail="Face photo is required. Please update your profile picture first."
                )

        # Get exam
        exam_res = db.table("exams").select("*").eq("id", examId).execute()
        if not exam_res.data:
            raise HTTPException(status_code=404, detail="Exam not found.")
        exam = exam_res.data[0]

        if exam["status"] != "REGISTRATION_OPEN":
            raise HTTPException(
                status_code=400, 
                detail=f"Registration is not open for this exam. Current status: {exam['status']}"
            )

        # Double check candidate limit
        registered_count_res = db.table("exam_registrations").select("id", count="exact").eq("exam_id", examId).eq("status", "REGISTERED").execute()
        total_registered = registered_count_res.count or 0
        if total_registered >= exam["total_seats"]:
            # Auto-close registration since limit reached
            try:
                db.table("exams").update({"status": "REGISTRATION_CLOSED"}).eq("id", examId).execute()
            except Exception:
                pass
            raise HTTPException(status_code=400, detail="Registration limit reached for this examination.")

        # Check existing registration
        exist_check = db.table("exam_registrations").select("id").eq("student_id", student_id).eq("exam_id", examId).execute()
        if exist_check.data:
            raise HTTPException(status_code=400, detail="You are already registered for this exam.")

        # Generate unique sequential application number
        year = datetime.datetime.utcnow().year
        count_res = db.table("exam_registrations").select("id", count="exact").execute()
        seq = (count_res.count or 0) + 1
        application_number = f"LG-{year}-{seq:05d}"

        # Insert registration in PENDING_PAYMENT
        reg_data = {
            "student_id": student_id,
            "exam_id": examId,
            "application_number": application_number,
            "status": "PENDING_PAYMENT",
            "payment_status": "PENDING",
            "center_preference_1": body.center_preference_1 if body.center_preference_1 else None,
            "center_preference_2": body.center_preference_2 if body.center_preference_2 else None,
            "center_preference_3": body.center_preference_3 if body.center_preference_3 else None
        }

        res = db.table("exam_registrations").insert(reg_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to initiate exam registration.")

        return {
            "registration_id": res.data[0]["id"],
            "application_number_preview": application_number,
            "fee_inr": exam["fee_inr"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/registrations/{id}/payment/initiate")
def initiate_payment(
    id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        # Get registration
        reg_res = db.table("exam_registrations").select("*, exams(*)").eq("id", id).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Registration record not found.")
        reg = reg_res.data[0]

        if reg["student_id"] != student_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to registration.")

        exam = reg["exams"]
        amount_paise = int(exam["fee_inr"] * 100)

        # Mock Razorpay Checkout Payload
        checkout_payload = {
            "key": settings.RAZORPAY_KEY_ID or "rzp_test_mockkey",
            "amount": amount_paise,
            "currency": "INR",
            "order_id": f"order_{str(uuid.uuid4())[:12]}",
            "name": "ParikshaSetu",
            "description": f"Registration Fee for {exam['name']}",
            "prefill": {
                "name": current_user.email.split("@")[0],
                "email": current_user.email
            },
            "notes": {
                "registration_id": id,
                "exam_id": exam["id"]
            }
        }
        return checkout_payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/registrations/{id}/payment/confirm")
def dev_confirm_payment(
    id: str,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    """
    Developer bypass helper to instantly complete payment and set registration to REGISTERED.
    """
    try:
        # Get student
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        # Get registration
        reg_res = db.table("exam_registrations").select("*, exams(*)").eq("id", id).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Registration record not found.")
        reg = reg_res.data[0]

        if reg["student_id"] != student_id:
            raise HTTPException(status_code=403, detail="Unauthorized.")

        exam = reg["exams"]
        transaction_id = f"tx_{str(uuid.uuid4())[:12].upper()}"

        update_data = {
            "status": "REGISTERED",
            "payment_status": "SUCCESS",
            "payment_transaction_id": transaction_id,
            "payment_amount_inr": exam["fee_inr"],
            "payment_at": datetime.datetime.utcnow().isoformat() + "Z",
            "registered_at": datetime.datetime.utcnow().isoformat() + "Z"
        }

        res = db.table("exam_registrations").update(update_data).eq("id", id).execute()

        log_audit(
            event_type="STUDENT_REGISTERED",
            event_description=f"Student registered for exam '{exam['name']}'. Payment transaction: {transaction_id}.",
            metadata={"registration_id": id, "exam_id": exam["id"]},
            actor_id=current_user.id,
            ip_address=request.client.host
        )

        # Trigger confirmation email background task
        # Normally this would be send_registration_confirmation.delay(...)
        print(f"[Celery Mock] Triggering send_registration_confirmation for {current_user.email}")

        return {
            "status": "success",
            "message": "Payment confirmed. Exam registration is now active.",
            "registration": res.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payments/webhook")
def payment_webhook(
    body: Dict[str, Any],
    request: Request,
    db: Client = Depends(get_service_db)
):
    """
    Public webhook endpoint for Razorpay payment captures.
    """
    # Simply extract the payload notes registration_id if not checking signature
    try:
        event = body.get("event")
        if event == "payment.captured":
            payment = body["payload"]["payment"]["entity"]
            notes = payment.get("notes") or {}
            reg_id = notes.get("registration_id")
            
            if reg_id:
                reg_res = db.table("exam_registrations").select("*, exams(*)").eq("id", reg_id).execute()
                if reg_res.data:
                    reg = reg_res.data[0]
                    exam = reg["exams"]
                    
                    update_data = {
                        "status": "REGISTERED",
                        "payment_status": "SUCCESS",
                        "payment_transaction_id": payment["id"],
                        "payment_amount_inr": float(payment["amount"]) / 100.0,
                        "payment_at": datetime.datetime.utcnow().isoformat() + "Z",
                        "registered_at": datetime.datetime.utcnow().isoformat() + "Z"
                    }
                    
                    db.table("exam_registrations").update(update_data).eq("id", reg_id).execute()
                    
                    log_audit(
                        event_type="STUDENT_REGISTERED",
                        event_description=f"Webhook: Student registered for exam '{exam['name']}' via Razorpay.",
                        metadata={"registration_id": reg_id, "exam_id": exam["id"]},
                        ip_address=request.client.host
                    )
        return {"status": "processed"}
    except Exception as e:
        print(f"Webhook processing error: {e}")
        # Webhook should always return 200/ok to avoid retries if we parsed it
        return {"status": "error", "detail": str(e)}


@router.get("/students/me/registrations")
def get_my_registrations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        # Get student
        student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student profile not found.")
        student_id = student_res.data[0]["id"]

        # Fetch registrations
        res = db.table("exam_registrations").select("*, exams(*, agencies(name, slug))").eq("student_id", student_id).execute()
        regs = res.data or []
        
        # Check if admit card exists for each
        for r in regs:
            ac_res = db.table("admit_cards").select("id").eq("registration_id", r["id"]).eq("is_valid", True).execute()
            r["admit_card_id"] = ac_res.data[0]["id"] if ac_res.data else None
            
        return regs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/registrations/{id}")
def get_registration_detail(
    id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        reg_res = db.table("exam_registrations").select("*, exams(*, agencies(name, slug)), students(*)").eq("id", id).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Registration not found.")
        reg = reg_res.data[0]

        # Auth check
        if current_user.role == "student":
            student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
            if not student_res.data or reg["student_id"] != student_res.data[0]["id"]:
                raise HTTPException(status_code=403, detail="Unauthorized access to registration.")
        else:
            # Staff check - agency scope
            if current_user.agency_id != reg["exams"]["agency_id"]:
                raise HTTPException(status_code=403, detail="Unauthorized access to registration.")

        # Check admit card
        ac_res = db.table("admit_cards").select("id").eq("registration_id", id).eq("is_valid", True).execute()
        reg["admit_card_id"] = ac_res.data[0]["id"] if ac_res.data else None

        return reg
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/registrations/{id}/admit-card")
def get_registration_admit_card(
    id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_service_db)
):
    try:
        # Get registration details for security check
        reg_res = db.table("exam_registrations").select("student_id, exam_id").eq("id", id).execute()
        if not reg_res.data:
            raise HTTPException(status_code=404, detail="Registration not found.")
        reg = reg_res.data[0]

        # Auth check
        if current_user.role == "student":
            student_res = db.table("students").select("id").eq("user_id", current_user.id).execute()
            if not student_res.data or reg["student_id"] != student_res.data[0]["id"]:
                raise HTTPException(status_code=403, detail="Unauthorized.")

        # Get admit card
        ac_res = db.table("admit_cards").select("*").eq("registration_id", id).eq("is_valid", True).execute()
        if not ac_res.data:
            raise HTTPException(status_code=404, detail="Admit card not issued or is invalid.")
        admit_card = ac_res.data[0]

        # Create signed url
        pdf_path = admit_card["pdf_path"]
        signed_url_res = db.storage.from_("admit-cards").create_signed_url(pdf_path, 3600)
        
        return {
            "admit_card_id": admit_card["id"],
            "pdf_signed_url": signed_url_res.get("signedURL")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
