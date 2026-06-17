# LeakGuard AI — Database Design Document

All tables live in a PostgreSQL database hosted on Supabase. Row-Level Security (RLS) is enabled on every table. All timestamps are stored as `TIMESTAMPTZ` (UTC). All IDs are `UUID` unless stated otherwise.

---

## Table Index

1. agencies
2. agency_staff
3. exams
4. exam_centers
5. exam_rooms
6. students
7. exam_registrations
8. center_allocations
9. admit_cards
10. question_papers
11. paper_vault_access_logs
12. print_jobs
13. print_watermark_registry
14. print_room_surveillance_alerts
15. transit_trunks
16. transit_events
17. transit_geofence_violations
18. checkin_events
19. room_allocations
20. surveillance_alerts
21. cbt_exam_sessions
22. answer_sheet_uploads
23. answer_sheet_visibility_scores
24. evaluator_assignments
25. evaluation_marks
26. evaluation_discrepancies
27. exam_results
28. leak_reports
29. whistleblower_reports
30. student_grievances
31. grievance_cctv_attachments
32. audit_logs

---

## 1. agencies

Stores every registered examination agency on the platform.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default gen_random_uuid() | Unique agency identifier |
| name | TEXT | NOT NULL | Full legal name of the agency |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier used for subdomain routing |
| official_email | TEXT | NOT NULL, UNIQUE | Primary contact email |
| pan_number | TEXT | NOT NULL | PAN / GST / Registration number |
| address | TEXT | NOT NULL | Registered address |
| city | TEXT | NOT NULL | City |
| state | TEXT | NOT NULL | State |
| pincode | TEXT | NOT NULL | Postal code |
| phone | TEXT | NOT NULL | Primary contact phone |
| status | TEXT | NOT NULL, default 'PENDING' | One of: PENDING, ACTIVE, SUSPENDED, DEREGISTERED |
| approved_at | TIMESTAMPTZ | NULLABLE | When platform admin approved the agency |
| approved_by | UUID | FK → platform_admins.id, NULLABLE | Platform admin who approved |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last updated timestamp |

---

## 2. agency_staff

All staff members associated with an agency, including the head.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique staff record identifier |
| agency_id | UUID | NOT NULL, FK → agencies.id ON DELETE CASCADE | Parent agency |
| user_id | UUID | NOT NULL, FK → auth.users.id | Supabase Auth user linked to this staff member |
| full_name | TEXT | NOT NULL | Staff member's full name |
| email | TEXT | NOT NULL | Staff member's email |
| phone | TEXT | NOT NULL | Contact phone |
| role | TEXT | NOT NULL | One of: agency_head, manager, operator, transit_manager, center_officer, chief_moderator, moderator, grading_teacher |
| is_active | BOOLEAN | NOT NULL, default true | Whether the account is currently active |
| invited_at | TIMESTAMPTZ | NOT NULL, default now() | When the invite was sent |
| joined_at | TIMESTAMPTZ | NULLABLE | When the staff member accepted the invite and set their password |
| created_by | UUID | FK → agency_staff.id | Who created this staff record |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |

---

## 3. exams

Core exam records created by agency staff.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique exam identifier |
| agency_id | UUID | NOT NULL, FK → agencies.id ON DELETE CASCADE | Owning agency |
| created_by | UUID | NOT NULL, FK → agency_staff.id | Staff member who created the exam |
| name | TEXT | NOT NULL | Full exam name |
| slug | TEXT | NOT NULL | URL-safe identifier for this exam |
| mode | TEXT | NOT NULL | One of: ONLINE, OFFLINE |
| exam_date | DATE | NOT NULL | Date of the exam |
| start_time | TIMETZ | NOT NULL | Scheduled start time |
| duration_minutes | INTEGER | NOT NULL | Duration of the exam in minutes |
| fee_inr | NUMERIC(10,2) | NOT NULL | Registration fee in INR |
| total_seats | INTEGER | NOT NULL | Maximum number of students that can register |
| eligibility_criteria | JSONB | NOT NULL | Structured eligibility rules (age range, qualifications, categories) |
| syllabus | TEXT | NULLABLE | Syllabus text (or link to uploaded PDF) |
| syllabus_pdf_path | TEXT | NULLABLE | Supabase Storage path for syllabus PDF |
| brochure_pdf_path | TEXT | NULLABLE | Supabase Storage path for AI-generated brochure |
| status | TEXT | NOT NULL, default 'DRAFT' | One of: DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, ADMIT_CARDS_ISSUED, ONGOING, PAPER_UPLOAD_PENDING, EVALUATION_IN_PROGRESS, RESULT_DECLARED |
| registration_open_at | TIMESTAMPTZ | NULLABLE | When registration opens |
| registration_close_at | TIMESTAMPTZ | NULLABLE | When registration closes |
| visibility_score_threshold | NUMERIC(3,1) | NOT NULL, default 8.0 | Minimum AI visibility score for answer sheets |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last updated timestamp |

