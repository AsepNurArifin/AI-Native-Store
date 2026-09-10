"""Uji SalesAgent (FR-SA-01/02/03) dengan mock LLM + chat API."""
import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models import User
@pytest.mark.asyncio
async def test_chat_start_and_message(client: AsyncClient, db):
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Tono|08123"})
    assert r.status_code == 200
    conv = r.json()["conversation_id"]
    r = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "halo, cari produk"})
    assert r.status_code == 200
    data = r.json()
    assert data["reply"]  # ada balasan AI (mock)
    # percakapan tercatat
    from app.services.conversation_service import ConversationService
    result = await ConversationService.detail(db, conv)
    assert result is not None
    conv_obj, messages, _ = result
    assert len(messages) == 2  # customer + AI
    assert messages[0].sender == "CUSTOMER"
    assert messages[1].sender == "AI"
@pytest.mark.asyncio
async def test_confirm_expired_summary(client: AsyncClient, db):
    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Tono|08123"})
    conv = r.json()["conversation_id"]
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": "TIDAK-ADA", "idempotency_key": "x", "customer": {"name": "Tono"}},
    )
    assert r.status_code == 410


# ---- Fix 1.3: /chat/analyst/ask wajib auth (FR-AUTH-02, UC-03) ----


@pytest.mark.asyncio
async def test_analyst_ask_requires_token(client: AsyncClient, db):
    r = await client.post("/api/v1/chat/analyst/ask", json={"question": "berapa total penjualan"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_analyst_ask_owner_ok(client: AsyncClient, db):
    db.add(User(name="O", email="analyst@t.dev", password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "analyst@t.dev", "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post("/api/v1/chat/analyst/ask", headers=h, json={"question": "berapa total penjualan"})
    assert r.status_code == 200
    body = r.json()
    assert body["disclaimer"]  # FR-BA-05: disclaimer selalu ada
