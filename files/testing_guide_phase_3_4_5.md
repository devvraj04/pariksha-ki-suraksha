# Testing Guide - Phases 3, 4, and 5

This guide provides step-by-step instructions to verify and test the features implemented in **Phase 3 (Exam Definition & Lifecycle)**, **Phase 4 (Student Registrations & Payments)**, and **Phase 5 (Center Allocation & Admit Cards)**.

---

## 1. Prerequisites & Setup
Ensure both servers are running locally.
*   **FastAPI Backend**: `uvicorn main:app --reload` on port `8000` (within `apps/api`)
*   **Next.js Frontend**: `npm run dev` on port `3000` (within `apps/web`)
*   **Active Tenant (Agency)**: A registered, active agency (e.g. `examboard` or `national-testing-agency`).

---

## 2. Phase 3 Testing Flow (Exam Specifications & Lifecycle)

### A. Create an Examination Definition
1. Login to the Agency Portal as an `agency_head` or `manager` at `http://[agency-slug].localhost:3000/login`.
2. Navigate to **Examinations** on the sidebar menu or header, and click the **[New Examination]** button.
3. **Step 1 (Basic Info)**: Enter details:
   * **Exam Name**: `Engineering Eligibility Test 2026`
   * **Slug**: `eet-2026`
   * **Mode**: `OFFLINE`
   * **Seat Ceiling**: `10`
   * **Schedule**: Set to a date/time in the near future (e.g. tomorrow).
   * **Registration Fee**: `500` INR.
   * Click **Create Exam & Next**.
4. **Step 2 (Eligibility)**: Define rules (Min Age: `18`, Max Age: `30`, Qualification: `Any Graduate`). Click **Save & Next**.
5. **Step 3 (Syllabus)**: Input test topics text (e.g. "Physics, Chemistry, Mathematics, Aptitude"). Click **Save & Next**.
6. **Step 4 (Centers & Rooms)**:
   * **Center Name**: `Delhi Test Hub`
   * **Center Code**: `DEL-01`
   * **City**: `New Delhi`
   * Add a room: Code `Room-1`, Capacity `5`. Click **[Add Room]**.
   * Click **[Save & Register Center]**.
   * *Repeat for a second center*: `Mumbai Test Hub`, Code `MUM-01`, City `Mumbai`, Room `Room-A`, Capacity `5`. Click **[Save & Register Center]**.
   * Click **Save & Continue to Review**.
7. **Step 5 (Review)**: Review the configuration values. You should see "AI Brochure Compilation: Brochure generated & signed".
8. Click **Go to Exam Workspace**.

### B. Promote Exam Lifecycle States
1. In the **Exam Workspace** header, click **[Publish Exam Specs]**. Status will transition to `PUBLISHED`.
2. In the header, click **[Open Registration Roster]**. Status will transition to `REGISTRATION_OPEN`.

---

## 3. Phase 4 Testing Flow (Student Registration & Payment)

### A. Candidate Account Creation
1. Open a new window or clear your session, and navigate to `http://localhost:3000/student/register`.
2. Enter personal details (Name, email, dob, address, password).
3. Under **Live Biometric Face Capture**:
   * Click **[Open Webcam]** to use your webcam, align your face in the target guidelines, and click **Capture Photo**.
   * Or upload a profile picture file.
4. Upload any dummy ID card scan file, input a dummy ID number, and click **Register & Set Up Account**.
5. Verify redirection to `http://localhost:3000/student/login` occurs after successful registration.

### B. Exam Discovery & Registration
1. Login to the candidate console using the newly created student account.
2. In the dashboard under **Open Upcoming Examinations**, find the `Engineering Eligibility Test 2026` card.
3. Click **[Register Now]**.
4. Rank the 3 center preferences (e.g. Preference 1: `Delhi Test Hub`, Preference 2: `Mumbai Test Hub`).
5. Click **Submit & Proceed to Payment**.

### C. Simulated Checkout Payment
1. On the payment checkout screen, verify the exam fee details and application number preview.
2. Click the **Simulate payment (Dev Bypass)** button.
3. Verify the screen transitions to "Payment Successful" displaying your sequential application number (format: `LG-2026-0000X`).
4. Click **Back to Candidate Dashboard** and verify the exam card status reads `CONFIRMED ROLLED`.

---

## 4. Phase 5 Testing Flow (Allocation & Admit Cards)

### A. Close Registration & Run Seating Allocation
1. Log back in as `agency_head` at the agency console, and open the `Engineering Eligibility Test 2026` workspace.
2. Click **[Force Close Registration]** in the header. The status changes to `REGISTRATION_CLOSED`.
3. Open the **Center Allocation** tab.
4. Click **Run Center Allocation**.
5. Verify the progress indicator polls until completion, and showcases allocation tables matching preferences. Verify any fallback coordinates use nearest Haversine geodistances.

### B. Issue Admit Cards
1. From the center allocation tab success banner, click the **Generate & Issue Admit Cards** button.
2. Verify progress polls until completion, after which the exam status automatically transitions to `ADMIT_CARDS_ISSUED`.

### C. Download Secured Admit Card
1. Log back into the Candidate Dashboard.
2. Locate the registered exam card. The status should now show `Admit Card Ready` or offer a **Download Admit Card** action.
3. Click the download button, and verify the styled PDF embeds successfully in the secure viewer, carrying instructions, test center details, and a biometric-embedded QR code.
