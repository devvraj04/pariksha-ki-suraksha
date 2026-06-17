# LeakGuard AI — System Design Document

---

## 1. Overview

LeakGuard AI is a multi-tenant, end-to-end examination security and management platform built for India's high-stakes examination ecosystem. It covers the full lifecycle: agency onboarding → exam creation → student registration → secure paper transit → live proctoring → answer sheet evaluation → result publication → leak investigation.

The platform operates under a **subdomain-per-agency** model. When an agency registers, the system provisions a dedicated portal at `[agency-slug].[platform-name].com`. The platform name is TBD and will be filled in at launch.

---

## 2. Stakeholder Map

| Stakeholder | Portal Access | Primary Responsibility |
|---|---|---|
| Agency Head | Agency Portal (Admin) | Full control: exam creation, staff management, result publication |
| Manager | Agency Portal | Exam operations, center allocation, grievance review |
| Operator | Agency Portal | Paper printing, upload, center-level task execution |
| Transit Manager | Agency Portal | Paper dispatch tracking, trunk handoff confirmation |
| Center Officer | Center Day-of Portal | Student check-in, biometric verification, seating, paper receipt |
| Grading Teacher | Evaluation Portal | Answer sheet evaluation for assigned batch |
| Moderator | Evaluation Portal | Cross-checking flagged/high-score papers |
| Chief Moderator | Evaluation Portal | Final authority on grading discrepancies |
| Student/Candidate | Student Portal | Registration, admit card download, exam, result, grievance |
| Anonymous Public | Public Whistleblower Portal | Anonymous leak and misconduct reporting |

---

## 3. Technology Stack

### 3.1 Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Form Handling:** React Hook Form + Zod
- **Real-time UI:** Supabase Realtime + Socket.io (for live CCTV dashboard and room occupancy)

### 3.2 Backend
- **API Layer:** FastAPI (Python)
- **Authentication:** Supabase Auth (JWT-based, role-scoped tokens)
- **Database:** Supabase PostgreSQL
- **File Storage:** Supabase Storage (encrypted buckets)
- **Task Queue:** Celery + Redis (for async AI agent jobs)
- **Caching:** Redis

### 3.3 AI / Security Engine
- **Orchestration:** LangGraph / CrewAI (multi-agent coordination)
- **Computer Vision:** YOLOv8 (phone detection, anomaly detection, answer sheet scan scoring)
- **OCR/Scan Processing:** OpenCV + Tesseract
- **Watermark Engine:** Custom steganography module (low-visibility tracking matrix codes embedded into PDFs at print time)
- **Leak Attribution:** Agent 7 — reverse-watermark extractor + log cross-reference engine

### 3.4 Encryption & Security
- **At-rest encryption:** AES-256-GCM for all exam papers and answer keys
- **Split-key architecture:** Full decryption key assembled only in server RAM at the scheduled exam micro-window; never stored whole on disk
- **JWT:** Role-scoped, short-lived tokens with refresh rotation
- **QR Code Security:** Cryptographic hash of student biometric profile embedded in admit card QR
- **Transit Locks:** TOTP-based OTP + biometric + GPS coordinate validation for IoT trunk unlocking

### 3.5 Infrastructure
- **Hosting:** Cloud (AWS / GCP) with multi-region support
- **CDN:** Cloudfront / Cloudflare for static assets
- **IoT Integration:** MQTT broker for GPS trunk telemetry
- **CCTV Streaming:** WebRTC-based secure stream relay to Agency Command Center
- **Edge AI:** YOLOv8 lite models deployed at exam center edge nodes (works offline, syncs on reconnect)

---

## 4. Portal Architecture

### 4.1 Multi-Tenant Routing

```
[platform].com                    → Public landing, exam discovery, anonymous reporting
[platform].com/student            → Student portal (login, registration, results)
[agency-slug].[platform].com      → Agency-specific portal (admin + operations)
[agency-slug].[platform].com/center  → Center Officer day-of portal
[agency-slug].[platform].com/eval    → Evaluator portal (teachers, moderators)
```

