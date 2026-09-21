from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User, Organization
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.services.reporting.pdf_gen import generate_pdf_report

# Setup test DB engine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)


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
        json={"email": "report_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "report_user@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_generate_pdf_report_bytes():
    # Setup mock Scan and Finding objects
    mock_asset = MagicMock()
    mock_asset.domain = "testdomain.com"
    
    mock_scan = MagicMock()
    mock_scan.id = "mock-scan-id"
    mock_scan.asset = mock_asset
    mock_scan.risk_score = 75
    mock_scan.completed_at = datetime.now(timezone.utc)

    mock_finding = MagicMock()
    mock_finding.title = "Mock Vulnerability"
    mock_finding.severity = "high"
    mock_finding.category = "headers"
    mock_finding.cvss_score = 7.5
    mock_finding.owasp_mapping = "A05:2021"
    mock_finding.mitre_mapping = "T1566"
    mock_finding.description = "Detailed vulnerability description"
    mock_finding.remediation = "Fix code configuration"

    pdf_bytes = generate_pdf_report(mock_scan, [mock_finding])
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    # PDF files must start with standard magic bytes %PDF
    assert pdf_bytes.startswith(b"%PDF")


def test_download_report_unauthenticated(client):
    response = client.get("/api/v1/scans/some-scan-id/report")
    assert response.status_code == 401


def test_download_report_success(client, db, auth_header):
    user = db.query(User).filter(User.email == "report_user@example.com").first()
    org_id = user.org_id

    # Create owned asset, scan, and findings
    asset = Asset(org_id=org_id, domain="my-domain.com", verification_status="verified", verification_token="tok")
    db.add(asset)
    db.flush()

    scan = Scan(
        asset_id=asset.id,
        status="completed",
        risk_score=95,
        triggered_by=user.id,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(scan)
    db.flush()

    finding = Finding(
        scan_id=scan.id,
        category="dns",
        severity="low",
        title="Missing SPF",
        description="desc",
        remediation="rem",
        raw_output="{}",
    )
    db.add(finding)
    db.commit()

    # Query report download API route
    response = client.get(f"/api/v1/scans/{scan.id}/report", headers=auth_header)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert "my-domain.com" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_download_report_cross_org_denied(client, db, auth_header):
    # Create another organization
    org2 = Organization(name="Other Organization")
    db.add(org2)
    db.flush()

    asset2 = Asset(org_id=org2.id, domain="other-domain.com", verification_status="verified", verification_token="tok2")
    db.add(asset2)
    db.flush()

    scan2 = Scan(
        asset_id=asset2.id,
        status="completed",
        risk_score=100,
        started_at=datetime.now(timezone.utc),
    )
    db.add(scan2)
    db.commit()

    # Query scan2 report using user1 credentials (must fail with 404 scoping block)
    response = client.get(f"/api/v1/scans/{scan2.id}/report", headers=auth_header)
    assert response.status_code == 404
    assert "Scan record not found or access denied" in response.json()["detail"]


from unittest.mock import MagicMock
