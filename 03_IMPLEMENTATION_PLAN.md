# LeakGuard AI — Implementation Plan & Coding Agent Directive

> **Version:** 1.0.0 | **Hackathon:** FAR AWAY 2026 | **Document Purpose:** Complete build specification for coding agents and team developers.
> **Read before coding:** `01_SYSTEM_DESIGN.md` (architecture & APIs) and `02_DATABASE_DESIGN.md` (schema & RLS).
> **Monorepo root:** `leakguard-ai/`

---

## ⚠️ Flagged Design Changes (Requires Team Decision)

The following items were identified during plan preparation. **Do not implement them until the decision is confirmed.**

| # | Flag | Current Design | Proposed Change | Risk if Unchanged |
|---|---|---|---|---|
| **F-01** | Shamir's is described as "2-of-2" in the API docs but "2-of-N" in the architecture doc | API doc says both shares required | Clarify and hard-code threshold as `k=2, n=2` | Ambiguity may cause two developers to build incompatible key-assembly logic |
| **F-02** | `GET /vault/papers/{paper_id}/view` streams to canvas via "short-lived pre-signed token" — the token storage mechanism is undefined | Token implied but not designed | Add a `vault_view_tokens` table with a 60-second TTL and `is_used BOOLEAN` column | Without this, the protected canvas has no replay-attack protection |
| **F-03** | YOLOv8 agents (print room + exam hall) are described as separate processes but share identical logic | Two separate workers defined | Unify into one `vision_agent.py` with a `--location-type` CLI flag to reduce duplication | Minimal risk, purely architectural cleanliness |
| **F-04** | `batch_receptions.count_mismatch` uses a `GENERATED ALWAYS AS` computed column — Supabase's Postgres version may or may not support this cleanly via migrations | Computed column in schema | Fallback: compute `count_mismatch` in the FastAPI service layer and write it as a regular boolean | If Supabase migration fails, supervisor can't receive batches |
| **F-05** | No rate-limiting middleware is defined for the FastAPI backend beyond the forensic upload note | Rate limit mentioned only for `/forensic/upload` | Add `slowapi` middleware globally with per-route overrides | Public endpoints could be abused during demo |

---

## Repository Structure

```
leakguard-ai/                          ← Monorepo root
├── apps/
│   ├── frontend/                      ← Next.js 14 (App Router)
│   │   ├── app/                       ← All routes live here
│   │   ├── components/                ← Shared UI components
│   │   ├── lib/                       ← Supabase client, API helpers
│   │   └── public/
│   └── backend/                       ← FastAPI (Python 3.11)
│       ├── api/
│       │   └── v1/                    ← All route files
│       ├── services/                  ← Business logic layer
│       ├── models/                    ← Pydantic request/response models
│       ├── dependencies/              ← Auth, DB, INTERNAL_KEY dependencies
│       └── main.py
├── workers/
│   ├── vision_agent/                  ← YOLOv8 standalone process
│   │   └── agent.py
│   └── forensic_worker/               ← OpenCV + EasyOCR pipeline
│       └── worker.py
├── shared/
│   └── types/                         ← TypeScript interfaces matching API contracts
│       └── index.ts
├── supabase/
│   └── migrations/                    ← SQL migration files (numbered, sequential)
│       ├── 001_enums.sql
│       ├── 002_core_tables.sql
│       ├── 003_module1_tables.sql
│       ├── 004_module2_tables.sql
│       ├── 005_module3_tables.sql
│       ├── 006_module4_tables.sql
│       ├── 007_module5_tables.sql
│       ├── 008_audit_tables.sql
│       ├── 009_indexes.sql
│       └── 010_rls_policies.sql
├── docker-compose.yml
└── .env.example
```

---

## Team Ownership Map

| Person | Area | Modules |
|---|---|---|
| **Person 1** | Frontend | Admin Dashboard, Vault UI (`/admin/*`, `/print-room/*`) |
| **Person 2** | Frontend | Transit PWA, Supervisor App, Forensic Portal (`/transit/*`, `/center/*`, `/report/*`) |
| **Person 3** | Backend + DB | Vault Service, Print Service, DB Migrations, Auth setup |
| **Person 4** | Backend + Vision | Transit Service, OMR Service, Centers Service, Vision Agent setup |
| **Person 5** | Forensic Worker | OpenCV pipeline, EasyOCR, Watermark decode, Report engine |

### Merge Contract — Non-Negotiable Rules

- All API JSON keys **must** use the exact column names from `02_DATABASE_DESIGN.md` Appendix Glossary.
- All Pydantic models in `backend/models/` must mirror TypeScript interfaces in `shared/types/index.ts`.
- All DB operations go through `supabase-py` service role client. **Never** call Supabase directly from frontend for writes (reads with RLS anon key are allowed).
- Branch naming: `feature/<person_number>/<short-description>` (e.g., `feature/3/vault-service`).
- All environment variables must be added to `.env.example` when introduced.

---

## Phase 0 — Foundation (All Team Members, Day 1 Morning)

> **Goal:** Shared scaffolding is set up before anyone writes feature code. Blocks all other phases.

### Task 0.1 — Supabase Project Setup

**Owner:** Person 3  
**Input:** `02_DATABASE_DESIGN.md` (complete schema, enums, indexes, RLS)

**What to build:**
Create all SQL migration files under `supabase/migrations/` in the numbered order shown in the repo structure. Each file is a standalone, runnable SQL script.

- `001_enums.sql` — Create all `CREATE TYPE ... AS ENUM` statements from §12 of the DB design doc. The six enums are: `user_role_enum`, `exam_status_enum`, `paper_status_enum`, `print_job_status_enum`, `transit_status_enum`, `forensic_job_status_enum`.
- `002_core_tables.sql` — Create `user_profiles`, `exams`, `exam_centers`, `exam_center_assignments`, `students`, `exam_enrollments` tables exactly as specified in §3 of the DB design doc.
- `003_module1_tables.sql` through `008_audit_tables.sql` — One file per module's tables. Use ON DELETE constraints exactly as documented.
- `009_indexes.sql` — All `CREATE INDEX` statements from §10 of the DB design doc, copied verbatim.
- `010_rls_policies.sql` — Implement every RLS policy from the §11 summary table. For each table/role combination marked with permissions, write a corresponding `CREATE POLICY` statement. Tables with no public access get `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` but no permissive public policies.

**Expected Output:**
- 10 SQL migration files, all runnable against Supabase without errors.
- Supabase dashboard shows all tables created, all indexes present, RLS enabled on all tables listed in §11.

