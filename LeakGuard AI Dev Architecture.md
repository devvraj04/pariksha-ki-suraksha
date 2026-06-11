# **🛡️ LeakGuard AI: Developer Architecture & MVP Blueprint**

**Target:** FAR AWAY Hackathon 2026 (Themes: Examinations, Agentic & Autonomous Systems)

**Core Philosophy:** Build a real, working prototype. No fake demos. High technical depth.

## **📌 Executive Context for Developer Agent**

**Developer Agent Directive:** You are tasked with building the MVP for *LeakGuard AI*. Current examination security systems only focus on the 3 hours students sit in the hall. **Our system secures the entire supply chain.** Do not build "just another cheating detector." We are building a cryptographic, AI-driven supply chain monitor. Your focus must be on **Engineering Quality** and **Execution**. Implement real encryption, actual middleware, and functional computer vision scripts.

## **🏗️ Macro Architecture & End-to-End Flow**

\[1. Vault: Shamir's Key Assembly\]   
            │ (Decrypts paper ONLY in RAM during print window)  
            ▼  
\[2. Print Interceptor: Tracking Matrix\]   
            │ (YOLOv8 monitors print room; Watermarks every page)  
            ▼  
\[3. Transit: Geofenced Custody\]   
            │ (QR Tamper Seals \+ GPS Route Deviation tracking)  
            ▼  
\[4. Center Verification: Cryptographic QR\]   
            │ (Live YOLOv8 room proctorship \+ identity hash matching)  
            ▼  
\[5. Post-Exam: Edge OMR Digitalization\]   
            │ (Visual Hash Registry to prevent transit tampering)  
            ▼  
\[6. Forensic Analysis & Crowd Reporting\]   
            │ (OCR \+ Watermark decoding for leak attribution)

## **📦 Module 1: Pre-Exam Lifecycle Management (The Vault & Printing)**

**Context:** 90% of massive leaks happen here. Humans should never interact with a raw PDF. We need to control the digital file and the physical printing process.

### **Feature 1.1: Cryptographic Secure Question Vault (Agent 1\)**

* **Description:** A zero-download, encrypted storage vault. The paper is encrypted using AES-256. The decryption key is split (Shamir's Secret Sharing) between two authorities. It only compiles in the server's RAM at the exact minute printing is authorized.  
* **Requirements:**  
  * **Backend:** FastAPI. Implement Shamir's Secret Sharing algorithm for key splitting.  
  * **Frontend:** Next.js. Create a protected canvas element for viewing (disable right-click, Ctrl+P, screenshot listeners).  
  * **Monitoring:** Hook into browser APIs to detect screen sharing or tab switching.  
* **Interconnectedness:** Triggers the print authorization window for Feature 1.2. Sends all access logs to the Forensic Agent (Module 5).  
* **🏆 Hackathon Judging Focus (Technical Depth):** Do not fake the encryption. Actually implement AES-256-GCM and a real key-splitting logic in the backend.

### **Feature 1.2: Printing Press Interceptor & Watermarking (Agents 2, 3 & 4\)**

* **Description:** A custom server middleware that intercepts the print command. It ensures only the allocated number of copies are printed, injects a hidden tracker, and uses a webcam to watch the print operator.  
* **Requirements:**  
  * **Middleware:** Python/FastAPI script acting as a print spooler interceptor.  
  * **Watermarking:** Use PyMuPDF or ReportLab to dynamically inject a micro-QR or Tracking Matrix Code into the footer of *every single page* before it hits the printer (\[PrinterID|OperatorID|Timestamp|CenterID\]).  
  * **Vision (Agent 4):** A local YOLOv8 script connected to a webcam that flags if a mobile phone is detected in the printing room.  
* **Interconnectedness:** Pulls allocation data from the central DB. Feeds printed batch IDs into the Transit Module (Module 2).  
* **🏆 Hackathon Judging Focus (Real-World Impact):** This is the "wow" factor. Show a live demo where attempting to print outside the scheduled window automatically kills the print job.

## **🚚 Module 2: Logistical Custody & Transit (The Supply Chain)**

**Context:** Once printed, physical boxes are often tampered with during transport to exam centers.

### **Feature 2.1: Geofenced Chain-of-Custody (Agents 5 & 6\)**

* **Description:** A mobile-first tracker for paper transit. Every physical box has a QR seal. Handlers must scan the QR at designated GPS checkpoints.  
* **Requirements:**  
  * **Frontend:** Next.js PWA utilizing the Web Geolocation API.  
  * **Backend:** Supabase real-time DB.  
  * **Logic:** Geofencing algorithm. If the transport device deviates from the Google Maps polyline route by \>500 meters, or stops for \>10 mins, flag the batch as "COMPROMISED".  
* **Interconnectedness:** Receives batch IDs from Module 1\. Passes custody to Module 3 (Exam Centers).  
* **🏆 Hackathon Judging Focus (Scalability & Execution):** Ensure the UI is dead-simple for truck drivers. Use Supabase real-time subscriptions to show a live-tracking map on the admin dashboard.

## **🏫 Module 3: Exam Center Operations**

**Context:** Preventing proxy cheating (impersonation) and physical exam hall cheating.

### **Feature 3.1: Cryptographic Admit Cards & Edge Proctorship**

* **Description:** Replaces standard admit cards with cryptographically signed QR codes to prevent forgery. Uses standard webcams for hall monitoring.  
* **Requirements:**  
  * **Identity Hash:** Admit card QR codes should contain a JWT or cryptographic hash containing student details, signed by the server's private key.  
  * **Vision:** YOLOv8 edge deployment to detect smartphones or earpieces in the exam hall.  
* **Interconnectedness:** Verifies the physical boxes received from Module 2 match the expected candidate count.  
* **🏆 Hackathon Judging Focus (Design & UX):** Make the QR scanning instantaneous. The supervisor app must be lightning fast.

## **🖨️ Module 4: Post-Exam Immutable Ledger**

**Context:** Answer sheets are often altered or swapped while being transported from the exam center to the grading facility.

### **Feature 4.1: Edge OMR Digitalization**

* **Description:** The moment the exam ends, local supervisors scan the OMR sheets. The system generates a visual cryptographic hash of the image and uploads it immediately.  
* **Requirements:**  
  * **Backend Processing:** Python script to generate a SHA-256 hash of the scanned image file.  
  * **Storage:** Supabase Storage.  
* **Interconnectedness:** Creates an immutable state. If the physical paper is altered later, its new hash won't match the database.  
* **🏆 Hackathon Judging Focus (Engineering Quality):** Build a robust API endpoint that can handle bulk image uploads rapidly without crashing.

## **🕵️ Module 5: Forensic Intelligence & Community Reporting**

**Context:** If a leak *does* happen (e.g., a photo on Telegram), we need to find the exact source in seconds, not months. We also need a whistleblower portal.

### **Feature 5.1: Integrity Network & Leak Attribution (Agents 7 & 8\)**

* **Description:** An anonymous portal for the public to upload suspected leak photos. The AI scans the photo, extracts the hidden Tracking Matrix, and pinpoints exactly who leaked it.  
* **Requirements:**  
  * **Frontend:** Anonymous Next.js upload portal ("See Something. Secure Something.").  
  * **Processing Engine:** EasyOCR / OpenCV pipeline. It must straighten the uploaded image, enhance contrast, and read the Tracking Matrix injected in Module 1\.  
* **Interconnectedness:** Queries the DB logs from Module 1 and 2 to generate a "Leak Source Probability Report" (e.g., *Operator John Doe: 98% probability of leak*).  
* **🏆 Hackathon Judging Focus (Innovation):** The ability to take a blurry photo of a leaked paper, run it through your system, and instantly output the name of the printer who leaked it is a guaranteed winning feature.

## **📊 MVP Priority Matrix & Build Order**

To win the hackathon, we must prioritize technical depth and execution. **Do not try to build everything perfectly.** Focus on the core USP: Supply Chain Security.

| Priority | Module | Reason for Score | Score (1-10) |
| :---- | :---- | :---- | :---- |
| **\#1** | **Mod 1: Vault & Print Interceptor** | **10/10** | This is the core innovation. If you only build this and Module 5, you have a winning project. It proves high engineering quality (cryptography \+ middleware \+ CV). |
| **\#2** | **Mod 5: Forensic Leak Attribution** | **9.5/10** | Closes the loop. Showing the judges how you catch a leak using OCR and watermarks demonstrates massive real-world impact. |
| **\#3** | **Mod 2: Geofenced Transit** | **8/10** | Highly visual for the demo (live map tracking). Easy to implement with Supabase and adds a layer of "logistics" (hitting another hackathon theme). |
| **\#4** | **Mod 3: Cryptographic Admit Cards** | **6/10** | Good to have, but QR scanners are common. Implement basic functionality, but don't spend too much time here. |
| **\#5** | **Mod 4: OMR Edge Digitalization** | **5/10** | Conceptually strong, but hard to demo effectively on stage without a physical scanner. Mock this if running out of time. |

**Final Note to Developer Agent:** Follow the FAR AWAY rule: *"The goal is not to write every line of code yourself. The goal is to build something meaningful."* Use open-source YOLO models, leverage Supabase for quick backend scaling, and focus your custom code on the **middleware** and the **cryptographic key handling**. Ensure the GitHub repo is clean and well-documented.