---

## 4. exam_centers

Centers registered by the agency for a specific exam.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique center identifier |
| exam_id | UUID | NOT NULL, FK → exams.id ON DELETE CASCADE | Parent exam |
| agency_id | UUID | NOT NULL, FK → agencies.id | Parent agency |
| name | TEXT | NOT NULL | Center name |
| address | TEXT | NOT NULL | Full address |
| city | TEXT | NOT NULL | City |
| state | TEXT | NOT NULL | State |
| pincode | TEXT | NOT NULL | Postal code |
| latitude | NUMERIC(10,7) | NOT NULL | GPS latitude of the center |
| longitude | NUMERIC(10,7) | NOT NULL | GPS longitude of the center |
| geofence_radius_meters | INTEGER | NOT NULL, default 100 | Radius within which trunk unlock and check-in are valid |
| center_code | TEXT | NOT NULL, UNIQUE (per exam) | Short alphanumeric code used in watermarking |
| total_capacity | INTEGER | NOT NULL | Sum of all room capacities |
| center_officer_id | UUID | NULLABLE, FK → agency_staff.id | Assigned Center Officer for this exam |
| is_active | BOOLEAN | NOT NULL, default true | Whether center is active for this exam |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |

---

## 5. exam_rooms

Individual rooms within each exam center.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique room identifier |
| center_id | UUID | NOT NULL, FK → exam_centers.id ON DELETE CASCADE | Parent center |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| room_code | TEXT | NOT NULL | Human-readable room code (e.g., "R1A", "Hall-3") |
| seating_capacity | INTEGER | NOT NULL | Maximum students allowed in this room |
| current_occupancy | INTEGER | NOT NULL, default 0 | Live count of students checked into this room |
| camera_stream_url | TEXT | NULLABLE | WebRTC stream URL for this room's CCTV feed |
| is_active | BOOLEAN | NOT NULL, default true | Whether room is available for allocation |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |

---

## 6. students

Student/candidate accounts on the platform.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique student identifier |
| user_id | UUID | NOT NULL, FK → auth.users.id | Supabase Auth user |
| full_name | TEXT | NOT NULL | Student's full name |
| email | TEXT | NOT NULL, UNIQUE | Registered email |
| phone | TEXT | NOT NULL | Registered mobile number (used for OTP) |
| date_of_birth | DATE | NOT NULL | Date of birth |
| gender | TEXT | NOT NULL | One of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| address | TEXT | NOT NULL | Residential address |
| city | TEXT | NOT NULL | City |
| state | TEXT | NOT NULL | State |
| pincode | TEXT | NOT NULL | Postal code |
| photo_path | TEXT | NULLABLE | Supabase Storage path for student photo |
| biometric_hash | TEXT | NULLABLE | Cryptographic hash of facial biometric (generated on registration) |
| id_proof_type | TEXT | NULLABLE | Type of ID proof (Aadhaar, PAN, Passport) |
| id_proof_number | TEXT | NULLABLE | ID proof number (encrypted) |
| id_proof_path | TEXT | NULLABLE | Supabase Storage path for ID proof scan |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last updated timestamp |

---

## 7. exam_registrations

A student's registration for a specific exam.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique registration identifier |
| student_id | UUID | NOT NULL, FK → students.id | Registering student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam being registered for |
| application_number | TEXT | NOT NULL, UNIQUE | Human-readable application number (e.g., "LG-2025-00123") |
| status | TEXT | NOT NULL, default 'PENDING_PAYMENT' | One of: PENDING_PAYMENT, REGISTERED, CANCELLED, CHECKED_IN, APPEARED, ABSENT |
| payment_status | TEXT | NOT NULL, default 'PENDING' | One of: PENDING, SUCCESS, FAILED, REFUNDED |
| payment_transaction_id | TEXT | NULLABLE | Payment gateway transaction ID |
| payment_amount_inr | NUMERIC(10,2) | NULLABLE | Amount paid |
| payment_at | TIMESTAMPTZ | NULLABLE | When payment was confirmed |
| center_preference_1 | UUID | NULLABLE, FK → exam_centers.id | First preferred center |
| center_preference_2 | UUID | NULLABLE, FK → exam_centers.id | Second preferred center |
| center_preference_3 | UUID | NULLABLE, FK → exam_centers.id | Third preferred center |
| registered_at | TIMESTAMPTZ | NULLABLE | When registration was confirmed post-payment |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |

