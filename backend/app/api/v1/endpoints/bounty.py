"""
Bug Bounty Platform endpoints: Program management, safe harbor authorization,
in-scope researcher submissions, triage workflow, researcher profile, and 90-day disclosure timeline.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User, Organization
from app.models.bounty import (
    BountyProgram, BountyScope, RewardTier, Researcher,
    VulnerabilityReport, ReportAttachment, ReportComment
)
from app.services.email import send_verification_email_smtp

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class ScopeCreate(BaseModel):
    asset_type: str  # domain | api | mobile_app | other
    target: str      # e.g. *.example.com
    in_scope: bool = True
    notes: Optional[str] = None


class RewardTierCreate(BaseModel):
    severity: str    # critical | high | medium | low
    min_amount: float = 0.0
    max_amount: float = 0.0
    currency: str = "USD"


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "public"  # public | private | invite_only
    safe_harbor_text: str
    scopes: List[ScopeCreate] = []
    reward_tiers: List[RewardTierCreate] = []


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # draft | active | paused | closed
    visibility: Optional[str] = None
    safe_harbor_text: Optional[str] = None


class ReportSubmit(BaseModel):
    title: str
    description: str
    steps_to_reproduce: str
    affected_scope_id: str
    severity_claimed: str  # critical | high | medium | low | info
    file_attachments: Optional[List[str]] = []


class ReportTriageUpdate(BaseModel):
    status: Optional[str] = None
    # submitted | triaging | accepted | duplicate | informative | not_applicable | resolved | disclosed
    severity_confirmed: Optional[str] = None
    cvss_score: Optional[float] = None
    reward_amount: Optional[float] = None


class CommentCreate(BaseModel):
    body: str
    is_internal: bool = False


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_researcher(db: Session, user: User) -> Researcher:
    researcher = db.query(Researcher).filter(Researcher.user_id == user.id).first()
    if not researcher:
        displayName = user.email.split("@")[0]
        researcher = Researcher(
            user_id=user.id,
            display_name=displayName,
            reputation_score=10,
            total_earned=0.0,
            total_reports=0,
        )
        user.is_researcher = True
        db.add(researcher)
        db.add(user)
        db.commit()
        db.refresh(researcher)
    return researcher


# ── 1. Program Management (Org Owners / Admins) ──────────────────────────────

@router.post("/programs", status_code=status.HTTP_201_CREATED)
def create_bounty_program(
    payload: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Create a new Bug Bounty Program with scopes, reward matrix, and legal Safe Harbor text.
    """
    program = BountyProgram(
        org_id=current_user.org_id,
        name=payload.name,
        description=payload.description,
        status="active",
        visibility=payload.visibility,
        safe_harbor_text=payload.safe_harbor_text,
    )
    db.add(program)
    db.commit()
    db.refresh(program)

    for sc in payload.scopes:
        scope_item = BountyScope(
            program_id=program.id,
            asset_type=sc.asset_type,
            target=sc.target,
            in_scope=sc.in_scope,
            notes=sc.notes,
        )
        db.add(scope_item)

    for rt in payload.reward_tiers:
        tier_item = RewardTier(
            program_id=program.id,
            severity=rt.severity,
            min_amount=rt.min_amount,
            max_amount=rt.max_amount,
            currency=rt.currency,
        )
        db.add(tier_item)

    db.commit()
    return {"id": program.id, "name": program.name, "status": program.status, "message": "Bug bounty program created successfully!"}


@router.get("/programs/public")
def list_public_bounty_programs(db: Session = Depends(get_db)):
    """
    List all active public bug bounty programs available across organizations.
    """
    programs = (
        db.query(BountyProgram)
        .filter(BountyProgram.status == "active", BountyProgram.visibility == "public")
        .order_by(BountyProgram.created_at.desc())
        .all()
    )

    result = []
    for p in programs:
        scopes = db.query(BountyScope).filter(BountyScope.program_id == p.id).all()
        rewards = db.query(RewardTier).filter(RewardTier.program_id == p.id).all()
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "safe_harbor_text": p.safe_harbor_text,
            "scopes_count": len(scopes),
            "scopes": [{"id": s.id, "target": s.target, "asset_type": s.asset_type, "in_scope": s.in_scope, "notes": s.notes} for s in scopes],
            "reward_tiers": [{"severity": r.severity, "min_amount": r.min_amount, "max_amount": r.max_amount, "currency": r.currency} for r in rewards],
            "created_at": p.created_at,
        })
    return result


