"""Uji auth (FR-AUTH-01..04): login, JWT, role guard."""
import pytest
from httpx import AsyncClient
async def _seed_user(db, *, email="owner@test.dev", password="pw12345", role="OWNER"):
    from app.core.security import hash_password
    from app.models import User
    u = User(name="Tester", email=email, password_hash=hash_password(password), role=role)
    db.add(u)
    await db.commit()
    return u
@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db):
    await _seed_user(db)
    resp = await client.post("/api/v1/auth/login", json={"email": "owner@test.dev", "password": "pw12345"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["user"]["role"] == "OWNER"
@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db):
    await _seed_user(db)
    resp = await client.post("/api/v1/auth/login", json={"email": "owner@test.dev", "password": "salah"})
    assert resp.status_code == 401
@pytest.mark.asyncio
async def test_me_requires_token(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
@pytest.mark.asyncio
async def test_owner_only_endpoint_blocks_staff(client: AsyncClient, db):
    await _seed_user(db, email="staff@test.dev", role="STAFF")
    login = await client.post("/api/v1/auth/login", json={"email": "staff@test.dev", "password": "pw12345"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/ai-actions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