---

## 8. center_allocations

Result of the AI center allocation process (agency-triggered post registration close).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique allocation identifier |
| registration_id | UUID | NOT NULL, UNIQUE, FK → exam_registrations.id | The exam registration this allocation belongs to |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam |
| allocated_center_id | UUID | NOT NULL, FK → exam_centers.id | The center the student was allocated to |
| preference_rank_matched | INTEGER | NOT NULL | Which preference was matched (1, 2, 3, or 0 if none matched and fallback used) |
| allocated_at | TIMESTAMPTZ | NOT NULL, default now() | When allocation was run |
| allocated_by | UUID | NOT NULL, FK → agency_staff.id | Staff member who triggered the allocation run |

---

## 9. admit_cards

Generated admit cards for each registered and allocated student.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique admit card identifier |
| registration_id | UUID | NOT NULL, UNIQUE, FK → exam_registrations.id | Parent registration |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Allocated center |
| qr_payload_jwt | TEXT | NOT NULL | The signed JWT payload embedded in the QR code |
| qr_biometric_hash | TEXT | NOT NULL | Biometric hash included in the QR payload for day-of verification |
| pdf_path | TEXT | NOT NULL | Supabase Storage path for the generated admit card PDF |
| generated_at | TIMESTAMPTZ | NOT NULL, default now() | When the admit card was generated |
| is_valid | BOOLEAN | NOT NULL, default true | Whether the admit card is currently valid (set false if cancelled/reissued) |

---

## 10. question_papers

Encrypted question papers stored in the vault.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique paper identifier |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| uploaded_by | UUID | NOT NULL, FK → agency_staff.id | Who uploaded the paper |
| encrypted_storage_path | TEXT | NOT NULL | Supabase Storage path for the AES-256-GCM encrypted paper file |
| key_share_1_vault_ref | TEXT | NOT NULL | Reference to Key Share 1 stored in Supabase Vault |
| key_share_2_hsm_ref | TEXT | NOT NULL | Reference to Key Share 2 stored in HSM |
| encryption_algorithm | TEXT | NOT NULL, default 'AES-256-GCM' | Encryption algorithm used |
| paper_version | INTEGER | NOT NULL, default 1 | Version number (if paper is replaced, old version is archived) |
| status | TEXT | NOT NULL, default 'VAULTED' | One of: VAULTED, DECRYPTED_FOR_PRINT, DECRYPTED_FOR_CBT, ARCHIVED |
| uploaded_at | TIMESTAMPTZ | NOT NULL, default now() | When the paper was uploaded and encrypted |
| upload_session_recording_path | TEXT | NULLABLE | Path to the upload session screen recording |

---

## 11. paper_vault_access_logs

Immutable log of every access (read/decrypt) to a question paper.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique log entry identifier |
| paper_id | UUID | NOT NULL, FK → question_papers.id | The paper accessed |
| accessed_by | UUID | NOT NULL, FK → agency_staff.id | Who accessed the paper |
| access_type | TEXT | NOT NULL | One of: UPLOAD, VIEW_ENCRYPTED, DECRYPT_FOR_PRINT, DECRYPT_FOR_CBT, ADMIN_REVIEW |
| ip_address | TEXT | NOT NULL | IP address of the accessor |
| device_fingerprint | TEXT | NULLABLE | Browser/device fingerprint |
| webcam_snapshot_path | TEXT | NULLABLE | Path to webcam snapshot taken at access time |
| accessed_at | TIMESTAMPTZ | NOT NULL, default now() | Timestamp of access |
| notes | TEXT | NULLABLE | Any additional context |

---

## 12. print_jobs

Records of each printing job initiated through the portal (offline exams only).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique print job identifier |
| paper_id | UUID | NOT NULL, FK → question_papers.id | Paper being printed |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center for which papers are being printed |
| initiated_by | UUID | NOT NULL, FK → agency_staff.id | Operator who initiated the job |
| printer_id | TEXT | NOT NULL | Unique printer machine identifier (MAC address or registered ID) |
| copies_requested | INTEGER | NOT NULL | Number of copies requested by the operator |
| copies_budget | INTEGER | NOT NULL | Maximum copies allowed for this center |
| copies_approved | INTEGER | NULLABLE | Copies approved by the system |
| status | TEXT | NOT NULL, default 'PENDING' | One of: PENDING, APPROVED, PRINTING, COMPLETED, BLOCKED_OVER_BUDGET, BLOCKED_ANOMALOUS_TIME |
| print_started_at | TIMESTAMPTZ | NULLABLE | When printing actually began |
| print_completed_at | TIMESTAMPTZ | NULLABLE | When printing completed |
| block_reason | TEXT | NULLABLE | Reason if job was blocked |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Record creation timestamp |