---

### Task 0.2 — FastAPI Skeleton

**Owner:** Person 3  
**Input:** `01_SYSTEM_DESIGN.md` §9 (API Reference), §8.4 (error convention), §8.5 (env vars)

**What to build:**
Bootstrap the FastAPI application in `apps/backend/`.

- `main.py` — Create the FastAPI app instance. Mount all routers under `/api/v1`. Add CORS middleware allowing the Next.js frontend origin. Add a global exception handler that always returns the standard error envelope: `{ "success": false, "data": null, "error": { "code": "...", "message": "..." } }`.
- `dependencies/auth.py` — A FastAPI dependency that extracts and validates the Supabase JWT from `Authorization: Bearer` header. The dependency must resolve the user's `role` from `user_profiles` and attach it to the request state. Create role-enforcement dependencies: `require_super_admin()`, `require_authority()`, `require_print_operator()`, `require_driver()`, `require_supervisor()`, and `require_internal_worker()` (validates `INTERNAL_WORKER_API_KEY` header, not JWT).
- `dependencies/db.py` — A dependency that provides a configured `supabase-py` client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Create empty router files for each module: `api/v1/vault.py`, `api/v1/print_jobs.py`, `api/v1/transit.py`, `api/v1/centers.py`, `api/v1/omr.py`, `api/v1/forensic.py`, `api/v1/vision.py`, `api/v1/system.py`. Each file registers its router prefix but has no routes yet.
- `GET /api/v1/health` in `system.py` — returns `{ "success": true, "data": { "status": "ok" } }`. This is the integration test baseline.

**Expected Output:**
- `uvicorn apps.backend.main:app` starts without errors.
- `GET /api/v1/health` returns 200.
- All routers are mounted and return 404 (not 500) for unimplemented routes.

---

### Task 0.3 — Next.js Skeleton

**Owner:** Person 1  
**Input:** `01_SYSTEM_DESIGN.md` §10 (Frontend Routes Reference)

**What to build:**
Bootstrap the Next.js 14 App Router project in `apps/frontend/`.

- Create the complete folder structure under `app/` matching every route in the Frontend Routes table. Each route should have a `page.tsx` that renders a placeholder with the route name (e.g., `<h1>Admin Dashboard</h1>`).
- `lib/supabase/client.ts` — Supabase browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase/server.ts` — Supabase server client for use in Server Components.
- `lib/api.ts` — A typed `apiFetch` wrapper that attaches the Bearer token from the Supabase session to every request to the FastAPI backend. Base URL from `NEXT_PUBLIC_API_URL` env var.
- `middleware.ts` — Next.js middleware that checks Supabase session. Redirect unauthenticated users to `/auth/login` for all protected routes. Public routes: `/`, `/auth/login`, `/report`, `/report/status/[job_id]`.
- `shared/types/index.ts` — TypeScript interfaces for all API response shapes (matching the JSON schemas in `01_SYSTEM_DESIGN.md` §9). At minimum: `Paper`, `PrintSession`, `PrintJob`, `TransitBatch`, `TransitPing`, `AdmitCard`, `OmrRecord`, `ForensicUpload`, `ForensicReport`, `VisionAlert`, `AuditLog`.

**Expected Output:**
- `next dev` starts without errors.
- All 15 defined routes render their placeholder pages.
- Unauthenticated access to `/admin` redirects to `/auth/login`.

---

### Task 0.4 — Shared Config & Docker

**Owner:** Person 3  
**Input:** `01_SYSTEM_DESIGN.md` §12 (Deployment Topology)

**What to build:**
- `.env.example` — All environment variables listed in `01_SYSTEM_DESIGN.md` §8.5, with empty values and inline comments explaining each.
- `docker-compose.yml` — Four services: `fastapi-backend` (port 8000), `nextjs-frontend` (port 3000), `vision-agent` (no exposed port, webcam passthrough), `forensic-worker` (no exposed port). All services share the same `.env` file. Vision agent and forensic worker depend on `fastapi-backend` being healthy.

**Expected Output:**
- `docker-compose up` brings all four services online.
- Frontend can reach backend at `http://fastapi-backend:8000/api/v1/health`.

---

## Phase 1 — Module 1: Vault & Print Interceptor (Priority #1)

> **Owner:** Person 3 (backend), Person 1 (frontend)
> **Dependency:** Phase 0 complete. Migrations 001–003 applied.

---

### Task 1.1 — VaultService: Paper Upload & Encryption

**Owner:** Person 3  
**Input:** `01_SYSTEM_DESIGN.md` §3.2 (VaultService), API: `POST /vault/papers`  
**DB tables used:** `papers`, `key_shares`, `audit_logs`

**What to build:**
Implement `services/vault_service.py` and the `POST /api/v1/vault/papers` endpoint.

**Detailed Steps:**

1. Accept a `multipart/form-data` request with fields: `file` (PDF binary), `exam_id` (UUID string), `title` (string). Validate that `exam_id` exists in the `exams` table.

2. Generate a 256-bit AES key using `os.urandom(32)`. Generate a 96-bit IV using `os.urandom(12)`. Encrypt the PDF bytes using AES-256-GCM (via `PyCryptodome`: `Crypto.Cipher.AES`, mode `MODE_GCM`). The result is: `(ciphertext, auth_tag)`. The IV and auth tag are stored in the DB; the raw PDF is discarded from memory after encryption.

3. Upload the encrypted ciphertext to Supabase Storage bucket `encrypted-papers` at path `{exam_id}/{paper_id}.enc`.

4. Implement Shamir's Secret Sharing (2-of-2 scheme) using the `secretsharing` library or implement it manually using GF(256) polynomial interpolation. Split the 32-byte AES key into exactly 2 shares. **Important:** The threshold is `k=2`, meaning both shares are required to reconstruct the key. Share 1 is for Authority A, Share 2 is for Authority B.

5. Encrypt each Shamir share before storing it: derive a per-authority encryption key using PBKDF2-HMAC-SHA256 with `VAULT_MASTER_SALT` from env and a deterministic authority-scoped salt string (`"authority_a"` or `"authority_b"`). Encrypt each share with AES-256-GCM. Store the resulting `share_value_encrypted` (hex string) in the `key_shares` table — two rows per paper, one per authority role.

6. Insert a row into `papers` with: `encrypted_blob_path`, `iv_hex` (hex of the 12-byte IV), `auth_tag_hex` (hex of the 16-byte auth tag), `file_size_bytes`, `status = 'encrypted'`, `uploaded_by = current_user_id`.

