"""
AI explanation task — reads raw findings and asks the LLM to explain them,
grounded in the actual finding data (not free generation).
Drop into: backend/app/workers/ai_tasks.py
"""

from celery import shared_task
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.scan import Finding, Scan
from app.core.config import settings
import requests  # or your preferred Gemini/OpenAI SDK


EXPLANATION_PROMPT_TEMPLATE = """You are a senior security consultant explaining a scan finding to a developer.

Finding category: {category}
Severity: {severity}
Title: {title}
Raw data: {raw_output}

Explain, grounded ONLY in the data above (do not invent details not present here):
1. What this is, in plain English
2. Why it matters / real-world impact
3. Estimated CVSS severity
4. OWASP Top 10 mapping if applicable
5. MITRE ATT&CK mapping if applicable
6. A concrete, step-by-step remediation
7. A short, one-line executive summary without technical jargon

Respond in JSON with keys: explanation, cvss_score, owasp_mapping, mitre_mapping, remediation, exec_summary.
"""


@shared_task(name="explain_scan_findings")
def explain_scan_findings(scan_id: str):
    db: Session = SessionLocal()
    try:
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()

        for finding in findings:
            prompt = EXPLANATION_PROMPT_TEMPLATE.format(
                category=finding.category,
                severity=finding.severity,
                title=finding.title,
                raw_output=finding.raw_output,
            )

            response = requests.post(
                "https://api.anthropic.com/v1/messages",  # or Gemini/OpenAI endpoint
                headers={"x-api-key": settings.AI_API_KEY, "content-type": "application/json"},
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 1000,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            result = response.json()
            text = result["content"][0]["text"]

            import json
            try:
                parsed = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
            except Exception:
                parsed = {"explanation": text}

            finding.ai_explanation = parsed.get("explanation")
            finding.cvss_score = parsed.get("cvss_score")
            finding.owasp_mapping = parsed.get("owasp_mapping")
            finding.mitre_mapping = parsed.get("mitre_mapping")
            finding.remediation = parsed.get("remediation")
            finding.exec_summary = parsed.get("exec_summary", f"Vulnerability in {finding.category} was detected: {finding.title}.")

        db.commit()
    finally:
        db.close()


SCORE_SUMMARY_PROMPT_TEMPLATE = """You are a senior security consultant summarizing a scan for a
non-technical founder who wants to know: "why isn't my score 100%?"

Risk score: {risk_score}/100
Findings that reduced the score, ordered by impact:
{findings_summary}

Write a short (4-6 sentence) plain-English summary that:
1. States the score and what tier that puts them in (excellent/good/needs work/poor)
2. Names the single biggest issue dragging the score down
3. Gives one concrete next action they should take first

Do not invent findings not listed above. Be direct, not alarmist.
"""


@shared_task(name="generate_score_summary")
def generate_score_summary(scan_id: str):
    db: Session = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()

        weights = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        sorted_findings = sorted(findings, key=lambda f: -weights.get(f.severity, 0))

        findings_summary = "\n".join(
            f"- [{f.severity.upper()}] {f.title}" for f in sorted_findings if f.severity != "info"
        ) or "No significant issues found."

        prompt = SCORE_SUMMARY_PROMPT_TEMPLATE.format(
            risk_score=scan.risk_score,
            findings_summary=findings_summary,
        )

        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.AI_API_KEY, "content-type": "application/json"},
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        summary_text = response.json()["content"][0]["text"]

        scan.status_detail = summary_text
        db.commit()
    finally:
        db.close()