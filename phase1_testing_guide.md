# 🧪 Phase 1 — Complete Testing Guide
### Pariksha-ki-Suraksha (LeakGuard AI)

> **Before you start:** Both servers must be running.
> - Terminal 1 → Backend is running: `uvicorn main:app --reload --port 8000`
> - Terminal 2 → Frontend is running: `npm run dev`

---

## 🟢 PART 1 — Check That Everything Is Online

### Step 1 — Test the Backend Health

1. Open your browser
2. Go to: **http://localhost:8000/api/v1/system/health**
3. ✅ You should see something like:
   ```json
   { "success": true, "data": { "status": "ok" } }
   ```
4. If you see this → backend is working ✅

---

### Step 2 — Open the API Docs (Swagger UI)

1. Open your browser
2. Go to: **http://localhost:8000/docs**
3. ✅ You should see a full list of all API routes
4. This is your testing playground for all backend features

---

### Step 3 — Check the Frontend

1. Open your browser
2. Go to: **http://localhost:3000**
3. ✅ You should see the login page / landing page of the app

---

## 🔐 PART 2 — Test Login (Supabase Auth)

### Step 4 — Log In as Super Admin

1. Go to **http://localhost:3000/auth/login**
2. Enter the Super Admin email and password (the one you created in Supabase)
3. Click **Sign In**
4. ✅ You should be redirected to the dashboard / print-room page

> **If login fails:** Go to your Supabase project → Authentication → Users
> and confirm the user exists and is confirmed.

---

## 📦 PART 3 — Test the Vault (Paper Upload & Encryption)

> These tests use the **Swagger UI** at http://localhost:8000/docs
> You need a Super Admin JWT token. Here's how to get one:

### Step 5 — Get Your Auth Token

