# LeakGuard AI — Real-World App Flow

This document describes the end-to-end operational flow of the platform as it would actually run in a real examination cycle. Each step maps to real user actions, system triggers, and database state transitions.

---

## FLOW 0: Platform Setup (One-Time)

**Actor:** Platform Admin

1. Platform admin deploys the platform and configures the base domain.
2. Admin panel is accessible at `admin.[platform].com`.
3. Admin sets global configuration: exam visibility score threshold defaults, geofence tolerance, watermark encoding keys, HSM integration.
4. Platform goes live. Landing page at `[platform].com` shows public exam listings.

---

## FLOW 1: Agency Registration & Onboarding

**Actor:** Agency Head (new)

### Step 1.1 — Agency Registration Request

Agency Head visits `[platform].com/agency/register` and fills in:
- Organization name, official email, phone
- PAN / GST / Registration number
- Registered address

System creates:
- `agencies` record with `status = PENDING`
- `audit_logs` entry: `AGENCY_REGISTRATION_REQUESTED`

### Step 1.2 — Platform Admin Approval

Admin reviews submitted documents on the admin panel.
- If approved: `agencies.status` → `ACTIVE`; `agencies.slug` is finalized
- System provisions subdomain: `[agency-slug].[platform].com`
- Agency Head receives email with login credentials
- `audit_logs` entry: `AGENCY_APPROVED`

### Step 1.3 — Agency Head Logs In & Sets Up Staff

Agency Head logs into `[agency-slug].[platform].com` with the provided credentials.

Navigates to **Staff Management → Add Staff Member:**
- Inputs: Full name, email, role (Manager / Operator / Transit Manager / Center Officer)
- System creates `agency_staff` record + Supabase Auth user
- Staff receives email invite with a temporary password link
- On first login, staff sets their own password
- `audit_logs` entry: `STAFF_MEMBER_ADDED`

**At this point:** The agency is operational. The Agency Head can see the full agency dashboard. Staff have access scoped to their role.

---

## FLOW 2: Exam Creation

**Actor:** Agency Head or Manager

### Step 2.1 — Exam Form

Navigates to **Exams → Create New Exam** on the agency portal.

Form filled in:
- Exam name, mode (Online/Offline), date, start time, duration
- Registration open/close dates
- Fee (INR), total seats
- Eligibility criteria (age, qualification, categories)
- Syllabus (text or PDF upload)

Centers added:
- For each center: name, address, GPS coordinates, center code
- For each room within each center: room code, seating capacity, camera stream URL (if CCTV is set up)

System creates:
- `exams` record with `status = DRAFT`
- `exam_centers` records
- `exam_rooms` records

### Step 2.2 — AI Brochure Generation

On saving the exam, a background Celery task fires:
- LLM generates a formatted Information Brochure PDF (exam overview, eligibility, dates, fee, centers, syllabus, exam pattern)
- Brochure saved to Supabase Storage
- `exams.brochure_pdf_path` updated

### Step 2.3 — Publishing the Exam

Agency Head clicks **Publish Exam.** `exams.status` → `PUBLISHED`.

Exam now appears on `[platform].com` (public listing) and on the agency's portal.

When the registration window is ready: **Open Registration.** `exams.status` → `REGISTRATION_OPEN`.

---

## FLOW 3: Student Registration & Payment

**Actor:** Student

### Step 3.1 — Student Account Creation

Student visits `[platform].com/student` and registers:
- Full name, email, phone, DOB, gender, address
- Photo upload (used for biometric hash generation)
- ID proof type and number upload

System creates:
- `students` record
- Supabase Auth user
- Biometric hash generated from photo and stored in `students.biometric_hash`

### Step 3.2 — Browse and Register for an Exam

Student browses exam listings, clicks an exam, reads the brochure.

Clicks **Register.** Fills exam-specific form:
- Personal details (pre-filled from profile)
- Eligibility documents upload (if required)
- Center preferences (ranked 1–3)

System creates `exam_registrations` record with `status = PENDING_PAYMENT`.

### Step 3.3 — Fee Payment

Student proceeds to payment (Razorpay / PayU integration).

On successful payment:
- `exam_registrations.payment_status` → `SUCCESS`
- `exam_registrations.status` → `REGISTERED`
- Unique `application_number` generated (e.g., `LG-2025-00123`)
- Student receives email confirmation with application number
- `audit_logs` entry: `STUDENT_REGISTERED`

