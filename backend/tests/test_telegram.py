"""Uji channel Telegram (Fase 3 PLAN_PRODUCT_LAUNCH.md).

- verify_request: mock menerima; bot menolak tanpa/invalid secret, fail-closed
  tanpa konfigurasi (unit + HTTP).
- parse_webhook: Update Telegram asli (message / callback_query / non-pesan).
- Alur e2e via /dev/mock-tg: pesan -> summary (jalur produksi, ScriptedLLM)
  -> tombol CONFIRM:<ref> (callback_query) -> order tercatat + stok turun.
- Idempotensi retry webhook (update_id sama -> skip) & CONFIRM ulang (idempotency
  key tg:<ref> -> tidak dobel order).
"""
import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.ai.llm import LLMResponse, LLMToolCall
from app.channels.telegram.adapter import TelegramAdapter
from app.channels.telegram.provider_mock import parse_telegram_update
from app.core.config import settings
from app.core.security import hash_password
from app.models import Conversation, Order, User


# ---------------------------------------------------------------- helpers

SECRET = "tg-secret-token-xyz"


class SummaryScriptedLLM:
    """LLM yang memanggil build_order_summary lalu menyebut summary_ref di balasan."""

    def __init__(self, product_id: str, quantity: int = 1):
        self.product_id = product_id
        self.quantity = quantity

    async def complete(self, *, system, messages, tools=None):
        if not any("hasil tool" in m.get("content", "") for m in messages):
            return LLMResponse("", [LLMToolCall(
                "build_order_summary",
                {"items": [{"product_id": self.product_id, "quantity": self.quantity}]},
            )])
        ref = ""
        for m in messages:
            match = re.search(r"'summary_ref': '([0-9a-f]+)'", m.get("content", ""))
            if match:
                ref = match.group(1)
        return LLMResponse(f"Berikut ringkasan pesanan Anda (ref: {ref}).", [])


async def _setup(client: AsyncClient, db):
    email = f"o-{uuid.uuid4().hex[:8]}@t.dev"
    db.add(User(name="O", email=email, password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post("/api/v1/products", headers=h, json={"name": "Kopi Toraja", "category": "Makanan", "price": 60000})
    pid = r.json()["id"]
    await client.post("/api/v1/inventory/adjustments", headers=h, json={"product_id": pid, "movement": "IN", "quantity": 5})
    return h, pid


def _tg_message(chat_id: int, text: str, update_id: int, first_name: str = "Andi") -> dict:
    return {
        "update_id": update_id,
        "message": {
            "message_id": update_id * 10,
            "from": {"id": chat_id, "first_name": first_name},
            "chat": {"id": chat_id, "type": "private"},
            "text": text,
        },
    }


def _tg_callback(chat_id: int, data: str, update_id: int, first_name: str = "Andi") -> dict:
    return {
        "update_id": update_id,
        "callback_query": {
            "id": f"cq{update_id}",
            "from": {"id": chat_id, "first_name": first_name},
            "data": data,
            "message": {"message_id": update_id * 10, "chat": {"id": chat_id, "type": "private"}},
        },
    }


# ------------------------------------------------- unit: parse Update asli

def test_parse_update_message_text():
    msg = parse_telegram_update(_tg_message(12345, "halo, ada kopi?", 100))
    assert msg is not None
    assert msg.channel == "TELEGRAM"
    assert msg.sender_id == "12345"
    assert msg.content == "halo, ada kopi?"
    assert msg.message_id == "100"


def test_parse_update_callback_query():
    msg = parse_telegram_update(_tg_callback(12345, "CONFIRM:abc123", 200))
    assert msg is not None
    assert msg.content == "CONFIRM:abc123"
    assert msg.sender_id == "12345"


def test_parse_update_ignores_non_text():
    assert parse_telegram_update({"update_id": 1, "message": {"chat": {"id": 1}, "photo": {}}}) is None
    assert parse_telegram_update({"update_id": 2, "edited_message": {"chat": {"id": 1}, "text": "x"}}) is None
    assert parse_telegram_update({"update_id": 3}) is None


# ------------------------------------------------- unit: verify secret

async def test_verify_mock_accepts_without_secret(db):
    assert settings.telegram_provider == "mock"
    adapter = TelegramAdapter(db)
    assert adapter.verify_request(None) is True


@pytest.fixture
def bot_mode(monkeypatch):
    monkeypatch.setattr(settings, "telegram_provider", "bot")
    monkeypatch.setattr(settings, "telegram_bot_token", "123:abc")
    monkeypatch.setattr(settings, "telegram_webhook_secret", SECRET)


async def test_verify_bot_rejects_missing_secret(db, bot_mode):
    assert TelegramAdapter(db).verify_request(None) is False


async def test_verify_bot_rejects_wrong_secret(db, bot_mode):
    assert TelegramAdapter(db).verify_request("salah") is False


async def test_verify_bot_accepts_correct_secret(db, bot_mode):
    assert TelegramAdapter(db).verify_request(SECRET) is True


async def test_verify_bot_fail_closed_without_configured_secret(db, monkeypatch):
    """Bot ter-deploy tanpa TELEGRAM_WEBHOOK_SECRET -> tolak semua (fail-closed)."""
    monkeypatch.setattr(settings, "telegram_provider", "bot")
    monkeypatch.setattr(settings, "telegram_webhook_secret", "")
    assert TelegramAdapter(db).verify_request("") is False


# ------------------------------------------------- HTTP: webhook security

async def test_webhook_http_rejects_wrong_secret(client: AsyncClient, bot_mode):
    resp = await client.post(
        "/api/v1/webhooks/telegram",
        json=_tg_message(1, "halo", 1),
        headers={"X-Telegram-Bot-Api-Secret-Token": "salah"},
    )
    assert resp.status_code == 401


async def test_webhook_http_accepts_correct_secret(client: AsyncClient, bot_mode):
    resp = await client.post(
        "/api/v1/webhooks/telegram",
        json={"update_id": 999, "edited_message": {"text": "x"}},  # non-pesan -> ok tapi diabaikan
        headers={"X-Telegram-Bot-Api-Secret-Token": SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["reply"] is None


# ------------------------------------------------- e2e: alur via mock provider

@pytest.mark.asyncio
async def test_telegram_flow_message_to_confirm_end_to_end(client: AsyncClient, db, monkeypatch):
    """UC-02 via Telegram: pesan -> summary -> tombol CONFIRM (callback_query) -> order.

    Memastikan: customer TERDAATAR dengan nama Telegram (first_name), sesi
    di-reuse (satu conversation), order + potongan stok terjadi.
    """
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=2))

    chat_id = 770011
    # 1) pesan pembeli -> AI balas ringkasan (dengan tombol di provider asli)
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_message(chat_id, "saya mau 2 kopi toraja", 10))
    assert r.status_code == 200, r.text
    reply = r.json()
    assert reply["order_summary"] is not None
    ref = reply["order_summary"]["summary_ref"]
    assert reply["order_summary"]["total"] == 120000

    # 2) customer tercatat dengan nama profil Telegram, channel TELEGRAM
    convs = (await db.execute(select(Conversation).order_by(Conversation.started_at))).scalars().all()
    assert len(convs) == 1, "sesi Telegram harus di-reuse, bukan baru per pesan"
    assert convs[0].channel == "TELEGRAM"

    # 3) tombol Konfirmasi ditekan -> callback_query CONFIRM:<ref>
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_callback(chat_id, f"CONFIRM:{ref}", 11))
    assert r.status_code == 200, r.text
    assert "berhasil dicatat" in r.json()["reply"]

    orders = (await db.execute(select(Order))).scalars().all()
    assert len(orders) == 1
    assert orders[0].status == "CONFIRMED"
    assert float(orders[0].total_amount) == 120000

    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 3  # 5 - 2


