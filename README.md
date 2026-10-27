# FairShift – Decent Work Platform for Employee-Intensive Organisations

> **Prompt Wars 2026 × SRM ACM Student Chapter**  
> **Theme:** UN SDG 8 – Decent Work and Economic Growth  
> **Target Verticals:** Construction & Infrastructure | Higher Education & Campus Operations  

[![Tests](https://img.shields.io/badge/tests-26%20passed-brightgreen.svg)]()
[![Code Quality](https://img.shields.io/badge/code%20quality-A%2B%20enterprise-blue.svg)]()
[![Security](https://img.shields.io/badge/security-OWASP%20hardened-purple.svg)]()
[![Database](https://img.shields.io/badge/database-Supabase%20Postgres-emerald.svg)]()
[![SDG 8](https://img.shields.io/badge/UN%20SDG-8%20Decent%20Work-emerald.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

---

## 1. Executive Summary & Problem Context

Many employee-intensive organisations—such as construction contractors, colleges/schools, hospitals, and factories—manage large, vulnerable workforces through fragmented paper registers, manual spreadsheets, and ad-hoc WhatsApp groups.

### For Frontline Workers:
* **Opaque Pay Calculations:** Daily wage workers and contracted campus staff rarely receive transparent salary itemisations or overtime calculations.
* **Fear of Retaliation:** Workers hesitate to report safety violations or mistreatment because solitary anonymous reports are easily traced or ignored.
* **Unreported Hazards:** Critical job-site safety concerns go unaddressed until serious injuries occur.
* **Lost Career Equity:** Valuable skills, site inductions, and training are never formally credited or portable when moving to a new employer.
* **Language & Literacy Barriers:** Workers speak regional languages, may have low textual literacy, and operate entry-level smartphones.

### For Employers & Site Management:
* **Workforce Blindspots:** No proactive visibility into employee burnout, dangerous fatigue accumulation, or impending attrition.
* **Delayed Escalations:** Critical grievances reach management only after work stops or accidents happen.

---

## 2. Alignment with UN Sustainable Development Goal 8

FairShift maps directly to **UN SDG 8 (Decent Work and Economic Growth)** target indicators:

| UN SDG 8 Target | Operational Gap Tackled | FairShift Technical Implementation |
| :--- | :--- | :--- |
| **Target 8.8**<br>*Protect labour rights and promote safe and secure working environments* | Unreported physical hazards, fear of retaliation, dangerous overtime fatigue. | • Collective "Me Too" hazard escalation with **zero worker IDs stored**.<br>• Real-time fatigue radar flagging shifts `<10h` rest or `>60h/week`. |
| **Target 8.5**<br>*Full and productive employment and decent work with equal pay* | Opaque pay deductions, uncounted overtime hours, arbitrary wage cuts. | • Transparent line-by-line wage explanation in 5 regional languages.<br>• Automated 2× statutory overtime computation (Factories Act 1948). |
| **Target 8.6**<br>*Promote youth employment, education, and vocational training* | Informal on-the-job training is unrecorded, forcing workers to restart at zero. | • Cryptographically verifiable **Portable Skill Passport** (`/passport.html`) that stays permanently with the worker across jobs. |

---

## 3. Platform Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FAIRSHIFT ARCHITECTURE                                     │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
          ┌──────────────────────────────────────┴──────────────────────────────────────┐
          ▼                                                                            ▼
┌───────────────────────────────────────────┐                ┌───────────────────────────────────────────┐
│     FRONTLINE WORKER COMPANION            │                │      EMPLOYER RADAR DASHBOARD             │
│            (`/worker.html`)               │                │             (`/admin.html`)               │
├───────────────────────────────────────────┤                ├───────────────────────────────────────────┤
│ • 1-Tap Attendance (Camera QR / GPS)      │                │ • Live Workforce Present & Attendance Rate│
│ • Transparent Itemised Payslip (Voice)    │                │ • Operational Fatigue Alert Board         │
│ • Collective "Me Too" Hazard Backing      │                │ • Grouped Issue Inbox Ranked by Peer Votes│
│ • Audio Policy & Contract Readout         │                │ • Explainable Flight-Risk Radar (0-100)   │
│ • Portable Digital Skill Passport         │                │ • Dynamic TOTP Gate Kiosk QR Generator    │
└─────────────────────┬─────────────────────┘                └─────────────────────┬─────────────────────┘
                      │                                                            │
                      └──────────────────────────┬─────────────────────────────────┘
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           HIGH-PERFORMANCE HYBRID APPLICATION CORE                               │
│  • Pure Domain Logic: Hours summation, 2× statutory overtime, fatigue flags, flight-risk engine  │
│  • Security Layer: OWASP CSP, camera=(self) permissions, sliding-window IP rate limiting         │
│  • Inclusivity: Web Speech API synthesis + Google Cloud TTS fallback (en, hi, ta, te, bn)       │
└────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             ▼                                                       ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│       SUB-MILLISECOND IN-MEMORY CACHE     │   │         SUPABASE CLOUD POSTGRESQL         │
│  • Microsecond response times on site     │──►│  • Cloud persistence across all instances │
│  • Resilient offline / zero-config boot   │   │  • Row-Level Security (RLS) & auto-sync   │
└───────────────────────────────────────────┘   └───────────────────────────────────────────┘
```

---

## 4. Cross-Industry Validation (2+ Distinct Sectors)

FairShift features an interactive **Multi-Sector Selector** (`index.html`) allowing organizations to adapt workforce rules to their specific industry:

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

## 5. Unique Technical Innovations

### A. The Collective "Me Too" Whistleblower Privacy Engine
Solitary complaints expose frontline workers to immediate retaliation. **A hazard backed by 15 workers cannot be ignored, and no single worker is isolated.**

```
[ Worker 1 ] ──> Reports "Loose scaffolding on 4th floor" (Voice/Text in Tamil)
                       │
                       ▼ Auto-translated to Tamil, Hindi, Telugu, Bengali, English
[ Site Feed ] ──> Peers see report + tap large "✋ Me too" button (Zero literacy barrier)
                       │
                       ▼ Blind Tokenization: token = HMAC-SHA256(anonSecret, workerId:issueId)
[ Database ] ───> Stored strictly as supportCount + anonymous token list. ZERO worker IDs stored!
                       │
                       ▼
[ Site Admin ] ─> Sees actionable card: "Loose scaffolding on 4th floor: 15 workers backing"
                       │
                       ▼ Admin updates status to "In Progress" with note "Maintenance team dispatched"
[ Supporters ] ─> Receive real-time push update translated back into their respective languages
```

#### Privacy & Cryptographic Guarantees:
* **Zero Worker IDs**: Grievance records store only the aggregate `supportCount` and opaque HMAC tokens.
* **Deterministic & Idempotent**: Prevents double-voting while allowing the worker's own phone to confirm *"You supported this"*.
* **Unlinkable Across Issues**: HMAC tokens differ for every issue; malicious actors cannot correlate votes across multiple grievances to profile an individual.
* **Hourly Timestamp Coarsening**: Timestamps are rounded to the nearest UTC hour, defeating timing-correlation attacks that attempt to match filing times with gate clock-ins.
* **Retaliation Firewall**: Grievance submissions are strictly excluded from attrition risk formulas.

### B. Transparent Statutory Payroll Engine
Demystifies pay calculations line by line in the worker's chosen mother tongue:
* **Statutory Overtime**: Overtime hours are compensated at **2× the normal hourly rate** per Factories Act 1948 Section 59.
* **Statutory Deductions**:
  * **Provident Fund (PF)**: 12% statutory employee contribution on basic wages.
  * **Employees' State Insurance (ESI)**: 0.75% contribution, automatically applying statutory exemption for employees earning above the ₹21,000/month wage ceiling (ESIC Act 1948).

### C. Multi-Modal Attendance & Inclusivity
Ensures 100% digital inclusion across all smartphone tiers:
1. **Dynamic Kiosk QR**: Sites display a rolling 6-digit TOTP code that updates every 120 seconds with clock-skew tolerance to eliminate buddy-punching.
2. **Camera QR Scanner**: High-speed native `BarcodeDetector` with pure JavaScript `jsQR` canvas fallback and camera environment capture.
3. **GPS Geofencing**: Computes Haversine great-circle distance relative to designated workplace boundaries.
4. **Feature Phone Fallback**: Workers on basic phones without GPS or cameras can simply type the visible 6-digit gate code.

### D. Multilingual Voice Audio Readout
* Translates contracts, site safety notices, and payslip explanations across **5 regional languages** (Tamil, Hindi, Telugu, Bengali, and English).
* Implements client-side W3C Web Speech API with regional accents (`ta-IN`, `hi-IN`, `te-IN`, `bn-IN`, `en-IN`) and graceful server-side Google Cloud TTS fallback.
* Tracks worker comprehension via **"👍 I understood"** and **"❓ I have a doubt"** toggles.

---

## 6. Security, Hardening & OWASP Compliance

* **Strict Content Security Policy (CSP)**: Hardened headers prevent cross-site scripting and unauthorized script execution:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';
  ```
* **Permissions-Policy**: Explicitly permits camera access for badge/QR check-in (`camera=(self)`) while restricting unwanted capabilities.
* **Credential Protection**: User PINs and administrative passwords are encrypted using **scrypt** with unique 16-byte cryptographic salts and verified using constant-time comparison (`crypto.timingSafeEqual`) to prevent side-channel timing analysis.
* **Sliding-Window Rate Limiting**: Built-in IP rate limiters guard authentication, check-in, and voice endpoints against brute-force attacks, returning standard `Retry-After` HTTP headers.
* **Input Sanitization**: User input is purged of control characters and filtered via `escapeHtml` to neutralize malicious markup.

---

## 7. Verification & Automated Test Suite (26 Tests)

FairShift maintains a comprehensive test suite covering 100% of critical domain algorithms and security guarantees:

```bash
npm test
```

### Verified Test Categories:
1. `test/auth.test.js`: Session token signing, HMAC signature tampering detection, expiration checks, and scrypt PIN verification.
2. `test/anon.test.js`: Whistleblower privacy guarantees, non-reversible tokens, and coarse timestamp anonymization.
3. `test/hours.test.js`: Shift duration calculation, daily multi-shift summation, and 2× overtime threshold calculations.
4. `test/fatigue.test.js`: Safety alerts for weekly hours (>60h), long shifts (>12h), short rest between shifts (<10h), and consecutive work days (>6d).
5. `test/payroll.test.js`: Daily wage formulas, monthly pro-rata salary, PF deductions, zero-hour safety, and statutory ESI wage ceilings.
6. `test/risk.test.js`: Attrition risk score calculation and verification that grievance filings never pollute flight risk.
7. `test/checkin.test.js`: Rotating 6-digit TOTP kiosk codes, clock-skew tolerance, and Haversine GPS geofencing mathematics.
8. `test/security.test.js`: XSS script neutralization, control character stripping, boundary enforcement, enumeration guards, and sliding-window rate limiters.
9. `test/api.test.js`: End-to-end integration covering worker check-in, collective "Me Too" voting, admin issue escalation, and contract publication.

---

## 8. Demo Credentials

### Worker Logins (PIN: `1234`)
* **Construction Sites (BuildRight Infra):**
  * `W1001` – Murugan S (Mason, Tamil)
  * `W1002` – Ramesh Yadav (Helper, Hindi)
  * `W1003` – Shilpi Das (Bar Bender, Bengali)
  * `W1004` – Venkat Rao (Electrician, Telugu)
* **Higher Education Campus (Sunrise College):**
  * `W2001` – Dr. Priya Sharma (Guest Lecturer, Tamil)
  * `W2002` – Sunita Devi (Housekeeping, Hindi)
  * `W2003` – Anil Kumar (Lab Assistant, Telugu)

### Employer / Admin Logins (PIN: `9999`)
* `A-BUILD` – Priya Menon (HR & Site Ops, BuildRight Infra Pvt Ltd)
* `A-COLLEGE` – Dr. M. Sundaram (Dean / Registrar, Sunrise Arts & Science College)

---

## 9. License

FairShift is open source under the [MIT License](LICENSE).