**Student dashboard now shows:** Registration confirmed. Admit card: Pending. Allocated center: Pending.

---

## FLOW 4: Center Allocation & Admit Card Generation

**Actor:** Agency Head or Manager (post registration close)

### Step 4.1 — Close Registration

Agency Head clicks **Close Registration.** `exams.status` → `REGISTRATION_CLOSED`.

### Step 4.2 — Run Center Allocation

Agency Head or Manager clicks **Allocate Centers** on the exam dashboard.

Background Celery task runs:
- For each registered student, iterates through center preferences (1 → 2 → 3)
- Allocates the first preferred center with remaining capacity
- If no preference has capacity, assigns the nearest center with available seats
- Creates `center_allocations` record for each student
- Updates `exam_centers.total_capacity` tracking

System notification sent to Agency Head: "Center allocation complete. X students allocated."

### Step 4.3 — Generate Admit Cards

Agency Head clicks **Generate Admit Cards.**

Background task runs for each allocated student:
- Builds JWT payload: `{student_id, exam_id, center_id, biometric_hash, exp}`
- Signs payload with platform's private key
- Generates admit card PDF: name, photo, application number, exam details, allocated center, reporting time, QR code
- PDF saved to Supabase Storage
- `admit_cards` record created

`exams.status` → `ADMIT_CARDS_ISSUED`

Students receive email: "Your admit card is ready. Download it from your portal."

**Student portal now shows:** Admit card downloadable. Allocated center and reporting time visible.

---

## FLOW 5: Question Paper Vault

**Actor:** Question Paper Setter (authorized by Agency Head; could be an external entity)

### Step 5.1 — Secure Upload Session

Paper Setter logs into the agency portal and navigates to **Question Paper Vault.**

On opening the upload interface:
- Webcam activates (with user disclosure)
- Screen recording begins
- Clipboard is blocked
- YOLOv8 camera feed begins monitoring for mobile phones

Paper Setter uploads the exam paper PDF.

System:
- Generates AES-256-GCM encryption key
- Encrypts the paper immediately on upload
- Splits key into two shares: Share 1 → Supabase Vault, Share 2 → HSM
- Stores encrypted paper to Supabase Storage (restricted bucket)
- Creates `question_papers` record with `status = VAULTED`
- `paper_vault_access_logs` entry: `UPLOAD`
- Upload session recording saved

**The paper is now sealed. No human can access the full key.**

---

## FLOW 6: Offline Exam — Printing & Transit

*Skip to Flow 7 for Online (CBT) exams.*

**Actor:** Operator (printing), Transit Manager (dispatch)

### Step 6.1 — Decryption for Printing (System-Triggered)

A scheduled Celery task fires at `exam_date - [configured lead time, e.g., 2 days]`:
- Both key shares fetched and combined in server RAM only
- Paper decrypted and made available to the Print Module
- `question_papers.status` → `DECRYPTED_FOR_PRINT`
- Key zeroed from RAM immediately after
- `paper_vault_access_logs` entry: `DECRYPT_FOR_PRINT`

### Step 6.2 — Print Job Initiation

Operator logs in and navigates to **Printing → New Print Job** for a specific center.

Inputs: Center selection, copies requested.

System validation:
- Is Operator authorized for this exam? → Checked against `agency_staff.role`
- Is it within the approved print time window? → Checked against configured window
- Do copies requested ≤ center budget? → Checked against `exam_rooms` total capacity

If all pass:
- `print_jobs` record created with `status = APPROVED`
- Print middleware sends the paper to the printer
- **Every printed page automatically receives a Dynamic Smart Watermark** (encoding center code, printer ID, operator ID, exact timestamp, page number)
- `print_watermark_registry` record created for every page printed
- `print_jobs.status` → `PRINTING` → `COMPLETED`

If copies exceed budget: `print_jobs.status` → `BLOCKED_OVER_BUDGET`. Alert sent to Manager.

If print time is anomalous: `print_jobs.status` → `BLOCKED_ANOMALOUS_TIME`. Terminal locked. Alert sent to Manager.

### Step 6.3 — Print Room Surveillance (Ongoing during print)

YOLOv8 cameras in the print room run continuously during the print window.

