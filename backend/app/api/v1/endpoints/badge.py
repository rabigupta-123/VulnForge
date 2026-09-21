from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.asset import Asset
from app.models.scan import Scan

router = APIRouter()


@router.get("/{asset_id}.svg")
def get_asset_trust_badge(asset_id: str, db: Session = Depends(get_db)):
    """
    Public endpoint returning a generated SVG trust badge indicating the asset's security grade.
    Only returns a badge if the asset is ownership-verified and has a completed scan.
    """
    # 1. Fetch asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found.",
        )

    # 2. Require verified ownership
    if asset.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Domain ownership verification is required.",
        )

    # 3. Retrieve latest completed scan
    latest_scan = (
        db.query(Scan)
        .filter(Scan.asset_id == asset_id, Scan.status == "completed")
        .order_by(Scan.completed_at.desc())
        .first()
    )

    if not latest_scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed scan audits found for this asset.",
        )

    # 4. Calculate grade parameters
    score = latest_scan.risk_score if latest_scan.risk_score is not None else 100
    if score >= 90:
        grade = "A"
        badge_bg = "#059669"   # emerald-600
        badge_text = "#ecfdf5" # emerald-50
    elif score >= 80:
        grade = "B"
        badge_bg = "#0891b2"   # cyan-600
        badge_text = "#ecfeff" # cyan-50
    elif score >= 70:
        grade = "C"
        badge_bg = "#d97706"   # amber-600
        badge_text = "#fffbeb" # amber-50
    elif score >= 60:
        grade = "D"
        badge_bg = "#ea580c"   # orange-600
        badge_text = "#fff7ed" # orange-50
    else:
        grade = "F"
        badge_bg = "#dc2626"   # red-600
        badge_text = "#fef2f2" # red-50

    scan_date = (latest_scan.completed_at or latest_scan.started_at).strftime("%Y-%m-%d")

    # 5. Generate beautiful Cloudflare/SSL-Labs style SVG
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40" viewBox="0 0 220 40">
  <rect width="220" height="40" rx="8" fill="#0b0f19" stroke="#1e293b" stroke-width="1.5"/>
  <text x="16" y="17" fill="#f8fafc" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="600" font-size="10" letter-spacing="0.5">CYBERGUARDIAN</text>
  <text x="16" y="29" fill="#64748b" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="8">Secured: {scan_date}</text>
  <rect x="150" y="8" width="54" height="24" rx="6" fill="{badge_bg}" />
  <text x="177" y="24" fill="{badge_text}" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="bold" font-size="11" text-anchor="middle">GRADE {grade}</text>
</svg>"""

    return Response(content=svg_content, media_type="image/svg+xml")