---

## 13. print_watermark_registry

Maps each watermark code to a specific printed page, enabling leak tracing.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique watermark record |
| print_job_id | UUID | NOT NULL, FK → print_jobs.id | The print job this page belongs to |
| center_code | TEXT | NOT NULL | Center code embedded in the watermark |
| printer_id | TEXT | NOT NULL | Printer machine ID embedded in the watermark |
| operator_id | UUID | NOT NULL, FK → agency_staff.id | Operator ID embedded in the watermark |
| page_number | INTEGER | NOT NULL | Page number in the paper |
| copy_number | INTEGER | NOT NULL | Which copy of the set this page is from |
| watermark_code | TEXT | NOT NULL, UNIQUE | The full encoded watermark string |
| printed_at | TIMESTAMPTZ | NOT NULL | Exact timestamp embedded in the watermark |

---

## 14. print_room_surveillance_alerts

AI-detected anomalies in the print room during a print job.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique alert identifier |
| print_job_id | UUID | NOT NULL, FK → print_jobs.id | Associated print job |
| camera_id | TEXT | NOT NULL | Camera identifier |
| alert_type | TEXT | NOT NULL | One of: MOBILE_PHONE_DETECTED, UNAUTHORIZED_PERSON, EXTRA_PAGES_TAKEN, ANOMALOUS_BEHAVIOR |
| confidence_score | NUMERIC(5,4) | NOT NULL | YOLOv8 detection confidence (0.0–1.0) |
| snapshot_path | TEXT | NOT NULL | Storage path for the alert screenshot |
| detected_at | TIMESTAMPTZ | NOT NULL, default now() | When the alert was generated |
| reviewed_by | UUID | NULLABLE, FK → agency_staff.id | Staff member who reviewed this alert |
| reviewed_at | TIMESTAMPTZ | NULLABLE | When reviewed |
| review_outcome | TEXT | NULLABLE | One of: DISMISSED, ESCALATED, ACTION_TAKEN |

---

## 15. transit_trunks

IoT-enabled trunks used for transporting offline exam papers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique trunk identifier |
| trunk_code | TEXT | NOT NULL, UNIQUE | Human-readable trunk code |
| print_job_id | UUID | NOT NULL, FK → print_jobs.id | Print job whose papers are in this trunk |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Destination center |
| assigned_transit_manager_id | UUID | NOT NULL, FK → agency_staff.id | Transit manager responsible for this trunk |
| device_imei | TEXT | NOT NULL | IMEI/serial of the GPS device in the trunk |
| status | TEXT | NOT NULL, default 'SEALED' | One of: SEALED, IN_TRANSIT, DELIVERED, COMPROMISED, UNLOCKED |
| sealed_at | TIMESTAMPTZ | NOT NULL, default now() | When the trunk was sealed at the source |
| dispatched_at | TIMESTAMPTZ | NULLABLE | When the transit vehicle departed |
| delivered_at | TIMESTAMPTZ | NULLABLE | When the trunk arrived at the center |
| unlock_otp_sent_at | TIMESTAMPTZ | NULLABLE | When OTP for unlocking was sent |
| unlocked_at | TIMESTAMPTZ | NULLABLE | When the trunk was successfully unlocked at the center |
| unlocked_by | UUID | NULLABLE, FK → agency_staff.id | Center Officer who unlocked the trunk |
| unlock_gps_latitude | NUMERIC(10,7) | NULLABLE | GPS latitude at the moment of unlock |
| unlock_gps_longitude | NUMERIC(10,7) | NULLABLE | GPS longitude at the moment of unlock |

---

## 16. transit_events

Real-time GPS telemetry events from trunks during transit.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique event identifier |
| trunk_id | UUID | NOT NULL, FK → transit_trunks.id | Parent trunk |
| latitude | NUMERIC(10,7) | NOT NULL | GPS latitude at this event |
| longitude | NUMERIC(10,7) | NOT NULL | GPS longitude at this event |
| speed_kmh | NUMERIC(6,2) | NULLABLE | Speed of the vehicle at this event |
| is_on_route | BOOLEAN | NOT NULL, default true | Whether this location is within the approved geofence corridor |
| recorded_at | TIMESTAMPTZ | NOT NULL | Timestamp of the GPS reading |

