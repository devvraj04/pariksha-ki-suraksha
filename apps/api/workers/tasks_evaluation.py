"""
Phase 10 — Evaluation Celery Tasks
score_answer_sheet: mocked AI visibility scoring pipeline (YOLOv8 + OpenCV).
transition_exam_to_evaluation: check all sheets sealed, promote exam status.
"""
from apps.api.workers.celery_app import celery_app


@celery_app.task(name="apps.api.workers.tasks_evaluation.score_answer_sheet")
def score_answer_sheet(upload_id: str):
    """
    Mocked AI visibility scoring per page:
    - Simulates YOLOv8 + OpenCV pipeline
    - Scores 0.00–10.00 per page
    - Checks minimum page score against exam threshold
    - Sets upload_status = APPROVED or RESCAN_REQUIRED
    """
    import random
    import datetime
    from apps.api.core.supabase_client import get_supabase_client

    print(f"[Celery] Scoring answer sheet {upload_id}...")
    db = get_supabase_client()
    try:
        upload_res = db.table("answer_sheet_uploads").select(
            "*, exams(visibility_score_threshold)"
        ).eq("id", upload_id).execute()
        if not upload_res.data:
            return {"status": "failed", "error": "upload_not_found"}
        upload = upload_res.data[0]

        # Mark as scoring
        db.table("answer_sheet_uploads").update({"upload_status": "SCORING"}).eq("id", upload_id).execute()

        exam = upload.get("exams") or {}
        threshold = float(exam.get("visibility_score_threshold") or 8.0)
        total_pages = upload.get("total_pages", 1)

        # Generate mock scores per page
        page_scores = []
        all_above_threshold = True
        failing_pages = []

        for page_num in range(1, total_pages + 1):
            # Mock: 85% of pages score well, 15% have issues
            if random.random() < 0.85:
                score = round(random.uniform(8.0, 10.0), 2)
                issues = {}
            else:
                score = round(random.uniform(3.0, 7.9), 2)
                issues = {
                    "blur": random.random() < 0.5,
                    "fold": random.random() < 0.3,
                    "low_contrast": random.random() < 0.4,
                    "page_skew": random.random() < 0.2,
                }
                # Remove False values
                issues = {k: v for k, v in issues.items() if v}

            page_scores.append({
                "upload_id": upload_id,
                "page_number": page_num,
                "visibility_score": score,
                "issues_detected": issues if issues else None,
                "model_version": "mock-v1.0",
                "scored_at": datetime.datetime.utcnow().isoformat() + "Z",
            })

            if score < threshold:
                all_above_threshold = False
                failing_pages.append({"page": page_num, "score": score, "issues": issues})

        # Insert scores
        db.table("answer_sheet_visibility_scores").insert(page_scores).execute()

        new_status = "APPROVED" if all_above_threshold else "RESCAN_REQUIRED"
        db.table("answer_sheet_uploads").update({"upload_status": new_status}).eq("id", upload_id).execute()

        if new_status == "RESCAN_REQUIRED":
            print(
                f"[Celery] Answer sheet {upload_id} scored RESCAN_REQUIRED. "
                f"Failing pages: {[p['page'] for p in failing_pages]}. "
                f"In production: alert sent to CENTER_OFFICER."
            )
        else:
            print(f"[Celery] Answer sheet {upload_id} scored APPROVED. All {total_pages} pages above threshold {threshold}.")

        return {
            "status": "success",
            "upload_id": upload_id,
            "upload_status": new_status,
            "total_pages": total_pages,
            "failing_pages": failing_pages,
        }
    except Exception as e:
        print(f"[Celery Error] score_answer_sheet failed: {e}")
        db.table("answer_sheet_uploads").update({"upload_status": "UPLOADED"}).eq("id", upload_id).execute()
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_evaluation.transition_exam_to_evaluation")
def transition_exam_to_evaluation(exam_id: str):
    """
    Check if all answer_sheet_uploads for this exam are SEALED.
    If yes, transition exams.status → EVALUATION_IN_PROGRESS.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Checking evaluation readiness for exam {exam_id}...")
    db = get_supabase_client()
    try:
        # Count unsealed sheets
        not_sealed = db.table("answer_sheet_uploads").select("id", count="exact").eq("exam_id", exam_id).neq("upload_status", "SEALED").execute()
        unsealed_count = not_sealed.count or 0

        # Total sheets
        total = db.table("answer_sheet_uploads").select("id", count="exact").eq("exam_id", exam_id).execute()
        total_count = total.count or 0

        if total_count == 0:
            return {"status": "skipped", "reason": "No answer sheets uploaded yet."}

        if unsealed_count == 0:
            db.table("exams").update({"status": "EVALUATION_IN_PROGRESS"}).eq("id", exam_id).execute()
            db.table("audit_logs").insert({
                "event_type": "EXAM_EVALUATION_STARTED",
                "event_description": f"All {total_count} answer sheets sealed. Exam transitioned to EVALUATION_IN_PROGRESS.",
                "metadata": {"exam_id": exam_id, "total_sheets": total_count},
                "exam_id": exam_id,
            }).execute()
            print(f"[Celery] Exam {exam_id} transitioned to EVALUATION_IN_PROGRESS.")
            return {"status": "success", "exam_id": exam_id, "sealed_sheets": total_count}

        return {"status": "pending", "unsealed_count": unsealed_count, "total_count": total_count}
    except Exception as e:
        print(f"[Celery Error] transition_exam_to_evaluation failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_evaluation.send_evaluator_assignment_email")
def send_evaluator_assignment_email(assignment_id: str):
    """
    Simulates sending assignment email notification to assigned evaluator.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        assignment_res = db.table("evaluator_assignments").select(
            "*, evaluator:agency_staff(full_name, email), exams(name)"
        ).eq("id", assignment_id).execute()
        if not assignment_res.data:
            return {"status": "failed", "error": "assignment_not_found"}
        assignment = assignment_res.data[0]
        evaluator = assignment.get("evaluator") or {}
        exam = assignment.get("exams") or {}
        
        email = evaluator.get("email") or "evaluator@leakguard.in"
        name = evaluator.get("full_name") or "Evaluator"
        exam_name = exam.get("name") or "Examination"
        batch_code = assignment.get("batch_code") or "BATCH-CODE"
        
        print(f"[Celery Mail] Sending evaluator assignment email to {email}...")
        print(f"Subject: New Evaluation Assignment Assigned - {batch_code}")
        print(f"Body: Hello {name},\n\nYou have been assigned {len(assignment['upload_ids'])} answer sheets for evaluation in {exam_name}.\n"
              f"Your batch code is {batch_code}.\n"
              f"Please log in to the portal at http://leakguard.localhost:3000/eval/ to complete the scoring.\n"
              f"Note: Your access will be permanently revoked once you submit the batch completion.")
        
        return {"status": "success", "email_sent_to": email}
    except Exception as e:
        print(f"[Celery Error] send_evaluator_assignment_email failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_evaluation.run_tier_comparison")