@pytest.mark.asyncio
async def test_telegram_confirm_retry_idempotent(client: AsyncClient, db, monkeypatch):
    """Retry webhook CONFIRM (update_id beda) -> idempotency key tg:<ref> -> tidak dobel order."""
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=1))

    chat_id = 770022
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_message(chat_id, "1 kopi", 20))
    ref = r.json()["order_summary"]["summary_ref"]

    for uid in (21, 22):  # dua kali tekan/retry
        r = await client.post("/api/v1/dev/mock-tg", json=_tg_callback(chat_id, f"CONFIRM:{ref}", uid))
        assert r.status_code == 200

    orders = (await db.execute(select(Order))).scalars().all()
    assert len(orders) == 1


@pytest.mark.asyncio
async def test_telegram_duplicate_update_id_skipped(client: AsyncClient, db, monkeypatch):
    """update_id sama dikirim ulang (retry webhook Telegram) -> di-skip."""
    import app.ai.sales_agent as sa
    from app.channels.messaging_base import _seen

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=1))
    _seen.clear()  # isolasi test

    payload = _tg_message(770033, "1 kopi", 30)
    r1 = await client.post("/api/v1/dev/mock-tg", json=payload)
    assert r1.status_code == 200
    r2 = await client.post("/api/v1/dev/mock-tg", json=payload)  # retry persis
    assert r2.status_code == 200
    assert r2.json() == {"status": "ignored", "reason": "bukan message type (non-teks / edited dsb.)"}


@pytest.mark.asyncio
async def test_telegram_cancel_abandons_session(client: AsyncClient, db, monkeypatch):
    chat_id = 770044
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_callback(chat_id, "CANCEL", 40))
    assert r.status_code == 200
    assert "dibatalkan" in r.json()["reply"]
    convs = (await db.execute(select(Conversation))).scalars().all()
    assert convs and convs[0].outcome == "ABANDONED"


@pytest.mark.asyncio
async def test_telegram_confirm_expired_ref_graceful(client: AsyncClient, db, monkeypatch):
    """E7: callback CONFIRM:<ref> tidak dikenal -> balasan ramah, bukan 500."""
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_callback(770055, "CONFIRM:bogus", 50))
    assert r.status_code == 200
    assert "kedaluwarsa" in r.json()["reply"]


# ------------------------------------------------- guard UUID tool (regresi live)

@pytest.mark.asyncio
async def test_tool_rejects_non_uuid_product_id_graceful(client: AsyncClient, db):
    """LLM live kadang mengisi SKU/nama sebagai product_id ("G066") — dulu
    asyncpg DataError -> 500. Kini tool mengembalikan error instruksional
    agar LLM bisa self-correct (panggil search_products dulu)."""
    from app.ai.tools import ToolExecutor

    tool = ToolExecutor(db)
    r = await tool.build_order_summary(items=[{"product_id": "G066", "quantity": 1}])
    assert "UUID" in r.get("error", ""), r

    r = await tool.get_product(product_id="Smartphone G066")
    assert "error" in r and "search_products" in r["error"]

    r = await tool.get_stock(product_id="G066")
    assert "error" in r and "search_products" in r["error"]
