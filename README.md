# 🛡️ ParikshaSetu — Exam Security & Integrity System

ParikshaSetu is a secure, anti-leak examination lifecycle management platform designed for national testing agencies (such as the National Testing Agency - NTA). The platform addresses security vulnerability vectors across the entire examination lifecycle—from secure question paper vaulting and geofenced transit to biometric-locked candidate gate check-ins, multi-tier evaluator grading, and automated watermark-based leak forensics.

---

## 🏗️ Architecture & Technology Stack

ParikshaSetu is built as a monorepo consisting of:
- **Frontend (`apps/web`):** Next.js 14 (App Router) styled with Vanilla CSS and Tailwind CSS, utilizing Lucide Icons for clean micro-animations.
- **Backend API (`apps/api`):** FastAPI (Python) serving a RESTful API with cryptographically signed tokens, geofence validations, and rate-limiting.
- **Background Processing (`apps/api/workers`):** Celery tasks running on Redis for asynchronous operations (e.g., biometric face checksum processing, PDF report compiling, result declaration notifications).
- **Database & Identity:** Supabase PostgreSQL with built-in Row-Level Security (RLS) policies enforcing agency-scoped and student-scoped data isolation.

---

## 📋 Prerequisites

Before setting up the project locally, ensure you have:
1. **Node.js:** v18+ and `npm` installed.
2. **Python:** v3.10+ installed.
3. **Redis Server:** Running locally (default `redis://localhost:6379/0`) for task queuing and OTP storage.
4. **PostgreSQL/Supabase:** A running PostgreSQL instance (or local/cloud Supabase environment).

---

## ⚡ Quick Start & Setup

### 1. Database Initialization
1. Ensure your database connection parameters are available.
2. The database schema is structured into sequential migrations under `infra/supabase/migrations/` (from `000_platform_admins.sql` to `035_invite_token_and_security_upgrades.sql`).
3. To wipe, construct, and seed all 33+ tables with full lifecycle demo data in one step, open the Supabase SQL Editor and run the contents of:
   * **[prune_and_seed.sql](file:///c:/Users/Devraj/Desktop/ParikshaSetu/prune_and_seed.sql)**

### 2. Backend API Setup (`apps/api`)
1. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r apps/api/requirements.txt
   ```
3. Create a `.env` file in the root workspace (`c:/Users/Devraj/Desktop/ParikshaSetu/.env`):
   ```env
   DATABASE_URL=your_postgresql_connection_string
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_jwt_secret
   REDIS_URL=redis://localhost:6379/0
   STUDENT_ID_ENCRYPTION_KEY=32_byte_base64_encryption_key
   ```
4. Start the FastAPI development server:
   ```bash
   venv\Scripts\uvicorn apps.api.main:app --reload --port 8000
   ```

### 3. Frontend Setup (`apps/web`)
1. Navigate to the frontend workspace.
2. Install Node packages:
   ```bash
   npm install
   ```
3. Configure environmental variables. Create `apps/web/.env`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

---

## 🎬 Application Portal Walkthrough

The platform isolates interfaces based on system roles (Admins, Agency Staff, Center Officers, Candidates, and the Public):

### 1. Public Portal & Landing Page (`/`)
- **Public Landing:** Explains system security protocols, audit logs, and allows access to open exam registrations.
- **Leak / Whistleblower Desk (`/report`):** Public gateway to report suspected paper leaks, upload evidence, or submit whistleblowing alerts anonymously.
- **Results Gateway (`/results`):** Public results lookup. Candidates can view their scorecard after verification by verifying a 6-digit OTP sent to their registered mobile number.

### 2. Platform Admin Console (`/admin`)
- **Dashboard:** Platform configuration, registration approval for new Testing Agencies (e.g., NTA), and global security monitoring.
- **Security Audit Logs:** Immutable log tracker monitoring database activity, vault accesses, geofence breaches, and print allocations.

### 3. Testing Agency Portal (`/agency/[agency-slug]`)
- **Exam Management:** Agency heads and managers create examinations, manage registration deadlines, set seat limits, and specify eligibility criteria.
- **Vault Operations (`/vault`):** Vault operators securely upload encrypted question papers. Access tokens and key shares are split between the main Vault and HSM keys.
- **Admit Card Generator:** Automatically generates admit cards embedded with encrypted, JWT-signed QR codes containing biometric facial checksums.
- **Watermark Registry & Printing:** Monitors center-specific print requests. The system embeds cryptographically calculated watermarks onto print jobs (e.g., tracing page counts, printer IDs, and operator details).
- **Transit Control Room:** Live GPS geofencing dashboard tracking geofenced transit trunks from central vaults to regional hubs, raising instant visual warnings if trucks deviate from routes.
- **Results Compiler:** Compiles results, generates scorecards, and publishes them after chief moderator evaluation approvals.

### 4. Exam Center Portal (`/center`)
- **Biometric Gate Check-In:** Center officers scan candidate admit cards. The portal verifies the encrypted QR codes and checks the student's live face snapshot against the registered face biometric checksum to flag mismatches.
- **Room Allocations:** Automatically assigns checked-in candidates to specific rooms and seat numbers.
- **Print Room Console:** Custom interface for printing physical test papers locally on exam day under camera surveillance.

### 5. Candidate Console (`/student`)
- **Dashboard:** Lists registered examinations, registration statuses (e.g., fee payment, check-in, appeared), and upcoming exams.
- **Exam Registration:** Form for candidates to select center preferences and upload ID proofs.
- **Payment Gateway:** Mock checkout interface completing registration.
- **Admit Card Downloader:** Download generated admit cards containing cryptographically verifiable details.
- **Scorecard Viewer (`/student/exams/[examSlug]/result`):** If results are declared, candidates click **"View Results"** to view their detailed scorecard, featuring:
  - **AIR & Category Rank:** Candidate ranks.
  - **Marks Breakdown:** Marks scored out of 300 across Mathematics, Physics, and Chemistry.
  - **Pass/Fail Badge:** Displays `QUALIFIED` or `NOT QUALIFIED`.
- **Grievance Desk:** File evaluation grievances or attach CCTV footage requests for review by agency moderators.

### 6. Forensic Leak Intelligence (`/agency/[agency-slug]/leaks`)
- **Watermark Extraction:** If a leaked photo of a question paper is uploaded, the forensic service analyzes hidden pixel watermarks. It decodes center codes, printer IDs, operator identifiers, and printing timestamps to isolate the leak source.

---

## 🔑 Demo Access Credentials

The SQL database seed (`prune_and_seed.sql`) pre-populates the environment with the following credentials (all passwords are `AdminPassword123`):

| Role | Portal / Path | Email / Username |
| --- | --- | --- |
| **Platform Admin** | `/admin` | `admin@parikshasetu.in` |
| **Agency Head (NTA)** | `/agency/national-testing-agency` | `hod@nta.in` |
| **Agency Staff (Manager)** | `/agency/national-testing-agency` | `staff1@nta.in` ... `staff4@nta.in` |
| **Agency Staff (Operator)** | `/agency/national-testing-agency` | `staff5@nta.in` ... `staff9@nta.in` |
| **Center Officer (Delhi)** | `/center` | `staff18@nta.in` (Center Code: `JEE-DEL-01`) |
| **Candidate 1 (JEE Result)**| `/student` | `student1@gmail.com` |
| **Candidate 51 (UGC NET)** | `/student` | `student51@gmail.com` |
