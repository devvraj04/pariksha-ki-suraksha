# I am creating a app which would work on the exam security in India the brief idea in my mind currently is agency come on this portal and register it through the head of agency and this would create a new route agency dot portal the name of the portal would be decided at and so keep it blank for now I will tell you the name of the portal at last after registering the head of agency can add staff members managers operators transit managers etc this all this edition would lead to creation of new accounts for that particular agency on our app now that after the required permission the staff or the head of the agency can create exam for that particular agency for that they need to make the complete registration form they need to mention date time centre cost for that exam the mode of that exam and the eligibility criteria for that exam upon receiving all such information the use of AI that is generated AI will create an information brochure for that particular exam this exam would be listed as exam dot agency name dot portal name are the managers and the agency members can view the students registered for this exam can also allocate centre randomly on a click of a button based on the priority given by the students also generate the student admit card all this with the secure jwt tokens and proper encryptions if the mode of the exam is online the paper will be stored on the spot till and will be accessible only at a particular centre it at the particular time of the exam upon entering the student details at the centre itself they should be with proper highest level of security if the paper is offline the paper would be stored on the portal then it would be sent to the printing press then would be carried to the centre and the approval will be required by the centre officer upon receiving the correct set of papers that is secure papers do this with highest level of security again also on the day of exam there would be a portal which would be monitoring the student entrance the student identity verification and any other type of one day verification required now after the exam this portal will be used for uploading the answer key the answer key would be encrypted in the secure format it would be scored by an AI agent based on the scanning it would give a score between 0 to 10 on how visible the actual question answer paper is for this the dependency should be on centre UID and student UID after all the papers are uploaded with the visibility greater than 9 or 8 agency gets to add corrections that is the teachers that would correct the paper that would lead to new creation of ID for teachers they would be given access to only specific papers they need to correct and upon completing their correction they should send a formal confirmation to the agency so that their access would be restricted now store the marks given by the corrections in the proper database with student id and UID and also the correction are ID the correction should be multilevel that is the normal teacher then a moderator then the chief moderator now there should be an option anonymous leak reporting where anyone can come to this exam portal and report any kind of leak or any kind of mis happening around the exam

# Now comes the student portal where student comes to the examination portal he can see all the exams and all the registered agencies can fill the registration form can see the information brochure and everything upon filling the entire registration form and paying the cost of the exam is registered for the exam once the agency declares the admit cards the student can download it upon logging into this student portal student will give the exam on the decided day and time upon the agency and the exam will able to see the result on this portal the result would be requiring student UID mobile number captcha to see the result also student would be able to report through his login that is report any kind of grievance in the answer sheet or the question paper or any kind of leak this would be a more detailed report as it is directly linked to the student id and not an anonymous and this would be treated on a priority basis these are all of my ideas something I am missing is the security while transit I want you to write this idea in a proper detailed way don't miss out on any point you can break this as the student portal and the agency portal connect everything properly and write Idea and such detailed that nothing is missed

# 

# **Comprehensive Blueprint: LeakGuard AI & Examination Management Portal**

**Tagline:** *See Something. Secure Something. Securing the entire exam lifecycle from vault to evaluation.*

## **1\. System Architecture & Portal Infrastructure**

The platform operates on a multi-tenant framework powered by a core multi-agent AI security system.

* **Frontend:** Next.js, Tailwind CSS (Multi-portal routing: \[agency\].portal.com)  
* **Backend & DB:** FastAPI, Supabase (PostgreSQL, Storage)  
* **AI/Security Engine:** LangGraph/CrewAI, YOLOv8, OpenCV, AES-256

### **1.1 The Agency Portal (Command Center)**

* **Onboarding:** Agencies register, creating hierarchical roles (Managers, Transit Officers, Grading Staff).  
* **Exam Creation & Center Setup:** Form builders capture exam requirements (date, mode, cost). Crucially, the agency adds a vetted **List of Centers**. For each center, the agency must define the infrastructure: Number of rooms, unique Room IDs, and the exact seating capacity per room.  
* **GenAI Automation:** Automatically generates Information Brochures, syllabus guidelines, and rules.  
* **Center Allocation:** AI randomly allocates the *Exam Center* to students based on priority preferences given during registration. (Specific rooms are left unassigned until the day of the exam).  
* **Live Command Center:** A master dashboard for the Agency Head providing real-time telemetry, live CCTV feeds from all active exam centers, and instant AI anomaly alerts.

### **1.2 The Student Portal (Candidate Interface)**

* **Global Dashboard:** Students view all agency exams, read brochures, and register/pay.  
* **Secure Admit Cards:** Generates dynamically with JWT (JSON Web Tokens) and cryptographic QR codes containing a secure hash of the student's biometric/identity profile.  
* **Result Access:** Multi-factor lock requiring Student UID \+ Mobile OTP \+ Captcha.

## **2\. PHASE 1: Pre-Exam (Creation, Vault & Transit)**

*This phase replaces human trust with cryptographic trust.*

### **2.1 Agent 1: Secure Question Vault**

* **Split-Key Encryption:** Papers are stored with AES-256. The full key is only compiled in server RAM at the exact scheduled micro-window.  
* **Secure Viewing Environment:** If an authorized professor opens a paper, the system automatically engages webcam, screen recording, and clipboard blocking. A computer vision agent watches for mobile phones pointed at the screen.

### **2.2 Agents 2, 3 & 4: Intelligent Printing & Watermarking**

