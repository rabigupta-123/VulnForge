from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import Organization, User
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.services.scanner.active_ports import scan_ports
from app.services.scanner.active_dir import scan_directories
from app.services.scanner.active_subdomains import scan_subdomains
from app.workers.tasks import execute_scan_job

# Create a local test SQLite database with disabled expire-on-commit to avoid detached instance errors
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)


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


def test_scan_ports_logic():
    # Mock socket connections: allow port 22 and 3306, refuse others
    def mock_create_connection(address, timeout=None):
        host, port = address
        if port in [22, 3306]:
            return MagicMock()
        raise ConnectionRefusedError("Connection refused")

    with patch("socket.create_connection", side_effect=mock_create_connection):
        findings = scan_ports("ports-test.com")
        assert len(findings) == 2
        titles = [f["title"] for f in findings]
        assert "Exposed Database Service Port (Port 3306)" in titles
        assert "Exposed Management Interface Port (Port 22)" in titles


def test_scan_directories_env_exposure():
    # Mock requests to return a successful .env file only when requested
    def mock_requests_get(url, *args, **kwargs):
        mock_resp = MagicMock()
        if url.endswith("/.env"):
            mock_resp.status_code = 200
            mock_resp.text = "DB_PASSWORD=supersecret_pass\nSECRET_KEY=123"
        else:
            mock_resp.status_code = 404
            mock_resp.text = "Not Found"
        return mock_resp

    with patch("requests.get", side_effect=mock_requests_get):
        findings = scan_directories("dir-test.com")
        assert len(findings) == 1
        assert "Exposed Environment Config File" in findings[0]["title"]
        assert findings[0]["severity"] == "critical"


def test_scan_subdomains_crt_logs():
    # Mock crt.sh response with 2 subdomains
    mock_crt = MagicMock()
    mock_crt.status_code = 200
    mock_crt.json.return_value = [
        {"name_value": "api.subdomain-test.com"},
        {"name_value": "dev.subdomain-test.com"},
    ]

    with patch("requests.get", return_value=mock_crt):
        with patch("dns.resolver.Resolver.resolve", return_value=True):
            findings = scan_subdomains("subdomain-test.com")
            assert len(findings) == 1
            assert findings[0]["title"] == "Subdomains Discovered"


@patch("app.workers.tasks.scan_dns")
@patch("app.workers.tasks.scan_ssl")
@patch("app.workers.tasks.scan_headers")
@patch("app.workers.tasks.scan_tech")
@patch("app.workers.tasks.scan_robots_sitemap")
@patch("app.workers.tasks.scan_ai_exposure")
@patch("app.workers.tasks.scan_third_party_scripts")
@patch("app.workers.tasks.scan_ports")
@patch("app.workers.tasks.scan_directories")
@patch("app.workers.tasks.scan_subdomains")
def test_execute_scan_job_active_checks_gate(
    mock_sub, mock_dir, mock_ports, mock_tp, mock_ai, mock_robots, mock_tech, mock_headers, mock_ssl, mock_dns, db
):
    # Setup scanner mock data
    mock_dns.return_value = []
    mock_ssl.return_value = []
    mock_headers.return_value = []
    mock_tech.return_value = []
    mock_robots.return_value = []
    mock_ai.return_value = []
    mock_tp.return_value = []
    mock_ports.return_value = [
        {"title": "Exposed SSH Port", "category": "ports", "severity": "medium", "cvss_score": 5.0, "description": "desc", "remediation": "rem", "raw_output": "{}"}
    ]
    mock_dir.return_value = []
    mock_sub.return_value = []

    # Pre-populate workspace records
    org = Organization(name="Test Active Workspace")
    db.add(org)
    db.flush()
    user = User(email="test@user.com", role="owner", org_id=org.id)
    db.add(user)
    db.flush()

    # 1. TEST CASE A: Verified domain (should trigger active scanners)
    asset_verified = Asset(org_id=org.id, domain="verified.com", verification_status="verified", verification_token="tok1")
    db.add(asset_verified)
    db.flush()
    scan_a = Scan(asset_id=asset_verified.id, status="queued", scan_type="pentest", triggered_by=user.id)
    db.add(scan_a)
    db.commit()

    with patch("app.workers.tasks.SessionLocal", return_value=db):
        res = execute_scan_job(scan_a.id, "verified.com")
        assert res["status"] == "completed"
        assert res["findings_count"] == 1
        assert res["risk_score"] == 92  # 100 - 8 (medium)
        mock_ports.assert_called_once_with("verified.com")

    # Reset mock call counts
    mock_ports.reset_mock()

    # 2. TEST CASE B: Unverified domain (should SKIP active scanners)
    # Re-fetch or create a clean unverified asset bound to session
    asset_unverified = Asset(org_id=org.id, domain="unverified.com", verification_status="pending", verification_token="tok2")
    db.add(asset_unverified)
    db.flush()
    scan_b = Scan(asset_id=asset_unverified.id, status="queued", scan_type="pentest", triggered_by=user.id)
    db.add(scan_b)
    db.commit()

    with patch("app.workers.tasks.SessionLocal", return_value=db):
        res = execute_scan_job(scan_b.id, "unverified.com")
        assert res["status"] == "completed"
        # Active scanners must NOT have been called, resulting in 0 findings
        assert res["findings_count"] == 0
        assert res["risk_score"] == 100
        mock_ports.assert_not_called()