---

## 17. transit_geofence_violations

Logged whenever a trunk deviates from its approved route.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique violation identifier |
| trunk_id | UUID | NOT NULL, FK → transit_trunks.id | Trunk that violated the geofence |
| violation_latitude | NUMERIC(10,7) | NOT NULL | Location where violation was detected |
| violation_longitude | NUMERIC(10,7) | NOT NULL | Location where violation was detected |
| deviation_meters | INTEGER | NOT NULL | How far off-route the trunk was |
| detected_at | TIMESTAMPTZ | NOT NULL, default now() | When the violation was detected |
| alerted_to | UUID | NOT NULL, FK → agency_staff.id | Manager/Head who was alerted |
| resolution | TEXT | NULLABLE | How the violation was resolved |
| resolved_at | TIMESTAMPTZ | NULLABLE | When the violation was resolved |

---

## 18. checkin_events

Records of each student checking in at their allocated exam center on exam day.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique check-in record |
| registration_id | UUID | NOT NULL, UNIQUE, FK → exam_registrations.id | The exam registration being checked in |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center where check-in occurred |
| qr_scan_result | TEXT | NOT NULL | One of: VALID, INVALID_SIGNATURE, WRONG_CENTER, EXPIRED |
| biometric_match_score | NUMERIC(5,4) | NULLABLE | Face match confidence score (0.0–1.0) |
| biometric_match_result | TEXT | NOT NULL | One of: MATCHED, FAILED, SKIPPED |
| biometric_photo_path | TEXT | NULLABLE | Storage path for the live biometric capture at check-in |
| checked_in_by | UUID | NOT NULL, FK → agency_staff.id | Center Officer who processed the check-in |
| checked_in_at | TIMESTAMPTZ | NOT NULL, default now() | Time of check-in |
| failed_attempts | INTEGER | NOT NULL, default 0 | Number of failed biometric attempts |
| is_flagged | BOOLEAN | NOT NULL, default false | Whether this check-in was flagged for review |
| flag_reason | TEXT | NULLABLE | Reason for flagging if is_flagged is true |

---

## 19. room_allocations

Binding of a student to a specific room on exam day (set at check-in).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique room allocation identifier |
| checkin_event_id | UUID | NOT NULL, UNIQUE, FK → checkin_events.id | Check-in event that triggered this allocation |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center |
| room_id | UUID | NOT NULL, FK → exam_rooms.id | Randomly allocated room |
| seat_number | TEXT | NULLABLE | Assigned seat number within the room |
| allocated_at | TIMESTAMPTZ | NOT NULL, default now() | When room was allocated |

---

## 20. surveillance_alerts

AI-detected anomalies in exam halls during the examination.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique alert identifier |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center where alert occurred |
| room_id | UUID | NULLABLE, FK → exam_rooms.id | Specific room, if identifiable |
| camera_id | TEXT | NOT NULL | Camera identifier |
| alert_type | TEXT | NOT NULL | One of: MOBILE_PHONE_DETECTED, EARPIECE_DETECTED, MASS_HEAD_TURNING, UNAUTHORIZED_PERSON, SUSPICIOUS_OBJECT |
| confidence_score | NUMERIC(5,4) | NOT NULL | Detection confidence (0.0–1.0) |
| snapshot_path | TEXT | NOT NULL | Storage path for alert screenshot |
| detected_at | TIMESTAMPTZ | NOT NULL, default now() | When detected |
| reviewed_by | UUID | NULLABLE, FK → agency_staff.id | Manager who reviewed |
| reviewed_at | TIMESTAMPTZ | NULLABLE | Review timestamp |
| review_outcome | TEXT | NULLABLE | One of: DISMISSED, ESCALATED, ACTION_TAKEN |

---

## 21. cbt_exam_sessions

Tracks online CBT exam sessions per student.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique session identifier |
| registration_id | UUID | NOT NULL, FK → exam_registrations.id | Parent registration |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center (for center-based CBT) |
| session_token | TEXT | NOT NULL, UNIQUE | Short-lived session token for the exam client |
| status | TEXT | NOT NULL, default 'NOT_STARTED' | One of: NOT_STARTED, ACTIVE, SUBMITTED, TIMED_OUT, FLAGGED |
| decrypted_at | TIMESTAMPTZ | NULLABLE | When the paper was decrypted for this student |
| started_at | TIMESTAMPTZ | NULLABLE | When the student started the exam |
| submitted_at | TIMESTAMPTZ | NULLABLE | When the student submitted |
| tab_switch_count | INTEGER | NOT NULL, default 0 | Number of tab switches detected |
| suspicious_typing_flags | INTEGER | NOT NULL, default 0 | Number of machine-like typing events detected |
| responses_encrypted_path | TEXT | NULLABLE | Encrypted storage path for student responses |

