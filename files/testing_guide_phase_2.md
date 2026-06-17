# ParikshaSetu AI — Phase 2 Testing Guide

This guide describes how to thoroughly test and verify **Phase 2 (Agency Onboarding & Staff Management)** of the ParikshaSetu platform.

---

## 1. Prerequisites & Host Configurations

Make sure the following subdomains are added to your OS hosts file to enable dynamic subdomain routing locally.

### Windows Hosts File Configuration
1. Open PowerShell or Command Prompt as **Administrator**.
2. Open the hosts file:
   ```cmd
   notepad C:\Windows\System32\drivers\etc\hosts
   ```
3. Ensure the following subdomains are appended:
   ```text
   127.0.0.1    parikshasetu.localhost
   127.0.0.1    admin.localhost
   127.0.0.1    agency1.localhost
   127.0.0.1    examboard.localhost
   ```
4. Save and close.

---

## 2. Running the Servers
Start both the backend FastAPI server and the Next.js frontend server.

### Start Backend API
```bash
uvicorn apps.api.main:app --reload --port 8000
```
*   API Docs: `http://localhost:8000/api/docs`

### Start Celery Workers (Windows Mode)
Because you are running on Windows, execute Celery with the `-P solo` pool flag to prevent multiprocess permission exceptions:
```bash
celery -A apps.api.workers.celery_app.celery_app worker --loglevel=info -P solo
```

### Start Frontend Application
```bash
cd apps/web
npm run dev
```
*   App Address: `http://localhost:3000`

---

## 3. End-to-End Onboarding & Testing Flow

Follow these sequential steps to verify the onboarding lifecycle:

### Step A: Agency Registration
1. Navigate to: `http://parikshasetu.localhost:3000/agency/register`
2. Fill out the form with sample information:
   *   **Organization Name**: `Exam Board`
   *   **Official Email**: `head@examboard.com`
   *   **PAN**: `ABCDE1234F`
   *   **Phone**: `9876543210`
   *   Other fields: Address, City, State, etc.
3. Submit the registration. You should see a successful submission screen detailing the audit event logging: `AGENCY_REGISTRATION_REQUESTED`.

### Step B: Administrative Approval
1. Navigate to the Admin console: `http://admin.localhost:3000/login`
2. Log in using the bypass credentials:
   *   **Email**: `admin@parikshasetu.in`
   *   **Secret Token**: `AdminPassword123`
3. Click on the **Agencies** tab.
4. Locate the pending entry for `Exam Board`. Click on it to expand details in the slide-over panel, and click **Approve**.
5. Inspect the backend terminal logs. You should see:
   *   The agency head user gets provisioned in Supabase Auth.
   *   The Celery worker logs print out:
     `[Celery] Sending welcome email to Exam Board (head@examboard.com) for agency <uuid>`
     `[Celery] Sending invitation email to Exam Board Head (head@examboard.com). Setup Link: http://examboard.localhost:3000/accept-invite?token=<token>`

### Step C: Password Setting & Profile Activation
1. Copy the setup link from the Celery console output:
   `http://examboard.localhost:3000/accept-invite?token=<token>`
2. Navigate to it in your web browser.
3. Type in a new password and confirm it (e.g. `AgencyPassword123`), then submit.
4. Verify the user details are updated in the database `joined_at` column and the auth password is set. Click **Proceed to Login** which takes you to:
   `http://examboard.localhost:3000/login`

### Step D: Subdomain Workspace Login
1. On `http://examboard.localhost:3000/login`, type:
   *   **Staff Email**: `head@examboard.com`
   *   **Workspace Password**: `AgencyPassword123`
2. Submit the form.
3. You will be redirected to the secure **Workspace Dashboard** at `http://examboard.localhost:3000/dashboard`.
4. Verification checklist:
   *   The dashboard lists the organization metrics.
   *   The sidebar displays `EXAMBOARDSETU` and your user details (`head@examboard.com` with role `agency_head`).
   *   Try clicking the **Edit Profile** button on the dashboard. Change the phone number or address and save. Confirm the updates persist on reload.

### Step E: Staff Invitation
1. Click **Staff Hierarchy** in the sidebar.
2. Click **Invite Staff** to open the operational registry form.
3. Input details for a manager:
   *   **Full Name**: `Sarah Manager`
   *   **Email**: `sarah@examboard.com`
   *   **Phone**: `9876500000`
   *   **Security Role**: `Manager`
4. Click **Send Invitation**.
5. Copy the generated onboarding setup link from the success banner, open it in the browser, set a password, and verify the record is added to the roster grid.

### Step F: Access Suspension & Deactivation Check
1. Logged in as `head@examboard.com`, navigate to the **Staff Hierarchy** grid.
2. Click the **Suspend** (ban/lock) button next to `Sarah Manager`.
3. In the database, check that `is_active` becomes `false` in `agency_staff`.
4. Inspect Celery worker logs. It should output:
   `[Celery] Sending deactivation notification to Sarah Manager (sarah@examboard.com). Access has been suspended.`
5. Try to log in as `sarah@examboard.com` at `http://examboard.localhost:3000/login`. The console should refuse authentication with a message:
   *   `Your staff account is currently deactivated. Please contact your administrator.`
6. Click **Activate** (shield check) in the staff console as `agency_head` to restore Sarah's access and verify login succeeds again.