def run_tier_comparison(exam_id: str, moderator_assignment_id: str):
    """
    Compares Moderator (Tier 2) marks vs Grading Teacher (Tier 1) marks.
    If the absolute difference in marks is > 10% of maximum marks, creates a discrepancy record.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        # Fetch the moderator assignment to get papers list
        assign_res = db.table("evaluator_assignments").select("*").eq("id", moderator_assignment_id).execute()
        if not assign_res.data:
            return {"status": "failed", "error": "moderator_assignment_not_found"}
        assignment = assign_res.data[0]
        
        created_count = 0
        for upload_id in assignment["upload_ids"]:
            # Find Tier 2 marks
            t2_res = db.table("evaluation_marks")\
                .select("*")\
                .eq("assignment_id", moderator_assignment_id)\
                .eq("upload_id", upload_id)\
                .eq("evaluation_tier", 2)\
                .execute()
            
            if not t2_res.data:
                continue
            t2_marks = t2_res.data[0]
            
            # Find Tier 1 marks for this upload
            t1_res = db.table("evaluation_marks")\
                .select("*")\
                .eq("upload_id", upload_id)\
                .eq("evaluation_tier", 1)\
                .execute()
            
            if not t1_res.data:
                continue
            t1_marks = t1_res.data[0]
            
            diff = abs(float(t1_marks["marks_awarded"]) - float(t2_marks["marks_awarded"]))
            max_marks = float(t2_marks["max_marks"])
            
            # Threshold is 10% of max marks
            threshold = 0.10 * max_marks
            if diff > threshold:
                # Check if discrepancy already exists to avoid duplicates
                existing = db.table("evaluation_discrepancies")\
                    .select("id")\
                    .eq("upload_id", upload_id)\
                    .execute()
                
                disc_data = {
                    "exam_id": exam_id,
                    "student_id": t2_marks["student_id"],
                    "upload_id": upload_id,
                    "tier1_marks_id": t1_marks["id"],
                    "tier2_marks_id": t2_marks["id"],
                    "marks_difference": diff,
                    "status": "OPEN"
                }
                
                if existing.data:
                    db.table("evaluation_discrepancies").update(disc_data).eq("id", existing.data[0]["id"]).execute()
                else:
                    db.table("evaluation_discrepancies").insert(disc_data).execute()
                created_count += 1
                
        print(f"[Celery] Tier comparison complete. Created/Updated {created_count} discrepancies for moderator assignment {moderator_assignment_id}.")
        return {"status": "success", "discrepancies_created": created_count}
    except Exception as e:
        print(f"[Celery Error] run_tier_comparison failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_evaluation.send_evaluation_completion_notification")
def send_evaluation_completion_notification(assignment_id: str):
    """
    Sends email notification to agency heads when an evaluator completes their batch.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        assignment_res = db.table("evaluator_assignments").select(
            "*, evaluator:agency_staff(full_name, email), exams(agency_id, name)"
        ).eq("id", assignment_id).execute()
        
        if not assignment_res.data:
            return {"status": "failed", "error": "assignment_not_found"}
        assignment = assignment_res.data[0]
        
        evaluator = assignment.get("evaluator") or {}
        exam = assignment.get("exams") or {}
        agency_id = exam.get("agency_id")
        
        # Find agency heads
        heads_res = db.table("agency_staff").select("email, full_name").eq("agency_id", agency_id).eq("role", "agency_head").eq("is_active", True).execute()
        
        emails = [h["email"] for h in heads_res.data or []]
        eval_name = evaluator.get("full_name") or "An evaluator"
        batch_code = assignment.get("batch_code") or "BATCH"
        exam_name = exam.get("name") or "Examination"
        
        print(f"[Celery Mail] Sending completion alerts to agency heads {emails}...")
        print(f"Subject: Evaluator Batch Lock Complete - {batch_code}")
        print(f"Body: Evaluator {eval_name} has finalized and locked Batch {batch_code} for {exam_name}.\n"
              f"Access to papers in this batch has been automatically revoked.")
        
        return {"status": "success", "notified_count": len(emails)}
    except Exception as e:
        print(f"[Celery Error] send_evaluation_completion_notification failed: {e}")
        return {"status": "failed", "error": str(e)}
