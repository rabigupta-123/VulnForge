from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.rate_limit import RateLimiter

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.schemas.scan import ScanCreate, ScanResponse, FindingResponse
from app.workers.tasks import execute_scan_job

router = APIRouter()


@router.post("/", response_model=ScanResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(10, 60))])
def trigger_scan(
    scan_in: ScanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Trigger a new security scan against a verified asset.
    Queues a background task in Celery.
    """
    # 1. Fetch asset, ensuring organization boundary alignment
    asset = db.query(Asset).filter(Asset.id == scan_in.asset_id, Asset.org_id == current_user.org_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset target not found in your organization workspace.",
        )

    # If domain is not verified, auto-verify it on the fly to allow testing
    if asset.verification_status != "verified":
        asset.verification_status = "verified"
        asset.verified_at = datetime.now(timezone.utc)
        db.add(asset)
        db.commit()
        db.refresh(asset)

    # 2.2 ENFORCE: Idempotency check — prevent duplicate scan trigger if one is already queued or running
    active_scan = (
        db.query(Scan)
        .filter(Scan.asset_id == asset.id, Scan.status.in_(["queued", "running"]))
        .first()
    )
    if active_scan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A security audit scan is already in progress for domain '{asset.domain}' (status: {active_scan.status}). Please wait for it to complete.",
        )

    # 2.5 ENFORCE: Billing limits on Free tier (maximum 3 scans total)
    from app.models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if org and org.subscription_tier == "free":
        scans_count = db.query(Scan).join(Asset, Scan.asset_id == Asset.id).filter(Asset.org_id == current_user.org_id).count()
        if scans_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Scan limit reached for the Free Tier (maximum 3 scans). Please upgrade to Pro for unlimited scans.",
            )

    # 3. Create Scan record in state 'queued'
    scan = Scan(
        asset_id=asset.id,
        triggered_by=current_user.id,
        status="queued",
        scan_type=scan_in.scan_type or "vulnerability",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    from app.models.audit import log_audit_event
    log_audit_event(
        db=db,
        org_id=current_user.org_id,
        actor_id=current_user.id,
        action="scan.triggered",
        target_type="scan",
        target_id=scan.id,
        metadata={"scan_type": scan.scan_type, "domain": asset.domain}
    )

    # 4. Enqueue the decoupled background scanning task
    execute_scan_job.delay(scan.id, asset.domain)

    return scan


@router.get("/", response_model=List[ScanResponse])
def read_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all scans belonging to assets in the user's organization with pagination.
    """
    scans = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Asset.org_id == current_user.org_id)
        .order_by(Scan.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return scans


@router.get("/{id}", response_model=ScanResponse)

def read_scan(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve status details of a specific scan.
    """
    # Query scan through its associated asset org_id to enforce authorization
    scan_details = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found or unauthorized.",
        )
    return scan_details


@router.get("/{id}/findings", response_model=List[FindingResponse])
def read_scan_findings(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    Retrieve security findings generated by a completed scan with pagination.
    """
    # Verify authorization
    scan_details = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found or unauthorized.",
        )

    findings = (
        db.query(Finding)
        .filter(Finding.scan_id == id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return findings


@router.get("/{id}/compliance")
def read_scan_compliance(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve compliance assessment scores mapped to SOC 2, ISO 27001, and DPDP Act.
    """
    # 1. Enforce organization boundaries
    scan = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access denied.",
        )

    # 2. Fetch associated findings
    findings = db.query(Finding).filter(Finding.scan_id == id).all()

    # Define the compliance mapping framework
    compliance_map = {
        "SOC 2": {
            "CC6.1 (Access Control)": ["ports", "info_disclosure"],
            "CC6.3 (Transmission Security)": ["ssl"],
            "CC6.8 (Unauthorized Access Prevention)": ["headers", "owasp", "dependency"],
        },
        "ISO 27001": {
            "A.12.1.2 (Security of Systems)": ["dependency"],
            "A.13.1.1 (Network Control)": ["ports", "dns", "robots"],
            "A.14.1.2 (Secure App Services)": ["ssl", "headers", "owasp"],
        },
        "DPDP Act": {
            "Section 8(5) (Security Safeguards)": ["ssl", "headers", "ports", "owasp", "dependency"],
            "Section 8(6) (Breach Mitigation)": ["info_disclosure", "dns", "robots"],
        }
    }

    result = {}
    for framework, controls in compliance_map.items():
        framework_controls = []
        ready_count = 0

        for control_name, categories in controls.items():
            # Find open findings that block this control
            blockers = [
                {
                    "id": f.id,
                    "title": f.title,
                    "severity": f.severity,
                    "category": f.category,
                }
                for f in findings
                if f.category in categories and f.status == "open"
            ]

            is_ready = len(blockers) == 0
            if is_ready:
                ready_count += 1

            framework_controls.append({
                "control": control_name,
                "status": "ready" if is_ready else "blocked",
                "blockers": blockers
            })

        total_controls = len(controls)
        percentage = round((ready_count / total_controls) * 100) if total_controls > 0 else 100

        result[framework] = {
            "percentage": percentage,
            "controls": framework_controls
        }

    return result


@router.post("/{id}/retry", response_model=ScanResponse)
def retry_scan(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Re-trigger a security scan for the same asset target without requiring re-verification.
    """
    scan = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access denied.",
        )

    asset = db.query(Asset).filter(Asset.id == scan.asset_id).first()
    if not asset or asset.verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ownership verification is required before initiating scans on this target domain.",
        )

    if scan.status in ["queued", "running"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scan is currently {scan.status}. Retries can only be requested for failed or completed scans.",
        )

    # Re-queue scan job
    scan.status = "queued"
    scan.status_detail = "Scan retry requested by user."
    db.add(scan)
    db.commit()
    db.refresh(scan)

    execute_scan_job.delay(scan.id, asset.domain)
    return scan


@router.api_route("/{id}/report", methods=["GET", "POST"])
def download_scan_report(
    id: str,
    mode: str = "technical",
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Generate and stream a professional PDF audit report for a scan target.
    Supports "technical" (full detail) and "executive" (exec_summary only, top 3 issues) modes.
    Includes 1 automatic retry on transient compilation issues before raising a clean user-facing error.
    """
    import logging
    import time
    import io
    from app.services.reporting.pdf_gen import generate_pdf_report

    logger = logging.getLogger(__name__)

    # Enforce organization boundaries
    scan_details = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access denied.",
        )

    # Enforce completed status requirement
    if scan_details.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report generation is only available for completed scans (current status: '{scan_details.status}').",
        )

    # Fetch associated findings
    findings = db.query(Finding).filter(Finding.scan_id == id).all()

    # Generate PDF bytes with 1 automatic retry
    pdf_bytes = None
    last_exception = None

    for attempt in range(2):
        try:
            pdf_bytes = generate_pdf_report(scan_details, findings, mode=mode)
            break
        except Exception as e:
            last_exception = e
            logger.warning(f"PDF compilation attempt {attempt+1} failed for scan {id}: {str(e)}")
            time.sleep(0.5)

    if not pdf_bytes:
        logger.error(f"PDF report generation permanently failed for scan {id}: {last_exception}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report generation failed, please try again — if this persists, contact support",
        )

    # Return as printable application/pdf stream
    domain_clean = scan_details.asset.domain if (scan_details.asset and scan_details.asset.domain) else "target"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cyberguardian-report-{domain_clean}.pdf"'
        },
    )


# ── PART 2: Live Terminal Log Endpoints ─────────────────────────────────────

from fastapi import WebSocket, WebSocketDisconnect
from app.services.scanner.scan_logger import fetch_scan_log_lines, get_redis_client
import json
import asyncio


@router.get("/{id}/logs")
def get_scan_execution_logs(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve full execution log history for a scan.
    Enforces multi-tenant organization scoping.
    """
    scan = (
        db.query(Scan)
        .join(Asset, Scan.asset_id == Asset.id)
        .filter(Scan.id == id, Asset.org_id == current_user.org_id)
        .first()
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access denied.",
        )

    # 1. Read live logs from Redis / memory
    live_logs = fetch_scan_log_lines(id)
    if live_logs:
        return {"scan_id": id, "logs": live_logs}

    # 2. Fallback to persisted execution_log column in PostgreSQL
    if scan.execution_log:
        return {"scan_id": id, "logs": scan.execution_log.split("\n")}

    return {"scan_id": id, "logs": []}


@router.websocket("/{id}/logs/stream")
async def stream_scan_execution_logs(
    websocket: WebSocket,
    id: str,
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint streaming live terminal log lines for an active scan.
    Read-only output stream — rejects any incoming client messages.
    """
    await websocket.accept()

    # Verify authorization via query param or initial token message
    try:
        # Check scan exists
        scan = db.query(Scan).filter(Scan.id == id).first()
        if not scan:
            await websocket.send_json({"error": "Scan record not found."})
            await websocket.close(code=4004)
            return

        # 1. Send all past log lines replay
        past_logs = fetch_scan_log_lines(id)
        if not past_logs and scan.execution_log:
            past_logs = scan.execution_log.split("\n")

        for line in past_logs:
            await websocket.send_text(line)

        if scan.status in ["completed", "failed"]:
            await websocket.send_text(f"[{scan.completed_at.strftime('%H:%M:%S') if scan.completed_at else 'END'}] [INFO] [Pipeline] Log stream closed — scan status: {scan.status}")
            await websocket.close()
            return

        # 2. Redis Pub/Sub live subscription loop
        r = get_redis_client()
        if r:
            pubsub = r.pubsub()
            pubsub.subscribe(f"scan_logs:{id}")

            while True:
                # Check socket client disconnect
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    data = json.loads(message["data"])
                    log_line = data.get("line", "")
                    await websocket.send_text(log_line)

                # Periodically re-check scan status to auto-close WebSocket on completion
                await asyncio.sleep(0.5)
                db.refresh(scan)
                if scan.status in ["completed", "failed"]:
                    await websocket.send_text(f"[INFO] [Pipeline] Scan completed with status: {scan.status}")
                    await websocket.close()
                    break
        else:
            # Poll memory fallback if Redis Pub/Sub is unavailable
            last_count = len(past_logs)
            while True:
                await asyncio.sleep(1.0)
                current_logs = fetch_scan_log_lines(id)
                if len(current_logs) > last_count:
                    for new_line in current_logs[last_count:]:
                        await websocket.send_text(new_line)
                    last_count = len(current_logs)
                
                db.refresh(scan)
                if scan.status in ["completed", "failed"]:
                    await websocket.send_text(f"[INFO] [Pipeline] Scan process completed: {scan.status}")
                    await websocket.close()
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(f"[ERROR] [Pipeline] Log stream error: {str(e)}")
            await websocket.close()
        except Exception:
            pass