---

## 22. answer_sheet_uploads

Records of answer sheets scanned and uploaded post-exam by center operators.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique upload record identifier |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| center_id | UUID | NOT NULL, FK → exam_centers.id | Center from which paper was uploaded |
| student_id | UUID | NOT NULL, FK → students.id | Student whose paper is uploaded |
| registration_id | UUID | NOT NULL, FK → exam_registrations.id | Parent registration |
| uploaded_by | UUID | NOT NULL, FK → agency_staff.id | Center Operator who uploaded |
| encrypted_pdf_path | TEXT | NOT NULL | Storage path for the encrypted scanned PDF |
| total_pages | INTEGER | NOT NULL | Total pages in the upload |
| upload_status | TEXT | NOT NULL, default 'UPLOADED' | One of: UPLOADED, SCORING, APPROVED, RESCAN_REQUIRED, SEALED |
| uploaded_at | TIMESTAMPTZ | NOT NULL, default now() | Upload timestamp |

---

## 23. answer_sheet_visibility_scores

AI visibility scoring results for each uploaded answer sheet.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique scoring record |
| upload_id | UUID | NOT NULL, FK → answer_sheet_uploads.id | Parent upload |
| page_number | INTEGER | NOT NULL | Page number within the upload |
| visibility_score | NUMERIC(4,2) | NOT NULL | AI-assigned visibility score (0.00–10.00) |
| issues_detected | JSONB | NULLABLE | Detected issues (e.g., blur, fold, low contrast) |
| scored_at | TIMESTAMPTZ | NOT NULL, default now() | When scoring was run |
| model_version | TEXT | NOT NULL | Version of the scoring model used |

---

## 24. evaluator_assignments

Maps grading teachers and moderators to specific anonymized paper batches.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique assignment identifier |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| evaluator_id | UUID | NOT NULL, FK → agency_staff.id | The teacher or moderator |
| role | TEXT | NOT NULL | One of: grading_teacher, moderator, chief_moderator |
| batch_code | TEXT | NOT NULL | Anonymized batch code (not directly linked to student names) |
| upload_ids | UUID[] | NOT NULL | Array of answer_sheet_uploads.id values in this batch |
| assigned_by | UUID | NOT NULL, FK → agency_staff.id | Who made the assignment |
| assigned_at | TIMESTAMPTZ | NOT NULL, default now() | Assignment timestamp |
| status | TEXT | NOT NULL, default 'PENDING' | One of: PENDING, IN_PROGRESS, COMPLETED, LOCKED |
| completed_at | TIMESTAMPTZ | NULLABLE | When the evaluator formally confirmed completion |
| access_revoked_at | TIMESTAMPTZ | NULLABLE | When access was permanently revoked post-completion |

---

## 25. evaluation_marks

Marks awarded to each student at each evaluation tier.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique marks record |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| student_id | UUID | NOT NULL, FK → students.id | Student (de-anonymized reference stored here; not shown to evaluators) |
| upload_id | UUID | NOT NULL, FK → answer_sheet_uploads.id | The specific paper evaluated |
| center_uid | UUID | NOT NULL, FK → exam_centers.id | Center UID (part of the secure mapping) |
| evaluator_id | UUID | NOT NULL, FK → agency_staff.id | Who awarded these marks |
| assignment_id | UUID | NOT NULL, FK → evaluator_assignments.id | Parent assignment |
| evaluation_tier | INTEGER | NOT NULL | 1 = Grading Teacher, 2 = Moderator, 3 = Chief Moderator |
| marks_awarded | NUMERIC(7,2) | NOT NULL | Marks awarded by this evaluator at this tier |
| max_marks | NUMERIC(7,2) | NOT NULL | Maximum possible marks |
| subject_breakdown | JSONB | NULLABLE | Section/subject-wise breakdown of marks |
| remarks | TEXT | NULLABLE | Evaluator remarks |
| evaluated_at | TIMESTAMPTZ | NOT NULL, default now() | When marks were submitted |

---

## 26. evaluation_discrepancies