@router.get("/programs")
def list_org_bounty_programs(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List organization's own managed bug bounty programs.
    """
    programs = (
        db.query(BountyProgram)
        .filter(BountyProgram.org_id == current_user.org_id)
        .order_by(BountyProgram.created_at.desc())
        .all()
    )
    return programs


@router.get("/programs/{id}")
def get_bounty_program_detail(id: str, db: Session = Depends(get_db)):
    """
    Get detailed public bug bounty program information, scopes, reward matrix, and Safe Harbor statement.
    """
    program = db.query(BountyProgram).filter(BountyProgram.id == id).first()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty program not found.")

    scopes = db.query(BountyScope).filter(BountyScope.program_id == id).all()
    reward_tiers = db.query(RewardTier).filter(RewardTier.program_id == id).all()

    return {
        "id": program.id,
        "org_id": program.org_id,
        "name": program.name,
        "description": program.description,
        "status": program.status,
        "visibility": program.visibility,
        "safe_harbor_text": program.safe_harbor_text,
        "scopes": scopes,
        "reward_tiers": reward_tiers,
        "created_at": program.created_at,
    }


@router.patch("/programs/{id}")
def update_bounty_program(
    id: str,
    payload: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update a program's status, name, description, or Safe Harbor legal text.
    """
    program = db.query(BountyProgram).filter(BountyProgram.id == id, BountyProgram.org_id == current_user.org_id).first()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found or access denied.")

    if payload.name: program.name = payload.name
    if payload.description: program.description = payload.description
    if payload.status: program.status = payload.status
    if payload.visibility: program.visibility = payload.visibility
    if payload.safe_harbor_text: program.safe_harbor_text = payload.safe_harbor_text

    db.add(program)
    db.commit()
    db.refresh(program)
    return program


# ── 2. Researcher Submissions Flow ───────────────────────────────────────────

@router.post("/programs/{id}/reports", status_code=status.HTTP_201_CREATED)
def submit_vulnerability_report(
    id: str,
    payload: ReportSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Submit a vulnerability report against an in-scope target item.
    Rejects submissions targeting out-of-scope targets (where in_scope == False).
    """
    program = db.query(BountyProgram).filter(BountyProgram.id == id).first()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found.")

    if program.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Program is currently '{program.status}'. Submissions are disabled.")

    # 1. Validate target scope item belongs to program
    scope = db.query(BountyScope).filter(BountyScope.id == payload.affected_scope_id, BountyScope.program_id == id).first()
    if not scope:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected target scope item is invalid for this program.")

    # 2. ENFORCE: Target item MUST be explicitly in-scope
    if not scope.in_scope:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submission rejected: Target '{scope.target}' is explicitly listed as OUT-OF-SCOPE for this bounty program.",
        )

    # Get or register researcher profile
    researcher = _get_or_create_researcher(db, current_user)

    report = VulnerabilityReport(
        program_id=program.id,
        researcher_id=researcher.id,
        affected_scope_id=scope.id,
        title=payload.title,
        description=payload.description,
        steps_to_reproduce=payload.steps_to_reproduce,
        severity_claimed=payload.severity_claimed,
        status="submitted",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Attach optional proof-of-concept files
    if payload.file_attachments:
        for path in payload.file_attachments:
            att = ReportAttachment(report_id=report.id, file_path=path)
            db.add(att)
        db.commit()

    researcher.total_reports += 1
    db.add(researcher)
    db.commit()

    return {"report_id": report.id, "status": report.status, "message": "Vulnerability report submitted for triage!"}


# ── 3. Organization Triage Workflow ──────────────────────────────────────────

@router.get("/reports")
def list_triage_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Org triage queue for all vulnerability reports submitted against the organization's programs.
    """
    query = (
        db.query(VulnerabilityReport)
        .join(BountyProgram, VulnerabilityReport.program_id == BountyProgram.id)
        .filter(BountyProgram.org_id == current_user.org_id)
    )

    if status_filter:
        query = query.filter(VulnerabilityReport.status == status_filter)

    reports = query.order_by(VulnerabilityReport.submitted_at.desc()).all()

    result = []
    for r in reports:
        res = db.query(Researcher).filter(Researcher.id == r.researcher_id).first()
        sc = db.query(BountyScope).filter(BountyScope.id == r.affected_scope_id).first()
        result.append({
            "id": r.id,
            "program_id": r.program_id,
            "title": r.title,
            "description": r.description,
            "steps_to_reproduce": r.steps_to_reproduce,
            "severity_claimed": r.severity_claimed,
            "severity_confirmed": r.severity_confirmed,
            "cvss_score": r.cvss_score,
            "status": r.status,
            "reward_amount": r.reward_amount,
            "submitted_at": r.submitted_at,
            "resolved_at": r.resolved_at,
            "disclosure_eligible_at": r.disclosure_eligible_at,
            "researcher_name": res.display_name if res else "Researcher",
            "target": sc.target if sc else "Scope Target",
        })
    return result


@router.patch("/reports/{id}/triage")
def triage_vulnerability_report(
    id: str,
    payload: ReportTriageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update triage status, confirmed severity, CVSS score, and reward amount.
    Sets 90-day disclosure eligibility timeline when resolved.
    """
    report = (
        db.query(VulnerabilityReport)
        .join(BountyProgram, VulnerabilityReport.program_id == BountyProgram.id)
        .filter(VulnerabilityReport.id == id, BountyProgram.org_id == current_user.org_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found or access denied.")

    if payload.status:
        report.status = payload.status
        if payload.status == "triaging" and not report.triaged_at:
            report.triaged_at = datetime.now(timezone.utc)
        elif payload.status in ["resolved", "accepted"]:
            if not report.resolved_at:
                now = datetime.now(timezone.utc)
                report.resolved_at = now
                report.disclosure_eligible_at = now + timedelta(days=90)  # 90-day disclosure timeline

    if payload.severity_confirmed:
        report.severity_confirmed = payload.severity_confirmed

    if payload.cvss_score is not None:
        report.cvss_score = payload.cvss_score

    if payload.reward_amount is not None:
        report.reward_amount = payload.reward_amount
        # Credit researcher earnings and reputation
        researcher = db.query(Researcher).filter(Researcher.id == report.researcher_id).first()
        if researcher:
            researcher.total_earned += payload.reward_amount
            researcher.reputation_score += 50
            db.add(researcher)

    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/{id}")
def get_report_detail(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get full report detail with threaded comments and attachments.
    Filters internal comments if user is researcher.
    """
    report = db.query(VulnerabilityReport).filter(VulnerabilityReport.id == id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    researcher = db.query(Researcher).filter(Researcher.user_id == current_user.id).first()

    # Authorization: org admin/owner OR the report's researcher
    program = db.query(BountyProgram).filter(BountyProgram.id == report.program_id).first()
    is_org_member = program and program.org_id == current_user.org_id
    is_report_researcher = researcher and researcher.id == report.researcher_id

    if not is_org_member and not is_report_researcher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to report details.")

    # Fetch comments (filter internal comments if user is researcher)
    comments_query = db.query(ReportComment).filter(ReportComment.report_id == id)
    if is_report_researcher and not is_org_member:
        comments_query = comments_query.filter(ReportComment.is_internal == False)

    comments = comments_query.order_by(ReportComment.created_at.asc()).all()
    attachments = db.query(ReportAttachment).filter(ReportAttachment.report_id == id).all()

    return {
        "id": report.id,
        "title": report.title,
        "description": report.description,
        "steps_to_reproduce": report.steps_to_reproduce,
        "severity_claimed": report.severity_claimed,
        "severity_confirmed": report.severity_confirmed,
        "cvss_score": report.cvss_score,
        "status": report.status,
        "reward_amount": report.reward_amount,
        "submitted_at": report.submitted_at,
        "resolved_at": report.resolved_at,
        "disclosure_eligible_at": report.disclosure_eligible_at,
        "comments": [{"id": c.id, "author_id": c.author_id, "body": c.body, "is_internal": c.is_internal, "created_at": c.created_at} for c in comments],
        "attachments": [{"id": a.id, "file_path": a.file_path, "uploaded_at": a.uploaded_at} for a in attachments],
    }


@router.post("/reports/{id}/comments")
def add_report_comment(
    id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Add a comment to a vulnerability report thread.
    `is_internal = True` notes are restricted to org triagers only.
    """
    report = db.query(VulnerabilityReport).filter(VulnerabilityReport.id == id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    comment = ReportComment(
        report_id=report.id,
        author_id=current_user.id,
        body=payload.body,
        is_internal=payload.is_internal,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


# ── 4. Researcher Profile & Dashboard ────────────────────────────────────────

@router.get("/researcher/profile")
def get_researcher_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get current logged in researcher profile details.
    """
    researcher = _get_or_create_researcher(db, current_user)
    return {
        "id": researcher.id,
        "display_name": researcher.display_name,
        "reputation_score": researcher.reputation_score,
        "total_earned": researcher.total_earned,
        "total_reports": researcher.total_reports,
        "created_at": researcher.created_at,
    }


@router.get("/researcher/reports")
def get_researcher_submitted_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List researcher's own submitted vulnerability reports.
    """
    researcher = _get_or_create_researcher(db, current_user)
    reports = (
        db.query(VulnerabilityReport)
        .filter(VulnerabilityReport.researcher_id == researcher.id)
        .order_by(VulnerabilityReport.submitted_at.desc())
        .all()
    )
    return reports