7. Write an `audit_logs` row with `action_type = 'paper_uploaded'`, `entity_type = 'papers'`, `entity_id = paper_id`.

8. Return `{ paper_id, exam_id, key_share_a_id, key_share_b_id, status: "encrypted" }`.

**Expected Output:**
- `POST /api/v1/vault/papers` with a valid PDF and exam_id returns HTTP 201 with the specified response body.
- Two `key_shares` rows exist in DB for the paper.
- Encrypted blob is visible in Supabase Storage.
- An audit log entry exists.
- No plaintext PDF ever appears on disk or in the DB.

---

### Task 1.2 — VaultService: Key Share Retrieval & Print Authorization

**Owner:** Person 3  
**Input:** `01_SYSTEM_DESIGN.md` §3.2 (VaultService), APIs: `GET /vault/key-shares/{share_id}`, `POST /vault/papers/{paper_id}/authorize-print`  
**DB tables used:** `key_shares`, `print_sessions`, `papers`

**What to build:**

**Key Share Retrieval (`GET /vault/key-shares/{share_id}`):**
1. Enforce that the requesting user's role matches the `authority_role` column of the requested share (Authority A can only retrieve their own share).
2. Check `is_retrieved = FALSE`. If already retrieved, return HTTP 409 with error code `ERR_SHARE_ALREADY_USED`.
3. Decrypt the stored `share_value_encrypted` using the same PBKDF2 derivation from Task 1.1. Return the plaintext hex share to the caller.
4. Set `is_retrieved = TRUE`, `retrieved_at = NOW()`, `retrieved_by = current_user_id`.
5. Write audit log: `action_type = 'key_share_retrieved'`.

**Print Authorization (`POST /vault/papers/{paper_id}/authorize-print`):**
1. Accept body: `{ share_a: hex, share_b: hex, authorized_copies: int, authorized_centers: [uuid], print_window_minutes: int }`.
2. Reconstruct the AES key from the two Shamir shares using the inverse of the splitting logic in Task 1.1.
3. Fetch the paper's `iv_hex` and `auth_tag_hex` from DB. Download the encrypted blob from Supabase Storage into RAM (not to disk).
4. Decrypt using AES-256-GCM with the reconstructed key, IV, and auth tag. If decryption fails (tag mismatch), return HTTP 400 `ERR_DECRYPTION_FAILED`.
5. Parse the decrypted PDF to count pages (use `PyMuPDF`: `fitz.open(stream=pdf_bytes)`). Update `papers.page_count`.
6. Update `papers.status = 'print_authorized'`.
7. Create a `print_sessions` row: `paper_id`, `authorized_by_a`, `authorized_by_b`, `authorized_copies`, `authorized_centers`, `expires_at = NOW() + print_window_minutes`.
8. Store the decrypted PDF bytes in a server-side in-memory cache keyed by `print_session_id` (use a Python `dict` or `asyncio` cache). Set a background task to wipe this cache when `expires_at` is reached.
9. Emit a Supabase Realtime event on channel `print_room` indicating the session is open.
10. Write audit log: `action_type = 'print_authorized'`.

**Expected Output:**
- Both authorities can retrieve their shares exactly once.
- A valid pair of shares reconstructs the AES key and decrypts the paper.
- A `print_sessions` row is created with a future `expires_at`.
- The decrypted PDF is in the in-memory cache.
- A second attempt to use either share returns HTTP 409.

---

### Task 1.3 — WatermarkService & Print Spooler

**Owner:** Person 3  
**Input:** `01_SYSTEM_DESIGN.md` §3.2 (PrintSpoolerMiddleware, WatermarkService), APIs: `POST /print/jobs`, `POST /print/jobs/{job_id}/abort`  
**DB tables used:** `print_jobs`, `print_sessions`, `watermark_registry`, `audit_logs`

**What to build:**

**`POST /api/v1/print/jobs`** (create and execute a print job):
1. Accept body: `{ paper_id: uuid, session_id: uuid, center_id: uuid, printer_id: string, copies_requested: int }`.
2. Validate: session is active (`is_active = TRUE`, `expires_at > NOW()`), `center_id` is in `authorized_centers`, `copies_requested` does not exceed remaining copies (sum of existing jobs for this session vs. `authorized_copies`).
3. Check that the decrypted PDF bytes are still in the in-memory cache for this `session_id`. If not (expired), return HTTP 410 `ERR_SESSION_EXPIRED`.
4. Create a `print_jobs` row with `status = 'queued'`.
5. For each copy (1 to `copies_requested`), for each page in the PDF:
   - Construct the TMC payload: `{ printer_id, operator_id: current_user_id, center_id, batch_id: watermark_batch_id, timestamp_unix: int(time.time()), copy_index, page_index }`.
   - Encode this payload as a QR code binary using the `qrcode` library. Render the QR code as a small image (approx. 40×40 points).
   - Open the PDF page using `fitz.open(stream=pdf_bytes)`. Insert the QR image into the page footer (bottom-right corner, 1cm from edges) using `page.insert_image(rect, stream=qr_bytes)`.
   - Insert a row into `watermark_registry` with the `tmc_payload` JSON and `tmc_code_hex`.
6. Produce the final watermarked PDF bytes. Send to the printer using Python's `subprocess` to call the OS print command (e.g., `lp -d {printer_id} -n 1 {tmpfile}` on Linux, or `win32print` on Windows). **Never write the un-watermarked PDF to disk.**
7. Update `print_jobs.status = 'completed'`, set `copies_printed`, `completed_at`.
8. Update `papers.status = 'printed'`.
9. Write audit log: `action_type = 'print_job_created'`.
10. Emit `print_room` Realtime event: `{ event: 'print_job_completed', job_id }`.

**`POST /api/v1/print/jobs/{job_id}/abort`:**
1. Auth: `super_admin` or the `print_operator` who owns the job.
2. Update `print_jobs.status = 'aborted'`, set `aborted_reason` from request body.
3. Write audit log: `action_type = 'print_job_aborted'`.
4. Emit `print_room` Realtime event: `{ event: 'print_job_aborted', job_id }`.

**Expected Output:**
- Calling `POST /print/jobs` with a valid session produces a watermarked PDF and a completed print job.
- Every page of every copy has a unique QR code in the footer.
- `watermark_registry` has exactly `copies_requested × page_count` rows.
- A call after `expires_at` returns HTTP 410.

---

### Task 1.4 — PrintRoomVisionAgent (Worker)

