import time
from apps.api.workers.celery_app import celery_app

@celery_app.task(name="apps.api.workers.tasks_exam.send_agency_welcome_email")
def send_agency_welcome_email(agency_id: str, email: str, name: str):
    """
    Task to send onboarding welcome email to Agency Head
    """
    print(f"[Celery] Sending welcome email to {name} ({email}) for agency {agency_id}")
    time.sleep(2) # Simulate network call
    return {"status": "sent", "agency_id": agency_id}

@celery_app.task(name="apps.api.workers.tasks_exam.send_agency_rejection_email")
def send_agency_rejection_email(agency_id: str, email: str, reason: str):
    """
    Task to send rejection email to Agency Head
    """
    print(f"[Celery] Sending rejection email to {email} for agency {agency_id}. Reason: {reason}")
    time.sleep(2)
    return {"status": "sent", "agency_id": agency_id}

@celery_app.task(name="apps.api.workers.tasks_exam.send_staff_invite_email")
def send_staff_invite_email(email: str, full_name: str, slug: str, invite_token: str):
    """
    Task to send staff invitation email containing the password setup URL.
    """
    invite_url = f"http://{slug}.localhost:3000/accept-invite?token={invite_token}"
    print(f"[Celery] Sending invitation email to {full_name} ({email}). Setup Link: {invite_url}")
    time.sleep(2)
    return {"status": "sent", "email": email, "invite_url": invite_url}

@celery_app.task(name="apps.api.workers.tasks_exam.send_staff_deactivation_email")
def send_staff_deactivation_email(email: str, full_name: str):
    """
    Task to send deactivation email notifying the staff member that their account was suspended.
    """
    print(f"[Celery] Sending deactivation notification to {full_name} ({email}). Access has been suspended.")
    time.sleep(2)
    return {"status": "sent", "email": email}

