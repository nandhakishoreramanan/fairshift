# FairShift – Decent Work Platform

> **Prompt Wars 2026 × SRM ACM Student Chapter**  
> **Theme:** UN SDG 8 – Decent Work and Economic Growth  
> **Target Industries:** Construction Infrastructure & Higher Education / Colleges

[![Tests](https://img.shields.io/badge/tests-16%20passed-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Platform](https://img.shields.io/badge/deploy-Google%20Cloud%20Run-blue.svg)]()
[![SDG 8](https://img.shields.io/badge/UN%20SDG-8%20Decent%20Work-emerald.svg)]()

---

## 1. The Problem Statement & Context

Many employee-intensive organisations—such as construction contractors, colleges/schools, hospitals, and factories—manage large, vulnerable workforces through fragmented paper registers, manual spreadsheets, and ad-hoc WhatsApp groups.

### For Workers:
* **Opaque Pay Calculations:** Daily wage workers and contracted campus staff rarely receive transparent salary itemisations or overtime calculations.
* **Fear of Retaliation:** Workers hesitate to report safety violations or mistreatment because solitary anonymous reports are easily traced or ignored.
* **Unreported Hazards:** Critical job-site safety concerns go unaddressed until serious injuries occur.
* **Lost Career Equity:** Valuable skills, site inductions, and training are never formally credited or portable when moving to a new employer.
* **Language & Literacy Barriers:** Workers speak regional languages, may have low textual literacy, and operate entry-level smartphones.

### For Employers:
* **Workforce Blindspots:** No proactive visibility into employee burnout, dangerous fatigue accumulation, or impending attrition.
* **Delayed Escalations:** Critical grievances reach management only after work stops or accidents happen.

---

## 2. Our Solution: FairShift

**FairShift** is a dual-interface decent work platform built for high-touch, employee-intensive organisations. It gives frontline workers an accessible, icon-first, voice-enabled companion, while giving employers actionable operational insights and real-time fatigue safety radar.

### Core Modules & Features

| Feature | Worker Interface (`/worker.html`) | Employer / Admin Dashboard (`/admin.html`) |
| :--- | :--- | :--- |
| **1. Attendance & Shift Tracking** | Check-in via rotating 6-digit site kiosk code or GPS geofence; automatic calculation of regular & overtime hours. | Live gate kiosk QR generator with rolling HMAC PINs to prevent buddy-punching; live attendance trends. |
| **2. Transparent Multilingual Payslip** | Visual bar chart of daily hours + itemised breakdown (regular, 2× overtime, food/travel allowance, PF, ESI) translated into native language. | Real-time payroll breakdown with statutory compliance audit checks. |
| **3. Collective "Me Too" Grievance System** | Voice-first or icon-based hazard reporting + 1-tap "Me Too" backing for workplace peers in their own language. | Grouped issue inbox ranked by worker count (e.g. *"Loose scaffold: 15 workers backing"*); status updater with translated notes. |
| **4. Multilingual Audio Contract Readout** | Workers can listen to new contracts or workplace policy changes spoken aloud in **English, Hindi, Tamil, Telugu, or Bengali** with *"I understood"* / *"I have a doubt"* acknowledgment. | Notice publisher with automated translation into 5 regional languages and tracking of worker doubts for HR follow-up. |
| **5. Portable Skill Passport** | Permanent cryptographic digital record of certified trades, safety inductions, and experience with verifiable public QR link (`/passport.html`). | One-click verified credential issuance to workers for skills training or tenure milestones. |
| **6. Fatigue & Attrition Safety Radar** | Early warnings: excessive weekly hours (>60h), back-to-back shifts (<10h rest), and 7+ consecutive days. | Operational fatigue alerts board + explainable attrition risk score (0–100) based on attendance velocity and workload. |

---

## 3. Unique Feature Deep Dives

### A. The Collective "Me Too" Hazard & Grievance Engine
Solitary anonymous complaints are easy to ignore or blame on a scapegoat. **A hazard backed by 15 workers cannot be ignored, and no individual is singled out.**

```
[ Worker 1 ] ──> Reports "No drinking water at Block C" (by voice/text in Tamil)
                       │
                       ▼ (Translated to Tamil, Hindi, Telugu, Bengali, English)
[ Workplace Feed ] ──> Peers see issue + 1-tap large "✋ Me too" button (Zero typing/literacy barrier)
                       │
                       ▼ (HMAC-SHA256 Tokenization: token = HMAC(anonSecret, workerId:issueId))
[ Database ] ────────> Stored strictly as supportCount + anonymous token list. ZERO worker IDs stored!
                       │
                       ▼
[ Employer Admin ] ──> Sees consolidated card: "No drinking water at Block C: 15 workers backing"
                       │
                       ▼ Admin updates status to "In Progress" with note "Water tanker dispatched"
[ Every Supporter ] ─> Receives real-time status update translated into their respective native language
```

#### Cryptographic Privacy Guarantee:
* Tokens are deterministic per `(workerId, issueId)` to enforce idempotent voting without double-counting.
* Tokens are unique per issue; votes cannot be joined across issues to profile an individual worker.
* Timestamps are coarsened to the hour so report times cannot be cross-referenced with attendance badge-ins.
* **Grievance submissions are strictly excluded from attrition risk algorithms**, ensuring whistleblowers are never flagged as flight risks.

### B. Multilingual Audio Contract & Policy Readout
When administration issues a new employment contract or safety mandate, frontline employees do not need to struggle with complex legal text:
* One-click **"🔊 Listen"** synthesizes the document in native regional phonetics (**Hindi, Tamil, Telugu, Bengali, or English**).
* Uses high-quality Web Speech API on modern devices and falls back gracefully to Google Cloud Text-to-Speech API on basic mobile devices.
* Workers tap **"👍 I understood"** or **"❓ I have a doubt"** so site supervisors know immediately who needs verbal orientation.

---

## 4. Cross-Industry Application (2+ Distinct Sectors)

FairShift is architected to operate seamlessly across fundamentally different workforce environments:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     FAIRSHIFT PLATFORM                                 │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴─────────────────────────┐
           ▼                                                  ▼
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│  INDUSTRY 1: CONSTRUCTION SITES     │    │  INDUSTRY 2: COLLEGES & SCHOOLS     │
│  (e.g., BuildRight Infrastructure)  │    │  (e.g., Sunrise Arts & Science)     │
├─────────────────────────────────────┤    ├─────────────────────────────────────┤
│ • Pay Model: Daily wages + 2× OT    │    │ • Pay Model: Monthly contracted pay │
│ • Workforce: Migrant masons, bar    │    │ • Workforce: Guest lecturers, lab   │
│   benders, electricians, helpers    │    │   assistants, housekeeping staff    │
│ • Primary Hazards: Loose scaffold,  │    │ • Primary Hazards: Unpaid exam      │
│   water shortages, PPE absence      │    │   invigilation, expired lab gear    │
│ • Check-in: Rotating QR at gate     │    │ • Check-in: Geofenced campus code   │
│ • Passport: CSDCI trade certificates│    │ • Passport: UGC-NET & FDP training  │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
```

---

## 5. Technology Stack & Architecture

* **Runtime:** Node.js 20+ (zero bloat, lightweight Alpine container).
* **Server Framework:** Express.js with clean modular services and repositories.
* **Frontend:** Vanilla modern HTML5, CSS custom properties (responsive, accessible, high-contrast, WCAG AA compliant), Web Speech Synthesis & Recognition APIs.
* **Offline & PWA:** Service Worker (`sw.js`) with static asset caching and Web App Manifest for low-bandwidth 2G/3G networks.
* **Cloud Platform:** Google Cloud Run (containerised stateless deployment behind Google Frontend proxy).
* **Security & Auth:** HMAC-SHA256 session claims, scrypt password hashing, CSP security headers, IP rate limiting, zero exposed secrets.
* **Repository Size:** Under **400 KB** (well within the strict 10 MB hackathon cap).

---

## 6. Verification & Automated Test Suite

FairShift includes 16 comprehensive unit and integration tests verifying every business-critical layer:

```bash
npm test
```

### Verified Test Areas:
1. `test/auth.test.js`: Session token signing, tampering rejection, expiration, and scrypt PIN verification.
2. `test/anon.test.js`: Cryptographic anonymity, un-joinable tokens, and coarse timestamp privacy.
3. `test/hours.test.js`: Daily work hour summation and 2× overtime threshold calculation.
4. `test/fatigue.test.js`: Flags for weekly limit (>60h), long shifts (>12h), short rest (<10h), and consecutive work days (>6d).
5. `test/payroll.test.js`: Daily wage formulas, monthly pro-rata salary, PF (12%), and ESI (0.75%).
6. `test/risk.test.js`: Attrition risk score calculation and verification that complaints do not pollute flight risk.
7. `test/checkin.test.js`: Rotating 6-digit TOTP kiosk codes with clock skew tolerance and GPS geofence mathematics.
8. `test/api.test.js`: End-to-end integration covering worker check-in, collective "Me Too" voting, admin issue escalation, and contract publication.

---

## 7. Deployment Instructions for Google Cloud Run

FairShift is built to deploy to Google Cloud Run in a single command without third-party platform lock-in.

### Option A: Direct gcloud Build & Deploy (Recommended)
```bash
# 1. Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Build & Deploy to Google Cloud Run
gcloud run deploy fairshift \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

### Option B: Docker Container Run
```bash
docker build -t fairshift .
docker run -p 8080:8080 -e NODE_ENV=production fairshift
```

Once deployed, Google Cloud Run provisions an `https://...run.app` endpoint with automatic SSL certificates and autoscaling.

---

## 8. Demo Credentials

### Worker Logins (PIN: `1234`)
* **Construction (BuildRight Infra):**
  * `W1001` – Murugan S (Mason, Tamil)
  * `W1002` – Ramesh Yadav (Helper, Hindi)
  * `W1003` – Shilpi Das (Bar Bender, Bengali)
  * `W1004` – Venkat Rao (Electrician, Telugu)
* **College Campus (Sunrise College):**
  * `W2001` – Lakshmi Priya (Guest Lecturer, Tamil)
  * `W2002` – Sunita Devi (Housekeeping, Hindi)
  * `W2003` – Anil Kumar (Lab Assistant, Telugu)

### Employer / Admin Logins (PIN: `9999`)
* `A-BUILD` – Priya Menon (HR, BuildRight Infra Pvt Ltd)
* `A-COLLEGE` – Dr. K. Raman (Registrar, Sunrise Arts & Science College)

---

## 9. Structured LinkedIn Submission Post

As specified in the Prompt Wars guidelines, copy and adapt the following structured text for your public LinkedIn submission post:

```text
🚀 Excited to present FairShift: A Decent Work Platform for Employee-Intensive Organisations!

Built for Prompt Wars 2026 by ACM Student Chapter, SRMIST under the theme of UN SDG 8 (Decent Work and Economic Growth).

📌 Step 1: The Problem
Millions of frontline workers on construction sites, college campuses, and factories are managed through paper registers, spreadsheets, and informal WhatsApp groups. Workers face opaque pay deductions, fear of retaliation when raising safety hazards, language barriers, and a lack of portable career history. Employers suffer from blind spots regarding workforce fatigue and silent attrition.

📌 Step 2: Solution Fit
FairShift bridges this divide through two tailored interfaces:
1. For Workers: An icon-first, voice-enabled mobile web app with 1-tap attendance, transparent payslips explained in regional languages (Tamil, Hindi, Telugu, Bengali), an audio contract reader, a portable Skill Passport, and a game-changing collective "Me Too" grievance mechanism where peer backing escalates safety hazards without exposing individual worker identities.
2. For Employers: An actionable workforce health dashboard with fatigue alerts (excessive hours, short rest, back-to-back shifts), attrition risk radar, rotating QR gate check-in, and notice broadcast with automated translation.
We validated FairShift across two distinct sectors: Construction (daily-wage shift work with double overtime) and Higher Education (contract faculty & campus support staff).

📌 Step 3: Our Build
• Architecture: Node.js 20, Express, PWA Service Worker for low-connectivity environments.
• Cryptography: HMAC-SHA256 anonymous supporter tokens protecting whistleblower privacy.
• Accessibility: High contrast, WCAG AA compliant, Web Speech voice synthesis and dictation.
• Cloud Deployment: Deployed on Google Cloud Run container infrastructure.
• Verified with 16 automated unit & integration tests, with a repo size strictly under 400 KB!

Check out our code and live demo:
🔗 GitHub: https://github.com/YOUR_USERNAME/fairshift.git
🌐 Live Cloud Run: https://YOUR_DEPLOYED_URL.run.app

#PromptWars #ACMSrmist #GoogleForDevelopers #Hack2Skill #SDG8 #DecentWork #CloudRun #WebDevelopment #AI
```

---

## 10. License

FairShift is open source under the [MIT License](LICENSE).
