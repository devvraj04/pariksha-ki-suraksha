# ParikshaSetu — Testing Guide: Phases 6, 7, 8, 9, 10

> **Prerequisites before starting**
> - Backend running: `uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000`
> - Frontend running: `npm run dev` (in `apps/web/`)
> - You have a valid **Agency Head JWT** (log in at `http://national-testing-agency.localhost:3000/agency/login`)
> - You have an exam in at least **REGISTRATION_CLOSED** status with ≥ 1 center and rooms
> - Supabase Storage buckets created: `question-papers-vault` and `answer-sheet-uploads`
> - Export your token once for curl tests:
>   ```powershell
>   $TOKEN = "paste_your_jwt_here"
>   $EXAM = "paste_your_exam_uuid_here"
>   $BASE = "http://localhost:8000/api/v1"
>   ```

---

## Phase 6 — Secure Question Paper Vault

### 6.1 — UI Test: Start Upload Session

1. Go to `http://national-testing-agency.localhost:3000/agency/exams/[examId]`
2. Click the **🔒 Question Vault** tab
3. Click **"🔐 Start Monitored Upload Session"**
4. **Expected:**
   - Button changes to `● Session Active` (green, animated)
   - "End Session" button appears
   - Upload form panel appears below with webcam monitoring notice

### 6.2 — UI Test: Upload & Vault a Paper

1. While session is active, click **"Select PDF File"** and choose any PDF
2. Click **"Upload & Vault"**
3. **Expected:**
   - Button shows spinning `Encrypting…` loader
   - Alert: `"Paper encrypted and vaulted successfully!"`
   - Paper appears in "Vaulted Papers" list below with status `VAULTED`
   - Vault Access Log shows `UPLOAD` entry with your name

### 6.3 — API Test: Session Start

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/papers/upload-session/start" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  | Select-Object -ExpandProperty Content
```

**Expected response:**
```json
{
  "session_token": "abc123...",
  "expires_in_seconds": 900,
  "message": "Upload session active. Webcam monitoring is now enabled."
}
```

### 6.4 — API Test: Upload Paper

```powershell
$SESSION = "paste_session_token_here"
$PDF_PATH = "C:\path\to\any-file.pdf"

$form = @{
  file = Get-Item $PDF_PATH
}
Invoke-RestMethod -Uri "$BASE/exams/$EXAM/papers" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "X-Session-Token" = "$SESSION" } `
  -Form $form
```

**Expected:**
```json
{
  "status": "VAULTED",
  "paper_id": "...",
  "paper_version": 1,
  "encryption_algorithm": "AES-256-GCM",
  "message": "Paper encrypted and vaulted. Key shares distributed."
}
```

### 6.5 — API Test: Get Paper Status (never returns ciphertext)

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/papers" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Array of `{id, status, paper_version, uploaded_at}` — **no** key material, **no** storage paths.

### 6.6 — API Test: Vault Access Log

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/papers/vault-access-log" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Log entries with `access_type = "UPLOAD"` and staff name.

### 6.7 — Celery Task Test

```powershell
venv\Scripts\python -c "
from apps.api.workers.tasks_vault import schedule_paper_decryption, decrypt_paper_for_print, decrypt_paper_for_cbt
r = schedule_paper_decryption.delay('fake-paper-id', 'fake-exam-id')
print('schedule_paper_decryption:', r.result)
"
```

**Expected log output:**
```
[Celery] Redis is not reachable. Falling back to Eager Mode
[Celery] Scheduling decryption tasks for paper fake-paper-id...
```

### 6.8 — Security Check: Session Expiry

1. Start a session
2. Paste a **wrong** session token in the upload header
3. **Expected:** HTTP 401 — "Upload session token is invalid or expired."

### 6.9 — Supabase Check

In Supabase → Storage → `question-papers-vault`:
- You should see file: `[examId]/paper_v1.enc`
- File extension `.enc` — binary ciphertext, not readable

---

## Phase 7 — Intelligent Printing Module

> **Note:** Printing tab is only enabled for `OFFLINE` mode exams.

### 7.1 — UI Test: View Print Jobs

1. Go to exam workspace → **🖨 Print Module** tab
2. Click **Refresh**
3. **Expected:** Table loads (empty if first time), no errors

### 7.2 — UI Test: Create Print Job