Each agency subdomain resolves to the same Next.js app; the subdomain is parsed server-side to scope all data fetches to that `agency_id`.

### 4.2 Role-Based Access Control (RBAC)

Every JWT issued by Supabase Auth carries:
- `agency_id`
- `role` (one of: `agency_head`, `manager`, `operator`, `transit_manager`, `center_officer`, `grading_teacher`, `moderator`, `chief_moderator`, `student`)
- `exam_scope` (optional: specific exam IDs the token grants access to)
- `paper_batch_ids` (for evaluators: the specific anonymized batch assigned to them)

Middleware on both the Next.js frontend and FastAPI backend validates these claims on every request.

---

## 5. Module-by-Module System Design

### 5.1 Agency Onboarding Module

**Trigger:** Agency Head visits `[platform].com/agency/register`

**Process:**
1. Agency Head submits: Organization name, official email, PAN/GST/Registration number, address, contact details
2. Platform admin reviews and approves (manual or AI-assisted document verification)
3. On approval:
   - Agency record created in DB with a unique `agency_slug`
   - Subdomain provisioned: `[agency-slug].[platform].com`
   - Agency Head account created with `role = agency_head`
   - Welcome email dispatched with login credentials and onboarding guide

**Staff Addition:**
- Agency Head navigates to Staff Management
- Inputs name, email, role (Manager / Operator / Transit Manager / Center Officer)
- System creates user account with scoped role JWT
- Staff receives email invite with temporary password

---

### 5.2 Exam Creation Module

**Trigger:** Agency Head or Manager initiates "Create New Exam"

**Form Inputs:**
- Exam name
- Exam date and time (start + duration)
- Mode: Online (CBT) or Offline (paper-based)
- Cost (INR)
- Eligibility criteria (age, qualification, category filters)
- List of exam centers (each center requires: Center name, address, GPS coordinates, total rooms, room IDs, seating capacity per room)
- Maximum total seats
- Syllabus and guidelines (uploaded PDF or text input)

**GenAI Automation (on form submission):**
- LLM generates a formatted **Information Brochure** (PDF) containing: exam overview, eligibility, important dates, center list, syllabus, exam pattern, fee structure, contact
- Brochure is stored in Supabase Storage and linked to the exam record
- Exam is listed publicly on `[platform].com` and on the agency's portal

**Exam States (lifecycle):**
`DRAFT` → `PUBLISHED` → `REGISTRATION_OPEN` → `REGISTRATION_CLOSED` → `ADMIT_CARDS_ISSUED` → `ONGOING` → `PAPER_UPLOAD_PENDING` → `EVALUATION_IN_PROGRESS` → `RESULT_DECLARED`

---

### 5.3 Student Registration Module

**Trigger:** Student visits `[platform].com/student`, creates account, browses exams

**Registration Flow:**
1. Student fills exam-specific registration form (personal details, eligibility documents, center preferences ranked 1–N)
2. Student pays exam fee (payment gateway integration: Razorpay / PayU)
3. On successful payment: `ExamRegistration` record created with status `REGISTERED`
4. Student receives registration confirmation with a unique Application Number

**Center Allocation (Agency-triggered):**
- Agency clicks "Allocate Centers" button post registration close
- AI randomly assigns each student an exam center from their preference list (priority-weighted)
- If top-preference center is full, system falls to next preference
- Allocation result stored; students can view their allocated center on portal

**Admit Card Generation:**
- Agency triggers "Generate Admit Cards"
- System generates per-student PDF admit card containing: Name, Application Number, Photo, Exam details, Allocated Center, Reporting Time
- The QR code on the admit card is a JWT-signed payload containing: `{student_id, exam_id, center_id, biometric_hash}` — signed with the platform's private key
- Students download admit cards from their portal login

---

### 5.4 Secure Question Paper Vault (Agent 1)

**Paper Upload:**
- Authorized Question Paper Setter uploads the paper via a secure, session-monitored interface
- During the upload session: webcam activated, screen recording initiated, clipboard blocked
- Computer vision agent (YOLOv8) actively monitors for mobile phones pointed at the screen
- Paper is encrypted with AES-256-GCM immediately on upload; key split into two shares: one stored in the vault DB, one stored in a Hardware Security Module (HSM) or Supabase Vault

