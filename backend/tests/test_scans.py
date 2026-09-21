from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.models.user import User, Organization
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.services.scanner.passive_dns import scan_dns
from app.services.scanner.passive_ssl import scan_ssl
from app.services.scanner.passive_headers import scan_headers
from app.workers.tasks import execute_scan_job
from app.main import app

# Create a local test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        # Teardown test tables
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    # Override database dependency mapping to local test DB session
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
    # Register and log in a user helper
    client.post(
        "/api/v1/auth/register",
        json={"email": "scanner_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "scanner_user@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_trigger_scan_unverified(client, auth_header):
    # Register a new target domain but leave it unverified
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "unverified.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # Triggering scan on unverified domain must fail with 403 Forbidden
    res_scan = client.post(
        "/api/v1/scans/",
        json={"asset_id": asset_id},
        headers=auth_header
    )
    assert res_scan.status_code == 403
    assert "verification is required" in res_scan.json()["detail"]


@patch("app.workers.tasks.execute_scan_job.delay")
def test_trigger_scan_verified(mock_celery, client, auth_header, db):
    # Register domain asset
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "verified.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # Manually bypass verification status in DB
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.verification_status = "verified"
    db.add(asset)
    db.commit()

    # Trigger scan (should succeed since target is verified)
    res_scan = client.post(
        "/api/v1/scans/",
        json={"asset_id": asset_id},
        headers=auth_header
    )
    assert res_scan.status_code == 201
    scan_data = res_scan.json()
    assert scan_data["status"] == "queued"
    assert scan_data["asset_id"] == asset_id

    # Verify background worker job enqueued
    mock_celery.assert_called_once_with(scan_data["id"], "verified.com")


def test_scan_dns_logic():
    # Mock DNS lookup resolution to trigger fallback/missing checks
    with patch("dns.resolver.Resolver.resolve", side_effect=Exception("Lookup failed")):
        findings = scan_dns("nonexistent.com")
        # Should detect two findings (Missing SPF and Missing DMARC)
        assert len(findings) == 2
        titles = [f["title"] for f in findings]
        assert "Missing SPF Record" in titles
        assert "Missing DMARC Record" in titles


def test_scan_ssl_logic():
    # Test closed port (no findings generated, just skipped)
    with patch("socket.create_connection", side_effect=Exception("Connection refused")):
        findings = scan_ssl("closedport.com")
        assert len(findings) == 0

    # Test SSL verification error (invalid cert)
    import ssl
    with patch("socket.create_connection"):
        with patch("ssl.create_default_context") as mock_ctx:
            mock_ctx.return_value.wrap_socket.side_effect = ssl.SSLCertVerificationError("Self-signed cert")
            findings = scan_ssl("selfsigned.com")
            assert len(findings) == 1
            assert findings[0]["title"] == "Invalid SSL/TLS Certificate Verification"


def test_scan_headers_logic():
    # Mock requests.get response to return basic headers and insecure cookies
    mock_response = MagicMock()
    mock_response.headers = {
        "Content-Type": "text/html",
        "Set-Cookie": "session_id=123;"  # Missing HttpOnly and Secure attributes
    }
    mock_response.text = "<html></html>"
    mock_response.status_code = 200

    with patch("requests.get", return_value=mock_response):
        findings = scan_headers("vulnerable.com")
        titles = [f["title"] for f in findings]
        assert "Missing Content Security Policy (CSP) Header" in titles
        assert "Missing HTTP Strict Transport Security (HSTS) Header" in titles
        assert "Insecure Cookie Configuration" in titles


@patch("app.workers.tasks.scan_dns")
@patch("app.workers.tasks.scan_ssl")
@patch("app.workers.tasks.scan_headers")
@patch("app.workers.tasks.scan_tech")
@patch("app.workers.tasks.scan_robots_sitemap")
@patch("app.workers.tasks.scan_ai_exposure")
@patch("app.workers.tasks.scan_third_party_scripts")
def test_execute_scan_job_task(mock_tp, mock_ai, mock_robots, mock_tech, mock_headers, mock_ssl, mock_dns, db):
    # Setup mock scanning findings
    mock_dns.return_value = [
        {"title": "Missing SPF Record", "category": "dns", "severity": "medium", "cvss_score": 4.3, "description": "desc", "remediation": "rem", "raw_output": "{}"}
    ]
    mock_ssl.return_value = []
    mock_headers.return_value = [
        {"title": "Missing Content Security Policy (CSP) Header", "category": "headers", "severity": "medium", "cvss_score": 5.3, "description": "desc", "remediation": "rem", "raw_output": "{}"}
    ]
    mock_tech.return_value = []
    mock_robots.return_value = []
    mock_ai.return_value = []
    mock_tp.return_value = []

    # Pre-populate dummy records for task run context
    from app.models.user import Organization, User
    org = Organization(name="Test Org")
    db.add(org)
    db.flush()
    user = User(email="test@user.com", role="owner", org_id=org.id)
    db.add(user)
    db.flush()
    asset = Asset(org_id=org.id, domain="testscan.com", verification_status="pending", verification_token="tok")
    db.add(asset)
    db.flush()
    scan = Scan(asset_id=asset.id, status="queued", triggered_by=user.id)
    db.add(scan)
    db.commit()

    # Inject test database session in place of SessionLocal
    with patch("app.workers.tasks.SessionLocal", return_value=db):
        res = execute_scan_job(scan.id, "testscan.com")
        assert res["status"] == "completed"
        assert res["findings_count"] == 2
        # Start at 100, deduct 8 (medium) for SPF and 8 (medium) for CSP -> 84
        assert res["risk_score"] == 84

        # Verify database scan state
        db.expire_all()
        scan_db = db.query(Scan).filter(Scan.id == scan.id).first()
        assert scan_db.status == "completed"
        assert scan_db.risk_score == 84

        # Verify DB findings entries
        findings_db = db.query(Finding).filter(Finding.scan_id == scan.id).all()
        assert len(findings_db) == 2
