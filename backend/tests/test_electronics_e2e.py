"""Public electronics flow; only LLM responses are scripted, services/DB are real.

These tests prove orchestration, not the quality/accuracy of a live model.
"""
import ast

import httpx
import pytest
from sqlalchemy import func, select

from app.ai.llm import LLM, LLMResponse, LLMToolCall
from app.core.security import hash_password
from app.models import Order, User
from app.seed.generate import _flat_catalog


def tool_result(messages, name):
    prefix = f"hasil tool {name}: "
    message = next(m["content"] for m in reversed(messages) if m["content"].startswith(prefix))
    return ast.literal_eval(message[len(prefix):])


class ElectronicsLLM:
    """Choose IDs only from production search results, never from fixtures."""

    def __init__(self):
        self.step = 0
        self.selected = None
        self.compared = []

    async def complete(self, *, system, messages, tools=None):
        step = self.step
        self.step += 1
        if step == 0:
            return LLMResponse("", [LLMToolCall("search_products", {
                "category": "Laptop", "ram_min_gb": 16, "budget_max": 12_000_000,
                "storage_min_gb": 512, "stock_only": True,
            })])
        if step == 1:
            found = tool_result(messages, "search_products")["items"]
            assert len(found) == 2
            self.selected = found[0]
            return LLMResponse("", [LLMToolCall("compare_products", {"product_ids": [p["id"] for p in found]})])
        if step == 2:
            self.compared = tool_result(messages, "compare_products")["compared"]
            text = "; ".join(f"{p['name']}: RAM {p['specification']['ram_gb']}GB, {p['specification']['prosesor']}" for p in self.compared)
            return LLMResponse(text)
        if step == 3:
            return LLMResponse("", [LLMToolCall("build_order_summary", {
                "items": [{"product_id": self.selected["id"], "quantity": 1}],
            })])
        summary = tool_result(messages, "build_order_summary")["summary"]
        return LLMResponse(f"Total Rp{summary['total']}; periksa ringkasan lalu konfirmasi.")


async def owner_headers(client, db):
    db.add(User(name="Owner", email="electronics@test.dev", password_hash=hash_password("testpass"), role="OWNER"))
    await db.commit()
    login = await client.post("/api/v1/auth/login", json={"email": "electronics@test.dev", "password": "testpass"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.asyncio
async def test_recommend_compare_buy_confirm_retry_and_admin(client, db, monkeypatch):
    import app.ai.sales_agent as sa

    headers = await owner_headers(client, db)
    names = {"Lenovo IdeaPad Slim 5 i5/16/512GB", "Acer Swift Go 14 Ryzen 7/16/512GB", "ASUS Vivobook 14 A1404ZA i3/8/512GB"}
    for category, name, price, spec in _flat_catalog():
        if name not in names:
            continue
        created = await client.post("/api/v1/products", headers=headers, json={
            "name": name, "category": category, "price": price, "specification": spec,
        })
        assert created.status_code == 201, created.text
        stocked = await client.post("/api/v1/inventory/adjustments", headers=headers, json={
            "product_id": created.json()["id"], "movement": "IN", "quantity": 3,
        })
        assert stocked.is_success, stocked.text

    llm = ElectronicsLLM()
    monkeypatch.setattr(sa, "get_llm", lambda model=None: llm)
    started = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Dewi|081234"})
    conv = started.json()["conversation_id"]
    reply = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "Bandingkan laptop RAM 16GB, SSD 512GB di bawah 12 juta"})
    assert reply.status_code == 200, reply.text
    cards = reply.json()["products"]
    assert len(cards) == 2 and len(llm.compared) == 2
    assert all(p["specification"]["ram_gb"] == 16 and p["price"] <= 12_000_000 for p in cards)
    # The data path preserves unknown fields instead of inventing values.
    assert all("garansi" not in p["specification"] for p in llm.compared)
    assert reply.json()["order_summary"] is None

    reply = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "Mau yang Lenovo satu unit"})
    assert reply.status_code == 200, reply.text
    summary = reply.json()["order_summary"]
    assert summary["total"] == 10_499_000
    assert (await db.execute(select(func.count(Order.id)))).scalar_one() == 0
    body = {"order_summary_ref": summary["summary_ref"], "idempotency_key": "electronics-retry", "customer": {"name": "Dewi", "contact": "081234"}}
    for _ in range(2):
        confirmed = await client.post(f"/api/v1/chat/{conv}/confirm", json=body)
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["total"] == summary["total"]
    orders = await client.get("/api/v1/orders", headers=headers)
    assert orders.status_code == 200
    assert len(orders.json()) == 1
    assert orders.json()[0]["status"] == "CONFIRMED"
    product = await client.get(f"/api/v1/products/{llm.selected['id']}", headers=headers)
    assert product.json()["current_stock"] == 2


@pytest.mark.asyncio
async def test_llm_timeout_is_explicit_and_creates_no_order(client, db, monkeypatch):
    import app.ai.sales_agent as sa

    class TimeoutProvider:
        async def complete(self, **kwargs):
            raise httpx.ReadTimeout("simulated provider outage")

    # Use the real facade's degradation path without constructing an HTTP client.
    llm = object.__new__(LLM)
    llm.provider = TimeoutProvider()
    monkeypatch.setattr(sa, "get_llm", lambda model=None: llm)
    started = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Dewi|081234"})
    conv = started.json()["conversation_id"]
    reply = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "Beli iPhone satu"})
    assert reply.status_code == 200, reply.text
    assert "sementara tidak tersedia" in reply.json()["reply"]
    assert reply.json()["order_summary"] is None
    assert reply.json()["products"] == []
    assert (await db.execute(select(func.count(Order.id)))).scalar_one() == 0