1. Select a center from the dropdown
2. Set Copies: `50`
3. Set Printer ID: `PRINTER-001`
4. Click **"Create Print Job"**
5. **Expected:** Alert — `"Print job created. Status: SCHEDULED"` or `"COMPLETED"` (in eager mode, runs immediately)
6. Job appears in table below with status `COMPLETED`

### 7.3 — API Test: Create Print Job

```powershell
$CENTER = "paste_center_uuid_here"
$body = '{"center_id": "' + $CENTER + '", "copies_requested": 25, "printer_id": "MAC-00-AA-BB-CC"}'

Invoke-WebRequest -Uri "$BASE/exams/$EXAM/print-jobs" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "status": "SCHEDULED",
  "job_id": "...",
  "copies_budget": 25,
  "message": "Print job initiated..."
}
```

### 7.4 — API Test: Get Print Jobs

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/print-jobs" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Array with status `COMPLETED` (Celery eager mode runs synchronously).

### 7.5 — API Test: Get Single Print Job

```powershell
$JOB = "paste_job_uuid_here"
Invoke-WebRequest -Uri "$BASE/print-jobs/$JOB" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Job detail including `surveillance_alerts` array.

### 7.6 — Celery Task Test: Print Job Execution

```powershell
venv\Scripts\python -c "
from apps.api.workers.tasks_printing import execute_print_job, run_print_room_surveillance
r = execute_print_job.delay('fake-job-id')
print('execute_print_job:', r.result)
"
```

**Expected log:**
```
[Celery] Executing print job fake-job-id...
[Celery Error] print_job_not_found  (expected — fake ID)
```

### 7.7 — Celery Task Test: Surveillance

```powershell
venv\Scripts\python -c "
from apps.api.workers.tasks_printing import run_print_room_surveillance
for i in range(20):
    r = run_print_room_surveillance.delay('fake-job-id')
print('Ran 20 surveillance ticks (expect ~2 alerts in DB if real job)')
"
```

### 7.8 — Watermark Verification

After creating a real print job with e.g. 5 copies:
- In Supabase → Table Editor → `print_watermark_registry`
- Expected: `5 copies × 12 pages = 60 rows`
- Each row has a unique `watermark_code` with format: `CENTER|PRINTER|OPERATOR|TIMESTAMP|P001|C0001|HEXSUFFIX`

---

## Phase 8 — Chain-of-Custody Transit

### 8.1 — API Test: Create Trunk

```powershell
$JOB = "paste_completed_print_job_uuid"
$CENTER = "paste_center_uuid"
$body = '{
  "center_id": "' + $CENTER + '",
  "transport_vehicle_id": "DL-01-AA-1234",
  "driver_id": "DRV-001",
  "geofence_corridor_km": 2.0
}'

Invoke-WebRequest -Uri "$BASE/print-jobs/$JOB/trunks" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "trunk_id": "...",
  "trunk_code": "TRK-...",
  "status": "SEALED",
  "integrity_seal": "sha256:..."
}
```

### 8.2 — API Test: Get Trunks

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/trunks" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Array with trunk at status `SEALED`.

### 8.3 — UI Test: Dispatch Trunk

1. Go to **🚚 Chain-of-Custody** tab → click Refresh
2. Find a trunk with status `SEALED`
3. Click **"Dispatch"**
4. Refresh — status changes to `IN_TRANSIT`

### 8.4 — API Test: Dispatch

```powershell
$TRUNK = "paste_trunk_uuid"
Invoke-WebRequest -Uri "$BASE/trunks/$TRUNK/dispatch" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** `{"status": "IN_TRANSIT", ...}`

### 8.5 — UI Test: 3-Factor Unlock Flow

1. Go to `http://national-testing-agency.localhost:3000/agency/center/[examId]/trunk-unlock`
2. Enter the Trunk UUID and click **"Verify GPS & Send OTP"**
3. **Expected (within geofence):**
   - Blue box shows **Dev Mode OTP** (e.g. `471829`)
   - Step indicator advances to "OTP"
4. Enter the 6-digit OTP and click **"Verify OTP"**
5. **Expected:** Advances to "Biometric & Receipt" step
6. Click **"✓ Papers Correct"**
7. **Expected:** Green success screen — "Trunk Secured & Received"

### 8.6 — API Test: Full Unlock Flow