**Owner:** Person 4  
**Input:** `01_SYSTEM_DESIGN.md` §3.2 (PrintRoomVisionAgent), API: `POST /vision/alert`

**What to build:**
Implement `workers/vision_agent/agent.py` as a standalone Python script.

1. Accept CLI arguments: `--location-type` (`print_room` or `exam_hall`), `--location-id` (UUID), `--webcam-index` (int, default 0), `--api-base-url`, `--internal-api-key`.
2. Open a webcam using `cv2.VideoCapture(webcam_index)`.
3. Load the YOLOv8 model using `ultralytics`: `YOLO(os.getenv('YOLO_MODEL_PATH'))`. Use the standard `yolov8n.pt` model (pre-trained COCO) which includes the `cell phone` class (class ID 67).
4. Run inference on every 5th frame (to reduce CPU load). Use confidence threshold from `YOLO_CONFIDENCE_THRESHOLD` env var (default 0.65).
5. If a `cell phone` (or `headphones` for exam hall mode) class is detected with confidence above threshold:
   - Capture the current frame as JPEG bytes.
   - Call `POST {api_base_url}/api/v1/vision/alert` with header `X-Internal-API-Key: {internal_api_key}` and body: `{ agent_id, location_type, location_id, detected_class, confidence, frame_jpeg_b64 }`.
   - Log the detection to stdout with timestamp.
6. The `POST /api/v1/vision/alert` FastAPI endpoint (implement in `api/v1/vision.py`):
   - Validate the `X-Internal-API-Key` header.
   - Upload the frame JPEG to Supabase Storage at `vision-alerts/{timestamp}_{agent_id}.jpg`.
   - Insert a `vision_alerts` row.
   - If `location_type = 'print_room'`: query the currently active `print_jobs` for the linked job and set `status = 'aborted'`, `aborted_reason = 'vision_alert'`. Set `triggered_abort = TRUE` on the alert row.
   - Emit `vision_alerts` Realtime event.
   - Write audit log: `action_type = 'vision_alert_fired'`.

**Expected Output:**
- Agent process starts and logs "Vision agent running" to stdout.
- Holding a phone in front of the webcam triggers an alert within 2–3 seconds.
- A `vision_alerts` row appears in the DB.
- An active print job is set to `aborted` when triggered from `print_room` mode.

---

### Task 1.5 — Secure Vault Viewer (Frontend)

**Owner:** Person 1  
**Input:** `01_SYSTEM_DESIGN.md` §3.2 (VaultViewerCanvas), route `/print-room/view-paper`

**What to build:**
Implement the protected canvas viewer at `app/print-room/view-paper/page.tsx`.

1. On page load, call `GET /api/v1/vault/papers/{paper_id}/view` to obtain a short-lived view token (see F-02 flag — implement a simple 60-second token mechanism).
2. Fetch the decrypted PDF as a binary Blob using the view token. Render each PDF page onto an HTML `<canvas>` element using `pdfjs-dist` (PDF.js). Do **not** use `<img>`, `<iframe>`, or `<embed>`.
3. Attach the following browser-level protections:
   - `oncontextmenu={(e) => e.preventDefault()}` — disables right-click.
   - `document.addEventListener('keydown', ...)` — intercept and cancel `Ctrl+P`, `Ctrl+S`, `Ctrl+Shift+I`, `F12`.
   - `document.addEventListener('visibilitychange', ...)` — when tab loses focus, immediately clear the canvas and display a "Session Locked" overlay. A supervisor must re-authenticate to continue.
   - Listen for `navigator.mediaDevices.getDisplayMedia` calls by overriding the method and blocking it (set to a function that always throws `NotAllowedError`).
4. Display a countdown timer showing the remaining print window duration (from `print_session.expires_at`).
5. A "Authorize Print" button calls `POST /api/v1/print/jobs` with the session details.

**Expected Output:**
- The PDF renders on a canvas with no download affordances visible.
- Right-click menu is suppressed.
- `Ctrl+P` opens no print dialog.
- Switching browser tabs blanks the canvas.
- The countdown timer counts down to 0, after which the session is locked.

---

### Task 1.6 — Print Room Dashboard (Frontend)

**Owner:** Person 1  
**Input:** `01_SYSTEM_DESIGN.md` §3.2, route `/print-room`

**What to build:**
Implement the print operator dashboard at `app/print-room/page.tsx`.

1. Fetch and display the active `print_sessions` for the current operator.
2. Display the job queue: a list of `print_jobs` for the active session, each showing status (`queued`, `printing`, `completed`, `aborted`).
3. Subscribe to Supabase Realtime channel `print_room`. Update the job queue in real-time as events arrive.
4. Display a live feed panel for vision alerts: subscribe to the `vision_alerts` Realtime channel. When an alert appears, show a red banner with the detected class, confidence score, and a thumbnail of the flagged frame (if available). If `triggered_abort = TRUE`, display "PRINT JOB ABORTED" in bold.
5. An "Abort Job" button calls `POST /print/jobs/{job_id}/abort`.

**Expected Output:**
- Operator logs in and sees the active session and job queue.
- A new print job appears in the queue in real-time without page refresh.
- A vision alert banner appears within 2 seconds of the vision agent firing.

---

## Phase 2 — Module 5: Forensic Intelligence (Priority #2)

> **Owner:** Person 5 (worker), Person 2 (frontend)
> **Dependency:** Phase 0 complete. Phase 1 Task 1.3 must be complete (watermarks must exist in DB).

---

### Task 2.1 — ForensicWorker: Image Processing Pipeline

**Owner:** Person 5  
**Input:** `01_SYSTEM_DESIGN.md` §7.1 (ForensicWorker pipeline)  
**DB tables used:** `forensic_uploads`, `forensic_reports`, `print_jobs`, `watermark_registry`, `transit_batches`, `user_profiles`

**What to build:**
Implement `workers/forensic_worker/worker.py` as a standalone Python process that polls the DB for unprocessed forensic uploads.

The worker runs a continuous loop:
1. Every 5 seconds, query `forensic_uploads` where `status = 'processing'` (fetching the oldest first, LIMIT 1).
2. Download the uploaded image from Supabase Storage.
3. Run the OpenCV image enhancement pipeline:
   - **Deskew:** Convert to grayscale. Use Canny edge detection followed by Hough Line Transform (`cv2.HoughLinesP`) to detect dominant line angles. Rotate the image by the detected skew angle using `cv2.warpAffine`.
   - **Contrast Enhancement:** Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) using `cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))` on the L channel of the LAB color space.
   - **Binarization:** Apply adaptive threshold using `cv2.adaptiveThreshold` with `ADAPTIVE_THRESH_GAUSSIAN_C`, threshold type `THRESH_BINARY`.
