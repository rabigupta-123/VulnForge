from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.asset import Asset
from app.models.scan import Scan

router = APIRouter()


class WebhookScanPayload(BaseModel):
    asset_id: str
    ci_token: str


@router.post("/webhook-scan")
def trigger_ci_webhook_scan(
    payload: WebhookScanPayload,
    db: Session = Depends(get_db),
):
    """
    CI/CD automated scan trigger endpoint. Authenticates via the asset-specific
    CI token and initiates the background passive/active scanning suite.
    """
    asset = (
        db.query(Asset)
        .filter(Asset.id == payload.asset_id, Asset.ci_token == payload.ci_token)
        .first()
    )
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid asset ID or CI/CD integration token.",
        )

    if asset.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ownership verification is required before initiating scans on this target domain.",
        )

    active_scan = (
        db.query(Scan)
        .filter(Scan.asset_id == asset.id, Scan.status.in_(["queued", "running"]))
        .first()
    )
    if active_scan:
        return {
            "message": "A security scan is already in progress for this asset target.",
            "scan_id": active_scan.id,
            "status": active_scan.status,
        }

    # Instantiate scan record in DB
    scan = Scan(
        asset_id=asset.id,
        status="queued",
        risk_score=None,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Trigger Celery scanning job locally
    from app.workers.tasks import execute_scan_job
    execute_scan_job.delay(scan.id, asset.domain)

    return {
        "message": "Scan triggered via CI/CD integration.",
        "scan_id": scan.id,
    }