**At Exam Time:**
- A scheduled Celery task fires at `exam_start_time - 5 minutes`
- Both key shares are fetched and combined in server RAM only
- Paper is decrypted and made accessible (online: served to exam nodes; offline: released to printing module)
- Key is zeroed from RAM after the access window closes

---

### 5.5 Intelligent Printing Module (Agents 2, 3, 4) — Offline Mode Only

**Print Interceptor:**
- Operators initiate printing through the portal's print interface (no direct file access)
- System validates: Is Operator authorized for this exam? Is copy count within the center's allocated budget?
- If copy count exceeds budget (e.g., 550 requested vs 500 allocated): print job killed, alert sent to Manager
- Anomalous print time (outside defined window, e.g., 2 AM): terminal locked, Manager alerted

**Dynamic Smart Watermarking:**
- Every page printed gets a low-visibility steganographic **Tracking Matrix Code** overlaid
- Code encodes: `[Center Code] | [Printer ID] | [Operator ID] | [Timestamp] | [Page Number]`
- If any page from this print run leaks, the watermark is machine-readable and can trace the exact source

**Print Room Surveillance:**
- YOLOv8 cameras in the print room run continuously during the print window
- Detects: unauthorized mobile phones, people reaching into paper stacks, extra pages being pocketed
- Alerts sent in real-time to the Agency Command Center dashboard

---

### 5.6 Chain-of-Custody Transit Module (Agents 5 & 6) — Offline Mode Only

**Smart Trunk Setup:**
- Printed papers are sealed in IoT-enabled trunks
- Each trunk has: GPS tracker, mechanical digital lock (OTP + biometric), tamper-evident seal sensor
- Trunk is assigned a unique `TrunkID` and associated with a specific center and operator

**Geofenced Transit Tracking:**
- Trunk's GPS telemetry is streamed to the portal via MQTT
- The portal displays live location of all active trunks on the Agency Command Center map
- Any deviation from the pre-approved route beyond a geofence threshold: trunk batch flagged as `POTENTIALLY_COMPROMISED`, Manager and Agency Head alerted immediately

**Multi-Factor Handoff at Destination:**
- To unlock the trunk at the exam center, the Center Officer must:
  1. Be physically within GPS coordinates of the registered exam center (±50m)
  2. Enter an OTP sent to their registered mobile at the time of unlock request
  3. Complete a biometric scan (fingerprint / face)
- On successful unlock: `HandoffEvent` logged with timestamp, GPS coordinates, Center Officer ID
- Center Officer formally confirms receipt of the correct paper set on the portal
- Any mismatch (wrong trunk, wrong center) triggers an immediate security lockdown

---

### 5.7 Day-of-Exam: Check-in & Seating Module

**Student Arrival:**
1. Student presents physical admit card + digital admit card on phone
2. Center Officer scans the QR code → portal validates JWT signature and decodes payload
3. Live biometric scan (face match) is run against the `biometric_hash` embedded in the QR payload
4. On successful match: `CheckinEvent` created, student marked `PRESENT`
5. System performs **randomized room allocation** in real-time:
   - Checks current occupancy of all rooms in that center (from `RoomAllocation` table)
   - Randomly assigns an available room with remaining capacity
   - Room ID is instantly and permanently bound to `{student_id, exam_id}` in DB
6. Student is handed a physical slip with their Room and Seat number

**Live Room Capacity Dashboard (Center Officer view):**
- Real-time map of all rooms in the center
- Each room shows: Total capacity / Current occupancy / Available seats
- Updates live as students check in via Supabase Realtime
- No room can be marked over-capacity; system blocks further allocation to a full room

**Proxy Prevention:**
- If face match fails: access denied, security alert generated, incident logged with photo evidence
- Three failed attempts: terminal locked, Manager alerted

---

### 5.8 Online CBT Mode Security Module

