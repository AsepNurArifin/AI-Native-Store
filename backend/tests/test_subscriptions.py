"""Uji funnel subscribe (Fase 2 PLAN_PRODUCT_LAUNCH.md) + rate-limit P5.

- POST /api/v1/subscriptions: publik, validasi, status PENDING.
- GET  /api/v1/subscriptions: khusus OWNER (panel admin).
- Rate-limit: 5 req/menit/IP -> 429 + Retry-After.
"""
import pytest
from httpx import AsyncClient

from app.core import rate_limit as rl
from app.core.config import settings


async def _seed_owner(db):
    from app.core.security import hash_password
    from app.models import User

    u = User(name="Owner", email="owner@test.dev", password_hash=hash_password("pw12345"), role="OWNER")
    db.add(u)
    await db.commit()
    return u


_VALID = {
    "store_name": "Toko Bu Ratna",
    "owner_name": "Ratna",
    "contact": "081234567890",
    "plan": "trial",
}


@pytest.mark.asyncio
async def test_subscribe_success(client: AsyncClient):
    resp = await client.post("/api/v1/subscriptions", json=_VALID)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "PENDING"  # mock billing: menunggu aktivasi manual
    assert data["plan"] == "trial"
    assert data["store_name"] == "Toko Bu Ratna"
    assert "id" in data


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value",
    [
        ("store_name", "T"),                       # < 2 karakter
        ("owner_name", "  "),                      # kosong setelah strip
        ("contact", "bukan-kontak"),               # bukan email/WA
        ("plan", "enterprise"),                    # paket tak dikenal
    ],
)
async def test_subscribe_validation(client: AsyncClient, field, value):
    payload = {**_VALID, field: value}
    resp = await client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("contact", ["ratna@email.com", "+6281234567890", "0812-3456-789", "6281234567890"])
async def test_subscribe_contact_formats(client: AsyncClient, contact):
    resp = await client.post("/api/v1/subscriptions", json={**_VALID, "contact": contact})
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_subscribe_plan_defaults_to_trial(client: AsyncClient):
    payload = {k: v for k, v in _VALID.items() if k != "plan"}
    resp = await client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 201
    assert resp.json()["plan"] == "trial"


@pytest.mark.asyncio
async def test_list_subscriptions_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/subscriptions")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_subscriptions_owner(client: AsyncClient, db):
    await _seed_owner(db)
    await client.post("/api/v1/subscriptions", json=_VALID)
    await client.post("/api/v1/subscriptions", json={**_VALID, "plan": "monthly", "store_name": "Toko Kedua"})

    login = await client.post("/api/v1/auth/login", json={"email": "owner@test.dev", "password": "pw12345"})
    token = login.json()["access_token"]

    resp = await client.get("/api/v1/subscriptions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 2
    # terbaru dulu
    assert rows[0]["store_name"] == "Toko Kedua"


@pytest.mark.asyncio
async def test_subscribe_rate_limited(client: AsyncClient, monkeypatch):
    """P5: lewat 5 request/menit/IP dari IP sama -> 429 + Retry-After."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True, raising=False)
    monkeypatch.setattr(rl, "_buckets", {})  # bucket bersih per test

    for i in range(5):
        resp = await client.post(
            "/api/v1/subscriptions",
            json={**_VALID, "store_name": f"Toko {i}"},
            headers={"X-Forwarded-For": "203.0.113.7"},
        )
        assert resp.status_code == 201

    resp = await client.post(
        "/api/v1/subscriptions",
        json={**_VALID, "store_name": "Toko Keenam"},
        headers={"X-Forwarded-For": "203.0.113.7"},
    )
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


@pytest.mark.asyncio
async def test_rate_limit_per_ip(client: AsyncClient, monkeypatch):
    """IP berbeda punya bucket terpisah — satu IP kena limit tidak memblokir lainnya."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True, raising=False)
    monkeypatch.setattr(rl, "_buckets", {})

    for i in range(5):
        await client.post(
            "/api/v1/subscriptions",
            json={**_VALID, "store_name": f"Toko A{i}"},
            headers={"X-Forwarded-For": "198.51.100.1"},
        )
    blocked = await client.post(
        "/api/v1/subscriptions",
        json=_VALID,
        headers={"X-Forwarded-For": "198.51.100.1"},
    )
    assert blocked.status_code == 429

    other = await client.post(
        "/api/v1/subscriptions",
        json=_VALID,
        headers={"X-Forwarded-For": "198.51.100.2"},
    )
    assert other.status_code == 201
