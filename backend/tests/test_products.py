"""Uji produk & stok (FR-SMS-01/02/03)."""
import pytest
from httpx import AsyncClient
async def _owner_token(client: AsyncClient, db) -> str:
    from app.core.security import hash_password
    from app.models import User
    db.add(User(name="O", email="o@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "o@t.dev", "password": "x12345"})
    return r.json()["access_token"]
def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
@pytest.mark.asyncio
async def test_create_and_list_product(client: AsyncClient, db):
    token = await _owner_token(client, db)
    r = await client.post(
        "/api/v1/products",
        headers=_auth(token),
        json={"name": "Kopi Gayo", "category": "Makanan", "price": 45000, "low_stock_threshold": 5},
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["current_stock"] == 0
    lst = await client.get("/api/v1/products?status=ACTIVE", headers=_auth(token))
    assert any(p["id"] == pid for p in lst.json())
@pytest.mark.asyncio
async def test_stock_summary_and_adjustment(client: AsyncClient, db):
    token = await _owner_token(client, db)
    r = await client.post(
        "/api/v1/products", headers=_auth(token),
        json={"name": "Vitamin C", "category": "Kesehatan", "price": 20000},
    )
    pid = r.json()["id"]
    adj = await client.post(
        "/api/v1/inventory/adjustments", headers=_auth(token),
        json={"product_id": pid, "movement": "IN", "quantity": 10},
    )
    assert adj.status_code == 201
    summary = await client.get("/api/v1/inventory/summary", headers=_auth(token))
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 10
    assert row["is_low_stock"] is False
@pytest.mark.asyncio
async def test_delete_product_blocked_when_referenced(client: AsyncClient, db):
    token = await _owner_token(client, db)
    r = await client.post(
        "/api/v1/products", headers=_auth(token),
        json={"name": "Produk X", "category": "Fashion", "price": 50000},
    )
    pid = r.json()["id"]
    # buat inventory transaction (referensi)
    await client.post(
        "/api/v1/inventory/adjustments", headers=_auth(token),
        json={"product_id": pid, "movement": "IN", "quantity": 1},
    )
    d = await client.delete(f"/api/v1/products/{pid}", headers=_auth(token))
    assert d.status_code == 409
