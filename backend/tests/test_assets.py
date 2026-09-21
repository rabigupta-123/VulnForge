from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db

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
        json={"email": "asset_owner@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "asset_owner@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_asset_anonymous(client):
    # Registration must fail for unauthenticated requests
    response = client.post(
        "/api/v1/assets/",
        json={"domain": "example.com", "verification_method": "dns_txt"}
    )
    assert response.status_code == 401


def test_create_asset(client, auth_header):
    # Add a domain with a protocol and path; check that it is cleaned to host root
    response = client.post(
        "/api/v1/assets/",
        json={"domain": "https://dev.example.com/some/path?query=1", "verification_method": "file_upload"},
        headers=auth_header
    )
    assert response.status_code == 201
    data = response.json()
    assert data["domain"] == "dev.example.com"  # cleaned correctly
    assert data["verification_method"] == "file_upload"
    assert data["verification_status"] == "pending"
    assert "verification_token" in data
    assert "id" in data


def test_read_assets(client, auth_header):
    # Create multiple assets under the authenticated org workspace
    client.post(
        "/api/v1/assets/",
        json={"domain": "one.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    client.post(
        "/api/v1/assets/",
        json={"domain": "two.com", "verification_method": "file_upload"},
        headers=auth_header
    )

    response = client.get("/api/v1/assets/", headers=auth_header)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    domains = [a["domain"] for a in data]
    assert "one.com" in domains
    assert "two.com" in domains


def test_trigger_verification_dns_success(client, auth_header):
    # Create a pending asset
    res_create = client.post(
        "/api/v1/assets/",
        json={"domain": "verifieddns.com", "verification_method": "dns_txt"},
        headers=auth_header
    )
    asset_id = res_create.json()["id"]

    # Mock DNS lookup to return True
    with patch("app.api.v1.endpoints.assets.check_dns_txt_verification", return_value=True) as mock_dns:
        res_verify = client.post(f"/api/v1/assets/{asset_id}/verify", headers=auth_header)
        assert res_verify.status_code == 200
        data = res_verify.json()
        assert data["verification_status"] == "verified"
        assert data["verified_at"] is not None
        mock_dns.assert_called_once_with("verifieddns.com", data["verification_token"])


def test_trigger_verification_file_fail(client, auth_header):
    # Create a pending asset
    res_create = client.post(
        "/api/v1/assets/",
        json={"domain": "failedfile.com", "verification_method": "file_upload"},
        headers=auth_header
    )
    asset_id = res_create.json()["id"]

    # Mock file retrieval check to return False
    with patch("app.api.v1.endpoints.assets.check_file_verification", return_value=False) as mock_file:
        res_verify = client.post(f"/api/v1/assets/{asset_id}/verify", headers=auth_header)
        assert res_verify.status_code == 200
        data = res_verify.json()
        assert data["verification_status"] == "failed"
        assert data["verified_at"] is None
        mock_file.assert_called_once_with("failedfile.com", data["verification_token"])
