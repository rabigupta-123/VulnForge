from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User, Organization
from app.models.asset import Asset
from app.models.scan import Scan, Finding

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
    # Register and log in a dummy user
    client.post(
        "/api/v1/auth/register",
        json={"email": "dashboard_user@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "dashboard_user@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_overview_unauthenticated(client):
    # Anonymous requests must receive 401 Unauthorized
    response = client.get("/api/v1/dashboard/overview")
    assert response.status_code == 401


def test_dashboard_overview_success(client, db, auth_header):
    # 1. Retrieve the registered user and their auto-created Organization ID from the DB
    user = db.query(User).filter(User.email == "dashboard_user@example.com").first()
    assert user is not None
    org_id = user.org_id

    # 2. Add assets to this organization
    asset1 = Asset(org_id=org_id, domain="acme.com", verification_status="verified", verification_token="tok1")
    asset2 = Asset(org_id=org_id, domain="test.acme.com", verification_status="pending", verification_token="tok2")
    db.add(asset1)
    db.add(asset2)
    db.flush()

    # 3. Add scans
    now = datetime.now(timezone.utc)
    scan1 = Scan(
        asset_id=asset1.id,
        status="completed",
        risk_score=80,
        triggered_by=user.id,
        started_at=now - timedelta(minutes=10),
        completed_at=now - timedelta(minutes=8),
    )
    scan2 = Scan(
        asset_id=asset1.id,
        status="completed",
        risk_score=90,
        triggered_by=user.id,
        started_at=now - timedelta(minutes=5),
        completed_at=now - timedelta(minutes=3),
    )
    scan3 = Scan(
        asset_id=asset2.id,
        status="queued",
        triggered_by=user.id,
        started_at=now,
    )
    db.add(scan1)
    db.add(scan2)
    db.add(scan3)
    db.flush()

    # 4. Add findings (1 critical, 2 medium)
    f1 = Finding(
        scan_id=scan1.id,
        category="directories",
        severity="critical",
        title="Critical Alert",
        description="desc",
        remediation="rem",
        raw_output="{}",
    )
    f2 = Finding(
        scan_id=scan1.id,
        category="ports",
        severity="medium",
        title="Medium Alert A",
        description="desc",
        remediation="rem",
        raw_output="{}",
    )
    f3 = Finding(
        scan_id=scan1.id,
        category="headers",
        severity="medium",
        title="Medium Alert B",
        description="desc",
        remediation="rem",
        raw_output="{}",
    )
    db.add(f1)
    db.add(f2)
    db.add(f3)
    db.commit()

    # 5. Query the Dashboard API
    response = client.get("/api/v1/dashboard/overview", headers=auth_header)
    assert response.status_code == 200
    res_data = response.json()

    # 6. Verify metric assertions
    assert res_data["total_assets"] == 2
    assert res_data["total_scans"] == 3
    assert res_data["critical_findings"] == 1
    assert res_data["high_findings"] == 0
    assert res_data["medium_findings"] == 2
    assert res_data["average_risk_score"] == 85.0  # Average of 80 and 90
    assert len(res_data["recent_scans"]) == 3
    assert res_data["recent_scans"][0]["domain"] == "test.acme.com"  # scan3 is queued (started latest)