**Just-in-Time Decryption:**
- Exam paper remains AES-256-GCM encrypted on the center's local exam server until `exam_start_time`
- At the exact start minute, the student enters their credentials on the exam client
- Server authenticates the student + validates they are `CHECKED_IN` at the correct center
- Paper is decrypted and served to that student's session only

**Sandbox Defense Layer:**
- Clipboard is disabled for the duration of the exam session
- Tab switching triggers a warning (3 warnings = auto-submission flagged for review)
- Keystroke analytics engine: detects machine-like typing speeds (flags AI browser extension use)
- Screen recording (student-consented, disclosed in registration) during the exam window

---

### 5.9 Live Proctoring & Agency Command Center

**CCTV Integration:**
- Standard IP cameras at exam halls run YOLOv8 edge inference locally
- Detects: mobile phones, earpieces, unusual group behaviors (mass head-turning), unauthorized persons
- Detection events create `SurveillanceAlert` records with timestamp, camera ID, screenshot evidence

**Agency Command Center Dashboard:**
- Live WebRTC stream thumbnails from every active center and room
- Agency Head and designated Managers can click any room to expand to full-screen live feed
- Real-time alert feed (right panel) showing all AI-detected anomalies across all centers
- Student check-in progress bar per center (X of Y students checked in)
- Trunk location map (for offline exams)

---

### 5.10 Post-Exam: Answer Sheet Upload & AI Visibility Scoring

**Upload Process (Center Operator):**
- After exam concludes, Center Officer locks the hall and initiates scan upload
- Answer sheets are scanned page-by-page using center's scanner
- Uploaded PDFs are encrypted in transit (TLS 1.3) and at rest (AES-256-GCM)
- Each upload is tagged: `{center_uid, student_uid, exam_id}`

**AI Visibility Scoring (YOLOv8 + OpenCV):**
- An AI agent immediately processes each uploaded PDF
- Assigns a **Visibility Score (0–10)** based on: ink clarity, page orientation, fold/damage artifacts, answer legibility
- Score ≥ 8: Paper approved, status set to `EVALUATION_READY`
- Score < 8: Center Operator is alerted immediately to rescan before sealing physical papers
- Score ≥ 8 threshold is configurable per exam by the Agency Head

**Physical Sealing:**
- After all digital uploads are confirmed ≥ 8 visibility, physical papers are sealed in tamper-evident envelopes
- Seal confirmation is recorded on the portal by the Center Officer
- Unsealing requires Chief Moderator authorization

---

### 5.11 Multi-Tier Anonymized Evaluation Module

**Anonymization:**
- Student names and photos are stripped from all papers presented to evaluators
- Papers are referenced only by `{anonymized_batch_code}` derived from `center_uid + student_uid` — the mapping is stored in a separate encrypted lookup table accessible only to the Chief Moderator

**Evaluator Onboarding:**
- Agency creates Teacher accounts with `role = grading_teacher`
- Each teacher is assigned a specific batch of anonymized papers — stored as `EvaluatorAssignment`
- Teacher can only see papers in their assigned batch — enforced at both API and DB row-level security level

**3-Tier Evaluation Workflow:**

| Tier | Role | Responsibility |
|---|---|---|
| Tier 1 | Grading Teacher | Primary evaluation of assigned batch |
| Tier 2 | Moderator | Cross-checks high-scoring papers + random 10–15% sample |
| Tier 3 | Chief Moderator | Resolves discrepancies, final authority, approves result publication |

**Marks Storage:**
- Each marks entry stored as: `{student_id, exam_id, center_uid, evaluator_id, tier, marks_awarded, evaluation_timestamp}`
- Discrepancies between Tier 1 and Tier 2 (>threshold) are auto-flagged for Tier 3 review

**Access Lock-in:**
- When a Grading Teacher confirms completion ("Submit & Lock"), their access to those papers is permanently revoked
- Confirmation triggers a formal notification to the Agency (email + portal notification)
- Same lock-in applies when Moderator and Chief Moderator complete their tiers

---

### 5.12 Result Publication Module

