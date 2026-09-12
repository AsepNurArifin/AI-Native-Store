"""Two genuine chat summaries race to confirm the last unit (FOR UPDATE)."""
import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.ai.llm import LLMResponse, LLMToolCall
from app.core.security import hash_password
from app.models import Order, User


class SummaryLLM:
    def __init__(self, product_id):
        self.product_id = product_id
        self.called = False

    async def complete(self, *, system, messages, tools=None):
        if not self.called:
            self.called = True
            return LLMResponse("", [LLMToolCall("build_order_summary", {
                "items": [{"product_id": self.product_id, "quantity": 1}],
            })])
        return LLMResponse("Periksa ringkasan sebelum konfirmasi.")


@pytest.mark.asyncio
async def test_concurrent_confirm_oversell_protection(client: AsyncClient, db, monkeypatch):
    import app.ai.sales_agent as sa

    db.add(User(name="O", email="o@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "o@t.dev", "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Laptop Langka", "category": "Laptop", "price": 5_000_000},
    )
    pid = r.json()["id"]
    await client.post(
        "/api/v1/inventory/adjustments", headers=h,
        json={"product_id": pid, "movement": "IN", "quantity": 1},
    )
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryLLM(pid))
    previews = []
    for customer in ("C1|1", "C2|2"):
        start = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": customer})
        conv = start.json()["conversation_id"]
        reply = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "Pesan satu laptop"})
        assert reply.status_code == 200, reply.text
        previews.append((conv, reply.json()["order_summary"]["summary_ref"]))
    # No manual injection into summary_store: both refs come from the real tool.
    assert previews[0][1] != previews[1][1]
    assert (await db.execute(select(func.count(Order.id)))).scalar_one() == 0

    async def confirm(conv, ref, key):
        return await client.post(
            f"/api/v1/chat/{conv}/confirm",
            json={"order_summary_ref": ref, "idempotency_key": key, "customer": {"name": "C"}},
        )

    results = await asyncio.gather(*(confirm(conv, ref, f"race-{i}") for i, (conv, ref) in enumerate(previews)))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert (await db.execute(select(func.count(Order.id)))).scalar_one() == 1
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 0