Any detection (phone, pocketing pages, unauthorized person):
- `print_room_surveillance_alerts` record created
- Real-time alert pushed to Agency Command Center dashboard
- Alert email sent to Manager

### Step 6.4 — Sealing & Trunk Assignment

After printing completes, Operator physically seals papers into the IoT Smart Trunk.

Operator confirms seal on the portal:
- `transit_trunks` record created: `status = SEALED`
- Trunk assigned to a Transit Manager

### Step 6.5 — Transit Dispatch

Transit Manager dispatches the vehicle. Logs departure on portal.
- `transit_trunks.dispatched_at` updated
- `transit_trunks.status` → `IN_TRANSIT`
- GPS tracker begins streaming telemetry to platform via MQTT
- Each ping creates a `transit_events` record
- Agency Command Center displays live trunk location on a map

**If trunk deviates from approved route beyond geofence threshold:**
- `transit_trunks.status` → `COMPROMISED`
- `transit_geofence_violations` record created
- Immediate alert to Manager and Agency Head with GPS coordinates of deviation

### Step 6.6 — Handoff at the Center

Trunk arrives at exam center. Center Officer initiates unlock via the center portal.

System validates three factors simultaneously:
1. Center Officer's current GPS coordinates are within `exam_centers.geofence_radius_meters` of the center
2. Center Officer enters OTP sent to their registered mobile
3. Center Officer completes biometric scan (face match)

On all three passing:
- Trunk lock releases
- `transit_trunks.status` → `DELIVERED`
- `transit_trunks.unlocked_at`, `unlocked_by`, `unlock_gps_*` populated
- `audit_logs` entry: `TRUNK_UNLOCKED_AT_CENTER`

Center Officer confirms receipt of correct paper set on the portal. Any mismatch triggers `COMPROMISED` flag and immediate alert.

---

## FLOW 7: Online CBT — Pre-Exam Decryption

**Actor:** System (automated)

A scheduled Celery task fires at `exam_start_time - 5 minutes`:
- Both key shares fetched and combined in server RAM
- Paper decrypted
- Decrypted paper pushed to the exam center's local server (encrypted in transit via TLS 1.3)
- Paper remains encrypted on the local server until a student authenticates and starts their session
- Key zeroed from RAM
- `question_papers.status` → `DECRYPTED_FOR_CBT`

---

## FLOW 8: Day-of-Exam Operations

### Step 8.1 — Student Arrival & Check-In

Student arrives at the center and approaches the check-in terminal.

Center Officer scans the QR code on the student's admit card.

System:
- Validates JWT signature on the QR payload
- Confirms `center_id` in payload matches the current center
- Confirms `exam_id` is correct and exam is `ONGOING`

If QR is valid:
- Live face capture runs, compared against `students.biometric_hash`
- If match score ≥ threshold: check-in proceeds
- `checkin_events` record created with `biometric_match_result = MATCHED`
- `exam_registrations.status` → `CHECKED_IN`

If biometric fails:
- Warning displayed; second attempt offered
- Three failures: `checkin_events.is_flagged = true`, terminal locks, Manager alerted
- Security incident photo saved to `checkin_events.biometric_photo_path`

### Step 8.2 — Randomized Room Allocation (at check-in)

Immediately after successful check-in:
- System queries `exam_rooms` for this center: finds all rooms where `current_occupancy < seating_capacity`
- Randomly selects one room from the available list
- Creates `room_allocations` record binding `{student_id, exam_id}` to `room_id`
- `exam_rooms.current_occupancy` incremented by 1
- Student is handed a slip with room code and seat number

### Step 8.3 — Live Room Capacity Dashboard

Center Officer's portal shows a live room map:
- Each room tile: Room Code / Capacity: X / Occupied: Y / Available: Z
- Powered by Supabase Realtime — updates instantly as each student checks in
- System blocks further allocation to a room at capacity

Agency Command Center also reflects this map in real-time for all centers simultaneously.

### Step 8.4 — Exam Begins (Offline)

At the scheduled start time, Center Officer distributes papers from the unlocked trunk. Exam proceeds normally under invigilator supervision.

### Step 8.5 — Exam Begins (Online CBT)

Student sits at the CBT terminal and enters their credentials.

