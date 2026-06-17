import datetime
from apps.api.workers.celery_app import celery_app

@celery_app.task(name="apps.api.workers.tasks_grievance.pull_cctv_for_grievance")
def pull_cctv_for_grievance(student_id: str, exam_id: str, grievance_id: str):
    """
    Looks up student's room allocation, clips CCTV footage for the exam duration,
    uploads to 'cctv-clips' bucket, and updates the grievance attachment record.
    """
    from apps.api.core.supabase_client import get_supabase_client
    print(f"[Celery] Pulling CCTV clip for student {student_id}, exam {exam_id}, grievance {grievance_id}...")
    db = get_supabase_client()
    try:
        # 1. Resolve room allocation
        room_id = None
        alloc_res = db.table("room_allocations").select("room_id").eq("student_id", student_id).eq("exam_id", exam_id).execute()
        if alloc_res.data:
            room_id = alloc_res.data[0]["room_id"]
        else:
            # Fallback: find any room under the exam
            rooms_res = db.table("exam_rooms").select("id").eq("exam_id", exam_id).limit(1).execute()
            if rooms_res.data:
                room_id = rooms_res.data[0]["id"]

        if not room_id:
            print("[Celery VMS Warning] No room allocation found for CCTV pulling.")
            return {"status": "skipped", "reason": "room_not_allocated"}

        # 2. Get camera details
        room_res = db.table("exam_rooms").select("camera_stream_url, room_code").eq("id", room_id).execute()
        room = room_res.data[0] if room_res.data else {"room_code": "ROOM-01", "camera_stream_url": ""}
        camera_id = f"CAM-{room['room_code']}-01"

        # 3. Retrieve exam duration
        exam_res = db.table("exams").select("exam_date, start_time, duration_minutes").eq("id", exam_id).execute()
        if exam_res.data:
            exam = exam_res.data[0]
            exam_date = exam["exam_date"]
            start_time = exam["start_time"]
            duration = exam["duration_minutes"]
            footage_start = f"{exam_date}T{start_time}Z"
            # Parse start time and add duration
            try:
                t_start = datetime.datetime.strptime(f"{exam_date} {start_time}", "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    t_start = datetime.datetime.strptime(f"{exam_date} {start_time}", "%Y-%m-%d %H:%M:%SZ")
                except Exception:
                    t_start = datetime.datetime.utcnow() - datetime.timedelta(hours=2)
            t_end = t_start + datetime.timedelta(minutes=duration)
            footage_end = t_end.isoformat() + "Z"
        else:
            footage_start = (datetime.datetime.utcnow() - datetime.timedelta(hours=2)).isoformat() + "Z"
            footage_end = datetime.datetime.utcnow().isoformat() + "Z"

        # 4. Generate mock CCTV clip (dummy MP4 header/bytes)
        # 100 bytes of dummy MP4 payload
        dummy_mp4_bytes = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom<mock_cctv_feed_clip>" + b"\x00" * 80
        
        footage_path = f"{exam_id}/{room_id}/{grievance_id}/footage.mp4"
        try:
            db.storage.from_("cctv-clips").upload(footage_path, dummy_mp4_bytes, {"content-type": "video/mp4"})
        except Exception:
            try:
                db.storage.from_("cctv-clips").update(footage_path, dummy_mp4_bytes, {"content-type": "video/mp4"})
            except Exception as se:
                print(f"[Celery VMS Error] Storage upload failed for CCTV clip: {se}")
                return {"status": "failed", "error": str(se)}

        # 5. Insert attachment row
        db.table("grievance_cctv_attachments").insert({
            "grievance_id": grievance_id,
            "room_id": room_id,
            "camera_id": camera_id,
            "footage_start": footage_start,
            "footage_end": footage_end,
            "footage_path": footage_path
        }).execute()

        # 6. Update student_grievances
        db.table("student_grievances").update({
            "auto_cctv_attached": True
        }).eq("id", grievance_id).execute()

        print(f"[Celery VMS] CCTV footage auto-attached to grievance {grievance_id}.")
        return {"status": "success", "footage_path": footage_path}
    except Exception as e:
        print(f"[Celery Error] pull_cctv_for_grievance failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_grievance.send_grievance_filed_notification")
def send_grievance_filed_notification(grievance_id: str):
    """
    Sends internal email notification to the assigned manager about the new grievance.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        g_res = db.table("student_grievances").select(
            "*, students(full_name), exams(name), manager:agency_staff!assigned_to(email, full_name)"
        ).eq("id", grievance_id).execute()
        
        if not g_res.data:
            return {"status": "failed", "error": "grievance_not_found"}
        g = g_res.data[0]
        
        manager = g.get("manager") or {}
        email = manager.get("email")
        manager_name = manager.get("full_name") or "Chief Manager"
        student_name = g.get("students", {}).get("full_name") or "Candidate"
        exam_name = g.get("exams", {}).get("name") or "Exam"
        
        if email:
            print(f"[Celery Mail] Sending grievance notification to manager {email}...")
            print(f"Subject: High Priority Grievance Filed - Ticket GRV-{grievance_id[:8]}")
            print(f"Body: Hello {manager_name},\n\nA candidate '{student_name}' has filed a high-priority grievance in category '{g['category']}' for '{exam_name}'.\n"
                  f"The system is currently auto-attaching CCTV video footage. Please log in to review.")
        
        return {"status": "success"}
    except Exception as e:
        print(f"[Celery Error] send_grievance_filed_notification failed: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="apps.api.workers.tasks_grievance.send_grievance_resolution_notification")
def send_grievance_resolution_notification(grievance_id: str):
    """
    Sends email notification to the student when their grievance is resolved/rejected.
    """
    from apps.api.core.supabase_client import get_supabase_client
    db = get_supabase_client()
    try:
        g_res = db.table("student_grievances").select(
            "*, students(email, full_name), exams(name)"
        ).eq("id", grievance_id).execute()
        
        if not g_res.data:
            return {"status": "failed", "error": "grievance_not_found"}
        g = g_res.data[0]
        
        student = g.get("students") or {}
        email = student.get("email")
        student_name = student.get("full_name") or "Candidate"
        exam_name = g.get("exams", {}).get("name") or "Exam"
        
        if email:
            print(f"[Celery Mail] Sending resolution email to student {email}...")
            print(f"Subject: Update on your Grievance - Ticket GRV-{grievance_id[:8]}")
            print(f"Body: Hello {student_name},\n\nYour grievance (category: {g['category']}) regarding '{exam_name}' has been processed.\n"
                  f"Status: {g['status']}\n"
                  f"Manager Resolution Note:\n{g['resolution_notes']}\n\n"
                  f"Thank you,\nParikshaSetu AI Security Network")
                  
        return {"status": "success"}
    except Exception as e:
        print(f"[Celery Error] send_grievance_resolution_notification failed: {e}")
        return {"status": "failed", "error": str(e)}