Auto-flagged when Tier 1 and Tier 2 marks differ beyond the threshold.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique discrepancy record |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| upload_id | UUID | NOT NULL, FK → answer_sheet_uploads.id | Paper with discrepancy |
| tier1_marks_id | UUID | NOT NULL, FK → evaluation_marks.id | Tier 1 marks record |
| tier2_marks_id | UUID | NOT NULL, FK → evaluation_marks.id | Tier 2 marks record |
| marks_difference | NUMERIC(7,2) | NOT NULL | Absolute difference in marks |
| status | TEXT | NOT NULL, default 'OPEN' | One of: OPEN, UNDER_REVIEW, RESOLVED |
| resolved_by | UUID | NULLABLE, FK → agency_staff.id | Chief Moderator who resolved |
| final_marks_id | UUID | NULLABLE, FK → evaluation_marks.id | The Tier 3 marks record that resolved this |
| resolved_at | TIMESTAMPTZ | NULLABLE | When resolved |

---

## 27. exam_results

Final published results per student per exam.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique result identifier |
| exam_id | UUID | NOT NULL, FK → exams.id | Parent exam |
| student_id | UUID | NOT NULL, FK → students.id | Student |
| registration_id | UUID | NOT NULL, FK → exam_registrations.id | Parent registration |
| final_marks | NUMERIC(7,2) | NOT NULL | Final awarded marks |
| max_marks | NUMERIC(7,2) | NOT NULL | Maximum possible marks |
| percentage | NUMERIC(5,2) | NOT NULL | Calculated percentage |
| rank | INTEGER | NULLABLE | Overall rank (if applicable) |
| category_rank | INTEGER | NULLABLE | Rank within the student's category |
| result_status | TEXT | NOT NULL | One of: PASS, FAIL, ABSENT, WITHHELD |
| subject_breakdown | JSONB | NULLABLE | Subject-wise marks breakdown |
| result_pdf_path | TEXT | NULLABLE | Storage path for the signed result PDF |
| published_at | TIMESTAMPTZ | NOT NULL, default now() | When the result was published |
| published_by | UUID | NOT NULL, FK → agency_staff.id | Who published the result |

---

## 28. leak_reports

Reports of suspected leaked papers submitted for Agent 7 investigation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique report identifier |
| exam_id | UUID | NULLABLE, FK → exams.id | Exam the leaked paper relates to |
| reported_by | UUID | NULLABLE, FK → agency_staff.id | Internal staff reporter (null if external) |
| source_type | TEXT | NOT NULL | One of: INTERNAL, WHISTLEBLOWER, PUBLIC_MEDIA |
| uploaded_image_path | TEXT | NOT NULL | Storage path for the uploaded suspected leak image |
| watermark_extracted | TEXT | NULLABLE | Decoded watermark string (output of Agent 7) |
| extracted_center_code | TEXT | NULLABLE | Center code from watermark |
| extracted_printer_id | TEXT | NULLABLE | Printer ID from watermark |
| extracted_operator_id | UUID | NULLABLE, FK → agency_staff.id | Operator identified from watermark |
| extracted_timestamp | TIMESTAMPTZ | NULLABLE | Print timestamp from watermark |
| probability_report | JSONB | NULLABLE | Agent 7 output: probability scores per suspect |
| investigation_status | TEXT | NOT NULL, default 'RECEIVED' | One of: RECEIVED, PROCESSING, REPORT_GENERATED, CLOSED |
| reported_at | TIMESTAMPTZ | NOT NULL, default now() | When the report was submitted |

---

## 29. whistleblower_reports

Fully anonymous public reports submitted through the public portal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique report identifier |
| exam_id | UUID | NULLABLE, FK → exams.id | Exam the report relates to (if known) |
| category | TEXT | NOT NULL | One of: PAPER_LEAK, BRIBERY, IMPERSONATION, INVIGILATOR_MISCONDUCT, OTHER |
| description | TEXT | NOT NULL | Reporter's description |
| evidence_paths | TEXT[] | NULLABLE | Array of Storage paths for uploaded photos/videos |
| location_text | TEXT | NULLABLE | Location description provided by reporter |
| ai_risk_score | INTEGER | NULLABLE | AI-assigned risk score (0–100) |
| routing_status | TEXT | NOT NULL, default 'RECEIVED' | One of: RECEIVED, AI_SCORED, ROUTED_TO_AUDIT, CLOSED |
| submitted_at | TIMESTAMPTZ | NOT NULL, default now() | Submission timestamp |

---

## 30. student_grievances