4. Attempt QR/Data Matrix decode using `pyzbar.decode()` on the binarized image. If `pyzbar` finds no codes, also try `pylibdmtx.decode()` for Data Matrix codes.
5. If no TMC found after both decoders:
   - Update `forensic_uploads.status = 'no_watermark_found'`.
   - Write a `forensic_reports` row with `tmc_decoded = NULL`, `confidence_score = 0`, `processing_notes = 'No TMC found after full pipeline'`.
   - Continue to next job.
6. If TMC is found, parse the JSON payload from the decoded bytes: `{ printer_id, operator_id, center_id, batch_id, timestamp_unix, copy_index, page_index }`.
7. Run the `LeakAttributionEngine`:
   - Look up the `operator_id` in `user_profiles` to get `operator_name`.
   - Look up the `batch_id` in `transit_batches` to get the custody chain.
   - Query `transit_pings` for the batch to find any `geofence_status = 'deviation'` or `'stationary'` events.
   - Compute `confidence_score`: start at `1.0`. Subtract `0.05` for each transit deviation event. The score represents confidence that the identified operator is the leak source.
   - Reconstruct `custody_chain` as an ordered array of events: `[{ event: 'printed', actor: operator_name, timestamp }, { event: 'dispatched', actor: driver_name, timestamp }, { event: 'checkpoint_scanned', ... }, { event: 'delivered', ... }]`.
8. Insert a `forensic_reports` row with the full TMC decoded payload, primary suspect fields, custody chain JSONB, and confidence score.
9. Update `forensic_uploads.status = 'completed'`.
10. Write audit log: `action_type = 'forensic_report_generated'`.

**Expected Output:**
- A photo of a watermarked page (taken with a phone camera) uploaded to the system causes a `forensic_reports` row to be generated within 30 seconds.
- The report correctly identifies the `operator_id`, `printer_id`, `center_id`, and `batch_id` embedded in the watermark.
- A heavily rotated or low-contrast image is still processed (deskew + CLAHE pipeline working).

---

### Task 2.2 — Forensic API Endpoints

**Owner:** Person 5 (processing logic) + Person 3 (endpoint wiring)  
**Input:** `01_SYSTEM_DESIGN.md` §9 (Module 5 APIs): `POST /forensic/upload`, `GET /forensic/status/{job_id}`, `GET /forensic/reports`

**What to build:**

**`POST /api/v1/forensic/upload`** (public, no auth):
1. Rate limit: 5 uploads per IP per hour. Use `slowapi` with a Redis or in-memory store.
2. Accept `multipart/form-data` with `file` (JPEG/PNG) and optional `description` string.
3. Hash the client IP with SHA-256 and store as `uploader_ip_hash` (never store raw IP).
4. Upload image to Supabase Storage at `forensic-uploads/{uuid}.jpg`.
5. Insert `forensic_uploads` row with `status = 'processing'`.
6. Write audit log: `action_type = 'forensic_upload'`.
7. Return HTTP 202: `{ job_id, status: "processing", estimated_seconds: 15 }`.

**`GET /api/v1/forensic/status/{job_id}`** (public, no auth):
1. Query `forensic_uploads` by `id`.
2. If `status != 'completed'`, return `{ job_id, status, report: null }`.
3. If `status = 'completed'`, join with `forensic_reports` and return the full report structure as specified in `01_SYSTEM_DESIGN.md` §9.

**`GET /api/v1/forensic/reports`** (auth: `super_admin`):
1. Return a paginated list of all `forensic_reports` joined with `forensic_uploads`.

**Expected Output:**
- Anonymous POST to `/forensic/upload` returns a `job_id`.
- Polling `GET /forensic/status/{job_id}` transitions from `processing` to `completed`.
- After the 5th upload from the same IP in an hour, the 6th returns HTTP 429.

---

### Task 2.3 — Forensic Portal (Frontend)

**Owner:** Person 2  
**Input:** `01_SYSTEM_DESIGN.md` §7.2 (ForensicPortal), routes `/report`, `/report/status/[job_id]`

**What to build:**

**`/report` page:**
1. Tagline headline: "See Something. Secure Something."
2. A drag-and-drop file upload zone that accepts JPEG and PNG files. Show a preview of the selected image.
3. An optional description textarea.
4. On submit, call `POST /api/v1/forensic/upload`. On success, navigate to `/report/status/{job_id}`.
5. No login prompt of any kind. The page must be fully anonymous.

**`/report/status/[job_id]` page:**
1. On load, call `GET /api/v1/forensic/status/{job_id}`.
2. If `status = 'processing'`: show a progress animation and poll every 3 seconds.
3. If `status = 'no_watermark_found'`: show a clear message — "No tracking code detected in this image. Either the image is not from our system, or the watermark area was cropped."
4. If `status = 'completed'`: render the Leak Source Report:
   - A prominent card showing: Operator Name, Printer Label, Center Name, and timestamp of the print event.
   - A confidence score displayed as a percentage with a color-coded badge (green ≥ 90%, yellow 70–89%, red < 70%).
   - A collapsible "Custody Chain" timeline showing the full chain of events from printing to delivery.
5. If `status = 'failed'`: show a generic error message and a retry link.

**Expected Output:**
- An anonymous user can upload a photo and receive a tracking report with zero login friction.
- The status page auto-refreshes and renders the report with operator name and confidence score.
- The custody chain timeline renders all events in chronological order.

---

## Phase 3 — Module 2: Geofenced Transit (Priority #3)

> **Owner:** Person 4 (backend), Person 2 (frontend)
> **Dependency:** Phase 0 complete. Migrations 001–004 applied.

---

### Task 3.1 — TransitService & GeofenceEngine

**Owner:** Person 4  
**Input:** `01_SYSTEM_DESIGN.md` §4.2 (TransitService, GeofenceEngine), APIs: `POST /transit/batches`, `POST /transit/batches/{batch_id}/ping`, `POST /transit/batches/{batch_id}/checkpoint/{checkpoint_id}/scan`  
**DB tables used:** `transit_batches`, `transit_checkpoints`, `transit_pings`, `audit_logs`

**What to build:**

