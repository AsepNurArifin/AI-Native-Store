"""Uji pembuatan order atomik (FR-SMS-06): idempotency, stok kurang, pembatalan."""
import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models import User
async def _setup(client: AsyncClient, db):
    db.add(User(name="O", email="o@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "o@t.dev", "password": "x12345"})
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    # produk + stok 5
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Kopi Toraja", "category": "Makanan", "price": 60000},
    )
    pid = r.json()["id"]
    await client.post(
        "/api/v1/inventory/adjustments", headers=h,
        json={"product_id": pid, "movement": "IN", "quantity": 5},
    )
    # percakapan web
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Andi|081234"})
    conv = r.json()["conversation_id"]
    return h, pid, conv
@pytest.mark.asyncio
async def test_confirm_order_creates_order_and_deducts_stock(client: AsyncClient, db):
    h, pid, conv = await _setup(client, db)
    # bangun summary via SalesAgent (mock) — untuk tes langsung inject via tool path:
    from app.services.summary_store import put
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    put(OrderSummary(
        summary_ref="ref1", total=120000,
        items=[OrderSummaryItem(product_id=pid, name="Kopi Toraja", quantity=2,
                                unit_price=60000, discount=0, line_total=120000)],
    ))
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": "ref1", "idempotency_key": "idem-1", "customer": {"name": "Andi", "contact": "081234"}},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "CONFIRMED"
    assert data["total"] == 120000
    assert data["replayed"] is False
    # stok turun ke 3
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 3
    # order terlihat di list
    orders = await client.get("/api/v1/orders", headers=h)
    assert any(o["id"] == data["order_id"] for o in orders.json())
@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate(client: AsyncClient, db):
    h, pid, conv = await _setup(client, db)
    from app.services.summary_store import put
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    put(OrderSummary(
        summary_ref="ref2", total=60000,
        items=[OrderSummaryItem(product_id=pid, name="Kopi Toraja", quantity=1,
                                unit_price=60000, discount=0, line_total=60000)],
    ))
    body = {"order_summary_ref": "ref2", "idempotency_key": "idem-2", "customer": {"name": "Andi"}}
    r1 = await client.post(f"/api/v1/chat/{conv}/confirm", json=body)
    r2 = await client.post(f"/api/v1/chat/{conv}/confirm", json=body)
    assert r1.json()["order_id"] == r2.json()["order_id"]
    assert r2.json()["replayed"] is True
    # stok hanya berkurang sekali: 5 -> 4
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 4
@pytest.mark.asyncio
async def test_insufficient_stock_rejected(client: AsyncClient, db):
    h, pid, conv = await _setup(client, db)
    from app.services.summary_store import put
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    put(OrderSummary(
        summary_ref="ref3", total=300000,
        items=[OrderSummaryItem(product_id=pid, name="Kopi Toraja", quantity=99,
                                unit_price=60000, discount=0, line_total=5940000)],
    ))
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": "ref3", "idempotency_key": "idem-3", "customer": {"name": "Andi"}},
    )
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "INSUFFICIENT_STOCK"
@pytest.mark.asyncio
async def test_cancel_restores_stock(client: AsyncClient, db):
    h, pid, conv = await _setup(client, db)
    from app.services.summary_store import put
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    put(OrderSummary(
        summary_ref="ref4", total=60000,
        items=[OrderSummaryItem(product_id=pid, name="Kopi Toraja", quantity=1,
                                unit_price=60000, discount=0, line_total=60000)],
    ))
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": "ref4", "idempotency_key": "idem-4", "customer": {"name": "Andi"}},
    )
    oid = r.json()["order_id"]
    c = await client.post(f"/api/v1/orders/{oid}/cancel", headers=h)
    assert c.status_code == 200
    assert c.json()["status"] == "CANCELLED"
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 5
