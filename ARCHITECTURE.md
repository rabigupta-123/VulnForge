# CyberGuardian AI — System Architecture & Data Flow

This document details the architectural design, data pipelines, multi-tenant security boundaries, and scanning worker subsystems of **CyberGuardian AI**.

---

## 1. High-Level Data Flow

```
[User Browser]
      │ (HTTPS REST / SSE Logs)
      ▼
[FastAPI Server] ──► [Structured Logging & Log Redaction]
      │
      ├──► Auth & JWT Validation (org_id Scoping)
      ├──► Audit Logger (app.models.audit)
      │
      ▼
[Celery Background Task Queue] (Redis Broker)
      │
      ├──► Passive Scanners (DNS, SSLyze, SecurityHeaders, Wappalyzer, Robots)
      ├──► Active Scanners (Nmap, OWASP ZAP, DirBuster, Subfinder)
      └──► Strix AI Agent Engine (usestrix/strix)
                 │
                 ▼ (LLM Reasoning & PoC Verification)
           [OpenAI / Anthropic / Gemini API]
```

---

## 2. Multi-Tenant Organization Isolation (`org_id`)

Every core model in CyberGuardian AI belongs to an Organization workspace boundary:

- `User.org_id` ──► `Organization.id`
- `Asset.org_id` ──► `Organization.id`
- `Scan` ──► `Asset` (Gated by `Asset.org_id == current_user.org_id`)
- `Finding` ──► `Scan` (Gated by scan ownership)
- `BountyProgram.org_id` ──► `Organization.id`

All API endpoints enforce `org_id` alignment at the database query level to guarantee zero cross-tenant data leaks.

---

## 3. Strix AI Integration Subsystem

```
[execute_scan_job Task]
       │
       ▼ (Check scan_mode == 'strix' AND asset.verification_status == 'verified')
[run_strix_scan Service]
       │
       ├──► Popen Subprocess (`strix -n -t target --scan-mode quick --max-budget 10`)
       ├──► Live Output Streamer ──► emit_scan_log() ──► Redis Pub/Sub ──► UI Terminal
       ├──► Wall-Clock Timeout Monitor (STRIX_TIMEOUT_SECONDS)
       │
       ▼ (Process Exit / Timeout)
[Report Parser] ──► Reads vulnerabilities.json & findings.sarif
       │
       ▼
[Finding Ingestion]
       ├── Sets verified_by_poc: bool (True only if PoC confirmed)
       ├── Adds [Unverified Finding - Lower Confidence] prefix if PoC absent
       └── Tags code patch with [HUMAN REVIEW REQUIRED]
```

---

## 4. Audit Trail & Security Logs

Immutable audit records are created for all mutating operations:
- `asset.created`
- `asset.verified`
- `scan.triggered`
- `finding.status_updated`
- `user.role_changed`