**`POST /api/v1/transit/batches`** (auth: `super_admin`):
1. Accept: `{ print_job_id, center_id, assigned_driver_id, route_origin_lat, route_origin_lng }`.
2. Call the Google Maps Directions API with origin (print facility coords from env) and destination (`exam_centers.lat/lng`). Extract the encoded polyline string from the response.
3. Parse the polyline into a list of checkpoint lat/lng coordinates (use every 5th point as a named checkpoint).
4. Insert `transit_batches` row with `status = 'dispatched'`, `route_polyline = encoded_polyline_string`, `qr_seal_payload = JSON.stringify({ batch_id, center_id, driver_id, dispatched_at })`.
5. Insert `transit_checkpoints` rows for each checkpoint.
6. Write audit log: `action_type = 'batch_dispatched'`.
7. Return the batch record with the `qr_seal_payload` (driver will display this as a QR code on the box).

**`POST /api/v1/transit/batches/{batch_id}/ping`** (auth: `driver`):
1. Accept: `{ lat, lng, accuracy_meters }`.
2. Run `GeofenceEngine`:
   - Decode the route polyline using a polyline decoder library (e.g., `polyline` package).
   - For each consecutive pair of polyline points, compute the perpendicular distance from the ping point to the line segment using the haversine formula. Take the minimum distance across all segments as `deviation_meters`.
   - If `deviation_meters > 500`: `geofence_status = 'deviation'`.
   - Else, check time since the last ping where `geofence_status = 'ok'` was not stationary. If the vehicle has not moved more than 50m in the last 10 minutes: `geofence_status = 'stationary'`.
   - Else: `geofence_status = 'ok'`.
3. Insert `transit_pings` row.
4. If `geofence_status` is `'deviation'` or `'stationary'`:
   - Update `transit_batches.status = 'compromised'`, set `compromised_reason`.
   - Write audit log: `action_type = 'batch_compromised'`.
   - Emit `transit_updates` Realtime event: `{ batch_id, status: 'compromised', reason }`.
5. Else: emit `transit_updates` event with current lat/lng for map update.

**`POST /api/v1/transit/batches/{batch_id}/checkpoint/{checkpoint_id}/scan`** (auth: `driver`):
1. Validate that `checkpoint_id` belongs to `batch_id`.
2. Update `transit_checkpoints.scanned_at = NOW()`, `scanned_by = current_user_id`.
3. If all checkpoints are scanned, update `transit_batches.status = 'delivered'`, `delivered_at = NOW()`.
4. Emit `transit_updates` Realtime event.

**Expected Output:**
- Creating a batch returns a `qr_seal_payload` and pre-populated checkpoints.
- A ping with coordinates 600m off-route updates batch status to `compromised`.
- A ping with no movement for 11 minutes updates status to `compromised` with reason `stationary`.
- All status changes appear in the Realtime channel within 1 second.

---

### Task 3.2 — Transit Driver PWA (Frontend)

**Owner:** Person 2  
**Input:** `01_SYSTEM_DESIGN.md` §4.2 (TransitPWA), route `/transit/track/[batch_id]`

**What to build:**
Implement the driver-facing tracking interface at `app/transit/track/[batch_id]/page.tsx`.

1. On load, fetch the batch record: route polyline, checkpoints, current status.
2. Render a Google Maps instance. Draw the planned route polyline in blue. Render checkpoint markers.
3. Call `navigator.geolocation.watchPosition` with `enableHighAccuracy: true, maximumAge: 0`. On each position update:
   - Display the driver's current location as an animated marker.
   - Call `POST /api/v1/transit/batches/{batch_id}/ping` with current coordinates.
4. Subscribe to Supabase Realtime on channel `transit_updates`. If a `compromised` event arrives for this batch, show a full-screen red alert: "⚠️ ROUTE DEVIATION DETECTED. Contact Control Center Immediately."
5. Display a list of checkpoints with checkmark/pending icons. A "Scan Checkpoint QR" button opens the device camera for QR scanning (use `jsQR`). On scan, call the checkpoint scan API.
6. Keep the UI dead-simple: large status badge, the map, and the checkpoint list. No menus or complex navigation.
7. Add `manifest.json` and service worker for PWA installability.

**Expected Output:**
- Driver opens the URL on a phone, grants location permission, and sees their live position on the map.
- The route is drawn and checkpoints are marked.
- Simulating a GPS coordinate 600m off-route triggers the red alert screen.

---

### Task 3.3 — Admin Live Transit Map (Frontend)

**Owner:** Person 1  
**Input:** `01_SYSTEM_DESIGN.md` §4.2 (AdminLiveMap), route `/admin/transit`

**What to build:**
Implement the admin transit overview at `app/admin/transit/page.tsx`.

1. Fetch all active `transit_batches` (status not `delivered`).
2. Render a single Google Maps instance with all batches as markers. Color-code: green = `in_transit`, yellow = last ping was `stationary`, red = `compromised`.
3. Subscribe to Supabase Realtime on channel `transit_updates`. On each event, update the relevant marker's position and color without re-fetching all batches.
4. Clicking a marker shows a sidebar with: batch ID, driver name, destination center, current status, last checkpoint scanned, and last ping timestamp.
5. A "Mark as Delivered" button (admin override) calls the checkpoint scan API to complete the batch.

**Expected Output:**
- Admin sees all active batches on a live map.
- A compromised batch's marker turns red within 2 seconds of the driver pinging an off-route coordinate.

---

## Phase 4 — Module 3: Exam Center Operations (Priority #4)

> **Owner:** Person 4 (backend), Person 2 (frontend)
> **Dependency:** Phase 0 complete. Migrations 001–005 applied.

---

### Task 4.1 — AdmitCardService

**Owner:** Person 4  
**Input:** `01_SYSTEM_DESIGN.md` §5.2 (AdmitCardService), APIs: `POST /admit-cards/generate`, `POST /admit-cards/verify`  
**DB tables used:** `admit_cards`, `admit_card_scans`, `students`, `exam_enrollments`

**What to build:**

**`POST /api/v1/admit-cards/generate`** (auth: `super_admin`):
1. Accept: `{ exam_id, center_id }`.
2. Query `exam_enrollments` for all students enrolled in this exam at this center.
3. For each student, construct the JWT payload: `{ student_id, exam_id, center_id, name_hash, photo_hash, iat: now_unix, exp: exam_day_end_unix }`.
4. Sign the JWT using RS256 with the `JWT_RS256_PRIVATE_KEY` from env (load PEM via `python-jose` or `PyJWT`).
5. Hash the JWT string with SHA-256. Store the hash (not the JWT itself) in `admit_cards.jwt_payload_hash`.
6. Return all generated JWTs as a JSON array (the caller prints them as QR codes on admit cards). The JWT string is the QR payload.

