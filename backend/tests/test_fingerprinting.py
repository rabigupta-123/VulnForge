from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User, Organization
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.services.scanner.tech_detect import scan_tech
from app.services.scanner.robots_sitemap import scan_robots_sitemap
from app.workers.tasks import execute_scan_job

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


def test_scan_tech_logic():
    # Mock requests.get response to return Server, X-Powered-By leaks, and a WordPress meta generator
    mock_resp = MagicMock()
    mock_resp.headers = {
        "Server": "nginx/1.18.0 (Ubuntu)",
        "X-Powered-By": "PHP/7.4.3",
    }
    mock_resp.text = """
    <html>
        <head>
            <meta name="generator" content="WordPress 6.2.2" />
        </head>
        <body>Test Page</body>
    </html>
    """
    mock_resp.status_code = 200

    with patch("requests.get", return_value=mock_resp):
        findings = scan_tech("fingerprint-test.com")
        assert len(findings) == 3
        titles = [f["title"] for f in findings]
        assert "Server Version Disclosure" in titles
        assert "X-Powered-By Information Disclosure" in titles
        assert "CMS / Framework Version Disclosure" in titles


def test_scan_robots_sitemap_disclosed_paths():
    # Mock robots.txt with sensitive disallows and sitemap.xml
    mock_robots = MagicMock()
    mock_robots.status_code = 200
    mock_robots.text = """
    User-agent: *
    Disallow: /admin/
    Disallow: /backups/
    Disallow: /public-images/
    """

    mock_sitemap = MagicMock()
    mock_sitemap.status_code = 200
    mock_sitemap.text = "<urlset></urlset>"

    def mock_requests_get(url, *args, **kwargs):
        if "robots.txt" in url:
            return mock_robots
        elif "sitemap.xml" in url:
            return mock_sitemap
        return MagicMock(status_code=404)

    with patch("requests.get", side_effect=mock_requests_get):
        findings = scan_robots_sitemap("robots-test.com")
        assert len(findings) == 2
        titles = [f["title"] for f in findings]
        assert "Sensitive Paths Disclosed in robots.txt" in titles
        assert "Sitemap Configuration Discovered" in titles


def test_scan_robots_sitemap_missing():
    # Mock failing requests (e.g. 404 missing files)
    mock_fail = MagicMock(status_code=404)

    with patch("requests.get", return_value=mock_fail):
        findings = scan_robots_sitemap("missing-files.com")
        # Should generate 1 finding: robots.txt File Missing (info)
        assert len(findings) == 1
        assert findings[0]["title"] == "robots.txt File Missing"


@patch("app.workers.tasks.scan_dns")
@patch("app.workers.tasks.scan_ssl")
@patch("app.workers.tasks.scan_headers")
@patch("app.workers.tasks.scan_tech")
@patch("app.workers.tasks.scan_robots_sitemap")
@patch("app.workers.tasks.scan_ai_exposure")
@patch("app.workers.tasks.scan_third_party_scripts")
def test_execute_scan_job_with_tech_findings(
    mock_tp, mock_ai, mock_robots, mock_tech, mock_headers, mock_ssl, mock_dns, db
):
    # Setup scanner mocks to return 1 low finding from tech detection and 1 info finding from robots
    mock_dns.return_value = []
    mock_ssl.return_value = []
    mock_headers.return_value = []
    mock_tech.return_value = [
        {"title": "Server Version Disclosure", "category": "info_disclosure", "severity": "low", "cvss_score": 3.3, "description": "desc", "remediation": "rem", "raw_output": "{}"}
    ]
    mock_robots.return_value = [
        {"title": "Sitemap Configuration Discovered", "category": "dns", "severity": "info", "cvss_score": 0.0, "description": "desc", "remediation": "rem", "raw_output": "{}"}
    ]
    mock_ai.return_value = []
    mock_tp.return_value = []

    # Pre-populate workspace records
    from app.models.user import Organization, User
    org = Organization(name="Test Workspace")
    db.add(org)
    db.flush()
    user = User(email="test@user.com", role="owner", org_id=org.id)
    db.add(user)
    db.flush()
    asset = Asset(org_id=org.id, domain="fingerprint.com", verification_status="pending", verification_token="token")
    db.add(asset)
    db.flush()
    scan = Scan(asset_id=asset.id, status="queued", triggered_by=user.id)
    db.add(scan)
    db.commit()

    # Run the Celery scanning task using local DB session
    with patch("app.workers.tasks.SessionLocal", return_value=db):
        res = execute_scan_job(scan.id, "fingerprint.com")
        assert res["status"] == "completed"
        assert res["findings_count"] == 2
        # Start at 100, deduct 3 for Server version leak (low) and 0 for Sitemap discovered (info) -> 97
        assert res["risk_score"] == 97

        # Verify DB updates
        scan_db = db.query(Scan).filter(Scan.id == scan.id).first()
        assert scan_db.status == "completed"
        assert scan_db.risk_score == 97

        findings_db = db.query(Finding).filter(Finding.scan_id == scan.id).all()
        assert len(findings_db) == 2
