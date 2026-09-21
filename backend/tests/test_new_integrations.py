import pytest
from unittest.mock import patch, MagicMock, ANY
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.asset import Asset
from app.models.user import Organization, User
from app.models.scan import Scan, Finding
from app.models.identity import IdentityCheck
from app.services.scanner.ai_exposure_scan import scan_ai_exposure
from app.services.scanner.third_party_scan import scan_third_party_scripts
from app.workers.tasks import send_scan_alerts

# Use in-memory SQLite with StaticPool to ensure all connections share the same database
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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


@pytest.fixture(scope="function", autouse=True)
def patch_session_local():
    with patch("app.workers.tasks.SessionLocal", TestingSessionLocal):
        yield


@pytest.fixture(scope="function")
def auth_header(client):
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "features_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "features_user@example.com", "password": "password123"}
    )
    if "access_token" not in login_res.json():
        print("REGISTRATION RESPONSE:", reg_res.status_code, reg_res.text)
        print("LOGIN RESPONSE:", login_res.status_code, login_res.text)
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@patch("requests.get")
def test_ai_exposure_and_third_party_scanners(mock_get):
    # 1. Mock HIBP/HTTP response for script search
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '<html><script src="https://cdn.com/jquery-2.2.4.js"></script><script src="/assets/index.js"></script></html>'
    
    mock_js_resp = MagicMock()
    mock_js_resp.status_code = 200
    mock_js_resp.text = 'const key = "sk-proj-123456789012345678901234567890123456789012345678";'
    
    mock_get.side_effect = lambda url, **kwargs: mock_js_resp if "index.js" in url else mock_resp

    # Run scanners
    ai_findings = scan_ai_exposure("test-target.com")
    tp_findings = scan_third_party_scripts("test-target.com")

    # Assert AI Exposure finding
    assert len(ai_findings) >= 1
    assert ai_findings[0]["category"] == "ai_exposure"
    assert "OpenAI API Key" in ai_findings[0]["title"]

    # Assert Third-party script finding
    assert len(tp_findings) >= 1
    assert tp_findings[0]["category"] == "third_party_script"
    assert "jquery" in tp_findings[0]["raw_output"]["library"].lower()
    assert tp_findings[0]["raw_output"]["detected_version"] == "2.2.4"


@patch("app.workers.tasks.execute_scan_job.delay")
def test_ci_webhook_scan_trigger(mock_celery, client, db, auth_header):
    # 1. Register asset target and verify it in DB
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "ci-trigger.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]
    from app.models.asset import Asset
    asset_obj = db.query(Asset).filter(Asset.id == asset_id).first()
    if asset_obj:
        asset_obj.verification_status = "verified"
        db.commit()

    # 2. Generate CI Token via asset POST endpoint
    res_token = client.post(f"/api/v1/assets/{asset_id}/ci-token", headers=auth_header)
    assert res_token.status_code == 200
    ci_token = res_token.json()["ci_token"]
    assert ci_token.startswith("cg_ci_")

    # 3. Trigger CI Webhook Scan
    res_webhook = client.post(
        "/api/v1/ci/webhook-scan",
        json={"asset_id": asset_id, "ci_token": ci_token}
    )
    assert res_webhook.status_code == 200
    assert "Scan triggered via CI/CD" in res_webhook.json()["message"]
    scan_id = res_webhook.json()["scan_id"]
    assert scan_id is not None

    # Assert Celery scan worker was queued
    mock_celery.assert_called_once()


@patch("requests.post")
def test_celery_scan_alerts(mock_post, db):
    # Mock requests.post response details for Slack webhook validation checks
    mock_post.return_value.status_code = 200
    mock_post.return_value.text = "ok"

    # 1. Create Organization with notification channels
    org = Organization(name="Alerting Org", subscription_tier="free")
    org.notification_channels = {
        "slack_webhook_url": "https://hooks.slack.com/alerts",
        "custom_webhook_url": "https://custom-webhook.com"
    }
    db.add(org)
    db.commit()
    db.refresh(org)

    # 2. Create Asset and Scan (specifying mandatory verification_token)
    asset = Asset(org_id=org.id, domain="alert-test.com", verification_token="tok123")
    db.add(asset)
    db.commit()
    db.refresh(asset)

    scan = Scan(asset_id=asset.id, status="completed", risk_score=80)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # 3. Create findings (Critical)
    f = Finding(scan_id=scan.id, category="owasp", severity="critical", title="SQL Injection vulnerability", status="open")
    db.add(f)
    db.commit()

    # 4. Trigger Alerts dispatch task
    res = send_scan_alerts(scan.id)
    assert res["status"] == "success"
    assert "slack" in res["dispatched_channels"]
    assert "custom_webhook" in res["dispatched_channels"]
    
    # Verify Slack POST webhook call
    mock_post.assert_any_call("https://hooks.slack.com/alerts", json=ANY, timeout=8)


def test_ai_grounded_assistant_qa(client, db, auth_header):
    # 1. Get current user org
    user = db.query(User).filter(User.email == "features_user@example.com").first()
    org_id = user.org_id

    # 2. Create Asset, Scan, and Finding (specifying mandatory verification_token)
    asset = Asset(org_id=org_id, domain="assistant-qa.com", verification_token="tok456")
    db.add(asset)
    db.commit()
    db.refresh(asset)

    scan = Scan(asset_id=asset.id, status="completed", risk_score=85, completed_at=datetime.now(timezone.utc))
    db.add(scan)
    db.commit()
    db.refresh(scan)

    f = Finding(scan_id=scan.id, category="ssl", severity="high", title="Outdated SSL Certificate version", description="Expired SSL Cert", status="open")
    db.add(f)
    db.commit()

    # 3. Call Ask Assistant endpoint (LLM mockup fallback)
    res_ask = client.post(
        "/api/v1/assistant/ask",
        json={"question": "What SSL issues do I have?"},
        headers=auth_header
    )
    assert res_ask.status_code == 200
    answer = res_ask.json()["answer"]
    assert "Outdated SSL Certificate version" in answer


def test_phone_otp_verification(client, db, auth_header):
    phone_number = "+15550199"

    # 1. Initiate Phone OTP Verification
    res_phone = client.post(
        "/api/v1/identity/phone",
        json={"phone": phone_number},
        headers=auth_header
    )
    assert res_phone.status_code == 201
    check_data = res_phone.json()
    assert check_data["identifier_value"] == phone_number
    assert check_data["verification_status"] == "pending"

    # Fetch OTP from the database by retrieving token
    db_check = db.query(IdentityCheck).filter(IdentityCheck.identifier_value == phone_number).first()
    assert db_check.otp_expires_at is not None

    # 2. Confirm OTP validation failure on incorrect code
    res_fail = client.post(
        "/api/v1/identity/phone/confirm",
        json={"phone": phone_number, "otp_code": "000000"},
        headers=auth_header
    )
    assert res_fail.status_code == 400
    assert "Invalid verification OTP" in res_fail.json()["detail"]

    # 3. Verify OTP validation succeeds when matched
    import hashlib
    otp_code = "654321"
    hashed_otp = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    db_check.verification_token = hashed_otp
    db.commit()

    res_success = client.post(
        "/api/v1/identity/phone/confirm",
        json={"phone": phone_number, "otp_code": otp_code},
        headers=auth_header
    )
    assert res_success.status_code == 200
    assert res_success.json()["verification_status"] == "verified"
    assert len(res_success.json()["breach_results"]) == 1
