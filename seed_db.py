import os
import sys
import datetime

# Ensure python path has the root directory so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from apps.api.core.supabase_client import get_supabase_client
from apps.api.workers.tasks_exam import generate_exam_brochure, generate_admit_cards
from apps.api.workers.tasks_results import compile_exam_results

db = get_supabase_client()

def main():
    print("=== STARTING DATABASE PRUNING ===")
    
    # 1. Prune public tables in reverse dependency order
    tables_to_prune = [
        "audit_logs",
        "grievance_cctv_attachments",
        "student_grievances",
        "whistleblower_reports",
        "leak_reports",
        "exam_results",
        "evaluation_discrepancies",
        "evaluation_marks",
        "evaluator_assignments",
        "answer_sheet_visibility_scores",
        "answer_sheet_uploads",
        "cbt_exam_sessions",
        "room_allocations",
        "surveillance_alerts",
        "checkin_events",
        "transit_geofence_violations",
        "transit_events",
        "transit_trunks",
        "print_room_surveillance_alerts",
        "print_watermark_registry",
        "print_jobs",
        "paper_vault_access_logs",
        "question_papers",
        "admit_cards",
        "center_allocations",
        "exam_registrations",
        "students",
        "exam_rooms",
        "exam_centers",
        "exams",
        "agency_staff",
        "agencies",
        "platform_admins"
    ]

    for t in tables_to_prune:
        print(f"Pruning table {t}...")
        try:
            db.table(t).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as e:
            print(f"Error pruning table {t}: {e}")

    # 2. Delete all Supabase Auth users
    print("Retrieving all Supabase Auth users...")
    try:
        users = db.auth.admin.list_users()
        for u in users:
            print(f"Deleting auth user: {u.email} ({u.id})...")
            try:
                db.auth.admin.delete_user(u.id)
            except Exception as e:
                print(f"Error deleting user {u.email}: {e}")
    except Exception as e:
        print("Failed to list/prune auth users:", e)

    print("\n=== STARTING SEEDING PROCESS ===")
    
    # 1. Create Platform Admin
    print("Creating platform admin user in Auth...")
    try:
        admin_auth = db.auth.admin.create_user({
            "email": "admin@parikshasetu.in",
            "password": "AdminPassword123",
            "email_confirm": True,
            "user_metadata": {"role": "platform_admin"},
            "app_metadata": {"role": "platform_admin"}
        })
        admin_user_id = admin_auth.user.id
        print(f"Platform admin created in Auth: {admin_auth.user.email} (ID: {admin_user_id})")
    except Exception as e:
        print("Failed to create admin:", e)
        raise e
    
    # Insert admin into public.platform_admins
    db.table("platform_admins").insert({
        "user_id": admin_user_id,
        "full_name": "Platform Admin",
        "email": "admin@parikshasetu.in"
    }).execute()
    print("Platform admin record inserted into public database.")

    # 2. Create the Agency (National-Testing-Agency)
    print("Creating National-Testing-Agency...")
    agency_res = db.table("agencies").insert({
        "name": "National-Testing-Agency",
        "slug": "national-testing-agency",
        "official_email": "hod@nta.in",
        "pan_number": "AAACN1234A",
        "address": "NTA Headquarters, Okhla",
        "city": "New Delhi",
        "state": "Delhi",
        "pincode": "110020",
        "phone": "011-69227700",
        "status": "ACTIVE",
        "approved_at": datetime.datetime.utcnow().isoformat() + "Z"
    }).execute()
    agency_id = agency_res.data[0]["id"]
    print(f"Agency created: National-Testing-Agency (ID: {agency_id})")

    # 3. Create the Agency Head staff
    print("Creating Agency Head...")
    agency_head_auth = db.auth.admin.create_user({
        "email": "hod@nta.in",
        "password": "AdminPassword123",
        "email_confirm": True,
        "user_metadata": {
            "role": "agency_head",
            "agency_id": agency_id
        },
        "app_metadata": {
            "role": "agency_head",
            "agency_id": agency_id
        }
    })
    agency_head_user_id = agency_head_auth.user.id
    
    head_staff_res = db.table("agency_staff").insert({
        "agency_id": agency_id,
        "user_id": agency_head_user_id,
        "full_name": "NTA Director General",
        "email": "hod@nta.in",
        "phone": "9999999999",
        "role": "agency_head",
        "is_active": True
    }).execute()
    agency_head_staff_id = head_staff_res.data[0]["id"]
    print(f"Agency Head staff record created (ID: {agency_head_staff_id})")

    # 4. Create 50 Staff Members
    print("Creating 50 staff members...")
    staff_roles = (
        ["manager"] * 4 +
        ["operator"] * 5 +
        ["transit_manager"] * 5 +
        ["center_officer"] * 15 +
        ["chief_moderator"] * 5 +
        ["moderator"] * 5 +
        ["grading_teacher"] * 11
    )
    
    staff_records = []
    for idx, role in enumerate(staff_roles, 1):
        email = f"staff{idx}@nta.in"
        try:
            auth_user_res = db.auth.admin.create_user({
                "email": email,
                "password": "AdminPassword123",
                "email_confirm": True,
                "user_metadata": {"role": role, "agency_id": agency_id},
                "app_metadata": {"role": role, "agency_id": agency_id}
            })
            auth_user_id = auth_user_res.user.id
            
            s_res = db.table("agency_staff").insert({
                "agency_id": agency_id,
                "user_id": auth_user_id,
                "full_name": f"NTA Staff {idx} ({role.replace('_', ' ').title()})",
                "email": email,
                "phone": f"98765432{idx:02d}",
                "role": role,
                "is_active": True
            }).execute()
            
            staff_records.append(s_res.data[0])
        except Exception as e:
            print(f"Failed to create staff {email}: {e}")
            
    print(f"Total staff members seeded successfully: {len(staff_records) + 1} (including Agency Head)")

    # 5. Create 3 Exams (2 online, 1 offline) - capacity 1000 each
    print("Creating 3 exams with capacity 1000 each...")
    exams_to_create = [
        {
            "agency_id": agency_id,
            "created_by": agency_head_staff_id,
            "name": "NEET UG Online",
            "slug": "neet-ug-online",
            "mode": "ONLINE",
            "exam_date": (datetime.date.today() + datetime.timedelta(days=15)).isoformat(),
            "start_time": "10:00:00+05:30",
            "duration_minutes": 180,
            "fee_inr": 1700.00,
            "total_seats": 1000,
            "eligibility_criteria": {"min_age": 17, "max_age": 25, "qualification": "12th Pass"},
            "syllabus": "Physics, Chemistry, Biology core syllabus.",
            "status": "ADMIT_CARDS_ISSUED"
        },
        {
            "agency_id": agency_id,
            "created_by": agency_head_staff_id,
            "name": "JEE Main Online",
            "slug": "jee-main-online",
            "mode": "ONLINE",
            "exam_date": (datetime.date.today() + datetime.timedelta(days=20)).isoformat(),
            "start_time": "09:00:00+05:30",
            "duration_minutes": 180,
            "fee_inr": 1000.00,
            "total_seats": 1000,
            "eligibility_criteria": {"min_age": 16, "max_age": 24, "qualification": "12th Pass"},
            "syllabus": "Physics, Chemistry, Mathematics core syllabus.",
            "status": "PUBLISHED"
        },
        {
            "agency_id": agency_id,
            "created_by": agency_head_staff_id,
            "name": "UGC NET Offline",
            "slug": "ugc-net-offline",
            "mode": "OFFLINE",
            "exam_date": (datetime.date.today() + datetime.timedelta(days=25)).isoformat(),
            "start_time": "14:00:00+05:30",
            "duration_minutes": 180,
            "fee_inr": 1150.00,
            "total_seats": 1000,
            "eligibility_criteria": {"min_age": 21, "max_age": 30, "qualification": "Post Graduate"},
            "syllabus": "Teaching & Research Aptitude, Subject Core.",
            "status": "RESULT_DECLARED",
            "evaluation_approved_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
    ]
    
    exams = []
    for ed in exams_to_create:
        res = db.table("exams").insert(ed).execute()
        exam = res.data[0]
        exams.append(exam)
        print(f"Created exam: {exam['name']} ({exam['mode']}) - ID: {exam['id']}")

    online_exam_1 = exams[0]
    offline_exam = exams[2]

    # 6. Seed Exam Centers & Rooms
    print("Creating Exam Centers and allocating Center Officers...")
    center_officers = [s for s in staff_records if s["role"] == "center_officer"]
    co_idx = 0
    centers_map = {}
    
    for exam_item in exams:
        exam_id = exam_item["id"]
        centers_map[exam_id] = []
        for city, cap in [("Delhi", 400), ("Mumbai", 300), ("Bangalore", 300)]:
            co = center_officers[co_idx % len(center_officers)]
            co_idx += 1
            
            c_res = db.table("exam_centers").insert({
                "exam_id": exam_id,
                "agency_id": agency_id,
                "name": f"{exam_item['name']} {city} Center",
                "address": f"{city} Education Zone, Sector 4",
                "city": city,
                "state": "Delhi" if city == "Delhi" else ("Maharashtra" if city == "Mumbai" else "Karnataka"),
                "pincode": "110001" if city == "Delhi" else ("400001" if city == "Mumbai" else "560001"),
                "latitude": 28.6139 if city == "Delhi" else (19.0760 if city == "Mumbai" else 12.9716),
                "longitude": 77.2090 if city == "Delhi" else (72.8777 if city == "Mumbai" else 77.5946),
                "center_code": f"{exam_item['slug'][:3].upper()}-{city[:3].upper()}-01",
                "total_capacity": cap,
                "center_officer_id": co["id"],
                "slug": f"{exam_item['slug']}-{city.lower()}-center"
            }).execute()
            center = c_res.data[0]
            centers_map[exam_id].append(center)
            
            # Associate center officer with their exam center
            db.table("agency_staff").update({"center_id": center["id"]}).eq("id", co["id"]).execute()
            
            # Create rooms for this center (5 rooms of capacity cap/5)
            room_cap = cap // 5
            for r in range(1, 6):
                db.table("exam_rooms").insert({
                    "center_id": center["id"],
                    "exam_id": exam_id,
                    "room_code": f"ROOM-{r:02d}",
                    "seating_capacity": room_cap,
                    "current_occupancy": 0
                }).execute()
            print(f"Created center {center['name']} and 5 classrooms.")

    # 7. Add Students and registrations
    print("Creating students and registrations...")
    students_data = []
    for i in range(1, 6):
        email = f"student{i}@gmail.com"
        try:
            auth_user_res = db.auth.admin.create_user({
                "email": email,
                "password": "AdminPassword123",
                "email_confirm": True,
                "user_metadata": {"role": "student"},
                "app_metadata": {"role": "student"}
            })
            auth_user_id = auth_user_res.user.id
            
            s_res = db.table("students").insert({
                "user_id": auth_user_id,
                "full_name": f"Candidate Student {i}",
                "email": email,
                "phone": f"991122330{i}",
                "date_of_birth": "2000-01-01",
                "gender": "MALE" if i % 2 == 0 else "FEMALE",
                "address": "Delhi Colony Road",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "photo_path": f"{auth_user_id}/profile.jpg"
            }).execute()
            student = s_res.data[0]
            students_data.append(student)
            
            # Register for NEET UG Online (ONLINE) and UGC NET Offline (OFFLINE)
            for exam_item in [online_exam_1, offline_exam]:
                pref_centers = centers_map[exam_item["id"]]
                reg_status = "REGISTERED" if exam_item["mode"] == "ONLINE" else "APPEARED"
                db.table("exam_registrations").insert({
                    "student_id": student["id"],
                    "exam_id": exam_item["id"],
                    "application_number": f"APP-{exam_item['slug'][:3].upper()}-{i:04d}",
                    "status": reg_status,
                    "payment_status": "SUCCESS",
                    "payment_amount_inr": exam_item["fee_inr"],
                    "payment_transaction_id": f"txn_{i}000{exam_item['slug'][:3]}",
                    "payment_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "center_preference_1": pref_centers[0]["id"],
                    "center_preference_2": pref_centers[1]["id"],
                    "center_preference_3": pref_centers[2]["id"],
                    "registered_at": datetime.datetime.utcnow().isoformat() + "Z"
                }).execute()
            print(f"Created student {email} and registered for NEET and UGC NET.")
        except Exception as e:
            print(f"Failed to create student {email}: {e}")

    # 8. Center Seating Allocation & Admit Cards
    print("\nAllocating exam centers...")
    for exam_item in [online_exam_1, offline_exam]:
        regs_res = db.table("exam_registrations").select("*").eq("exam_id", exam_item["id"]).execute()
        for reg in regs_res.data:
            db.table("center_allocations").insert({
                "registration_id": reg["id"],
                "student_id": reg["student_id"],
                "exam_id": exam_item["id"],
                "allocated_center_id": reg["center_preference_1"],
                "preference_rank_matched": 1,
                "allocated_by": agency_head_staff_id
            }).execute()

    # 9. Chain of Custody & Evaluation (Offline UGC NET)
    print("\nSimulating Chain of Custody and Results for UGC NET Offline...")
    operator_staff = [s for s in staff_records if s["role"] == "operator"][0]
    transit_manager = [s for s in staff_records if s["role"] == "transit_manager"][0]
    grading_teacher = [s for s in staff_records if s["role"] == "grading_teacher"][0]
    moderator = [s for s in staff_records if s["role"] == "moderator"][0]
    
    # Create Question Paper Vault
    paper_res = db.table("question_papers").insert({
        "exam_id": offline_exam["id"],
        "uploaded_by": agency_head_staff_id,
        "encrypted_storage_path": f"{offline_exam['id']}/papers/question_paper_v1.pdf",
        "key_share_1_vault_ref": "vault-ref-001",
        "key_share_2_hsm_ref": "hsm-ref-002",
        "paper_version": 1,
        "status": "VAULTED",
        "paper_type": "QUESTION_PAPER"
    }).execute()
    paper_id = paper_res.data[0]["id"]
    
    # Create Answer Key Vault
    db.table("question_papers").insert({
        "exam_id": offline_exam["id"],
        "uploaded_by": agency_head_staff_id,
        "encrypted_storage_path": f"{offline_exam['id']}/papers/answer_key.pdf",
        "key_share_1_vault_ref": "vault-ref-003",
        "key_share_2_hsm_ref": "hsm-ref-004",
        "paper_version": -1,
        "status": "VAULTED",
        "paper_type": "ANSWER_KEY"
    }).execute()
    print("Question paper and official answer key vaulted successfully.")

    # Create Print Jobs & Trunks for Delhi Center
    delhi_center = centers_map[offline_exam["id"]][0]
    print_res = db.table("print_jobs").insert({
        "paper_id": paper_id,
        "exam_id": offline_exam["id"],
        "center_id": delhi_center["id"],
        "initiated_by": operator_staff["id"],
        "printer_id": "PRINTER-OKHLA-NTA",
        "copies_requested": 400,
        "copies_budget": 400,
        "copies_approved": 400,
        "status": "COMPLETED",
        "print_started_at": datetime.datetime.utcnow().isoformat() + "Z",
        "print_completed_at": datetime.datetime.utcnow().isoformat() + "Z"
    }).execute()
    print_job_id = print_res.data[0]["id"]
    
    db.table("transit_trunks").insert({
        "trunk_code": f"TRUNK-UGCNET-{delhi_center['id'][:8].upper()}",
        "print_job_id": print_job_id,
        "center_id": delhi_center["id"],
        "assigned_transit_manager_id": transit_manager["id"],
        "device_imei": "123456789012345",
        "status": "UNLOCKED",
        "dispatched_at": datetime.datetime.utcnow().isoformat() + "Z",
        "delivered_at": datetime.datetime.utcnow().isoformat() + "Z",
        "unlocked_at": datetime.datetime.utcnow().isoformat() + "Z",
        "unlocked_by": delhi_center["center_officer_id"]
    }).execute()
    print("Print jobs completed and transit trunks dispatched/unlocked.")

    # 10. Checkin Events & Answer Sheet Uploads
    print("\nSimulating student answer sheet uploads...")
    uploads = []
    for idx, student in enumerate(students_data):
        reg_res = db.table("exam_registrations").select("id").eq("exam_id", offline_exam["id"]).eq("student_id", student["id"]).execute()
        reg_id = reg_res.data[0]["id"]
        
        # Insert checkin event
        db.table("checkin_events").insert({
            "exam_id": offline_exam["id"],
            "student_id": student["id"],
            "registration_id": reg_id,
            "center_id": delhi_center["id"],
            "qr_scan_result": "VALID",
            "biometric_match_result": "MATCHED",
            "checked_in_by": delhi_center["center_officer_id"],
            "checked_in_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).execute()
        
        # Upload answer sheet
        up_res = db.table("answer_sheet_uploads").insert({
            "exam_id": offline_exam["id"],
            "center_id": delhi_center["id"],
            "student_id": student["id"],
            "registration_id": reg_id,
            "uploaded_by": delhi_center["center_officer_id"],
            "encrypted_pdf_path": f"{offline_exam['id']}/{student['id']}/answersheet.pdf",
            "total_pages": 4,
            "upload_status": "SEALED",
            "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z"
        }).execute()
        uploads.append(up_res.data[0])
        
    # Create evaluation assignments
    upload_ids = [u["id"] for u in uploads]
    
    t1_res = db.table("evaluator_assignments").insert({
        "exam_id": offline_exam["id"],
        "evaluator_id": grading_teacher["id"],
        "role": "grading_teacher",
        "batch_code": "BATCH-UGC-01",
        "upload_ids": upload_ids,
        "assigned_by": agency_head_staff_id,
        "status": "LOCKED",
        "completed_at": datetime.datetime.utcnow().isoformat() + "Z"
    }).execute()
    t1_assign_id = t1_res.data[0]["id"]
    
    t2_res = db.table("evaluator_assignments").insert({
        "exam_id": offline_exam["id"],
        "evaluator_id": moderator["id"],
        "role": "moderator",
        "batch_code": "BATCH-UGC-01",
        "upload_ids": upload_ids,
        "assigned_by": agency_head_staff_id,
        "status": "LOCKED",
        "completed_at": datetime.datetime.utcnow().isoformat() + "Z"
    }).execute()
    t2_assign_id = t2_res.data[0]["id"]
    
    # Seed evaluation marks
    marks = [85.0, 75.0, 92.0, 35.0, 65.0]
    breakdowns = [
        {"Section A": 40.0, "Section B": 45.0},
        {"Section A": 35.0, "Section B": 40.0},
        {"Section A": 45.0, "Section B": 47.0},
        {"Section A": 15.0, "Section B": 20.0},
        {"Section A": 30.0, "Section B": 35.0}
    ]
    
    for idx, student in enumerate(students_data):
        # Grading Teacher
        db.table("evaluation_marks").insert({
            "exam_id": offline_exam["id"],
            "student_id": student["id"],
            "upload_id": uploads[idx]["id"],
            "center_uid": delhi_center["id"],
            "evaluator_id": grading_teacher["id"],
            "assignment_id": t1_assign_id,
            "evaluation_tier": 1,
            "marks_awarded": marks[idx],
            "max_marks": 100.0,
            "subject_breakdown": breakdowns[idx],
            "remarks": "Fairly answered."
        }).execute()
        
        # Moderator
        db.table("evaluation_marks").insert({
            "exam_id": offline_exam["id"],
            "student_id": student["id"],
            "upload_id": uploads[idx]["id"],
            "center_uid": delhi_center["id"],
            "evaluator_id": moderator["id"],
            "assignment_id": t2_assign_id,
            "evaluation_tier": 2,
            "marks_awarded": marks[idx],
            "max_marks": 100.0,
            "subject_breakdown": breakdowns[idx],
            "remarks": "Agreed with primary marks."
        }).execute()
        
    print("Student answer sheets sealed and evaluations logged.")
    print("\n=== DATABASE SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