System:
- Authenticates student
- Confirms `room_allocations` record exists for this student + center
- Generates a short-lived session token
- Creates `cbt_exam_sessions` record with `status = ACTIVE`
- Decrypts the paper for this specific student's session only
- Exam interface loads

During the exam:
- Tab switch count tracked in `cbt_exam_sessions.tab_switch_count`
- Keystroke analytics engine flags machine-like typing → `suspicious_typing_flags` incremented
- Clipboard blocked at the system level

### Step 8.6 — Live Surveillance (Throughout Exam)

YOLOv8 edge nodes in exam halls run continuously:
- Detects: phones, earpieces, mass head-turning, unauthorized persons
- Each detection creates a `surveillance_alerts` record
- Real-time push to Agency Command Center dashboard
- Agency Head / Managers can view any room's live CCTV feed via WebRTC

---

## FLOW 9: Post-Exam — Answer Sheet Upload

**Actor:** Center Officer (Operator)

### Step 9.1 — Scanning & Upload

After the exam concludes, Center Officer locks the hall and initiates scanning.

For each student's answer sheet:
- Sheet is scanned page by page
- Uploaded via the center portal, tagged with `{center_uid, student_uid, exam_id}`
- Upload encrypted in transit (TLS 1.3) and at rest (AES-256-GCM) on arrival
- `answer_sheet_uploads` record created

### Step 9.2 — AI Visibility Scoring (Automatic)

Immediately on each upload, a background AI job runs:
- YOLOv8 + OpenCV processes each page
- Assigns a visibility score per page (0.00–10.00)
- Results stored in `answer_sheet_visibility_scores`

**If overall score ≥ 8 (configurable threshold):**
- `answer_sheet_uploads.upload_status` → `APPROVED`
- Paper queued for evaluation

**If any page scores < 8:**
- `answer_sheet_uploads.upload_status` → `RESCAN_REQUIRED`
- Center Operator receives immediate alert with the specific page number(s) that failed
- Operator must rescan those pages before physically sealing the papers

### Step 9.3 — Physical Sealing Confirmation

Once all digital uploads are approved (≥ 8 score), Center Officer physically seals papers in tamper-evident envelopes and logs the seal confirmation on the portal.
- `answer_sheet_uploads.upload_status` → `SEALED`

---

## FLOW 10: Answer Key Upload & Evaluation Setup

**Actor:** Agency Head or Manager

### Step 10.1 — Answer Key Upload

Agency uploads the official answer key via the portal.
- Answer key is encrypted with AES-256-GCM
- Stored in a restricted vault bucket
- Access logged in `paper_vault_access_logs`

### Step 10.2 — Anonymization

System strips all student-identifying information from the answer sheets as presented to evaluators.
- Papers are referenced only by anonymized batch codes derived from `center_uid + student_uid`
- The student identity mapping is stored separately in an encrypted lookup table accessible only to the Chief Moderator

### Step 10.3 — Evaluator Assignment

Agency navigates to **Evaluation → Assign Evaluators.**

For each Grading Teacher:
- Selects the teacher from agency staff list
- Assigns a specific batch of anonymized papers
- `evaluator_assignments` record created with `status = PENDING`

Teacher receives email: "You have been assigned X papers for evaluation. Login to access them."

---

## FLOW 11: Multi-Tier Evaluation

### Tier 1 — Grading Teacher

Grading Teacher logs into the evaluation portal.

Can only see papers in their assigned batch (enforced by RLS and API scope).

For each paper:
- Views the anonymized scanned answer sheet alongside the answer key
- Inputs marks per question/section
- Adds optional remarks

On completing all papers:
- Clicks **Submit & Lock**
- `evaluator_assignments.status` → `COMPLETED`
- `evaluator_assignments.completed_at` populated
- `evaluation_marks` records created for each paper (tier = 1)
- Teacher's access to all papers in that batch is permanently revoked
- `evaluator_assignments.access_revoked_at` populated
- Formal confirmation notification sent to Manager

### Tier 2 — Moderator

Moderator is assigned:
- All papers where Tier 1 marks were flagged (≥ a configured threshold)
- Random 10–15% sample of the full batch

Moderator evaluates these papers independently.
- `evaluation_marks` records created (tier = 2)

System auto-compares Tier 1 and Tier 2 marks for each paper:
- If difference > threshold: `evaluation_discrepancies` record created, `status = OPEN`
- If difference ≤ threshold: No discrepancy; Tier 2 marks stand

