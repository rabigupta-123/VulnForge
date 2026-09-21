from datetime import datetime, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User, Organization
from app.models.asset import Asset
from app.models.scan import Scan

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


def test_auth_registration_creates_stripe_customer(client, db):
    # 1. Register a new user
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "billing@example.com", "password": "securepassword123"}
    )
    assert response.status_code == 201
    data = response.json()

    # 2. Check the organization table to verify a mock Stripe Customer ID was saved
    org = db.query(Organization).filter(Organization.id == data["org_id"]).first()
    assert org is not None
    assert org.stripe_customer_id is not None
    assert org.stripe_customer_id.startswith("cus_mock_")
    assert org.subscription_tier == "free"


@patch("app.api.v1.endpoints.scans.execute_scan_job.delay")
def test_scan_gating_and_webhook_tier_updates(mock_celery_task_delay, client, db):
    # 1. Register user
    client.post(
        "/api/v1/auth/register",
        json={"email": "saaS@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "saaS@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user/org references from DB
    user = db.query(User).filter(User.email == "saaS@example.com").first()
    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    cust_id = org.stripe_customer_id

    # 2. Register and verify asset
    asset = Asset(org_id=org.id, domain="gate-test.com", verification_status="verified", verification_token="tok")
    db.add(asset)
    db.commit()

    # 3. Trigger 3 scans (succeeds)
    for i in range(3):
        res = client.post("/api/v1/scans/", json={"asset_id": asset.id}, headers=headers)
        assert res.status_code == 201
        scan_id = res.json()["id"]
        s = db.query(Scan).filter(Scan.id == scan_id).first()
        if s:
            s.status = "completed"
            db.commit()

    # 4. Triggering 4th scan must be blocked on Free Tier with 402 Payment Required
    res_fail = client.post("/api/v1/scans/", json={"asset_id": asset.id}, headers=headers)
    assert res_fail.status_code == 402
    assert "Scan limit reached" in res_fail.json()["detail"]

    # 5. Simulate Stripe customer.subscription.created webhook upgrading them to Pro
    webhook_payload = {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "customer": cust_id,
                "metadata": {
                    "tier": "pro"
                }
            }
        }
    }
    # Send webhook event
    res_webhook = client.post("/api/v1/billing/webhook", json=webhook_payload)
    assert res_webhook.status_code == 200

    # Refresh DB session, assert org is upgraded to Pro
    db.refresh(org)
    assert org.subscription_tier == "pro"

    # 6. Triggering 4th scan now succeeds (unlimited scans on Pro)
    res_success = client.post("/api/v1/scans/", json={"asset_id": asset.id}, headers=headers)
    assert res_success.status_code == 201
    scan_id_4 = res_success.json()["id"]
    s4 = db.query(Scan).filter(Scan.id == scan_id_4).first()
    if s4:
        s4.status = "completed"
        db.commit()

    # 7. Simulate subscription cancellation (customer.subscription.deleted) downgrading back to free
    webhook_cancel = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": cust_id
            }
        }
    }
    res_webhook_cancel = client.post("/api/v1/billing/webhook", json=webhook_cancel)
    assert res_webhook_cancel.status_code == 200

    # Refresh DB and check tier is free again
    db.refresh(org)
    assert org.subscription_tier == "free"

    # 8. Triggering 5th scan is blocked once again
    res_blocked_again = client.post("/api/v1/scans/", json={"asset_id": asset.id}, headers=headers)
    assert res_blocked_again.status_code == 402



