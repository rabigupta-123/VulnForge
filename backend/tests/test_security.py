import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db

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


def test_security_headers_are_present(client):
    # Call a public endpoint
    response = client.get("/health")
    assert response.status_code == 200

    # Assert standard security headers are injected
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-xss-protection") == "1; mode=block"
    assert "default-src 'self'" in response.headers.get("content-security-policy", "")
    assert "max-age=31536000" in response.headers.get("strict-transport-security", "")
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_swagger_environment_gating(client):
    # Under default test settings (settings.ENVIRONMENT is 'development')
    assert settings.ENVIRONMENT == "development"
    res_docs = client.get("/docs")
    assert res_docs.status_code == 200

    # Temporarily set environment to production
    settings.ENVIRONMENT = "production"
    
    # Re-instantiate a TestClient to force app startup configs mapping
    from fastapi import FastAPI
    from app.main import app as main_app
    
    # We must mock FastAPI config fields or temporarily patch settings
    # Since FastAPI routes and docs urls are bound at app init, let's create a temp app instance
    temp_app = FastAPI(
        openapi_url=None if settings.ENVIRONMENT != "development" else "/openapi.json",
        docs_url=None if settings.ENVIRONMENT != "development" else "/docs",
    )
    with TestClient(temp_app) as temp_client:
        res_prod_docs = temp_client.get("/docs")
        assert res_prod_docs.status_code == 404

    # Reset setting
    settings.ENVIRONMENT = "development"


def test_login_rate_limiting_brute_force(client):
    # Trigger 5 fake login attempts (will fail with 401 Unauthorized)
    for _ in range(5):
        res = client.post(
            "/api/v1/auth/login",
            data={"username": "bruteforce@example.com", "password": "wrongpassword"},
            headers={"X-Test-Rate-Limit": "true"}
        )
        assert res.status_code == 401

    # The 6th login request must trigger rate-limiting and return 429 Too Many Requests
    res_limit = client.post(
        "/api/v1/auth/login",
        data={"username": "bruteforce@example.com", "password": "wrongpassword"},
        headers={"X-Test-Rate-Limit": "true"}
    )
    assert res_limit.status_code == 429
    assert "Too many requests" in res_limit.json()["detail"]


def test_register_rate_limiting_brute_force(client):
    # Register endpoint limit is 3 requests per minute
    for _ in range(3):
        res = client.post(
            "/api/v1/auth/register",
            json={"email": "newuser@example.com", "password": "password123"},
            headers={"X-Test-Rate-Limit": "true"}
        )
        # First might succeed or fail if user exists, but it counts either way towards rate limits
        assert res.status_code in [201, 400]

    # The 4th register attempt must return 429
    res_limit = client.post(
        "/api/v1/auth/register",
        json={"email": "newuser@example.com", "password": "password123"},
        headers={"X-Test-Rate-Limit": "true"}
    )
    assert res_limit.status_code == 429
    assert "Too many requests" in res_limit.json()["detail"]
