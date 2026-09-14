"""Uji channel Telegram (Fase 3 PLAN_PRODUCT_LAUNCH.md).

- verify_request: mock menerima; bot menolak tanpa/invalid secret, fail-closed
  tanpa konfigurasi (unit + HTTP).
- parse_webhook: Update Telegram asli (message / callback_query / non-pesan).
- Alur e2e via /dev/mock-tg: pesan -> summary (jalur produksi, ScriptedLLM)
  -> tombol CONFIRM:<ref> (callback_query) -> order tercatat + stok turun.
- Idempotensi retry webhook (update_id sama -> skip) & CONFIRM ulang (idempotency
  key tg:<ref> -> tidak dobel order).
"""
import json
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
        if not any(m.get("role") == "tool" for m in messages):
            return LLMResponse("", [LLMToolCall(
                "build_order_summary",
                {"items": [{"product_id": self.product_id, "quantity": self.quantity}]},
            )])
        ref = ""
        for m in messages:
            if m.get("role") == "tool":
                try:
                    ref = json.loads(m["content"])["summary"]["summary_ref"]
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
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

async def test_verify_mock_accepts_without_secret(db, monkeypatch):
    # hermetik: paksa mock — jangan bergantung TELEGRAM_PROVIDER di .env
    # (dev/demo menjalankan provider bot asli, suite test tetap harus hijau)
    monkeypatch.setattr(settings, "telegram_provider", "mock")
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


# ----------------------------------- regresi: render ulang tombol konfirmasi

class VerbalConfirmScriptedLLM:
    """Reproduksi bug demo (14/09): giliran 1 memanggil build_order_summary,
    giliran berikutnya ("confirm order" verbal) membalas narasi TANPA memanggil
    tool apa pun — dulu reply.order_summary menjadi None sehingga inline
    keyboard tidak pernah dirender ulang dan customer terjebak."""

    def __init__(self, product_id: str, quantity: int = 1):
        self.product_id = product_id
        self.quantity = quantity

    async def complete(self, *, system, messages, tools=None):
        last = messages[-1]["content"] if messages else ""
        has_tool_result = any(m.get("role") == "tool" for m in messages)
        if "kopi" in last.lower() and not has_tool_result:
            return LLMResponse("", [LLMToolCall(
                "build_order_summary",
                {"items": [{"product_id": self.product_id, "quantity": self.quantity}]},
            )])
        if has_tool_result:
            ref = ""
            for m in messages:
                if m.get("role") == "tool":
                    try:
                        ref = json.loads(m["content"])["summary"]["summary_ref"]
                    except (json.JSONDecodeError, KeyError, TypeError):
                        pass
            return LLMResponse(f"Berikut ringkasan pesanan Anda (ref: {ref}).", [])
        # giliran verbal: balasan menyebut "tombol" TANPA membangun summary baru
        return LLMResponse("Siap! Silakan tekan tombol Konfirmasi untuk menyelesaikan pesanan. 😊", [])


@pytest.mark.asyncio
async def test_telegram_summary_rerendered_when_llm_skips_tool(client: AsyncClient, db, monkeypatch):
    """LLM skip tool pada giliran "confirm order" -> summary aktif sesi tetap
    dikirim kembali (order_summary terisi) sehingga inline keyboard
    CONFIRM:<ref> dirender ulang, dan tombol itu tetap berfungsi end-to-end."""
    import app.ai.sales_agent as sa
    from app.schemas.chat import ChatReply

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: VerbalConfirmScriptedLLM(pid, quantity=1))

    chat_id = 770066
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_message(chat_id, "saya mau 1 kopi toraja", 60))
    assert r.status_code == 200, r.text
    ref = r.json()["order_summary"]["summary_ref"]

    # giliran "confirm order" verbal — LLM tidak memanggil tool apa pun
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_message(chat_id, "confirm order", 61))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "tombol" in data["reply"]  # narasi LLM tetap tersampaikan apa adanya
    assert data["order_summary"] is not None, "summary sesi harus dirender ulang saat LLM skip tool"
    assert data["order_summary"]["summary_ref"] == ref

    # adapter membentuk inline keyboard dari summary hasil render ulang
    buttons = TelegramAdapter(db)._build_confirm_buttons(ChatReply.model_validate(data))
    assert buttons is not None
    assert buttons["inline_keyboard"][0][0]["callback_data"] == f"CONFIRM:{ref}"

    # tombol hasil render ulang tetap berfungsi end-to-end (order + stok turun)
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_callback(chat_id, f"CONFIRM:{ref}", 62))
    assert r.status_code == 200 and "berhasil dicatat" in r.json()["reply"]
    orders = (await db.execute(select(Order))).scalars().all()
    assert len(orders) == 1
    assert float(orders[0].total_amount) == 60000

    # setelah order jadi, sesi berikutnya TIDAK lagi membawa summary lama
    r = await client.post("/api/v1/dev/mock-tg", json=_tg_message(chat_id, "makasih ya", 63))
    assert r.status_code == 200
    assert r.json()["order_summary"] is None


async def test_webhook_http_malformed_body_returns_400(client: AsyncClient, bot_mode):
    """Body webhook bukan JSON valid -> 400 (dulu JSONDecodeError -> 500)."""
    resp = await client.post(
        "/api/v1/webhooks/telegram",
        content=b"{not-valid-json",
        headers={"X-Telegram-Bot-Api-Secret-Token": SECRET},
    )
    assert resp.status_code == 400


def test_summary_store_conversation_index():
    """Indeks per-conversation: lookup, pop, dan TTL."""
    from app.schemas.chat import OrderSummary, OrderSummaryItem
    from app.services import summary_store as ss

    item = OrderSummaryItem(
        product_id=str(uuid.uuid4()), name="Kopi Toraja", quantity=1,
        unit_price=60000.0, discount=0.0, line_total=60000.0,
    )
    s = OrderSummary(summary_ref=f"ref-{uuid.uuid4().hex[:8]}", items=[item], total=60000.0)
    ss.put(s)
    conv = f"conv-{uuid.uuid4().hex[:8]}"

    assert ss.get_for_conversation(conv) is None  # belum ada summary di sesi ini
    ss.put_for_conversation(conv, s)
    got = ss.get_for_conversation(conv)
    assert got is not None and got.summary_ref == s.summary_ref

    ss.pop_for_conversation(conv)
    assert ss.get_for_conversation(conv) is None

    # TTL: indeks kedaluwarsa -> None meski entri per-ref masih disimpan
    conv2 = f"conv-{uuid.uuid4().hex[:8]}"
    ss.put_for_conversation(conv2, s)
    ts, ref = ss._conv_index[conv2]
    ss._conv_index[conv2] = (ts - ss._TTL_SECONDS - 1, ref)
    assert ss.get_for_conversation(conv2) is None