Moderator locks their batch. Access revoked.

### Tier 3 — Chief Moderator

Chief Moderator sees all `evaluation_discrepancies` with `status = OPEN`.

For each discrepancy:
- Can see both Tier 1 and Tier 2 evaluations (still anonymized)
- Issues a final ruling on marks
- `evaluation_marks` record created (tier = 3)
- `evaluation_discrepancies.status` → `RESOLVED`
- `evaluation_discrepancies.final_marks_id` populated

Chief Moderator reviews the aggregate result overview and approves the batch for result publication.

---

## FLOW 12: Result Publication

**Actor:** Agency Head (trigger); System (automation)

### Step 12.1 — Pre-Publication Automated Checks

Before allowing publication, system verifies:
- All `answer_sheet_uploads` have `upload_status = SEALED`
- All `evaluator_assignments` have `status = COMPLETED`
- All `evaluation_discrepancies` have `status = RESOLVED`
- Chief Moderator has formally approved the result batch

If any check fails, result publication button is disabled with a specific error message.

### Step 12.2 — Result Compilation

On all checks passing, Agency Head clicks **Publish Results.**

System:
- Compiles final marks from the highest tier evaluation for each student
- Calculates percentage and rank
- Creates `exam_results` record per student
- Generates a digitally signed result PDF per student
- `exams.status` → `RESULT_DECLARED`

Students receive email: "Your result for [Exam Name] has been declared. View it on your portal."

### Step 12.3 — Student Result Access

Student navigates to **Results** on the student portal.

Multi-factor verification:
1. Enters Application Number (Student UID)
2. Enters OTP sent to their registered mobile number
3. Solves CAPTCHA

On successful verification:
- Result card displayed: subject-wise marks, total, percentage, rank, pass/fail status
- Signed result PDF downloadable

---

## FLOW 13: Leak Investigation

**Actor:** Agency Staff (internal) or Public (via whistleblower portal)

### Step 13.1 — Suspected Leak Reported

A photo of what appears to be a leaked exam paper surfaces (social media, WhatsApp, etc.).

Anyone uploads it to the portal (internal staff: via agency portal; public: via `[platform].com/report`).
- `leak_reports` record created with `investigation_status = RECEIVED`

### Step 13.2 — Agent 7 Processing

Background Celery task:
- Image is analyzed by Agent 7
- Steganographic Tracking Matrix Code extracted from the paper
- Watermark decoded: Center Code, Printer ID, Operator ID, Print Timestamp, Page Number
- Agent cross-references:
  - `paper_vault_access_logs`: who accessed the paper digitally, when
  - `print_room_surveillance_alerts`: CCTV anomalies during the identified print session
  - `transit_events` and `transit_geofence_violations`: transit history for the trunk carrying that center's papers
  - `checkin_events`: day-of personnel logs at that center

Agent 7 generates a **Leak Source Probability Report** in JSONB format:
- Example: `{"Printing Operator [name/ID]": 89, "Transit Officer [name/ID]": 11}`
- Includes: evidence chain, CCTV timestamps, access log references

- `leak_reports.probability_report` updated
- `leak_reports.investigation_status` → `REPORT_GENERATED`

Agency Head and Platform Audit Team receive the report.

---

## FLOW 14: Whistleblower & Anonymous Reporting

**Actor:** Any member of the public

### Step 14.1 — Anonymous Submission

Anyone visits `[platform].com/report`. No login required.

Fills in:
- Category (Paper Leak, Bribery, Impersonation, Misconduct, Other)
- Description
- Photo/video upload (optional)
- Exam ID (optional; if known)
- Location text (optional)

On submit:
- `whistleblower_reports` record created — no identity stored
- AI agent assigns a Risk Score (0–100) based on specificity, evidence quality, category severity
- `whistleblower_reports.ai_risk_score` populated
- If Risk Score ≥ 70: `routing_status` → `ROUTED_TO_AUDIT` — immediate escalation to platform audit team
- Below 70: `routing_status` → `AI_SCORED` — enters the normal review queue

Reporter sees a confirmation with a report tracking code (no login needed to check status).

---

## FLOW 15: Student Grievance Filing

**Actor:** Student (authenticated)