1. In the frontend, open browser Developer Tools (press **F12**)
2. Go to the **Application** tab → **Local Storage** → `http://localhost:3000`
3. Look for a key that contains `access_token`
4. Copy the token value (it's a long string starting with `eyJ...`)

---

### Step 6 — Authorize in Swagger

1. Go to **http://localhost:8000/docs**
2. Click the **Authorize 🔒** button (top right)
3. In the field, type: `Bearer <paste your token here>`
4. Click **Authorize**, then **Close**

---

### Step 7 — Upload a Question Paper (PDF Encryption Test)

1. In Swagger, find: **POST /api/v1/vault/papers**
2. Click **Try it out**
3. Fill in:
   - `file`: Click **Choose File** → select any `.pdf` file from your computer
   - `exam_id`: Enter a valid exam UUID from your Supabase `exams` table
   - `title`: Type anything like `"Test Paper Math 2025"`
4. Click **Execute**
5. ✅ Expected response (HTTP 201):
   ```json
   {
     "success": true,
     "data": {
       "paper_id": "some-uuid-here",
       "title": "Test Paper Math 2025",
       ...
     }
   }
   ```
6. ❌ If you get 404 → the exam_id doesn't exist in your database
7. ❌ If you get 400 → the file is not a PDF

---

### Step 8 — Verify Paper Is Stored

1. Go to your **Supabase Dashboard** → **Table Editor** → `papers` table
2. ✅ You should see a new row with your paper title and `status = "locked"`

---

## 🗝️ PART 4 — Test Key Shares (Shamir Secret Sharing)

### Step 9 — Get a Key Share as Authority A

1. In Swagger, find: **GET /api/v1/vault/key-shares/{share_id}**
2. Click **Try it out**
3. Enter the `share_id` from the Supabase `key_shares` table (created during paper upload)
4. Click **Execute**
5. ✅ Expected response: a `share_value` hex string
6. ❌ If you get 403 → your logged-in user is not `authority_a` role
7. ❌ If you get 409 (`ERR_SHARE_ALREADY_USED`) → share was already retrieved once

---

## 🖨️ PART 5 — Test Print Authorization

### Step 10 — Authorize a Print Session

1. In Swagger, find: **POST /api/v1/vault/papers/{paper_id}/authorize-print**
2. Click **Try it out**
3. Enter the `paper_id` from Step 7
4. In the request body, fill:
   ```json
   {
     "share_a": "<hex string from Step 9 as Authority A>",
     "share_b": "<hex string from Authority B>",
     "authorized_copies": 30,
     "authorized_centers": ["<center-uuid>"],
     "print_window_minutes": 60
   }
   ```
5. Click **Execute**
6. ✅ Expected response: a session object with `session_id`
7. ❌ If you get 400 with `ERR_DECRYPTION_FAILED` → the shares are wrong

---

## 📄 PART 6 — Test Print Jobs

### Step 11 — Create a Print Job

1. In Swagger, find: **POST /api/v1/print/jobs**
2. Click **Try it out**
3. Fill in:
   ```json
   {
     "paper_id": "<paper_id from Step 7>",
     "session_id": "<session_id from Step 10>",
     "center_id": "<center-uuid>",
     "printer_id": "printer_001",
     "copies_requested": 5
   }
   ```
4. Click **Execute**
5. ✅ Expected response (HTTP 201): job created with `status: "queued"`
6. ❌ If you get 410 (`ERR_SESSION_EXPIRED`) → re-run Step 10 to get a fresh session

---

### Step 12 — Abort a Print Job

1. In Swagger, find: **POST /api/v1/print/jobs/{job_id}/abort**
2. Click **Try it out**
3. Enter the `job_id` from Step 11
4. In the request body:
   ```json
   { "reason": "Testing abort functionality" }
   ```
5. Click **Execute**
6. ✅ Expected response:
   ```json
   { "success": true, "data": { "message": "Print job successfully aborted." } }
   ```

---

## 🌐 PART 7 — Test the Frontend UI

### Step 13 — View the Print Room Dashboard

1. Log in as a Print Operator at **http://localhost:3000/auth/login**
2. After login, go to **http://localhost:3000/print-room**
3. ✅ You should see the print room dashboard with job queue

---

### Step 14 — Test Token-Protected PDF View

1. In Swagger, find: **GET /api/v1/vault/papers/{paper_id}/view-token**
2. Enter the `paper_id`, click Execute
3. Copy the `token` from the response
4. Open a new browser tab and go to:
   ```
   http://localhost:8000/api/v1/vault/papers/<paper_id>/view?token=<paste token here>
   ```
5. ✅ The PDF should open inline in the browser
6. ❌ Reload the same URL again → you should get a 403 (token is single-use!)

---

## ✅ QUICK CHECKLIST — What "Pass" Looks Like

| # | What You're Testing | Expected Result |
|---|---------------------|-----------------|
| 1 | Backend health | HTTP 200, `status: ok` |
| 2 | Swagger docs load | Full route list visible |
| 3 | Frontend loads | Login page appears |
| 4 | Login | Redirected to dashboard |
| 5 | Upload PDF | HTTP 201, paper_id returned |
| 6 | Paper in DB | New row in `papers` table |
| 7 | Get key share | `share_value` returned |
| 8 | Second get same share | HTTP 409 ERR_SHARE_ALREADY_USED |
| 9 | Authorize print | Session ID returned |
| 10 | Create print job | HTTP 201, job queued |
| 11 | Abort print job | Success message returned |
| 12 | View token (PDF) | PDF opens in browser |
| 13 | Reuse view token | HTTP 403 Forbidden |

---

## ❗ Common Problems & Fixes

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` | Your token expired — log in again and get a fresh token |
| `403 Forbidden` | Your user doesn't have the right role (super_admin / authority_a etc.) |
| `404 Not Found` on exam_id | Create an exam record in Supabase first |
| `ERR_DECRYPTION_FAILED` | Wrong key shares — make sure you use both Share A and Share B |
| Frontend shows blank page | Check browser console (F12) for errors |
| Backend crashes | Check the terminal where uvicorn is running for the error message |

---

> 💡 **Tip:** Keep the Supabase Dashboard open at https://supabase.com/dashboard while testing.
> Watch the tables update in real time as you call APIs.