Authenticated grievances filed by students through the student portal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique grievance identifier |
| student_id | UUID | NOT NULL, FK → students.id | Filing student |
| exam_id | UUID | NOT NULL, FK → exams.id | Exam the grievance relates to |
| registration_id | UUID | NOT NULL, FK → exam_registrations.id | Parent registration |
| category | TEXT | NOT NULL | One of: ANSWER_KEY_DISPUTE, QUESTION_PAPER_ERROR, CENTER_MISCONDUCT, PEER_CHEATING, CBT_TECHNICAL_ISSUE, MISPRINTED_PAPER, UNFAIR_EVALUATION, OTHER |
| description | TEXT | NOT NULL | Student's detailed description |
| evidence_paths | TEXT[] | NULLABLE | Student-uploaded evidence (photos, screenshots) |
| priority | TEXT | NOT NULL, default 'HIGH' | All authenticated student grievances default to HIGH |
| status | TEXT | NOT NULL, default 'OPEN' | One of: OPEN, UNDER_REVIEW, RESOLVED, REJECTED |
| auto_cctv_attached | BOOLEAN | NOT NULL, default false | Whether CCTV was auto-attached based on room_allocation |
| assigned_to | UUID | NULLABLE, FK → agency_staff.id | Chief Exam Manager handling this grievance |
| resolution_notes | TEXT | NULLABLE | Resolution details |
| submitted_at | TIMESTAMPTZ | NOT NULL, default now() | Submission timestamp |
| resolved_at | TIMESTAMPTZ | NULLABLE | Resolution timestamp |

---

## 31. grievance_cctv_attachments

Auto-pulled CCTV segments attached to student grievances.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique attachment identifier |
| grievance_id | UUID | NOT NULL, FK → student_grievances.id | Parent grievance |
| room_id | UUID | NOT NULL, FK → exam_rooms.id | Room the CCTV is from |
| camera_id | TEXT | NOT NULL | Camera that captured the footage |
| footage_start | TIMESTAMPTZ | NOT NULL | Start of the pulled footage segment |
| footage_end | TIMESTAMPTZ | NOT NULL | End of the pulled footage segment |
| footage_path | TEXT | NOT NULL | Storage path for the clipped footage |
| pulled_at | TIMESTAMPTZ | NOT NULL, default now() | When the system pulled and attached this footage |

---

## 32. audit_logs

Immutable append-only log for all security-critical events across the platform.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique log entry identifier |
| agency_id | UUID | NULLABLE, FK → agencies.id | Agency context, if applicable |
| exam_id | UUID | NULLABLE, FK → exams.id | Exam context, if applicable |
| actor_id | UUID | NULLABLE | ID of the user who triggered the event (student, staff, or system) |
| actor_role | TEXT | NULLABLE | Role of the actor at the time of the event |
| event_type | TEXT | NOT NULL | Categorized event type (e.g., PAPER_DECRYPTED, TRUNK_UNLOCKED, BIOMETRIC_FAILED, RESULT_PUBLISHED) |
| event_description | TEXT | NOT NULL | Human-readable description of the event |
| metadata | JSONB | NULLABLE | Additional structured context (IDs, scores, before/after values) |
| ip_address | TEXT | NULLABLE | IP address of the actor |
| occurred_at | TIMESTAMPTZ | NOT NULL, default now() | When the event occurred |

> **Note:** This table is append-only. No UPDATE or DELETE statements are ever issued against it. RLS policy: INSERT only for authenticated users; SELECT only for agency heads and platform admins scoped to their own records.

---

## Key Relationships Summary

```
agencies
  └── agency_staff (many per agency)
  └── exams (many per agency)
        └── exam_centers (many per exam)
              └── exam_rooms (many per center)
        └── question_papers (one active per exam)
        └── exam_registrations (many per exam, one per student-exam pair)
              └── center_allocations (one per registration)
              └── admit_cards (one per registration)
              └── checkin_events (one per registration)
                    └── room_allocations (one per checkin)
              └── answer_sheet_uploads (one per registration)
                    └── answer_sheet_visibility_scores (many per upload)
                    └── evaluation_marks (one per upload per tier)
              └── exam_results (one per registration, published post-evaluation)
              └── student_grievances (many per registration)
                    └── grievance_cctv_attachments (auto-attached)

students
  └── exam_registrations (many per student)

transit_trunks
  └── transit_events (continuous GPS telemetry)
  └── transit_geofence_violations (when route deviates)

leak_reports
  └── (references print_watermark_registry, paper_vault_access_logs, transit_events for investigation)

whistleblower_reports (standalone, no auth linkage)
audit_logs (platform-wide, append-only)
```
