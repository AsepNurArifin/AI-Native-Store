"""Uji koncurrensi: dua confirm bersamaan untuk stok 1 — hanya satu yang sukses (FOR UPDATE)."""
import asyncio
import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models import User
from app.schemas.chat import OrderSummary, OrderSummaryItem
from app.services.summary_store import put
@pytest.mark.asyncio
async def test_concurrent_confirm_oversell_protection(client: AsyncClient, db):
    db.add(User(name="O", email="o@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "o@t.dev", "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Laptop Langka", "category": "Elektronik", "price": 5_000_000},
    )
    pid = r.json()["id"]
    await client.post(
        "/api/v1/inventory/adjustments", headers=h,
        json={"product_id": pid, "movement": "IN", "quantity": 1},
    )
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "C1|1"})
    conv1 = r.json()["conversation_id"]
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "C2|2"})
    conv2 = r.json()["conversation_id"]
    for ref in ("race1", "race2"):
        put(OrderSummary(
            summary_ref=ref, total=5_000_000,
            items=[OrderSummaryItem(product_id=pid, name="Laptop Langka", quantity=1,
                                    unit_price=5_000_000, discount=0, line_total=5_000_000)],
        ))
    async def confirm(conv: str, key: str, ref: str):
        return await client.post(
            f"/api/v1/chat/{conv}/confirm",
            json={"order_summary_ref": ref, "idempotency_key": key, "customer": {"name": "C"}},
        )
    r1, r2 = await asyncio.gather(confirm(conv1, "k1", "race1"), confirm(conv2, "k2", "race2"))
    codes = sorted([r1.status_code, r2.status_code])
    assert codes == [200, 409], f"harusnya 1 sukses 1 gagal: {codes}"
    # stok akhir 0
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 0