@celery_app.task(name="apps.api.workers.tasks_exam.generate_exam_brochure")
def generate_exam_brochure(exam_id: str):
    """
    Background task to generate a formatted examination information brochure.
    Calls LLM or falls back to template, generates a PDF, uploads to Supabase, and updates the exams row.
    """
    import os
    import json
    import urllib.request
    import urllib.parse
    from fpdf import FPDF
    from apps.api.core.supabase_client import get_supabase_client
    from apps.api.core.config import settings

    print(f"[Celery] Generating brochure for exam {exam_id}...")
    db = get_supabase_client()
    try:
        # Fetch exam
        exam_res = db.table("exams").select("*").eq("id", exam_id).execute()
        if not exam_res.data:
            return {"status": "failed", "error": "exam_not_found"}
        exam = exam_res.data[0]
        
        # Get agency details
        agency_res = db.table("agencies").select("*").eq("id", exam["agency_id"]).execute()
        agency = agency_res.data[0] if agency_res.data else {"name": "ParikshaSetu Partner Agency"}

        # Attempt to call Groq API (fallback to Gemini, then default template)
        brochure_text = None
        
        from apps.api.core.groq_client import query_groq
        prompt = (
            f"Write a detailed, structured, and professional examination brochure for the exam '{exam['name']}'. "
            f"Exam Date: {exam['exam_date']}. Mode: {exam['mode']}. Duration: {exam['duration_minutes']} minutes. "
            f"Fee: {exam['fee_inr']} INR. Syllabus: {exam.get('syllabus') or 'General aptitude and core topics'}. "
            f"Eligibility criteria: {json.dumps(exam.get('eligibility_criteria'))}. "
            f"Organized by: {agency['name']}. Limit to 300 words, formatted as plain sections."
        )
        
        try:
            brochure_text = query_groq(prompt, system_message="You are an official NTA exam brochure writer.")
        except Exception as e:
            print(f"[Celery LLM Warning] Groq API call failed: {e}.")
            
        if not brochure_text and settings.LLM_API_KEY:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.LLM_API_KEY}"
                headers = {"Content-Type": "application/json"}
                req_data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
                
                req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    brochure_text = res_body["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                print(f"[Celery LLM Warning] Gemini API call failed: {e}. Falling back to default template.")

        # Fallback to dynamic template if LLM failed/unavailable
        if not brochure_text:
            elig = exam.get('eligibility_criteria') or {}
            elig_str = f"Age Range: {elig.get('min_age', '18')} - {elig.get('max_age', '35')} years. Qualification: {elig.get('qualification', 'Any Graduate')}."
            brochure_text = (
                f"OFFICIAL EXAMINATION BROCHURE\n\n"
                f"1. GENERAL INFORMATION\n"
                f"Exam Name: {exam['name']}\n"
                f"Mode of Conduct: {exam['mode']}\n"
                f"Exam Date: {exam['exam_date']} (Start time: {exam['start_time']})\n"
                f"Duration: {exam['duration_minutes']} minutes\n"
                f"Registration Fee: {exam['fee_inr']} INR\n\n"
                f"2. ELIGIBILITY CRITERIA\n"
                f"{elig_str}\n\n"
                f"3. SYLLABUS AND CURRICULUM\n"
                f"{exam.get('syllabus') or 'Syllabus details are updated on the portal.'}\n\n"
                f"4. RULES AND REGULATIONS\n"
                f"- Biometric photo verification is mandatory at entry.\n"
                f"- Candidates must carry printed admit card and valid government ID.\n"
                f"- No electronic devices allowed in the exam halls.\n\n"
                f"Issued by: {agency['name']}\n"
                f"ParikshaSetu AI Security Network Core"
            )

        # Generate PDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, f"BROCHURE: {exam['name']}", border=0, ln=1, align="C")
        pdf.set_font("Helvetica", "I", 10)
        pdf.cell(0, 10, f"Organized by {agency['name']}", border=0, ln=1, align="C")
        pdf.line(10, 32, 200, 32)
        pdf.ln(10)
        
        pdf.set_font("Helvetica", "", 10)
        for line in brochure_text.split("\n"):
            if not line.strip():
                pdf.ln(3)
            else:
                pdf.multi_cell(0, 6, line)
        
        # fpdf2 returns bytearray; Supabase storage expects bytes
        pdf_bytes = bytes(pdf.output(dest='S'))
        
        # Upload PDF to Supabase storage 'brochures' bucket
        file_name = f"brochure_{exam_id}.pdf"
        try:
            db.storage.from_("brochures").upload(file_name, pdf_bytes, {"content-type": "application/pdf"})
        except Exception:
            try:
                db.storage.from_("brochures").update(file_name, pdf_bytes, {"content-type": "application/pdf"})
            except Exception as se:
                print(f"[Celery Error] Failed to write storage PDF file: {se}")
                raise
                
        # Update PDF path in exams table
        db.table("exams").update({"brochure_pdf_path": file_name}).eq("id", exam_id).execute()
        print(f"[Celery] Brochure generated and saved successfully: {file_name}")
        return {"status": "success", "brochure_pdf_path": file_name}
    except Exception as ex:
        print(f"[Celery Error] Brochure task encountered exception: {ex}")
        return {"status": "failed", "error": str(ex)}

def haversine_dist(lat1, lon1, lat2, lon2):
    import math
    R = 6371.0 # Radius of the earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@celery_app.task(name="apps.api.workers.tasks_exam.allocate_centers")
def allocate_centers(exam_id: str, actor_id: str):
    """
    Task to execute priority-weighted random center allocation algorithm.
    """
    import random
    from apps.api.core.supabase_client import get_supabase_client

    print(f"[Celery] Running center allocation for exam {exam_id} triggered by {actor_id}...")
    db = get_supabase_client()
    try:
        # Fetch exam
        exam_res = db.table("exams").select("*").eq("id", exam_id).execute()
        if not exam_res.data:
            return {"status": "failed", "error": "exam_not_found"}
            
        # Get centers list with total room capacity summed
        centers_res = db.table("exam_centers").select("*").eq("exam_id", exam_id).eq("is_active", True).execute()
        centers = centers_res.data or []
        if not centers:
            return {"status": "failed", "error": "no_centers_found"}
            
        # Sum capacities for each center
        center_capacities = {}
        for c in centers:
            # Get rooms
            rooms_res = db.table("exam_rooms").select("seating_capacity").eq("center_id", c["id"]).eq("is_active", True).execute()
            total_cap = sum(r["seating_capacity"] for r in rooms_res.data) if rooms_res.data else 0
            center_capacities[c["id"]] = {
                "id": c["id"],
                "latitude": float(c["latitude"]),
                "longitude": float(c["longitude"]),
                "capacity": total_cap,
                "allocated_count": 0
            }
            
        # Fetch registered applications (payment SUCCESS / REGISTERED status)
        regs_res = db.table("exam_registrations").select("*, students(*)").eq("exam_id", exam_id).eq("status", "REGISTERED").execute()
        registrations = regs_res.data or []
        if not registrations:
            return {"status": "success", "message": "No candidates to allocate."}
            
        # Randomize sequencing to prevent alphabet/chronological bias
        random.shuffle(registrations)
        
        # Prepare list for bulk inserts
        allocations_to_insert = []
        allocated_count = 0
        fallback_count = 0
        unallocated_count = 0
        
        for reg in registrations:
            student = reg["students"]
            allocated_center_id = None
            preference_rank_matched = 0
            
            # Retrieve preferences
            pref_ids = [reg.get("center_preference_1"), reg.get("center_preference_2"), reg.get("center_preference_3")]
            pref_ids = [pid for pid in pref_ids if pid] # filter nulls
            
            # 1. Try preference list
            for idx, pid in enumerate(pref_ids):
                if pid in center_capacities:
                    c_info = center_capacities[pid]
                    if c_info["allocated_count"] < c_info["capacity"]:
                        allocated_center_id = pid
                        preference_rank_matched = idx + 1
                        c_info["allocated_count"] += 1
                        allocated_count += 1
                        break
                        
            # 2. Fallback to nearest center by geodistance
            if not allocated_center_id:
                # Fallback: find centers with remaining seats
                available_centers = [c for c in center_capacities.values() if c["allocated_count"] < c["capacity"]]
                if available_centers:
                    # Delhi default coordinates
                    student_lat = float(student.get("latitude") or 28.6139)
                    student_lon = float(student.get("longitude") or 77.2090)
                    
                    # Sort by distance
                    available_centers.sort(key=lambda c: haversine_dist(student_lat, student_lon, c["latitude"], c["longitude"]))
                    nearest = available_centers[0]
                    allocated_center_id = nearest["id"]
                    preference_rank_matched = 0 # Fallback indicator
                    nearest["allocated_count"] += 1
                    fallback_count += 1
                    
            if allocated_center_id:
                allocations_to_insert.append({
                    "registration_id": reg["id"],
                    "student_id": student["id"],
                    "exam_id": exam_id,
                    "allocated_center_id": allocated_center_id,
                    "preference_rank_matched": preference_rank_matched,
                    "allocated_by": actor_id
                })
            else:
                unallocated_count += 1
                
        # Insert allocations in bulk
        if allocations_to_insert:
            db.table("center_allocations").delete().eq("exam_id", exam_id).execute()
            db.table("center_allocations").insert(allocations_to_insert).execute()
            
        print(f"[Celery] Allocation complete. Allocated: {allocated_count}, Fallback: {fallback_count}, Unallocated: {unallocated_count}")
        return {
            "status": "success",
            "allocated_count": allocated_count,
            "fallback_count": fallback_count,
            "unallocated_count": unallocated_count
        }
    except Exception as e:
        print(f"[Celery Error] Center allocation failed: {e}")
        return {"status": "failed", "error": str(e)}

@celery_app.task(name="apps.api.workers.tasks_exam.generate_admit_cards")
def generate_admit_cards(exam_id: str):
    """
    Task to generate cryptographically signed admit cards with a JWT-embedded QR code.
    """
    from apps.api.core.supabase_client import get_supabase_client
    from apps.api.core.config import settings
    import os

    print(f"[Celery] Generating admit cards for exam {exam_id}...")
    db = get_supabase_client()
    try:
        # Fetch exam
        exam_res = db.table("exams").select("*").eq("id", exam_id).execute()
        if not exam_res.data:
            return {"status": "failed", "error": "exam_not_found"}
        exam = exam_res.data[0]
        
        # Get allocations
        allocations_res = db.table("center_allocations").select("*, students(*), exam_centers(*)").eq("exam_id", exam_id).execute()
        allocations = allocations_res.data or []
        if not allocations:
            return {"status": "failed", "error": "no_allocations_found"}
            
        # Get RSA Private Key for token signing
        # pydantic-settings loads \\n as a literal two-char sequence from .env;
        # we unescape it so PyJWT can parse the PEM correctly.
        private_key_pem = settings.ADMIT_CARD_JWT_PRIVATE_KEY.replace("\\n", "\n")
        if not private_key_pem.strip():
            # Fallback to generating a temporary RSA key pair for testing
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import serialization
            key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            private_key_pem = key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ).decode("utf-8")
            print("[Celery Warning] ADMIT_CARD_JWT_PRIVATE_KEY missing in .env. Generated temporary RS256 keypair for testing.")
            
        import jwt
        import datetime
        import tempfile
        import urllib.request
        import urllib.parse
        from fpdf import FPDF
        
        generated_count = 0
        
        for alloc in allocations:
            student = alloc["students"]
            center = alloc["exam_centers"]
            
            # 1. Build JWT payload
            payload = {
                "student_id": student["id"],
                "exam_id": exam_id,
                "center_id": center["id"],
                "biometric_hash": student.get("biometric_hash") or "mock-biometric-hash",
                "iat": int(datetime.datetime.utcnow().timestamp()),
                "exp": int((datetime.datetime.utcnow() + datetime.timedelta(days=2)).timestamp())
            }
            
            # Sign with RS256
            token = jwt.encode(payload, private_key_pem, algorithm="RS256")
            
            # 2. Retrieve QR Code Image (Download from public API)
            qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={urllib.parse.quote(token)}"
            qr_bytes = None
            try:
                with urllib.request.urlopen(qr_url, timeout=5) as qr_res:
                    qr_bytes = qr_res.read()
            except Exception as qre:
                print(f"[Celery Warning] Failed to fetch QR from server: {qre}. Mocking QR.")
                
            # Write QR to temp file if downloaded
            qr_temp_path = None
            if qr_bytes:
                fd, qr_temp_path = tempfile.mkstemp(suffix=".png")
                with os.fdopen(fd, 'wb') as tmp:
                    tmp.write(qr_bytes)
            
            # 3. Create PDF Admit Card
            pdf = FPDF()
            pdf.add_page()
            
            # Header Tricolor Band (saffron, white, green inside y=5 to y=14)
            pdf.set_fill_color(255, 103, 31)
            pdf.rect(5, 5, 200, 3, style='F')
            pdf.set_fill_color(255, 255, 255)
            pdf.rect(5, 8, 200, 3, style='F')
            pdf.set_fill_color(18, 136, 37)
            pdf.rect(5, 11, 200, 3, style='F')

            # Footer Tricolor Band (saffron, white, green inside y=286 to y=292)
            pdf.set_fill_color(255, 103, 31)
            pdf.rect(5, 286, 200, 2, style='F')
            pdf.set_fill_color(255, 255, 255)
            pdf.rect(5, 288, 200, 2, style='F')
            pdf.set_fill_color(18, 136, 37)
            pdf.rect(5, 290, 200, 2, style='F')

            # Outline Page Border
            pdf.rect(5, 5, 200, 287)
            
            # Download student profile photo if it exists
            photo_temp_path = None
            photo_path = student.get("photo_path")
            if photo_path:
                try:
                    photo_bytes = db.storage.from_("webcam-snapshots").download(photo_path)
                    fd_photo, photo_temp_path = tempfile.mkstemp(suffix=".jpg")
                    with os.fdopen(fd_photo, 'wb') as tmp:
                        tmp.write(photo_bytes)
                except Exception as pe:
                    print(f"[Celery Warning] Failed to download student photo: {pe}")
            
            pdf.set_font("Helvetica", "B", 18)
            pdf.cell(0, 15, "PARIKSHASETU SECURED ADMIT CARD", border=0, ln=1, align="C")
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, exam["name"].upper(), border=0, ln=1, align="C")
            pdf.line(10, 32, 200, 32)
            pdf.ln(5)
            
            # Student details
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Candidate Name:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, student["full_name"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Email Address:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, student["email"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Registry ID:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, student["id"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Exam Date & Time:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, f"{exam['exam_date']} at {exam['start_time']} ({exam['duration_minutes']} mins)", ln=1)
            
            # Render Student Photo Frame at x=150, y=40
            pdf.rect(150, 40, 40, 45)
            if photo_temp_path:
                try:
                    pdf.image(photo_temp_path, x=150, y=40, w=40, h=45)
                except Exception as pie:
                    print(f"[Celery Warning] Failed to render student photo image: {pie}")
                    pdf.set_font("Helvetica", "I", 8)
                    pdf.text(152, 62, "PHOTO ERROR")
            else:
                pdf.set_font("Helvetica", "I", 8)
                pdf.text(152, 62, "NO PHOTO UPLOADED")
            
            pdf.ln(5)
            pdf.line(10, 88, 200, 88)
            pdf.ln(5)
            
            # Center allocation
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "ALLOCATED TEST CENTER DETAILS", ln=1)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Center Name:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, center["name"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Center Code:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 6, center["center_code"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(40, 6, "Center Address:")
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 6, f"{center['address']}, {center['city']}, {center['state']} - {center['pincode']}")
            
            pdf.ln(10)
            pdf.line(10, 135, 200, 135)
            pdf.ln(5)
            
            # Add QR Code
            if qr_temp_path:
                pdf.image(qr_temp_path, x=80, y=145, w=45, h=45)
                
            # Query Groq for personalized instructions
            instructions_text = None
            from apps.api.core.groq_client import query_groq
            
            prompt = (
                f"Generate exactly 3 short, official candidate-specific security instructions for candidate '{student['full_name']}' "
                f"attending the exam center '{center['name']}' (Center Code: {center['center_code']}). "
                f"The instructions must mention the candidate's name, center name, and center code. "
                f"Output ONLY the 3 instructions as a numbered list, keeping the total response under 80 words."
            )
            try:
                instructions_text = query_groq(prompt, system_message="You are an official National Testing Agency system.")
            except Exception as ge:
                print(f"[Celery Warning] Groq instructions generation failed: {ge}")

            if not instructions_text:
                instructions_text = (
                    f"1. Candidate {student['full_name']} must report to {center['name']} (Code: {center['center_code']}) with this admit card.\n"
                    f"2. Guard personnel at Center {center['center_code']} will perform mandatory face check-in against records.\n"
                    f"3. Please maintain exam discipline inside the premises of {center['name']} at all times."
                )

            pdf.set_y(195)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, "SECURITY INSTRUCTIONS FOR CANDIDATES", ln=1, align="C")
            pdf.set_font("Helvetica", "", 8)
            pdf.multi_cell(0, 4, (
                "1. Carry a printed physical copy of this admit card and a valid photo identity proof.\n"
                "2. Report to the allocated test center at least 1 hour prior to the examination start time.\n"
                "3. The QR code above contains cryptographic biometric hashes. Refrain from defacing the QR code.\n"
                "4. Biometric check-in and face matching are mandatory at the gate for exam admission."
            ))
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 8)
            pdf.cell(0, 5, "PERSONALIZED INSTRUCTIONS & GUIDELINES (AI GENERATED):", ln=1)
            pdf.set_font("Helvetica", "I", 8)
            pdf.multi_cell(0, 4, instructions_text)
            
            # fpdf2 returns bytearray; Supabase storage expects bytes
            pdf_admit_bytes = bytes(pdf.output(dest='S'))
            
            # Clean up temp files
            if qr_temp_path:
                try:
                    os.remove(qr_temp_path)
                except Exception:
                    pass
            if photo_temp_path:
                try:
                    os.remove(photo_temp_path)
                except Exception:
                    pass
                    
            # 4. Upload admit card PDF to Supabase Storage
            admit_card_path = f"{exam_id}/{student['id']}/admit_card.pdf"
            try:
                db.storage.from_("admit-cards").upload(admit_card_path, pdf_admit_bytes, {"content-type": "application/pdf"})
            except Exception:
                try:
                    db.storage.from_("admit-cards").update(admit_card_path, pdf_admit_bytes, {"content-type": "application/pdf"})
                except Exception as se:
                    print(f"[Celery Error] Failed to upload admit card storage file: {se}")
                    raise
                    
            # 5. Insert/update row in admit_cards table
            admit_card_data = {
                "registration_id": alloc["registration_id"],
                "student_id": student["id"],
                "exam_id": exam_id,
                "center_id": center["id"],
                "qr_payload_jwt": token,
                "qr_biometric_hash": student.get("biometric_hash") or "mock-biometric-hash",
                "pdf_path": admit_card_path,
                "is_valid": True
            }
            
            # Check if admit card row exists
            exist_check = db.table("admit_cards").select("id").eq("registration_id", alloc["registration_id"]).execute()
            if exist_check.data:
                db.table("admit_cards").update(admit_card_data).eq("registration_id", alloc["registration_id"]).execute()
            else:
                db.table("admit_cards").insert(admit_card_data).execute()
                
            generated_count += 1
            
        # Update exam status to ADMIT_CARDS_ISSUED
        db.table("exams").update({"status": "ADMIT_CARDS_ISSUED"}).eq("id", exam_id).execute()
        print(f"[Celery] Completed admit cards generation. Generated: {generated_count} cards.")
        
        return {"status": "success", "generated_count": generated_count}
    except Exception as e:
        print(f"[Celery Error] Admit cards generation failed: {e}")
        return {"status": "failed", "error": str(e)}

