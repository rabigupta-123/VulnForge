"""
Multi-Tenant Organization Isolation Security Tests.
Verifies that Organization A cannot access, query, or mutate Organization B's data across all endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User, Organization
from app.models.asset import Asset

client = TestClient(app)


def test_organization_data_isolation():
    """
    CRITICAL SECURITY TEST:
    Verifies that User A (Org A) receives 404/403 when trying to access Assets & Scans of Org B.
    """
    db = SessionLocal()
    import uuid
    uid_a = str(uuid.uuid4())[:8]
    uid_b = str(uuid.uuid4())[:8]
    try:
        # 1. Setup Org A and User A
        org_a = Organization(name="Org A Workspace", subscription_tier="pro")
        db.add(org_a)
        db.commit()
        db.refresh(org_a)

        user_a = User(
            email=f"user_a_iso_{uid_a}@orga.com",
            password_hash="hashed_pw_a",
            role="admin",
            org_id=org_a.id
        )
        db.add(user_a)

        # 2. Setup Org B and User B with an Asset
        org_b = Organization(name="Org B Workspace", subscription_tier="pro")
        db.add(org_b)
        db.commit()
        db.refresh(org_b)

        user_b = User(
            email=f"user_b_iso_{uid_b}@orgb.com",
            password_hash="hashed_pw_b",
            role="admin",
            org_id=org_b.id
        )
        db.add(user_b)

        asset_b = Asset(
            org_id=org_b.id,
            domain="target-org-b-isolation.com",
            verification_token="token_hash_b_12345",
            verification_status="verified"
        )
        db.add(asset_b)
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(asset_b)

        # 3. Authenticate as User A
        token_a = create_access_token(user_a.id)
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 4. Attempt to trigger scan on Org B's asset as User A -> MUST FAIL (404/403)
        res = client.post(
            "/api/v1/scans/",
            headers=headers_a,
            json={"asset_id": asset_b.id, "scan_type": "vulnerability"}
        )
        assert res.status_code in [404, 403, 409], f"Org A accessed Org B asset with status: {res.status_code}"

        # 5. Attempt to read Org B assets list as User A -> MUST NOT CONTAIN asset_b
        res_assets = client.get("/api/v1/assets/", headers=headers_a)
        assert res_assets.status_code == 200
        assets_data = res_assets.json()
        domains = [a["domain"] for a in assets_data]
        assert "target-org-b-isolation.com" not in domains, "Org A assets list leaked Org B domain!"
    finally:
        db.close()
