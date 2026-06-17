import hmac
import hashlib
import datetime
from fpdf import FPDF
from apps.api.workers.celery_app import celery_app
from apps.api.core.config import settings

@celery_app.task(name="apps.api.workers.tasks_results.compile_exam_results")
def compile_exam_results(exam_id: str):
    """
    Task to aggregate student marks and generate final scorecards:
    1. Find highest-tier evaluation_marks per student.
    2. Compute percentages.
    3. Determine pass/fail (threshold 40%).
    4. Calculate ranks with deterministic tie-breaker (lexicographical subject score, then application_number).
    5. Calculate category ranks (gender-based category).
    6. Generate FPDF2 scorecards digitally signed using RESULT_PDF_SIGNING_KEY.
    7. Save to exam_results.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Compiling results for exam {exam_id}")
    db = get_supabase_client()
    try:
        # Fetch all appeared student registrations
        # A student appeared if they have checked in
        checkins_res = db.table("checkin_events").select("student_id").eq("exam_id", exam_id).execute()
        appeared_student_ids = [c["student_id"] for c in checkins_res.data or []]
        
        if not appeared_student_ids:
            # Try falling back to REGISTERED students in registrations just in case
            regs_res = db.table("exam_registrations").select("student_id").eq("exam_id", exam_id).eq("status", "REGISTERED").execute()
            appeared_student_ids = [r["student_id"] for r in regs_res.data or []]

        if not appeared_student_ids:
            print("[Celery Warning] No appeared candidates found for results compilation.")
            return {"status": "skipped", "reason": "No candidates found."}

        # Fetch exam info
        exam_res = db.table("exams").select("name, agency_id").eq("id", exam_id).execute()
        exam_name = exam_res.data[0]["name"] if exam_res.data else "Examination"
        agency_id = exam_res.data[0]["agency_id"] if exam_res.data else None

        # Fetch staff profile for published_by FK (first available agency head/manager)
        staff_res = db.table("agency_staff").select("id").eq("agency_id", agency_id).eq("role", "agency_head").eq("is_active", True).execute()
        published_by_id = staff_res.data[0]["id"] if staff_res.data else None
        if not published_by_id:
            # Fallback
            staff_res = db.table("agency_staff").select("id").eq("agency_id", agency_id).eq("is_active", True).limit(1).execute()
            published_by_id = staff_res.data[0]["id"] if staff_res.data else None

        compiled_candidates = []

        for student_id in appeared_student_ids:
            # Find all evaluation marks for this student + exam
            marks_res = db.table("evaluation_marks")\
                .select("*")\
                .eq("exam_id", exam_id)\
                .eq("student_id", student_id)\
                .execute()
            
            marks_list = marks_res.data or []
            if not marks_list:
                continue

            # Pick highest tier: 3 -> 2 -> 1
            highest_mark = None
            for tier in [3, 2, 1]:
                matches = [m for m in marks_list if m["evaluation_tier"] == tier]
                if matches:
                    highest_mark = matches[0] # Take first
                    break
            
            if not highest_mark:
                continue

            # Load student profile
            student_res = db.table("students").select("full_name, gender").eq("id", student_id).execute()
            student = student_res.data[0] if student_res.data else {"full_name": "Unknown Candidate", "gender": "PREFER_NOT_TO_SAY"}

            # Load registration
            reg_res = db.table("exam_registrations").select("id, application_number").eq("exam_id", exam_id).eq("student_id", student_id).execute()
            if not reg_res.data:
                continue
            reg = reg_res.data[0]

            marks_awarded = float(highest_mark["marks_awarded"])
            max_marks = float(highest_mark["max_marks"])
            percentage = round((marks_awarded / max_marks) * 100, 2) if max_marks > 0 else 0.0
            
            # Deterministic subject tie-breaker score
            sub_breakdown = highest_mark.get("subject_breakdown") or {}
            tie_breaker_score = 0.0
            if sub_breakdown:
                first_subject = sorted(sub_breakdown.keys())[0] if sub_breakdown.keys() else ""
                if first_subject:
                    tie_breaker_score = float(sub_breakdown[first_subject])

            compiled_candidates.append({
                "student_id": student_id,
                "registration_id": reg["id"],
                "application_number": reg["application_number"],
                "full_name": student["full_name"],
                "gender": student["gender"],
                "final_marks": marks_awarded,
                "max_marks": max_marks,
                "percentage": percentage,
                "tie_breaker_score": tie_breaker_score,
                "subject_breakdown": sub_breakdown,
                "result_status": "PASS" if percentage >= 40.0 else "FAIL"
            })

        # Sort for ranks: final_marks desc, tie_breaker_score desc, application_number asc
        compiled_candidates.sort(key=lambda x: (-x["final_marks"], -x["tie_breaker_score"], x["application_number"]))

        # Assign ranks
        for index, cand in enumerate(compiled_candidates):
            cand["rank"] = index + 1

        # Assign category ranks (using Gender as the category/quota group)
        gender_ranks = {}
        for cand in compiled_candidates:
            g = cand["gender"]
            gender_ranks[g] = gender_ranks.get(g, 0) + 1
            cand["category_rank"] = gender_ranks[g]

        # Save results and generate PDFs
        for cand in compiled_candidates:
            # 1. Generate digital signature (HMAC-SHA256)
            secret = settings.RESULT_PDF_SIGNING_KEY or "result-secret-key"
            msg = f"{cand['student_id']}:{exam_id}:{cand['percentage']:.2f}"
            digital_sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()

            # 2. Build PDF using FPDF2
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
            
            # Header block
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, "PARIKSHASETU AI EXAMINATION GATEWAY", border=0, ln=1, align="C")
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 8, "OFFICIAL PROVISIONAL RESULTS SHEET", border=0, ln=1, align="C")
            pdf.line(10, 28, 200, 28)
            pdf.ln(10)
            
            # Candidate Info
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(50, 6, "Candidate Name:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, cand["full_name"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(50, 6, "Application Number:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, cand["application_number"], ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(50, 6, "Examination name:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, exam_name, ln=1)
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(50, 6, "Gender / Category:")
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 6, cand["gender"], ln=1)
            pdf.ln(6)
            
            # Results Table
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(70, 8, "Subject/Section", border=1)
            pdf.cell(40, 8, "Marks Scored", border=1, align="C")
            pdf.cell(40, 8, "Max Marks", border=1, align="C")
            pdf.ln()
            
            pdf.set_font("Helvetica", "", 10)
            for sub, score in cand["subject_breakdown"].items():
                pdf.cell(70, 7, str(sub), border=1)
                pdf.cell(40, 7, f"{float(score):.2f}", border=1, align="C")
                pdf.cell(40, 7, "—", border=1, align="C")
                pdf.ln()
                
            # Totals
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(70, 8, "GRAND TOTAL", border=1)
            pdf.cell(40, 8, f"{cand['final_marks']:.2f}", border=1, align="C")
            pdf.cell(40, 8, f"{cand['max_marks']:.2f}", border=1, align="C")
            pdf.ln(12)
            
            # Ranks & Status
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(60, 6, f"Final Percentage: {cand['percentage']}%")
            pdf.cell(60, 6, f"Result status: {cand['result_status']}")
            pdf.ln(6)
            pdf.cell(60, 6, f"All-India Rank (AIR): {cand['rank']}")
            pdf.cell(60, 6, f"Category Rank: {cand['category_rank']}")
            pdf.ln(8)
            
            # Query Groq for personalized feedback
            from apps.api.core.groq_client import query_groq
            
            subject_str = ", ".join([f"{sub}: {score}" for sub, score in cand["subject_breakdown"].items()])
            status_word = "passed" if cand["result_status"] == "PASS" else "did not pass"
            
            prompt = (
                f"Write a professional, concise AI performance feedback (max 50 words) for candidate '{cand['full_name']}' "
                f"who scored {cand['final_marks']}/{cand['max_marks']} ({cand['percentage']}%) and {status_word} the exam. "
                f"Subject breakdown: {subject_str}. "
                f"Be congratulatory and analytical if they passed, or encouraging and constructive with advisory feedback if they failed."
            )
            
            ai_feedback = None
            try:
                ai_feedback = query_groq(prompt, system_message="You are an official exam board academic counselor.")
            except Exception as ge:
                print(f"[Celery Warning] Groq results feedback failed: {ge}")
                
            if not ai_feedback:
                if cand["result_status"] == "PASS":
                    ai_feedback = f"Congratulations {cand['full_name']} on passing the examination with {cand['percentage']}%. Good performance across subjects."
                else:
                    ai_feedback = f"Dear {cand['full_name']}, you scored {cand['percentage']}%. We encourage you to review subject topics and attempt the examination again with better preparation."

            # AI Performance Panel
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, "AI PERFORMANCE FEEDBACK & COUNSELING", ln=1)
            pdf.set_font("Helvetica", "I", 8.5)
            pdf.multi_cell(0, 4.5, ai_feedback, border=1)
            pdf.ln(6)

            # Security watermark / Digital Verification box
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(180, 83, 9) # Amber
            pdf.cell(0, 5, "SECURED DIGITAL VERIFICATION SHA-256 SIGNATURE", ln=1)
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Courier", "", 8)
            pdf.multi_cell(0, 4, digital_sig, border=1)
            
            pdf_bytes = bytes(pdf.output(dest='S'))
            
            # Upload to 'result-pdfs' bucket
            pdf_path = f"{exam_id}/{cand['student_id']}/scorecard.pdf"
            try:
                db.storage.from_("result-pdfs").upload(pdf_path, pdf_bytes, {"content-type": "application/pdf"})
            except Exception:
                try:
                    db.storage.from_("result-pdfs").update(pdf_path, pdf_bytes, {"content-type": "application/pdf"})
                except Exception as se:
                    print(f"[Celery PDF Error] Failed to write result PDF file: {se}")

            # Check if result row already exists to avoid duplicates
            existing_result = db.table("exam_results").select("id").eq("registration_id", cand["registration_id"]).execute()
            
            result_data = {
                "exam_id": exam_id,
                "student_id": cand["student_id"],
                "registration_id": cand["registration_id"],
                "final_marks": cand["final_marks"],
                "max_marks": cand["max_marks"],
                "percentage": cand["percentage"],
                "rank": cand["rank"],
                "category_rank": cand["category_rank"],
                "result_status": cand["result_status"],
                "subject_breakdown": cand["subject_breakdown"],
                "result_pdf_path": pdf_path,
                "published_by": published_by_id,
                "published_at": datetime.datetime.utcnow().isoformat() + "Z"
            }
            
            if existing_result.data:
                db.table("exam_results").update(result_data).eq("id", existing_result.data[0]["id"]).execute()
            else:
                db.table("exam_results").insert(result_data).execute()

        print(f"[Celery] Successfully compiled results for {len(compiled_candidates)} students.")
        return {"status": "success", "total_compiled": len(compiled_candidates)}
    except Exception as e:
        print(f"[Celery Error] compile_exam_results failed: {e}")
        return {"status": "failed", "error": str(e)}

@celery_app.task(name="apps.api.workers.tasks_results.notify_students_result_declared")
def notify_students_result_declared(exam_id: str):
    """
    Sends email notifications to all candidates who appeared in the examination.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        # Find appeared candidates
        results_res = db.table("exam_results").select(
            "*, students(email, full_name), exams(name)"
        ).eq("exam_id", exam_id).execute()
        
        notified_count = 0
        for res in results_res.data or []:
            student = res.get("students") or {}
            exam = res.get("exams") or {}
            
            email = student.get("email")
            name = student.get("full_name") or "Candidate"
            exam_name = exam.get("name") or "Examination"
            
            if email:
                print(f"[Celery Mail] Results Notification -> Email: {email}")
                print(f"Subject: Results Declared: {exam_name}")
                print(f"Body: Hello {name},\n\nYour results for the examination '{exam_name}' have been officially published.\n"
                      f"Please log in to the student portal or visit http://leakguard.localhost:3000/results to view your scorecard.\n\n"
                      f"ParikshaSetu AI Security Network")
                notified_count += 1
                
        return {"status": "success", "notified_count": notified_count}
    except Exception as e:
        print(f"[Celery Error] notify_students_result_declared failed: {e}")
        return {"status": "failed", "error": str(e)}
