from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.asset import Asset
from app.models.scan import Scan, Finding
from app.services.ai.explainer import explain_finding, extract_json_object
from app.workers.tasks import execute_scan_job

# Create a local test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        db_session.expire_on_commit = False
        yield db_session
    finally:
        db_session.close()
        # Teardown test tables
        Base.metadata.drop_all(bind=engine)


def test_extract_json_object():
    # Test JSON inside markdown backticks
    text_backticks = "Here is your response:\n```json\n{\n  \"explanation\": \"hello\"\n}\n```"
    res1 = extract_json_object(text_backticks)
    assert res1["explanation"] == "hello"

    # Test raw clean JSON string
    text_raw = "{\n  \"explanation\": \"world\"\n}"
    res2 = extract_json_object(text_raw)
    assert res2["explanation"] == "world"

    # Test error raising for invalid input
    with pytest.raises(ValueError):
        extract_json_object("plain text response without braces")


@patch("app.core.config.settings.GEMINI_API_KEY", new="mock_api_key")
def test_explain_finding_success():
    # Mock HTTP 200 response with a valid JSON block
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": "```json\n{\n  \"explanation\": \"AI explanation\",\n  \"remediation\": \"AI remediation\",\n  \"cvss_score\": 7.2,\n  \"owasp_mapping\": \"A02\",\n  \"mitre_mapping\": \"T1059\"\n}\n```"
                        }
                    ]
                }
            }
        ]
    }

    with patch("requests.post", return_value=mock_resp):
        res = explain_finding("Missing SPF", "dns", "medium", "{}")
        assert res is not None
        assert res["explanation"] == "AI explanation"
        assert res["cvss_score"] == 7.2
        assert res["mitre_mapping"] == "T1059"


@patch("app.core.config.settings.GEMINI_API_KEY", new="mock_api_key")
def test_explain_finding_api_failure():
    # Mock HTTP 500 error from API
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"

    with patch("requests.post", return_value=mock_resp):
        res = explain_finding("Missing SPF", "dns", "medium", "{}")
        # Explainer must handle status code gracefully by returning None
        assert res is None


@patch("app.core.config.settings.GEMINI_API_KEY", new=None)
def test_explain_finding_missing_key():
    # Explainer must skip processing and return None instantly if key is empty
    res = explain_finding("Missing SPF", "dns", "medium", "{}")
    assert res is None


@patch("app.workers.tasks.scan_dns")
@patch("app.workers.tasks.scan_ssl")
@patch("app.workers.tasks.scan_headers")
@patch("app.workers.tasks.scan_tech")
@patch("app.workers.tasks.scan_robots_sitemap")
def test_execute_scan_job_with_ai_integration(
    mock_robots, mock_tech, mock_headers, mock_ssl, mock_dns, db
):
    # Setup mock scanning findings
    mock_dns.return_value = [
        {"title": "Missing SPF Record", "category": "dns", "severity": "medium", "cvss_score": 4.3, "description": "default desc", "remediation": "default rem", "raw_output": "{}"}
    ]
    mock_ssl.return_value = []
    mock_headers.return_value = []
    mock_tech.return_value = []
    mock_robots.return_value = []

    # Pre-populate workspace records
    from app.models.user import Organization, User
    org = Organization(name="Test AI Workspace")
    db.add(org)
    db.flush()
    user = User(email="test@user.com", role="owner", org_id=org.id)
    db.add(user)
    db.flush()
    asset = Asset(org_id=org.id, domain="aitest.com", verification_status="pending", verification_token="tok")
    db.add(asset)
    db.flush()
    scan = Scan(asset_id=asset.id, status="queued", triggered_by=user.id)
    db.add(scan)
    db.commit()

    # Case A: Mock explain_finding to return enriched AI data
    mock_ai_explanation = {
        "explanation": "AI explanation text",
        "remediation": "AI remediation code",
        "cvss_score": 5.8,
        "owasp_mapping": "A09",
        "mitre_mapping": "T1566"
    }

    with patch("app.workers.tasks.explain_finding", return_value=mock_ai_explanation):
        with patch("app.workers.tasks.SessionLocal", return_value=db):
            res = execute_scan_job(scan.id, "aitest.com")
            assert res["status"] == "completed"

            # Check database finding record to verify it was populated with AI values
            finding = db.query(Finding).filter(Finding.scan_id == scan.id).first()
            assert finding is not None
            assert finding.description == "AI explanation text"
            assert finding.remediation == "AI remediation code"
            assert finding.cvss_score == 5.8
            assert finding.owasp_mapping == "A09"
            assert finding.mitre_mapping == "T1566"

    # Case B: Mock explain_finding to return None (API key missing / request failed)
    # Re-trigger a fresh scan
    scan2 = Scan(asset_id=asset.id, status="queued", triggered_by=user.id)
    db.add(scan2)
    db.commit()

    with patch("app.workers.tasks.explain_finding", return_value=None):
        with patch("app.workers.tasks.SessionLocal", return_value=db):
            res = execute_scan_job(scan2.id, "aitest.com")
            assert res["status"] == "completed"

            # Check database finding record to verify it fell back to default scanner templates
            finding = db.query(Finding).filter(Finding.scan_id == scan2.id).first()
            assert finding is not None
            assert finding.description == "default desc"
            assert finding.remediation == "default rem"
            assert finding.cvss_score == 4.3
