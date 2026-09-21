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


def test_register_user(client):
    # Test registering a brand new user
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "owner"
    assert "id" in data
    assert "org_id" in data

    # Test registering a duplicate email (should fail)
    response_dup = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "anotherpassword"}
    )
    assert response_dup.status_code == 400
    assert "already registered" in response_dup.json()["detail"]


def test_login(client):
    # Register user first
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "password123"}
    )

    # Test correct login credentials
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "login@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Test incorrect credentials
    response_fail = client.post(
        "/api/v1/auth/login",
        data={"username": "login@example.com", "password": "wrongpassword"}
    )
    assert response_fail.status_code == 401


def test_read_user_me(client):
    email = "me@example.com"
    password = "mypassword"

    # Register user
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password}
    )

    # Log in
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password}
    )
    token = login_res.json()["access_token"]

    # Fetch current user profile details using valid access token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == email

    # Fetch profile without authentication token (should fail)
    me_res_no_auth = client.get("/api/v1/auth/me")
    assert me_res_no_auth.status_code == 401