**Pre-Publication Checks (automated):**
- All papers evaluated (no `EVALUATION_READY` papers remaining)
- All Tier 3 discrepancies resolved
- Chief Moderator has approved the result batch

**Result Access (Student Portal):**
- Student navigates to Result section, enters:
  1. Student UID (Application Number)
  2. Mobile OTP (sent to registered mobile)
  3. CAPTCHA
- On successful validation: Result card displayed with: Subject-wise marks, Total marks, Rank (if applicable), Pass/Fail status
- Result PDF downloadable with the platform's digital signature

---

### 5.13 Leak Investigation Engine (Agent 7)

**Trigger:** Any user (internal or public) uploads a suspected leaked paper photo to the portal

**Process:**
1. Agent 7 extracts the steganographic Tracking Matrix Code from the image
2. Decodes: Center Code, Printer ID, Operator ID, Timestamp, Page Number
3. Cross-references:
   - Vault access logs (who accessed the paper digitally, when)
   - Print room CCTV logs (anomalies during that print session)
   - Transit logs (trunk GPS history, handoff records)
   - Center day-of logs (who was in the print room, who handled that batch)
4. Generates a **Leak Source Probability Report**:
   - Example output: `Printing Operator: 89% | Transit Officer: 11%`
   - Report includes: evidence chain, CCTV timestamps, access logs
5. Report is routed to Agency Head and flagged to platform audit team

---

### 5.14 Integrity Network Module (Agent 8)

**Anonymous Whistleblower Portal (`[platform].com/report`):**
- Anyone (citizens, press, printing staff, invigilators) can submit a report
- Inputs: Category (leak, bribery, impersonation, other), Description, Photo/Video upload (optional), Location
- No account required; report is fully anonymized on submission
- AI agent assigns a **Risk Score (0–100)** based on: specificity of claim, evidence quality, category severity
- High-risk reports (score > 70) are routed immediately to the platform audit team
- Reports can also be linked to a specific exam by exam ID (without revealing reporter identity)

**Priority Student Grievance (Authenticated):**
- Student logs into the Student Portal → navigates to "File Grievance"
- Categories: Answer key dispute, Question paper error, Center misconduct (invigilator behavior, peer cheating), Technical issue (CBT), Misprinted paper, Unfair evaluation
- Because the grievance is tied to the student's authenticated UID (which is bound to a specific Room ID from check-in), the system automatically:
  1. Identifies the exact room the student was in
  2. Pulls the relevant CCTV footage segment (timestamp: exam window for that room)
  3. Attaches it to the grievance ticket
- Ticket is routed to the Agency's Chief Exam Manager as a `HIGH_PRIORITY` ticket
- Student receives a ticket ID and can track status

---

## 6. Security Architecture Summary

| Layer | Mechanism |
|---|---|
| Data at rest | AES-256-GCM encryption on all papers, answer sheets, keys |
| Data in transit | TLS 1.3 on all API calls; MQTT over TLS for IoT telemetry |
| Authentication | Supabase Auth JWT; role-scoped tokens; short-lived with refresh rotation |
| Paper access | Split-key vault; key only assembled in RAM at exam window |
| Physical transit | GPS-tracked smart trunks; multi-factor handoff (GPS + OTP + biometric) |
| Identity verification | Cryptographic QR admit cards; live face match at check-in |
| Leak attribution | Steganographic watermarks on every printed page; Agent 7 reverse-engineering |
| Evaluation integrity | Anonymized papers; row-level DB security; 3-tier evaluation; access lock-in |
| Reporting | Anonymous whistleblower system; AI risk scoring; authenticated student grievances |

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Availability | 99.9% uptime during exam windows |
| Concurrent users | 100,000+ students during peak registration |
| Latency | API responses < 200ms for non-AI endpoints |
| AI agent jobs | Async via Celery; SLA: Visibility scoring < 30s per paper |
| Data retention | Exam records retained for 7 years (regulatory compliance) |
| Audit logs | Immutable append-only log for all security-critical events |
| GDPR / DPDPA | Student biometric data encrypted separately; right to erasure post-retention period |
