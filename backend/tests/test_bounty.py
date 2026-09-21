import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_bounty.db"
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


def test_bounty_program_creation_and_submission(client):
    # 1. Register owner user
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "bounty_owner@example.com", "password": "password123"}
    )
    assert reg_res.status_code == 201

    login_res = client.post(
        "/api/v1/auth/login",
        data={"username": "bounty_owner@example.com", "password": "password123"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Bounty Program
    prog_res = client.post(
        "/api/v1/bounty/programs",
        headers=headers,
        json={
            "name": "Acme Security Bounty",
            "description": "Public vulnerability disclosure program.",
            "visibility": "public",
            "safe_harbor_text": "Authorized testing under terms.",
            "scopes": [
                {"asset_type": "domain", "target": "api.example.com", "in_scope": True, "notes": "Primary API"},
                {"asset_type": "domain", "target": "admin.example.com", "in_scope": False, "notes": "Out of scope portal"}
            ],
            "reward_tiers": [
                {"severity": "critical", "min_amount": 1000, "max_amount": 5000, "currency": "USD"}
            ]
        }
    )
    assert prog_res.status_code == 201
    prog_data = prog_res.json()
    prog_id = prog_data["id"]

    # 3. Get Program detail
    detail_res = client.get(f"/api/v1/bounty/programs/{prog_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["name"] == "Acme Security Bounty"
    assert len(detail["scopes"]) == 2

    in_scope_id = [s["id"] for s in detail["scopes"] if s["in_scope"]][0]
    out_scope_id = [s["id"] for s in detail["scopes"] if not s["in_scope"]][0]

    # 4. Register researcher user
    reg_r = client.post(
        "/api/v1/auth/register",
        json={"email": "hacker@example.com", "password": "password123"}
    )
    assert reg_r.status_code == 201
    token_r = client.post(
        "/api/v1/auth/login",
        data={"username": "hacker@example.com", "password": "password123"}
    ).json()["access_token"]
    headers_r = {"Authorization": f"Bearer {token_r}"}

    # 5. Submit report against OUT-OF-SCOPE target (must fail with 400)
    fail_sub = client.post(
        f"/api/v1/bounty/programs/{prog_id}/reports",
        headers=headers_r,
        json={
            "title": "SQLi on admin portal",
            "description": "Exploit on admin target",
            "steps_to_reproduce": "Step 1...",
            "affected_scope_id": out_scope_id,
            "severity_claimed": "critical"
        }
    )
    assert fail_sub.status_code == 400
    assert "OUT-OF-SCOPE" in fail_sub.json()["detail"]

    # 6. Submit report against IN-SCOPE target (must succeed)
    succ_sub = client.post(
        f"/api/v1/bounty/programs/{prog_id}/reports",
        headers=headers_r,
        json={
            "title": "IDOR in User Endpoint",
            "description": "User ID parameter tampering",
            "steps_to_reproduce": "1. Send GET /user/12",
            "affected_scope_id": in_scope_id,
            "severity_claimed": "high"
        }
    )
    assert succ_sub.status_code == 201
    report_id = succ_sub.json()["report_id"]

    # 7. Owner triages report
    triage_res = client.patch(
        f"/api/v1/bounty/reports/{report_id}/triage",
        headers=headers,
        json={
            "status": "accepted",
            "severity_confirmed": "high",
            "cvss_score": 8.5,
            "reward_amount": 1500.0
        }
    )
    assert triage_res.status_code == 200
    assert triage_res.json()["status"] == "accepted"
    assert triage_res.json()["reward_amount"] == 1500.0
    assert triage_res.json()["disclosure_eligible_at"] is not None
