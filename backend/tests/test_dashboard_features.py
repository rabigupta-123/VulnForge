import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.asset import Asset
from app.models.scan import Scan, Finding

# Create a local test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_features.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_header(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "audit_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "audit_user@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_scan_drift_tracking(client, db, auth_header):
    # 1. Create a verified asset
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "drift-test.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]
    
    # Force verification in DB
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.verification_status = "verified"
    db.commit()

    # 2. Create Scan 1
    scan1 = Scan(asset_id=asset_id, status="completed", risk_score=90)
    db.add(scan1)
    db.commit()
    db.refresh(scan1)

    f1 = Finding(scan_id=scan1.id, category="ssl", severity="medium", title="Vulnerability A", description="Desc A", remediation="Rem A", status="open")
    db.add(f1)
    db.commit()

    # 3. Create Scan 2
    scan2 = Scan(asset_id=asset_id, status="completed", risk_score=85)
    db.add(scan2)
    db.commit()
    db.refresh(scan2)

    # Finding A is resolved, but Finding B is new
    f2 = Finding(scan_id=scan2.id, category="ssl", severity="high", title="Vulnerability B", description="Desc B", remediation="Rem B", status="open")
    db.add(f2)
    db.commit()

    # 4. Fetch drift trend
    res_trend = client.get(f"/api/v1/assets/{asset_id}/trend", headers=auth_header)
    assert res_trend.status_code == 200
    data = res_trend.json()
    assert len(data["trends"]) == 2
    
    latest_trend = data["trends"][-1]
    assert latest_trend["new_findings_count"] == 1
    assert latest_trend["resolved_findings_count"] == 1
    assert latest_trend["new_findings"][0]["title"] == "Vulnerability B"
    assert latest_trend["resolved_findings"][0]["title"] == "Vulnerability A"


def test_compliance_mapping(client, db, auth_header):
    # Create asset, scan, and findings
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "compliance-test.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    scan = Scan(asset_id=asset_id, status="completed", risk_score=80)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Create a finding mapping to port scan (SOC 2 CC6.1, ISO 27001 A.13.1.1, DPDP Section 8(5))
    f = Finding(scan_id=scan.id, category="ports", severity="high", title="Open MySQL", description="Open database port", remediation="Close it", status="open")
    db.add(f)
    db.commit()

    res_comp = client.get(f"/api/v1/scans/{scan.id}/compliance", headers=auth_header)
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    
    # Verify mapping percentages and blocker counts
    assert "SOC 2" in comp_data
    assert comp_data["SOC 2"]["percentage"] == 67  # 2 ready, 1 blocked (2/3 = 66.6% -> rounds to 67)
    assert comp_data["SOC 2"]["controls"][0]["status"] == "blocked"
    assert comp_data["SOC 2"]["controls"][0]["blockers"][0]["title"] == "Open MySQL"


def test_finding_status_and_recalculation(client, db, auth_header):
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "status-test.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    scan = Scan(asset_id=asset_id, status="completed", risk_score=75) # 100 - 25 = 75
    db.add(scan)
    db.commit()
    db.refresh(scan)

    f = Finding(scan_id=scan.id, category="ssl", severity="critical", title="Expired SSL Certificate", description="SSL cert expired", remediation="Renew certificate", status="open")
    db.add(f)
    db.commit()

    # Update status to accepted_risk
    res_update = client.patch(
        f"/api/v1/findings/{f.id}/status",
        json={"status": "accepted_risk", "note": "Business approved risk."},
        headers=auth_header
    )
    assert res_update.status_code == 200
    
    # Risk score should now be recalculated to 100 because the critical finding is accepted_risk!
    db.refresh(scan)
    assert scan.risk_score == 100
    
    db.refresh(f)
    assert f.status == "accepted_risk"
    assert f.status_note == "Business approved risk."


def test_public_trust_badge(client, db, auth_header):
    # Use API post to populate org_id properly
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "badge-test.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # Force verification status
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.verification_status = "verified"
    db.commit()

    scan = Scan(asset_id=asset_id, status="completed", risk_score=92)
    db.add(scan)
    db.commit()

    # Public unauthenticated request
    res_badge = client.get(f"/api/v1/badge/{asset_id}.svg")
    assert res_badge.status_code == 200
    assert "image/svg+xml" in res_badge.headers["Content-Type"]
    svg_content = res_badge.text
    assert "GRADE A" in svg_content


@patch("app.workers.tasks.run_dependency_scan.delay")
def test_github_linkage_and_dependency_check(mock_celery, client, db, auth_header):
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "github-test.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # Link GitHub repo
    res_git = client.post(
        f"/api/v1/assets/{asset_id}/github",
        json={"github_repo": "acme/demo-project", "github_token": "gh_token_123"},
        headers=auth_header
    )
    assert res_git.status_code == 200
    assert res_git.json()["github_repo"] == "acme/demo-project"

    # Trigger dependency check (queues background Celery task, mocked)
    mock_celery.return_value = MagicMock(id="mock-task-id-555")
    res_check = client.post(
        f"/api/v1/assets/{asset_id}/check-dependencies",
        headers=auth_header
    )
    assert res_check.status_code == 200
    assert res_check.json()["task_id"] == "mock-task-id-555"
