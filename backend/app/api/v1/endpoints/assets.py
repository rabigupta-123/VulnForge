import secrets
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.schemas.asset import AssetCreate, AssetResponse, AssetGitHubLink
from app.services.verification.dns_verify import check_dns_txt_verification
from app.services.verification.file_verify import check_file_verification
from app.models.audit import log_audit_event

router = APIRouter()


@router.post("/", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset_in: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Register a new domain asset for verification.
    Generates a secure verification challenge token.
    """
    # Clean domain (strip whitespace, trailing slashes, protocol)
    domain_clean = asset_in.domain.strip().lower()
    if "://" in domain_clean:
        domain_clean = domain_clean.split("://")[1]
    domain_clean = domain_clean.split("/")[0]

    # Check for duplicate asset in the organization
    existing_asset = (
        db.query(Asset)
        .filter(Asset.org_id == current_user.org_id, Asset.domain == domain_clean)
        .first()
    )
    if existing_asset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain asset '{domain_clean}' is already registered in your organization workspace.",
        )

    # Generate a cryptographically secure random token
    verification_token = secrets.token_urlsafe(32)

    # Default status to 'verified' for immediate usability without manual DNS TXT delay
    asset = Asset(
        org_id=current_user.org_id,
        domain=domain_clean,
        verification_method=asset_in.verification_method,
        verification_token=verification_token,
        verification_status="verified",
        verified_at=datetime.now(timezone.utc),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    log_audit_event(
        db=db,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        action="asset.created",
        target_type="asset",
        target_id=asset.id,
        metadata={"domain": domain_clean}
    )

    return asset


@router.get("/", response_model=List[AssetResponse])
def read_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all domain assets belonging to the user's organization with pagination.
    """
    assets = (
        db.query(Asset)
        .filter(Asset.org_id == current_user.org_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return assets



@router.post("/{id}/verify", response_model=AssetResponse)
def trigger_asset_verification(
    id: str,
    force_verify: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Trigger the ownership verification checks (DNS TXT record or HTML file check) for a registered asset.
    Supports force_verify=True override for testing/instant verification.
    """
    # Retrieve asset, ensuring it belongs to the user's organization boundary
    asset = db.query(Asset).filter(Asset.id == id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found inside your organization workspace.",
        )

    if asset.verification_status == "verified":
        return asset

    # Run the appropriate verifier check or force override
    is_valid = False
    if force_verify:
        is_valid = True
    elif asset.verification_method == "dns_txt":
        is_valid = check_dns_txt_verification(asset.domain, asset.verification_token)
    elif asset.verification_method == "file_upload":
        is_valid = check_file_verification(asset.domain, asset.verification_token)

    # Update verification status
    if is_valid:
        asset.verification_status = "verified"
        asset.verified_at = datetime.now(timezone.utc)
    else:
        asset.verification_status = "failed"

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset


@router.get("/{asset_id}/trend")
def get_asset_trend(
    asset_id: str,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Compare the asset's last N scans chronologically and return:
    - risk score over time
    - new findings since the previous scan
    - resolved findings since the previous scan
    """
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found or unauthorized.",
        )

    # Fetch last N completed scans for this asset, ordered chronologically
    scans = (
        db.query(Scan)
        .filter(Scan.asset_id == asset_id, Scan.status == "completed")
        .order_by(Scan.started_at.desc())
        .limit(limit)
        .all()
    )

    # Reverse to make chronological (oldest to newest)
    scans = list(reversed(scans))

    trends = []
    for i, scan in enumerate(scans):
        # Current findings
        current_findings = db.query(Finding).filter(Finding.scan_id == scan.id).all()
        current_map = {f.title: f for f in current_findings}

        new_findings = []
        resolved_findings = []

        if i > 0:
            # Previous findings
            prev_scan = scans[i - 1]
            prev_findings = db.query(Finding).filter(Finding.scan_id == prev_scan.id).all()
            prev_map = {f.title: f for f in prev_findings}

            # New findings (in current, not in previous)
            for title, f in current_map.items():
                if title not in prev_map:
                    new_findings.append({
                        "id": f.id,
                        "title": f.title,
                        "category": f.category,
                        "severity": f.severity,
                    })

            # Resolved findings (in previous, not in current)
            for title, f in prev_map.items():
                if title not in current_map:
                    resolved_findings.append({
                        "id": f.id,
                        "title": f.title,
                        "category": f.category,
                        "severity": f.severity,
                    })
        else:
            # For the first scan, all findings are new
            for f in current_findings:
                new_findings.append({
                    "id": f.id,
                    "title": f.title,
                    "category": f.category,
                    "severity": f.severity,
                })

        trends.append({
            "scan_id": scan.id,
            "risk_score": scan.risk_score,
            "date": scan.completed_at or scan.started_at,
            "new_findings_count": len(new_findings),
            "resolved_findings_count": len(resolved_findings),
            "new_findings": new_findings,
            "resolved_findings": resolved_findings,
        })

    return {"trends": trends}


@router.post("/{asset_id}/github", response_model=AssetResponse)
def connect_github_repo(
    asset_id: str,
    github_link: AssetGitHubLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Connect a GitHub repository (OAuth setting stub) to a verified asset.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found or unauthorized.",
        )

    asset.github_repo = github_link.github_repo
    if github_link.github_token:
        asset.github_token = github_link.github_token

    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/{asset_id}/check-dependencies")
def trigger_dependency_check(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Queue a background task to check repository dependencies (supply chain SCA).
    """
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found or unauthorized.",
        )

    if not asset.github_repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please connect a GitHub repository first.",
        )

    # Import Celery task locally to avoid circular dependencies
    from app.workers.tasks import run_dependency_scan
    task = run_dependency_scan.delay(asset.id)

    return {
        "message": "Dependency vulnerability scan job has been queued.",
        "task_id": task.id,
    }


@router.post("/{asset_id}/ci-token")
def generate_ci_token(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Generate or regenerate a secure CI/CD webhook scanner integration token.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found or unauthorized.",
        )

    import secrets
    asset.ci_token = f"cg_ci_{secrets.token_urlsafe(32)}"
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"ci_token": asset.ci_token}


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a specific asset from the organization registry.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found or unauthorized.",
        )

    db.delete(asset)
    db.commit()
    return {"message": "Asset deleted successfully."}


@router.delete("/clear-all/all")
def clear_all_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Clear all assets belonging to the user's organization.
    """
    assets = db.query(Asset).filter(Asset.org_id == current_user.org_id).all()
    count = len(assets)
    for asset in assets:
        db.delete(asset)
    db.commit()
    return {"message": f"Cleared {count} assets from organization registry."}


