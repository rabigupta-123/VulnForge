from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.scan import Finding, Scan
from app.models.asset import Asset
from app.schemas.scan import FindingResponse, FindingStatusUpdate

router = APIRouter()


@router.patch("/{finding_id}/status", response_model=FindingResponse)
def update_finding_status(
    finding_id: str,
    status_update: FindingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update the resolution status of a specific security finding.
    Recalculates the associated scan's risk score dynamically.
    """
    # 1. Enforce organization boundary alignment
    finding = (
        db.query(Finding)
        .join(Scan, Finding.scan_id == Scan.id)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Finding.id == finding_id, Asset.org_id == current_user.org_id)
        .first()
    )

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found or unauthorized.",
        )

    # Validate status choices
    valid_statuses = ["open", "accepted_risk", "false_positive"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    # 2. Update status and note
    finding.status = status_update.status
    if status_update.note is not None:
        finding.status_note = status_update.note

    db.add(finding)
    db.commit()

    # 3. Recalculate associated scan risk score
    scan = finding.scan
    severity_weights = {
        "critical": 25,
        "high": 15,
        "medium": 8,
        "low": 3,
        "info": 0,
    }

    # Fetch all findings for this scan
    all_scan_findings = db.query(Finding).filter(Finding.scan_id == scan.id).all()

    risk_score = 100
    for f in all_scan_findings:
        if f.status == "open":
            risk_score -= severity_weights.get(f.severity.lower(), 0)

    scan.risk_score = max(0, risk_score)
    db.add(scan)
    db.commit()
    db.refresh(finding)

    return finding
