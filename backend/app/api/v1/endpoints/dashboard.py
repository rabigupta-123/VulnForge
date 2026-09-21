from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.schemas.dashboard import DashboardOverviewResponse, RecentScanItem

router = APIRouter()


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve aggregated security dashboard statistics for the logged-in user's organization.
    """
    org_id = current_user.org_id

    # 1. Count Total Assets
    total_assets = db.query(Asset).filter(Asset.org_id == org_id).count()

    # 2. Count Total Scans
    total_scans = db.query(Scan).join(Asset, Scan.asset_id == Asset.id).filter(Asset.org_id == org_id).count()

    # 3. Aggregate Findings Severities
    # Group findings counts by severity level
    severity_counts = (
        db.query(Finding.severity, func.count(Finding.id))
        .join(Scan, Finding.scan_id == Scan.id)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Asset.org_id == org_id)
        .group_by(Finding.severity)
        .all()
    )

    # Initialize severity dictionary
    findings_dict = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for severity, count in severity_counts:
        sev_lower = severity.lower()
        if sev_lower in findings_dict:
            findings_dict[sev_lower] = count

    # 4. Calculate Average Risk Score
    avg_score = (
        db.query(func.avg(Scan.risk_score))
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Asset.org_id == org_id, Scan.status == "completed")
        .scalar()
    )
    average_risk_score = round(float(avg_score), 1) if avg_score is not None else 100.0

    # 5. Fetch Recent Scans list (limit 5)
    recent_scans_db = (
        db.query(
            Scan.id,
            Asset.domain,
            Scan.status,
            Scan.risk_score,
            Scan.started_at,
            Scan.completed_at,
        )
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Asset.org_id == org_id)
        .order_by(Scan.started_at.desc())
        .limit(5)
        .all()
    )

    recent_scans = []
    for s_id, domain, status, score, started, completed in recent_scans_db:
        recent_scans.append(
            RecentScanItem(
                id=s_id,
                domain=domain,
                status=status,
                risk_score=score,
                started_at=started,
                completed_at=completed,
            )
        )

    return DashboardOverviewResponse(
        total_assets=total_assets,
        total_scans=total_scans,
        critical_findings=findings_dict["critical"],
        high_findings=findings_dict["high"],
        medium_findings=findings_dict["medium"],
        low_findings=findings_dict["low"],
        info_findings=findings_dict["info"],
        average_risk_score=average_risk_score,
        recent_scans=recent_scans,
    )


from pydantic import BaseModel
from typing import Optional
from app.models.user import Organization

class NotificationChannelsPayload(BaseModel):
    slack_webhook_url: Optional[str] = None
    alert_email: Optional[str] = None
    custom_webhook_url: Optional[str] = None


@router.get("/channels")
def get_notification_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve configured Slack/email/custom webhook channels for the organization.
    """
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org:
        return {}
    return org.notification_channels or {}


@router.post("/channels")
def update_notification_channels(
    payload: NotificationChannelsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Configure organization alert channels (Slack webhooks, custom webhook URLs, alert distribution emails).
    """
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org:
        return {}
    
    channels = {
        "slack_webhook_url": payload.slack_webhook_url,
        "alert_email": payload.alert_email,
        "custom_webhook_url": payload.custom_webhook_url,
    }
    org.notification_channels = channels
    db.add(org)
    db.commit()
    db.refresh(org)
    return org.notification_channels