* **The Print Interceptor:** A custom print middleware tracks Operator ID, Machine MAC address, and requested copy count. If an operator requests 550 copies when the center budget is 500, the print is killed. Anomalous print times (e.g., 2 AM) instantly lock the terminal.  
* **Dynamic Smart Watermarking:** Every printed page receives a low-visibility Tracking Matrix Code. If a leaked paper is photographed, scanning this code reveals: \[Center Code\] | \[Printer ID\] | \[Operator ID\] | \[Exact Timestamp\].  
* **Printing Surveillance:** YOLOv8 cameras in the print room detect unauthorized phones or extra pages being stuffed into pockets.

### **2.3 Agents 5 & 6: Chain-of-Custody & Tamper Transit**

* **IoT Smart Trunks:** Printed papers are sealed in GPS-enabled trunks with mechanical digital locks.  
* **Geofenced Transit:** The portal tracks the transit vehicle. Deviations flag the batch as "Compromised".  
* **Multi-Factor Handoff:** Unlocking the trunk at the destination requires the GPS coordinate to match the Exam Center, plus an OTP and Biometric scan from the Center Officer.

## **3\. PHASE 2: During Exam (Execution & Proctoring)**

*Ensuring the person taking the test is the registered candidate and tracking their exact location.*

### **3.1 D-Day Portal Verification & Randomized Seating**

* **Biometric Proxy Prevention:** At the center entrance, the candidate's live face is matched against the secure hash embedded in their JWT admit card QR code.  
* **Randomized Room Allocation & Binding:** Upon successful biometric verification, the system checks the pre-configured center infrastructure and **randomly** allocates an available Room ID to the student. This completely blocks pre-planned seating manipulation. This random Room ID is instantly and securely bound to the Student UID in the database.  
* **Live Room Mapping & Capacity:** The center staff portal displays an interactive, real-time map of all exam rooms. This dashboard updates instantly as students check-in, tracking total capacity versus current available seating to ensure no room exceeds its defined limit.

### **3.2 Offline & Online Physical Center Surveillance**

* **YOLOv8 Edge Surveillance:** Standard webcams in the hall run lightweight AI to detect forbidden objects (phones, earpieces) or anomalous behaviors (mass head-turning).  
* **Live Agency Streaming:** The camera feeds are securely streamed to the Agency Portal, allowing the Agency Head and designated managers to view live CCTV footage of any center or specific room during the examination window.

### **3.3 Online Mode (CBT Exam) Security**

* **Just-in-Time Decryption:** Papers remain encrypted on local servers until the exact start minute, unlocked only when the student enters their credentials.  
* **Sandbox Defense:** Disables clipboard, restricts tab switching, and uses system-level keylog listeners to detect non-human, machine-like typing speeds (blocking AI browser extensions).

## **4\. PHASE 3: Post-Exam (Evaluation & Result Integrity)**

*A highly secure, digitized process for evaluating student papers.*

### **4.1 Secure Upload & AI Visibility Check**

* **Encrypted Upload:** Post-exam, center operators scan and upload answer sheets securely to the portal.  
* **AI Visibility Scoring (0-10):** An AI agent immediately scans the uploaded PDFs. If the visibility score is \>8, it is approved for the evaluation phase. If it is below 8, the portal instantly alerts the center operator to rescan the paper to ensure legibility before physical sealing.

### **4.2 Anonymized Multi-Tier Evaluation**

* **Data Masking:** Papers are stripped of student names. They are mapped strictly using dependencies on Center UID and Student UID.  
* **Segmented Access:** Teachers are given access *only* to their specifically allotted batch of papers.  
* **The 3-Tier Checking Process:**  
  1. *Normal Teacher:* Conducts the primary evaluation.  
  2. *Moderator:* Cross-checks a percentage of papers or highly scored papers.  
  3. *Chief Moderator:* Final authority for discrepancy resolution.  
* **Lock-in Mechanism:** Once a teacher formally confirms completion on the portal, their access to those papers is permanently revoked.  
* **Database Schema:** Marks are stored securely mapped to: \[Student ID\] \+ \[Center UID\] \+ \[Evaluator/Correction ID\].

## **5\. PHASE 4: Leak Investigation & Community Reporting**

### **5.1 Agent 7: Leak Attribution**

* If a photo of a paper surfaces on social media, the image is uploaded to the portal. Agent 7 reverse-engineers the smart watermark, cross-references vault access logs, print room CCTV, and transit logs to generate a **Leak Source Probability Report** (e.g., *Printing Operator: 89%, Transport Officer: 11%*).

### **5.2 Agent 8: Integrity Network (Whistleblower & Grievance Portal)**

* **Anonymous Public Portal:** Allows citizens, press staff, or teachers to upload photos or report bribery anonymously. The AI assigns a risk score and routes it to the audit team.  
* **Priority Student Grievance (With Automated Evidence):** \* Inside their secure login, students can report center-specific issues (e.g., cheating by peers, faulty PC, misprinted paper).  
  * **Smart CCTV Attachment:** Because the report is tied to their authenticated Student UID (which was randomly bound to a specific Room ID during check-in), the system automatically identifies their exact location and timestamp. It then automatically pulls and attaches the relevant CCTV footage of that specific room to the generated grievance ticket.  
  * These become immediate, highly contextualized High-Priority tickets for the Chief Exam Manager, drastically reducing investigation time.