@celery_app.task(name="apps.api.workers.tasks_exam.transition_exam_to_ongoing")
def transition_exam_to_ongoing():
    """
    Celery Beat scheduled task to set exams to ONGOING when their start time is reached.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print("[Celery] Checking for exams to transition to ONGOING...")
    db = get_supabase_client()
    try:
        from datetime import datetime, date
        today_str = date.today().isoformat()
        
        exams_res = db.table("exams").select("id, name").eq("status", "ADMIT_CARDS_ISSUED").eq("exam_date", today_str).execute()
        transitioned = []
        for exam in (exams_res.data or []):
            db.table("exams").update({"status": "ONGOING"}).eq("id", exam["id"]).execute()
            db.table("audit_logs").insert({
                "event_type": "EXAM_STARTED",
                "event_description": f"Exam '{exam['name']}' has officially started and is now ONGOING.",
                "metadata": {"exam_id": exam["id"]}
            }).execute()
            transitioned.append(exam["id"])
            print(f"[Celery] Transitioned exam '{exam['name']}' to ONGOING.")
            
        return {"status": "success", "transitioned": transitioned}
    except Exception as e:
        print(f"[Celery Error] Failed to transition ongoing exams: {e}")
        return {"status": "failed", "error": str(e)}

@celery_app.task(name="apps.api.workers.tasks_exam.transition_exam_to_upload_pending")
def transition_exam_to_upload_pending():
    """
    Celery Beat scheduled task to transition exams to PAPER_UPLOAD_PENDING at their conclusion.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print("[Celery] Checking for exams to transition to PAPER_UPLOAD_PENDING...")
    db = get_supabase_client()
    try:
        exams_res = db.table("exams").select("id, name").eq("status", "ONGOING").execute()
        transitioned = []
        for exam in (exams_res.data or []):
            db.table("exams").update({"status": "PAPER_UPLOAD_PENDING"}).eq("id", exam["id"]).execute()
            db.table("audit_logs").insert({
                "event_type": "PAPER_UPLOAD_REQUIRED",
                "event_description": f"Exam '{exam['name']}' concluded. Answer sheet uploads are now pending.",
                "metadata": {"exam_id": exam["id"]}
            }).execute()
            transitioned.append(exam["id"])
            print(f"[Celery] Transitioned exam '{exam['name']}' to PAPER_UPLOAD_PENDING.")
            
        return {"status": "success", "transitioned": transitioned}
    except Exception as e:
        print(f"[Celery Error] Failed to transition pending upload exams: {e}")
        return {"status": "failed", "error": str(e)}


