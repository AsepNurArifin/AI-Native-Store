"""Uji SalesAgent (FR-SA-01/02/03) dengan mock LLM + chat API."""
import pytest
from httpx import AsyncClient
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