**`POST /api/v1/admit-cards/verify`** (auth: `supervisor`):
1. Accept: `{ jwt_string, center_id }`.
2. Verify the JWT signature using `JWT_RS256_PUBLIC_KEY`. If invalid: return `{ is_valid: false, failure_reason: 'invalid_signature' }`.
3. Check `exp` claim: if expired: `{ is_valid: false, failure_reason: 'expired' }`.
4. Check `center_id` claim matches the supervisor's `center_id`: if mismatch: `{ is_valid: false, failure_reason: 'wrong_center' }`.
5. Look up the student record by `student_id` from the JWT payload. Return `student.full_name`, `student.roll_number`, and `student.photo_storage_path` (a Supabase Storage URL for displaying the student's photo).
6. Insert `admit_card_scans` row.
7. Return: `{ is_valid: true, student: { full_name, roll_number, photo_url } }`.

**Expected Output:**
- Generating admit cards for 50 students creates 50 JWT strings and 50 `admit_cards` rows.
- Verifying a valid JWT returns student details.
- Verifying an expired or wrong-center JWT returns `is_valid: false` with the correct `failure_reason`.

---

### Task 4.2 — Supervisor App (Frontend)

**Owner:** Person 2  
**Input:** `01_SYSTEM_DESIGN.md` §5.2 (SupervisorApp), route `/center/supervisor`

**What to build:**
Implement the mobile-optimized supervisor dashboard at `app/center/supervisor/page.tsx`.

1. A large, full-screen QR scanner component using `jsQR` or `zxing-js`. The camera feed occupies most of the screen.
2. When a QR is scanned, immediately call `POST /api/v1/admit-cards/verify` with the scanned JWT.
3. If `is_valid: true`: display a green overlay with the student photo (from `photo_url`), name, and roll number. Auto-dismiss after 2 seconds.
4. If `is_valid: false`: display a red overlay with the `failure_reason` in large text. Require manual dismissal.
5. A "Receive Paper Box" section: a QR scanner mode for scanning the box's `qr_seal_payload`. On scan, call `POST /api/v1/centers/batch-reception` with the scanned batch ID, expected count (from batch record), and physically counted copies (input field).
6. Keep interactions to single taps. No keyboard input except the copy count field.

**Expected Output:**
- Supervisor opens the page on a tablet. Camera starts immediately.
- Scanning a valid admit card QR shows the student's face and name within 1 second.
- Scanning an invalid QR shows a red screen immediately.

---

## Phase 5 — Module 4: Post-Exam OMR Ledger (Priority #5)

> **Owner:** Person 4 (backend), Person 2 (frontend)
> **Dependency:** Phase 0 complete. Migrations 001–006 applied.

---

### Task 5.1 — OMRService

**Owner:** Person 4  
**Input:** `01_SYSTEM_DESIGN.md` §6.2 (OMRService), APIs: `POST /omr/upload`, `POST /omr/verify`, `POST /omr/bulk-upload`  
**DB tables used:** `omr_records`, `omr_verifications`

**What to build:**

**`POST /api/v1/omr/upload`** (auth: `supervisor`):
1. Accept `multipart/form-data`: `file` (JPEG/PNG), `student_id` (UUID), `exam_id` (UUID).
2. Read file bytes. Compute `sha256_hash = hashlib.sha256(file_bytes).hexdigest()`.
3. Upload image to Supabase Storage at `omr-scans/{exam_id}/{student_id}.jpg`. Store the storage path.
4. Insert `omr_records` row. The `(student_id, exam_id)` unique constraint prevents duplicate uploads.
5. Return: `{ omr_record_id, sha256_hash, storage_path }`.

**`POST /api/v1/omr/verify`** (auth: `super_admin`):
1. Accept same fields as upload plus the `student_id` and `exam_id` to look up the original hash.
2. Compute hash of the re-uploaded image. Compare against `omr_records.sha256_hash`.
3. Insert `omr_verifications` row with `is_match` result.
4. Return: `{ match: bool, stored_hash, computed_hash, original_uploaded_at, original_uploaded_by }`.

**`POST /api/v1/omr/bulk-upload`** (auth: `supervisor`):
1. Accept `multipart/form-data` with multiple files and a JSON manifest: `[{ filename, student_id, exam_id }]`.
2. Return HTTP 202 with a `job_id`. Process all uploads asynchronously as a FastAPI `BackgroundTask`.
3. Log progress to an in-memory job status dict accessible via `GET /api/v1/omr/bulk-status/{job_id}`.

**Expected Output:**
- Uploading an OMR image returns a SHA-256 hash.
- Re-uploading the same image to `/verify` returns `match: true`.
- Uploading a modified (tampered) image returns `match: false`.
- Bulk upload of 40 images returns 202 immediately and completes in the background.

---

### Task 5.2 — OMR Upload UI (Frontend)

**Owner:** Person 2  
**Input:** `01_SYSTEM_DESIGN.md` §6.2 (OMRUploadUI), route `/center/omr-upload`

**What to build:**
Implement `app/center/omr-upload/page.tsx`.

1. A file input that accepts multiple images (JPEG/PNG). Show thumbnails of selected images.
2. A student ID input or dropdown (auto-populated from enrolled students for the supervisor's center and exam).
3. Progress bar showing upload and hash-registration status per image.
4. A green checkmark with timestamp appears next to each successfully registered OMR.
5. For bulk mode: use the `POST /omr/bulk-upload` endpoint. Poll `GET /omr/bulk-status/{job_id}` every 2 seconds to update the progress bar.

**Expected Output:**
- Supervisor selects 10 images, sees upload progress, and all 10 show green checkmarks when done.
- Each checkmark shows the computed hash (first 8 chars) as a visual confirmation.

---

## Phase 6 — Admin Dashboard & System Utilities

> **Owner:** Person 1  
> **Dependency:** All backend phases complete (at least stubs).

---

### Task 6.1 — Admin Dashboard

**Owner:** Person 1  
**Input:** `01_SYSTEM_DESIGN.md` §10, route `/admin`

**What to build:**
Implement `app/admin/page.tsx` as the main control center.

1. Top-row stat cards: total active exams, total papers encrypted, active transit batches, open forensic jobs.
2. Recent `vision_alerts` panel: last 10 alerts with class, confidence, and timestamp. Subscribe to Realtime for live updates.
3. Print activity panel: last 10 `print_jobs` with status badges.
4. A quick-link navigation to `/admin/exams`, `/admin/transit`, `/admin/forensic`, `/admin/audit`.

### Task 6.2 — Exam Management UI

**Owner:** Person 1  
**Input:** Routes `/admin/exams`, `/admin/exams/[exam_id]`

**What to build:**
- Exam list page: table of all exams with status badges. "Create Exam" button opens a modal with fields: title, subject, scheduled_at, duration_minutes.
- Exam detail page: tabs for (1) Paper Upload — form to upload PDF and call `POST /vault/papers`, (2) Print Authorization — two-panel form for Authority A and B to submit their shares and call `POST /vault/papers/{id}/authorize-print`, (3) Admit Card Generation — button to call `POST /admit-cards/generate`.

### Task 6.3 — Audit Log Viewer

**Owner:** Person 1  
**Input:** Route `/admin/audit`, API: `GET /audit-logs`

**What to build:**
A searchable, filterable table of audit logs. Filters: `action_type` dropdown, date range picker, `user_id` text search. Results paginated with 50 rows per page.

---

## Phase 7 — Integration Testing & Demo Prep

> **Owner:** All team members  
> **Run this after all phases are merged to `main`.**

---

### Task 7.1 — End-to-End Integration Test Script

Create a `scripts/e2e_test.sh` bash script that:
1. Creates an exam via the API.
2. Uploads a sample PDF to the vault.
3. Retrieves key shares as Authority A and B.
4. Authorizes printing.
5. Creates and completes a print job.
6. Creates a transit batch.
7. Simulates 5 GPS pings (on-route), then 1 off-route ping.
8. Verifies batch status becomes `compromised`.
9. Uploads the watermarked PDF page photo to the forensic portal.
10. Polls until the forensic report is complete.
11. Asserts the `operator_id` in the report matches the operator from Step 5.

**Expected Output:**
- Script runs without errors in under 5 minutes.
- Final assertion passes: forensic report correctly attributes the leaked page.

---

### Task 7.2 — Demo Seed Data

Create `scripts/seed_demo.py` that populates the database with:
- 3 exam centers with realistic names and lat/lng coordinates.
- 2 exams (one `active`, one `draft`).
- 50 enrolled students with realistic names and roll numbers.
- 1 user per role (`super_admin`, `authority_a`, `authority_b`, `print_operator`, `driver`, `supervisor`).
- A pre-completed transit batch with 10 GPS pings.

**Expected Output:**
- Running `python scripts/seed_demo.py` completes without errors and the admin dashboard shows populated data.

---

## Environment Variables Reference

All variables below must be present in `.env` (copy from `.env.example`).

| Variable | Used By | Description |
|---|---|---|
| `SUPABASE_URL` | Backend, Frontend | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Full DB access key (never expose to frontend) |
| `SUPABASE_ANON_KEY` | Frontend only | Public key for Supabase JS client |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Same as SUPABASE_URL, exposed to browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Same as SUPABASE_ANON_KEY, exposed to browser |
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL of FastAPI backend (e.g., `http://localhost:8000`) |
| `VAULT_MASTER_SALT` | Backend | 32-byte hex string; used for PBKDF2 key derivation for key share encryption |
| `JWT_RS256_PRIVATE_KEY` | Backend | PEM-encoded RS256 private key for admit card JWT signing |
| `JWT_RS256_PUBLIC_KEY` | Backend | PEM-encoded RS256 public key for admit card JWT verification |
| `GOOGLE_MAPS_API_KEY` | Backend, Frontend | Google Maps Directions + JS API key |
| `YOLO_MODEL_PATH` | Vision Agent | Path to YOLOv8 `.pt` model file (e.g., `./models/yolov8n.pt`) |
| `YOLO_CONFIDENCE_THRESHOLD` | Vision Agent | Float 0.0–1.0, default `0.65` |
| `PRINT_ROOM_WEBCAM_INDEX` | Vision Agent | Integer, webcam device index for print room camera |
| `AUTHORIZED_PRINTER_IDS` | Backend | Comma-separated list of allowed printer IDs |
| `INTERNAL_WORKER_API_KEY` | Backend, Workers | Shared secret for worker-to-backend internal calls |

---

## Python Package Requirements

```
# apps/backend/requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
pycryptodome==3.20.0
secretsharing==1.0.0      # or implement manually
pymupdf==1.24.0            # PyMuPDF / fitz
qrcode[pil]==7.4.2
supabase==2.4.0
python-jose[cryptography]==3.3.0
slowapi==0.1.9
polyline==2.0.0
haversine==2.8.1
httpx==0.27.0

# workers/vision_agent/requirements.txt
ultralytics==8.2.0
opencv-python==4.9.0.80
numpy==1.26.4

# workers/forensic_worker/requirements.txt
opencv-python==4.9.0.80
easyocr==1.7.1
pyzbar==0.1.9
pylibdmtx==0.1.10
numpy==1.26.4
supabase==2.4.0
```

---

## Node.js Package Requirements

```json
{
  "dependencies": {
    "next": "14.2.3",
    "@supabase/supabase-js": "^2.43.4",
    "@supabase/ssr": "^0.3.0",
    "pdfjs-dist": "^4.2.67",
    "jsqr": "^1.4.0",
    "qrcode": "^1.5.3",
    "@types/google.maps": "^3.55.5"
  }
}
```

---

## Critical Constraints for All Agents

1. **No raw AES keys or Shamir shares are ever written to disk or stored in the database in plaintext.** If your code touches a key outside of in-memory scope, it is a security violation.
2. **All API responses follow the envelope format:** `{ "success": bool, "data": obj|null, "error": obj|null }`. Any deviation breaks the frontend contract.
3. **All DB column names, TypeScript interface keys, and Pydantic field names must match the Appendix Glossary in `02_DATABASE_DESIGN.md` exactly.** Mismatches between team members will cause merge failures.
4. **Realtime channels have fixed names:** `print_room`, `transit_updates`, `vision_alerts`, `forensic_jobs`. Use these exact strings.
5. **Auth roles are enforced at two layers:** FastAPI dependency (`require_X()`) AND Supabase RLS. Both must be in place. A missing FastAPI dependency is a security gap.
6. **The vision agent never stores raw frames to Supabase Storage unless a detection fires.** Continuous video is never retained.
7. **All Supabase Storage bucket names are fixed:** `encrypted-papers`, `omr-scans`, `vision-alerts`, `forensic-uploads`. Create these buckets in Supabase before running migrations.