```powershell
# Step 1: Request OTP (GPS check)
$unlockBody = '{"latitude": 28.6139, "longitude": 77.2090}'
$r = Invoke-RestMethod -Uri "$BASE/trunks/$TRUNK/unlock/request" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $unlockBody
$r | ConvertTo-Json

# Dev OTP will be in: $r.dev_otp
$OTP = $r.dev_otp

# Step 2: Confirm with OTP + biometric
$confirmBody = '{"otp": "' + $OTP + '", "biometric_data": "officer_fingerprint_b64"}'
Invoke-WebRequest -Uri "$BASE/trunks/$TRUNK/unlock/confirm" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $confirmBody `
  | Select-Object -ExpandProperty Content
```

**Expected after confirm:** `{"status": "UNLOCKED", ...}`

### 8.7 — Geofence Rejection Test

```powershell
# Use a location far from any center (e.g. London)
$body = '{"latitude": 51.5074, "longitude": -0.1278}'
Invoke-WebRequest -Uri "$BASE/trunks/$TRUNK/unlock/request" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:** `{"otp_sent": false, "error": "OUTSIDE_GEOFENCE", "distance_meters": ...}`

### 8.8 — Receipt Confirmation

```powershell
Invoke-WebRequest -Uri "$BASE/trunks/$TRUNK/receipt-confirm" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body '{"papers_correct": true}' `
  | Select-Object -ExpandProperty Content
```

**Expected:** `{"status": "DELIVERED", ...}`

---

## Phase 9 — Day-of-Exam Operations

> **Setup:** You need a student with a valid admit card JWT. Get one from the `/exams/[id]/allocations` page or Supabase `admit_cards` table.

### 9.1 — UI Test: Check-In Kiosk

1. Go to `http://national-testing-agency.localhost:3000/agency/center/[examId]/checkin`
2. **Expected:** Kiosk UI with progress bar, QR scan textarea
3. Paste a valid admit card JWT (from `admit_cards.qr_payload_jwt` in Supabase)
4. Click **"Verify QR Code"**
5. **Expected:** Advances to "QR Verified" with student name + email
6. Select **"MATCHED"** for biometric
7. Click **"Confirm Check-In"**
8. **Expected:** Green screen with **Room** and **Seat** number assigned

### 9.2 — API Test: QR Verify

```powershell
$JWT_PAYLOAD = "paste_admit_card_jwt_here"
$body = '{"qr_payload_jwt": "' + $JWT_PAYLOAD + '"}'

Invoke-WebRequest -Uri "$BASE/exams/$EXAM/checkin" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "student_id": "...",
  "full_name": "...",
  "email": "...",
  "allocated_center_id": "...",
  "roll_number": "..."
}
```

### 9.3 — API Test: Confirm Check-In

```powershell
$STUDENT = "paste_student_uuid"
$body = '{
  "student_id": "' + $STUDENT + '",
  "biometric_match_result": "MATCHED",
  "biometric_match_score": 0.94,
  "failed_attempts": 0
}'

Invoke-WebRequest -Uri "$BASE/exams/$EXAM/checkin/confirm" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "checkin_id": "...",
  "room_code": "ROOM-A",
  "seat_number": 1,
  "is_flagged": false
}
```

### 9.4 — API Test: Check-In Progress

```powershell
$CENTER = "paste_center_uuid"
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/centers/$CENTER/checkin-progress" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "total_registered": 100,
  "checked_in": 1,
  "absent_so_far": 99,
  "percent": 1
}
```

### 9.5 — UI Test: Live Rooms Dashboard

1. Go to `http://national-testing-agency.localhost:3000/agency/center/[examId]/rooms`
2. **Expected:** Grid of room cards with occupancy bars
3. After checking in a student, refresh (or wait 10 seconds for auto-refresh)
4. **Expected:** Room card shows updated occupancy (e.g. `1/30 seated`)
5. When room reaches 80%+, card border turns amber; at 100%, red

### 9.6 — API Test: Live Rooms

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/centers/$CENTER/rooms/live" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Array of rooms with `current_occupancy`, `available_seats`, `occupancy_percent`.

### 9.7 — Flagged Student Test (Biometric Failure)

```powershell
$body = '{
  "student_id": "' + $STUDENT + '",
  "biometric_match_result": "FAILED",
  "biometric_match_score": null,
  "failed_attempts": 2
}'

Invoke-WebRequest -Uri "$BASE/exams/$EXAM/checkin/confirm" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:** `"is_flagged": true` + `"flag_reason": "BIOMETRIC_MISMATCH"`

### 9.8 — CBT Session Test (Online Exams)

```powershell
$body = '{
  "student_id": "' + $STUDENT + '",
  "ip_address": "192.168.1.10",
  "user_agent": "Mozilla/5.0 Test"
}'

