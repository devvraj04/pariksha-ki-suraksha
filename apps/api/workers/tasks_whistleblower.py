import datetime
from apps.api.workers.celery_app import celery_app

@celery_app.task(name="apps.api.workers.tasks_whistleblower.score_whistleblower_report")
def score_whistleblower_report(report_id: str):
    """
    Simulates LLM-based risk evaluation of whistleblower submissions.
    Scores 0-100 based on category, description length/detail, location detail, and evidence count.
    If risk score >= 70, escalates status to ROUTED_TO_AUDIT.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Scoring whistleblower report {report_id}...")
    db = get_supabase_client()
    try:
        report_res = db.table("whistleblower_reports").select("*").eq("id", report_id).execute()
        if not report_res.data:
            return {"status": "failed", "error": "report_not_found"}
        report = report_res.data[0]

        # Calculate a mock AI risk score (0-100)
        score = 0
        
        # 1. Category severity
        cat_scores = {
            "PAPER_LEAK": 50,
            "BRIBERY": 35,
            "IMPERSONATION": 30,
            "INVIGILATOR_MISCONDUCT": 20,
            "OTHER": 10
        }
        score += cat_scores.get(report["category"], 10)

        # 2. Specificity (description length and keywords)
        desc = report["description"] or ""
        if len(desc) > 300:
            score += 15
        elif len(desc) > 100:
            score += 10
            
        # Detect specifics like numbers, codes, dates
        any_digits = any(char.isdigit() for char in desc)
        if any_digits:
            score += 10

        # 3. Location specificity
        if report.get("location_text") and len(report["location_text"]) > 4:
            score += 10

        # 4. Evidence files present
        evidence_paths = report.get("evidence_paths") or []
        if len(evidence_paths) > 0:
            score += 15

        # Clamp score between 0 and 100
        score = min(100, max(0, score))

        routing_status = "AI_SCORED"
        if score >= 70:
            routing_status = "ROUTED_TO_AUDIT"

        db.table("whistleblower_reports").update({
            "ai_risk_score": score,
            "routing_status": routing_status
        }).eq("id", report_id).execute()

        # Log audit trail (actor_id and ip_address are NULL to protect anonymity)
        db.table("audit_logs").insert({
            "event_type": "WHISTLEBLOWER_REPORT_SCORED",
            "event_description": f"Anonymous report {report_id} scored by AI agent. Risk: {score}. Status: {routing_status}.",
            "metadata": {"report_id": report_id, "score": score, "status": routing_status},
            "exam_id": report.get("exam_id")
        }).execute()

        if score >= 70:
            # Send alert to platform admins (mock email logs)
            print(f"[Celery Alert] HIGH RISK whistleblower report #{report_id} escalated to AUDIT! Risk: {score}")
            print(f"Category: {report['category']} | Location: {report.get('location_text')}")
            print(f"Description snippet: {desc[:200]}...")

        return {"status": "success", "report_id": report_id, "ai_risk_score": score}
    except Exception as e:
        print(f"[Celery Error] score_whistleblower_report failed: {e}")
        return {"status": "failed", "error": str(e)}