### Step 15.1 — Filing the Grievance

Student logs into the student portal, navigates to **My Exams → [Exam Name] → File Grievance.**

Selects category:
- Answer Key Dispute
- Question Paper Error
- Center Misconduct
- Peer Cheating
- CBT Technical Issue
- Misprinted Paper
- Unfair Evaluation
- Other

Fills description and uploads optional evidence.

### Step 15.2 — Auto-CCTV Attachment

Because the grievance is filed by an authenticated student whose `student_id` is bound to a specific `room_id` via `room_allocations`, the system automatically:
1. Looks up `room_allocations` for `{student_id, exam_id}` → finds `room_id`
2. Looks up `exam_rooms.camera_stream_url` for that room
3. Determines the relevant time window (exam start to exam end)
4. Clips and saves the CCTV footage segment for that room during that window
5. Creates `grievance_cctv_attachments` record
6. `student_grievances.auto_cctv_attached` → `true`

### Step 15.3 — Escalation & Resolution

`student_grievances` record created with `priority = HIGH`.

Assigned to Chief Exam Manager (Manager with appropriate role).

Chief Exam Manager receives immediate notification: "High priority grievance filed — [Category] — [Student Application Number] — CCTV auto-attached."

Manager reviews:
- Reads description
- Reviews auto-attached CCTV footage
- Reviews any student-uploaded evidence
- Takes action based on findings

Closes grievance with resolution notes.
- `student_grievances.status` → `RESOLVED` or `REJECTED`
- Student receives email notification with resolution summary

---

## State Machine Summary

### Exam Status Flow
```
DRAFT → PUBLISHED → REGISTRATION_OPEN → REGISTRATION_CLOSED
→ ADMIT_CARDS_ISSUED → ONGOING → PAPER_UPLOAD_PENDING
→ EVALUATION_IN_PROGRESS → RESULT_DECLARED
```

### Student Registration Status Flow
```
PENDING_PAYMENT → REGISTERED → CHECKED_IN → APPEARED / ABSENT
```

### Answer Sheet Upload Status Flow
```
UPLOADED → SCORING → APPROVED / RESCAN_REQUIRED → (re-upload) → APPROVED → SEALED
```

### Transit Trunk Status Flow
```
SEALED → IN_TRANSIT → DELIVERED / COMPROMISED → UNLOCKED
```

### Evaluator Assignment Status Flow
```
PENDING → IN_PROGRESS → COMPLETED → LOCKED (access revoked)
```

### Grievance Status Flow
```
OPEN → UNDER_REVIEW → RESOLVED / REJECTED
```

---

## Critical Security Checkpoints (At a Glance)

| Checkpoint | Mechanism | What It Prevents |
|---|---|---|
| Paper Upload | Session monitoring (webcam, screen record, phone detection) | Unauthorized digital capture of the paper at source |
| Vault Access | Split-key AES-256; key only in RAM at exam window | Any single point of compromise getting full paper access |
| Print Authorization | Copy count validation, time window enforcement | Over-printing or off-hours printing for leak distribution |
| Every Printed Page | Steganographic watermark (center + printer + operator + time) | Untraceable leaks; any leaked page reveals its origin |
| Print Room | YOLOv8 continuous surveillance | Physical theft or photography during print run |
| Transit | GPS geofencing + multi-factor trunk unlock | Route deviation, substitution, or unauthorized opening |
| Student Check-in | Cryptographic QR + live face match | Impersonation / proxy candidates |
| Room Seating | Randomized at check-in (not pre-announced) | Pre-planned seating manipulation for cheating rings |
| Exam Hall | YOLOv8 edge surveillance + live agency streaming | In-hall cheating, phone use, unauthorized aids |
| Online CBT | Just-in-time decryption per student session | Mass paper exposure or pre-exam extraction |
| Answer Sheets | Visibility scoring before acceptance | Deliberately obscured sheets to game evaluation |
| Evaluation | Anonymized papers + 3-tier checking + access lock-in | Biased evaluation, mark manipulation |
| Results | Multi-factor student verification (UID + OTP + CAPTCHA) | Unauthorized result access |
| Post-Exam Leaks | Agent 7 watermark reverse-engineering | Unpunished leaks; accountability gap |
| Grievances | Auto-CCTV attachment based on room binding | Time-consuming manual investigation |