Invoke-WebRequest -Uri "$BASE/exams/$EXAM/cbt/sessions" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:** `{"session_id": "...", "status": "ACTIVE", ...}`

```powershell
$SESSION_ID = "paste_cbt_session_id"
# Record tab switch
Invoke-WebRequest -Uri "$BASE/cbt/sessions/$SESSION_ID/tab-switch" `
  -Method PATCH `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
# Expected: {"tab_switch_count": 1, "is_terminated": false}

# Check auto-terminate at tab_switch_count >= 3
Invoke-WebRequest -Uri "$BASE/cbt/sessions/$SESSION_ID/tab-switch" -Method PATCH -Headers @{ "Authorization" = "Bearer $TOKEN" } | Out-Null
Invoke-WebRequest -Uri "$BASE/cbt/sessions/$SESSION_ID/tab-switch" -Method PATCH -Headers @{ "Authorization" = "Bearer $TOKEN" } | Select-Object -ExpandProperty Content
# Expected: {"tab_switch_count": 3, "is_terminated": true}
```

### 9.9 — Command Center Test

1. Go to `http://national-testing-agency.localhost:3000/agency/command-center`
2. **Expected:**
   - 3 stat cards: Total / Unreviewed / Escalated
   - Empty alert feed (or alerts if dayof surveillance ingest was run)
3. Alert auto-refresh every 8 seconds (green LIVE indicator)
4. Filter pills appear when alerts exist

---

## Phase 10 — Answer Sheet Upload & AI Scoring

### 10.1 — UI Test: Upload Answer Sheet (Exam Workspace)

1. Go to exam workspace → **📋 Answer Sheets** tab
2. Click **Refresh** to load existing sheets
3. Enter a **Student UUID** (from Supabase `students` table)
4. Select a center
5. Click **"Select PDF"** → choose any PDF
6. Click **"Upload & Score"**
7. **Expected:**
   - Status shows `SCORING` briefly (Celery eager mode is synchronous)
   - Refreshes to `APPROVED` (if all page scores ≥ 8.0) or `RESCAN_REQUIRED`

### 10.2 — UI Test: Center Officer Interface

1. Go to `http://national-testing-agency.localhost:3000/agency/center/[examId]/answer-sheets`
2. Select a center tab
3. **Expected:** 5-stat summary bar + sheet table
4. Upload a new sheet using the form
5. If status = `RESCAN_REQUIRED`: click **"Rescan"** on the row → select a new PDF
6. If status = `APPROVED`: click **"Seal"** on the row → status changes to `SEALED` (purple)

### 10.3 — API Test: Upload Answer Sheet

```powershell
$PDF_PATH = "C:\path\to\test-answer-sheet.pdf"
$STUDENT = "paste_student_uuid"

$form = @{
  file       = Get-Item $PDF_PATH
  student_id = $STUDENT
  center_id  = $CENTER
}

Invoke-RestMethod -Uri "$BASE/exams/$EXAM/answer-sheets/upload" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  -Form $form
```

**Expected:**
```json
{
  "upload_id": "...",
  "upload_status": "SCORING",
  "total_pages": 1,
  "message": "Answer sheet uploaded. AI scoring initiated."
}
```

### 10.4 — API Test: Get Answer Sheets

```powershell
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/answer-sheets" `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected:** Array of sheets with `upload_status` ∈ `[UPLOADED, SCORING, APPROVED, RESCAN_REQUIRED, SEALED]`

### 10.5 — Celery Task Test: AI Scoring

```powershell
venv\Scripts\python -c "
from apps.api.workers.tasks_evaluation import score_answer_sheet
# Use a real upload ID from Supabase
r = score_answer_sheet.delay('paste_upload_id_here')
print(r.result)
"
```

**Expected result:**
```json
{
  "status": "success",
  "upload_status": "APPROVED",
  "total_pages": 1,
  "failing_pages": []
}
```
or for RESCAN:
```json
{
  "status": "success",
  "upload_status": "RESCAN_REQUIRED",
  "failing_pages": [{"page": 1, "score": 6.4, "issues": {"blur": true}}]
}
```

### 10.6 — API Test: Seal Answer Sheet

```powershell
$UPLOAD = "paste_upload_uuid"
Invoke-WebRequest -Uri "$BASE/answer-sheets/$UPLOAD/seal" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  | Select-Object -ExpandProperty Content
```

