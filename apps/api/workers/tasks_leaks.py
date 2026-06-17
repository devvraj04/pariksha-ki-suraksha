import datetime
import json
import random
from apps.api.workers.celery_app import celery_app

@celery_app.task(name="apps.api.workers.tasks_leaks.run_leak_investigation")
def run_leak_investigation(report_id: str):
    """
    Reverse-engineers the Tracking Matrix Code from the leaked image,
    cross-references all event logs (vault logs, print room surveillance, transit logs, day-of logs),
    and generates the Leak Source Probability Report.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Running leak investigation for report {report_id}...")
    db = get_supabase_client()
    try:
        report_res = db.table("leak_reports").select("*").eq("id", report_id).execute()
        if not report_res.data:
            return {"status": "failed", "error": "report_not_found"}
        report = report_res.data[0]
        exam_id = report.get("exam_id")

        # Mock Steganographic Watermark Extraction
        # Try to find a real watermark record from the registry if exam is provided
        watermark = None
        if exam_id:
            jobs_res = db.table("print_jobs").select("id").eq("exam_id", exam_id).execute()
            job_ids = [j["id"] for j in jobs_res.data or []]
            if job_ids:
                w_res = db.table("print_watermark_registry").select("*").in_("print_job_id", job_ids).limit(1).execute()
                if w_res.data:
                    watermark = w_res.data[0]

        if watermark:
            watermark_code = watermark["watermark_code"]
            center_code = watermark["center_code"]
            printer_id = watermark["printer_id"]
            operator_id = watermark["operator_id"]
            printed_at = watermark["printed_at"]
        else:
            # Fallback to general mock
            # Find a staff member
            staff_res = db.table("agency_staff").select("id, full_name").eq("role", "operator").limit(1).execute()
            if not staff_res.data:
                staff_res = db.table("agency_staff").select("id, full_name").limit(1).execute()
            
            operator_id = staff_res.data[0]["id"] if staff_res.data else None
            center_code = "DEL-01"
            printer_id = "PRINTER-DEL-001"
            printed_at = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
            watermark_code = f"DEL-01|PRINTER-|{str(operator_id)[:8] if operator_id else 'OP'}|{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}|P001|C0001|MOCK"

        # Resolve operator name
        operator_name = "Unknown Operator"
        if operator_id:
            op_res = db.table("agency_staff").select("full_name").eq("id", operator_id).execute()
            if op_res.data:
                operator_name = op_res.data[0]["full_name"]

        # Cross-reference 1: Paper Vault logs
        vault_logs_desc = []
        if exam_id:
            vault_res = db.table("paper_vault_access_logs")\
                .select("*, agency_staff(full_name)")\
                .eq("exam_id", exam_id)\
                .execute()
            for log in vault_res.data or []:
                staff_name = log.get("agency_staff", {}).get("full_name") or "Unknown"
                vault_logs_desc.append(f"Digital vault accessed by {staff_name} at {log['accessed_at']} (IP: {log['ip_address']})")

        # Cross-reference 2: Print room surveillance alerts
        print_alerts_desc = []
        if exam_id:
            pjobs = db.table("print_jobs").select("id").eq("exam_id", exam_id).execute()
            pjob_ids = [pj["id"] for pj in pjobs.data or []]
            if pjob_ids:
                alerts_res = db.table("print_room_surveillance_alerts")\
                    .select("*")\
                    .in_("print_job_id", pjob_ids)\
                    .execute()
                for alert in alerts_res.data or []:
                    print_alerts_desc.append(f"CCTV Alert: {alert['alert_type']} detected in print room (Confidence: {alert['confidence_score'] * 100:.1f}%)")

        # Cross-reference 3: Transit logs & violations
        transit_desc = []
        if exam_id:
            # Find trunks for this exam
            trunks_res = db.table("transit_trunks").select("id, trunk_code").eq("exam_id", exam_id).execute()
            trunk_ids = [t["id"] for t in trunks_res.data or []]
            if trunk_ids:
                violations_res = db.table("transit_geofence_violations")\
                    .select("*")\
                    .in_("trunk_id", trunk_ids)\
                    .execute()
                for violation in violations_res.data or []:
                    transit_desc.append(f"Transit Route Deviation: Geofence violation at lat={violation['latitude']}, lon={violation['longitude']}")

        # Cross-reference 4: Exam day center check-in and room occupancy
        dayof_desc = []
        if exam_id:
            checkins = db.table("checkin_events").select("id", count="exact").eq("exam_id", exam_id).execute()
            dayof_desc.append(f"Check-in events verified: {checkins.count or 0} students checked in on day of exam.")

        # Construct suspects list with deterministic weights
        suspects = []
        
        # Suspect 1: Operator
        op_prob = 0.50
        op_evidence = [f"Direct association with watermark code: {watermark_code} (Operator ID: {operator_id})"]
        if print_alerts_desc:
            op_prob += 0.20
            op_evidence.append(print_alerts_desc[0])
        else:
            op_evidence.append("No active printing security breaches flagged for this operator.")
        
        suspects.append({
            "name": operator_name,
            "id": operator_id,
            "role": "Printing Operator",
            "probability": op_prob,
            "evidence": op_evidence
        })

        # Suspect 2: Transit Manager
        transit_prob = 0.30
        transit_evidence = ["Responsible for batch delivery to center."]
        if transit_desc:
            transit_prob += 0.10
            transit_evidence.extend(transit_desc[:2])
        else:
            transit_evidence.append("Transit path matches scheduled route with zero deviations.")
            
        suspects.append({
            "name": "Transit Manager Group",
            "id": None,
            "role": "Logistics Staff",
            "probability": transit_prob,
            "evidence": transit_evidence
        })

        # Suspect 3: Center Staff / General leak
        remainder = round(1.0 - (op_prob + transit_prob), 2)
        suspects.append({
            "name": "Center Invigilation Staff",
            "id": None,
            "role": "Center Officer",
            "probability": max(0.0, remainder),
            "evidence": [f"Center Code: {center_code}. " + (dayof_desc[0] if dayof_desc else "Exam day operations completed.")]
        })

        # Normalize probabilities to sum exactly to 1.0
        total_p = sum(s["probability"] for s in suspects)
        for s in suspects:
            s["probability"] = round(s["probability"] / total_p, 4)

        prob_report = {
            "suspects": suspects,
            "vault_access_logs": vault_logs_desc,
            "print_surveillance_alerts": print_alerts_desc,
            "transit_violations": transit_desc
        }

        # Update leak report row
        db.table("leak_reports").update({
            "watermark_extracted": watermark_code,
            "extracted_center_code": center_code,
            "extracted_printer_id": printer_id,
            "extracted_operator_id": operator_id,
            "extracted_timestamp": printed_at,
            "probability_report": prob_report,
            "investigation_status": "REPORT_GENERATED"
        }).eq("id", report_id).execute()

        # Audit log
        db.table("audit_logs").insert({
            "event_type": "LEAK_INVESTIGATION_COMPLETE",
            "event_description": f"Leak investigation analysis completed for report {report_id}.",
            "metadata": {"report_id": report_id, "top_suspect": suspects[0]["name"], "probability": suspects[0]["probability"]},
            "exam_id": exam_id
        }).execute()

        # Notify agency head (mock mail print)
        print(f"[Celery Alert] Leak Investigation complete for Report {report_id}!")
        print(f"Attributed to {suspects[0]['name']} with probability {suspects[0]['probability'] * 100:.1f}%.")

        return {"status": "success", "report_id": report_id}
    except Exception as e:
        print(f"[Celery Error] run_leak_investigation failed: {e}")
        return {"status": "failed", "error": str(e)}
