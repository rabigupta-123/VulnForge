import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.scan import Scan, Finding
from app.models.asset import Asset

router = APIRouter()


class AssistantAskPayload(BaseModel):
    question: str


def call_gemini_chat(prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        return ""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    try:
        resp = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=15
        )
        resp.raise_for_status()
        res_data = resp.json()
        return res_data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return f"Error contacting AI service: {str(e)}"


@router.post("/ask")
def ask_assistant(
    payload: AssistantAskPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Grounded Q&A Security Assistant endpoint. Extracts the organization's latest completed
    scan findings and answers user questions strictly based on that database context.
    """
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question query cannot be empty.",
        )

    # 1. Fetch latest completed scan for organization's assets
    scan = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Asset.org_id == current_user.org_id, Scan.status == "completed")
        .order_by(Scan.completed_at.desc())
        .first()
    )

    findings_json = []
    if scan:
        findings = db.query(Finding).filter(Finding.scan_id == scan.id).all()
        findings_json = [
            {
                "title": f.title,
                "category": f.category,
                "severity": f.severity,
                "description": f.description,
                "status": f.status,
            }
            for f in findings
        ]

    # 2. Formulate grounded prompt
    prompt = (
        "You are CyberGuardian AI, an agentic security dashboard chat assistant. "
        "You help developers understand and fix security vulnerabilities discovered on their assets.\n\n"
        "Here are the vulnerabilities discovered in the latest scan of the user's workspace:\n"
        f"{findings_json}\n\n"
        f"User's Question: {question}\n\n"
        "Instructions:\n"
        "- Answer the user's question based strictly on the provided scan findings list.\n"
        "- Do not make up or hallucinate any findings that are not listed in the data above.\n"
        "- Keep the answer concise, actionable, and developer-friendly."
    )

    # 3. Call LLM or use sandbox fallback
    answer = call_gemini_chat(prompt)
    if not answer:
        # Sandbox / Local development mock fallback grounded response
        findings_str = ", ".join([f["title"] for f in findings_json]) if findings_json else "no vulnerabilities"
        answer = (
            f"Grounding Sandbox Fallback: I analyzed your workspace's latest scan. "
            f"Current findings: [{findings_str}]. "
            f"In response to your query '{question}': please review the remediation advice "
            f"for these alerts in the dashboard tabs."
        )

    return {"answer": answer}
