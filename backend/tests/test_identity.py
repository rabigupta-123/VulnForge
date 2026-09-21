import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.asset import Asset
from app.models.identity import IdentityCheck

# Create a local test SQLite database for identity feature tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_identity.db"
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
        json={"email": "identity_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "identity_user@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_email_registration_and_confirmation(client, db, auth_header):
    # 1. Register email target
    res_reg = client.post(
        "/api/v1/identity/email",
        json={"email": "target@corp-sec.com"},
        headers=auth_header
    )
    assert res_reg.status_code == 201
    reg_data = res_reg.json()
    assert reg_data["identifier_value"] == "target@corp-sec.com"
    assert reg_data["verification_status"] == "pending"
    token = reg_data["verification_token"]
    assert token is not None

    # 2. Confirm email via redirection link
    res_confirm = client.get(
        f"/api/v1/identity/confirm?token={token}",
        follow_redirects=False
    )
    # Redirect code is 307 Temporary Redirect (or 302/303)
    assert res_confirm.status_code in [302, 303, 307]
    assert "results_ready=true&tab=identity" in res_confirm.headers["Location"]

    # 3. Verify database updates
    db_check = db.query(IdentityCheck).filter(IdentityCheck.verification_token == token).first()
    assert db_check.verification_status == "verified"
    assert db_check.breach_results is not None
    # Mock fallback returns 2 breaches
    assert len(db_check.breach_results) == 2
    assert db_check.breach_results[0]["Name"] == "Canva"


def test_domain_wide_asset_checks(client, db, auth_header):
    # 1. Register a verified domain asset target
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "sec-corp.net", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # Force verification status
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.verification_status = "verified"
    db.commit()

    # 2. Check domain breaches
    res_check = client.post(
        f"/api/v1/identity/domain/{asset_id}/check",
        headers=auth_header
    )
    assert res_check.status_code == 200
    check_data = res_check.json()
    assert check_data["identifier_value"] == "sec-corp.net"
    assert check_data["verification_status"] == "verified"
    assert len(check_data["breach_results"]) == 1
    assert check_data["breach_results"][0]["Name"] == "Domain-wide Leak"


def test_domain_wide_unverified_asset_fails(client, db, auth_header):
    # 1. Register a pending domain asset target
    res_asset = client.post(
        "/api/v1/assets/",
        json={"domain": "unverified-sec.net", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_asset.json()["id"]

    # 2. Check domain breaches should fail with 403 Forbidden
    res_check = client.post(
        f"/api/v1/identity/domain/{asset_id}/check",
        headers=auth_header
    )
    assert res_check.status_code == 403
    assert "DNS ownership verification" in res_check.json()["detail"]


@patch("requests.get")
def test_password_k_anonymity_proxy(mock_get, client, auth_header):
    # Mock HIBP range API response text
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "ABCDE:3\nFFFFF:24"
    mock_get.return_value = mock_response

    # Call password proxy check
    res_proxy = client.post(
        "/api/v1/identity/password-check",
        json={"prefix": "12345"},
        headers=auth_header
    )
    assert res_proxy.status_code == 200
    data = res_proxy.json()
    assert "ABCDE:3" in data["suffixes"]
    mock_get.assert_called_once_with("https://api.pwnedpasswords.com/range/12345", timeout=10)