**Expected (status must be APPROVED first):**
```json
{
  "upload_id": "...",
  "status": "SEALED",
  "sealed_at": "...",
  "seal_hash": "sha256:..."
}
```

**Expected if already RESCAN_REQUIRED or SEALED:**
HTTP 400 — "Cannot seal: sheet is not in APPROVED status."

### 10.7 — API Test: Seal All

```powershell
$body = '{"center_id": "' + $CENTER + '"}'
Invoke-WebRequest -Uri "$BASE/exams/$EXAM/answer-sheets/seal-all" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body `
  | Select-Object -ExpandProperty Content
```

**Expected:**
```json
{
  "sealed_count": 3,
  "skipped": 0,
  "message": "3 answer sheets sealed successfully."
}
```

### 10.8 — API Test: Rescan Upload

```powershell
$form = @{ file = Get-Item "C:\path\to\rescanned.pdf" }
Invoke-RestMethod -Uri "$BASE/answer-sheets/$UPLOAD/rescan" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $TOKEN" } `
  -Form $form
```

**Expected:** `{"upload_status": "SCORING", "rescan_version": 2, ...}`

### 10.9 — Exam Evaluation Transition Task

```powershell
venv\Scripts\python -c "
from apps.api.workers.tasks_evaluation import transition_exam_to_evaluation
r = transition_exam_to_evaluation.delay('paste_exam_id_here')
print(r.result)
"
```

**Expected (if all sheets sealed):**
```json
{"status": "success", "exam_id": "...", "sealed_sheets": 10}
```
Check Supabase → `exams.status` = `EVALUATION_IN_PROGRESS`

**Expected (if some sheets still open):**
```json
{"status": "pending", "unsealed_count": 3, "total_count": 10}
```

---

## Full End-to-End Exam Lifecycle Test

Run these in order for a complete Phase 6–10 walkthrough:

```
1. [Phase 6]  Start vault session → Upload encrypted paper → End session
2. [Phase 7]  Create print job → Confirm COMPLETED + watermarks in DB
3. [Phase 8]  Create trunk → Dispatch → Request unlock (GPS) → Enter OTP → Confirm receipt
4. [Phase 9]  Check in student (QR + biometric) → View room occupancy update
5. [Phase 10] Upload answer sheet → Score (APPROVED) → Seal → Seal All → Transition to EVALUATION_IN_PROGRESS
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Upload session token is invalid` | Session expired or wrong token | Start a new session (15-min TTL) |
| `StorageApiError` on vault upload | Bucket doesn't exist | Create `question-papers-vault` bucket in Supabase |
| `Trunk status is not IN_TRANSIT` | Trying to unlock SEALED trunk | Dispatch the trunk first |
| `Outside geofence` on unlock | Coordinates too far from center | Use center's actual lat/lon or add dev bypass |
| `Cannot seal: sheet is not in APPROVED status` | Sheet is RESCAN_REQUIRED | Upload rescan first, get APPROVED, then seal |
| `No papers vaulted yet` | Upload session not started | Start monitored session before uploading |
| `MQTT broker not reachable` | No MQTT broker running | Expected in dev — falls back gracefully |
| `answer-sheet-uploads bucket` 404 | Supabase bucket missing | Create `answer-sheet-uploads` private bucket |
| `cryptography` import error | Package not installed | Run `venv\Scripts\pip install cryptography==42.0.8` |

---

## Supabase Tables to Verify After Testing

| Phase | Table | What to Check |
|-------|-------|---------------|
| 6 | `question_papers` | `status = VAULTED`, no raw key material |
| 6 | `paper_vault_access_logs` | `access_type = UPLOAD` entry exists |
| 7 | `print_jobs` | `status = COMPLETED` |
| 7 | `print_watermark_registry` | `copies × 12` rows per job |
| 8 | `transit_trunks` | Status transitions: SEALED → IN_TRANSIT → UNLOCKED → DELIVERED |
| 8 | `transit_trunk_events` | Audit trail of all status changes |
| 9 | `exam_day_checkins` | `biometric_match_result`, `is_flagged`, `seat_number` |
| 9 | `exam_room_occupancy` | `current_occupancy` incremented after each checkin |
| 10 | `answer_sheet_uploads` | `upload_status` progression |
| 10 | `answer_sheet_visibility_scores` | Per-page scores (after Celery runs) |
