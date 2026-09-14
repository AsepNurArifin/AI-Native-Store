"""Uji katalog publik (/catalog) untuk halaman rak + fulfillment order (WEB)."""
import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models import User


async def _seed(client: AsyncClient, db):
    db.add(User(name="O", email="o@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "o@t.dev", "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Laptop Contoh", "category": "Laptop", "price": 8000000},
    )
    pid = r.json()["id"]
    await client.post(
        "/api/v1/inventory/adjustments", headers=h,
        json={"product_id": pid, "movement": "IN", "quantity": 3},
    )
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Rina|0812"})
    return h, pid, r.json()["conversation_id"]


@pytest.mark.asyncio
async def test_catalog_public_no_token(client: AsyncClient, db):
    _, pid, _ = await _seed(client, db)
    r = await client.get("/api/v1/catalog/categories")
    assert r.status_code == 200
    assert "Laptop" in r.json()

    r = await client.get("/api/v1/catalog/products", params={"category": "Laptop"})
    assert r.status_code == 200
    products = r.json()
    assert len(products) == 1
    assert products[0]["id"] == pid
    assert products[0]["current_stock"] == 3


@pytest.mark.asyncio
async def test_catalog_requires_category(client: AsyncClient, db):
    await _seed(client, db)
    r = await client.get("/api/v1/catalog/products")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_confirm_with_delivery_fulfillment_persisted(client: AsyncClient, db):
    h, pid, conv = await _seed(client, db)
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    from app.services.summary_store import put

    put(OrderSummary(
        summary_ref="ref-dlv", total=8000000,
        items=[OrderSummaryItem(product_id=pid, name="Laptop Contoh", quantity=1,
                                unit_price=8000000, discount=0, line_total=8000000)],
    ))
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={
            "order_summary_ref": "ref-dlv", "idempotency_key": "idem-dlv",
            "customer": {"name": "Rina", "contact": "0812"},
            "fulfillment": {
                "method": "DELIVERY", "recipient": "Rina", "phone": "0812",
                "address": "Jl. Contoh No. 1", "notes": "Titip resepsionis",
            },
        },
    )
    assert r.status_code == 200
    order_id = r.json()["order_id"]

    r = await client.get(f"/api/v1/orders/{order_id}", headers=h)
    assert r.status_code == 200
    fulfillment = r.json()["fulfillment"]
    assert fulfillment["method"] == "DELIVERY"
    assert fulfillment["address"] == "Jl. Contoh No. 1"
    assert fulfillment["notes"] == "Titip resepsionis"


@pytest.mark.asyncio
async def test_confirm_rejects_bad_fulfillment_method(client: AsyncClient, db):
    _, pid, conv = await _seed(client, db)
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    from app.services.summary_store import put

    put(OrderSummary(
        summary_ref="ref-bad", total=8000000,
        items=[OrderSummaryItem(product_id=pid, name="Laptop Contoh", quantity=1,
                                unit_price=8000000, discount=0, line_total=8000000)],
    ))
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={
            "order_summary_ref": "ref-bad", "idempotency_key": "idem-bad",
            "customer": {"name": "Rina", "contact": "0812"},
            "fulfillment": {"method": "KURIR_LEBIH_CEPAT"},
        },
    )
    assert r.status_code == 422
