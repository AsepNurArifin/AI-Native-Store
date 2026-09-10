"""Uji alur END-TO-END lewat entry point publik (Fix 1.1, 1.4, 2.2).

Aturan test hygiene (R10, REMEDIATION_PLAN):
    Test alur happy-path HARUS mendapatkan summary_ref dari jalur produksi
    (tool build_order_summary via chat/webhook), TIDAK dengan summary_store.put
    manual. Injeksi manual hanya boleh untuk mensimulasikan keadaan basi
    (stok berubah, summary kedaluwarsa) — lihat test_orders/test_concurrency.

LLM di-script per test (ScriptedLLM) supaya deterministik; ToolExecutor,
service, dan DB tetap jalur produksi penuh.
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.ai.llm import LLMResponse, LLMToolCall
from app.core.security import hash_password
from app.models import Conversation, Order, User


class ScriptedLLM:
    """LLM deterministik untuk test: respons berurutan, dipakai via monkeypatch."""

    def __init__(self, responses):
        self._responses = list(responses)

    async def complete(self, *, system, messages, tools=None):
        return self._responses.pop(0)


class SummaryScriptedLLM:
    """LLM yang memanggil build_order_summary lalu menarasikan hasilnya.

    Narasi iterasi-2 menyertakan summary_ref yang diambil dari hasil tool —
    sehingga ref bisa diparse dari balasan publik (termasuk webhook WA).
    """

    def __init__(self, product_id: str, quantity: int = 2):
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
    """Owner login + produk stok 5 — mirror helper test_orders (email unik per test)."""
    email = f"o-{uuid.uuid4().hex[:8]}@t.dev"
    db.add(User(name="O", email=email, password_hash=hash_password("x12345"), role="OWNER"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post("/api/v1/products", headers=h, json={"name": "Kopi Toraja", "category": "Makanan", "price": 60000})
    pid = r.json()["id"]
    await client.post("/api/v1/inventory/adjustments", headers=h, json={"product_id": pid, "movement": "IN", "quantity": 5})
    return h, pid


# ---------------------------------------------------------------- web e2e


@pytest.mark.asyncio
async def test_web_flow_message_to_confirm_end_to_end(client: AsyncClient, db, monkeypatch):
    """UC-02 Flow 1 via API publik: pesan -> summary (jalur asli) -> confirm -> order.

    Regression test Fix 1.1: dulu build_order_summary tidak pernah menyimpan
    summary, sehingga confirm selalu 410 SUMMARY_EXPIRED.
    """
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=2))

    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Andi|081234"})
    conv = r.json()["conversation_id"]

    r = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "saya mau 2 kopi toraja"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["order_summary"] is not None, "SalesAgent harus mengembalikan order summary"
    ref = data["order_summary"]["summary_ref"]
    assert data["order_summary"]["total"] == 120000

    # confirm pakai ref dari alur asli — TANPA summary_store.put manual
    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": ref, "idempotency_key": "e2e-1", "customer": {"name": "Andi", "contact": "081234"}},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CONFIRMED"
    assert r.json()["total"] == 120000

    # stok turun 5 -> 3
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 3


# ---------------------------------------------------------------- WA e2e


@pytest.mark.asyncio
async def test_whatsapp_flow_confirm_button_end_to_end(client: AsyncClient, db, monkeypatch):
    """UC-02 via WhatsApp: pesan -> summary -> tombol CONFIRM:<ref> -> order (Fix 1.4).

    Juga memastikan percakapan WA di-reuse (satu conversation), bukan baru per pesan.
    """
    from app.core.config import settings

    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(settings, "wa_test_numbers", "628123456789")
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=1))

    sender = "628123456789"

    # 1) pesan produk -> AI balas ringkasan + tombol CONFIRM:<ref>
    r = await client.post("/api/v1/webhooks/whatsapp", json={
        "from": sender, "text": "saya mau 1 kopi toraja", "message_id": f"m-{uuid.uuid4().hex}",
    })
    assert r.status_code == 200, r.text
    reply = r.json()["reply"] or ""
    match = re.search(r"ref: ([0-9a-f]+)", reply)
    assert match, f"balasan WA harus memuat summary ref: {reply!r}"
    ref = match.group(1)

    # percakapan WA hanya satu (reuse, bukan baru per pesan)
    n_conv = len((await db.execute(
        select(Conversation).where(Conversation.channel == "WHATSAPP")
    )).scalars().all())
    assert n_conv == 1

    # 2) tombol konfirmasi -> order dibuat
    r = await client.post("/api/v1/webhooks/whatsapp", json={
        "from": sender, "text": f"CONFIRM:{ref}", "message_id": f"m-{uuid.uuid4().hex}",
    })
    assert r.status_code == 200, r.text
    wa_reply = r.json()["reply"] or ""
    assert "dicatat" in wa_reply or "diproses sebelumnya" in wa_reply

    orders = (await db.execute(select(Order))).scalars().all()
    assert len(orders) == 1
    assert orders[0].status == "CONFIRMED"
    assert orders[0].channel_origin == "WHATSAPP"
    assert float(orders[0].total_amount) == 60000

    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 4


@pytest.mark.asyncio
async def test_whatsapp_confirm_expired_ref_graceful(client: AsyncClient, db, monkeypatch):
    """E7: CONFIRM:<ref> tidak dikenal -> balasan ramah, bukan 500, tanpa order."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "wa_test_numbers", "628123456789")
    r = await client.post("/api/v1/webhooks/whatsapp", json={
        "from": "628123456789", "text": "CONFIRM:bogusref123", "message_id": f"m-{uuid.uuid4().hex}",
    })
    assert r.status_code == 200
    assert "kedaluwarsa" in (r.json()["reply"] or "")
    assert len((await db.execute(select(Order))).scalars().all()) == 0


@pytest.mark.asyncio
async def test_whatsapp_confirm_retry_idempotent(client: AsyncClient, db, monkeypatch):
    """UC-02 E5: tombol CONFIRM dikirim ulang (retry webhook) -> tidak dobel order."""
    from app.core.config import settings

    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(settings, "wa_test_numbers", "628123456789")
    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=1))

    sender = "628123456789"
    r = await client.post("/api/v1/webhooks/whatsapp", json={
        "from": sender, "text": "saya mau 1 kopi", "message_id": f"m-{uuid.uuid4().hex}",
    })
    ref = re.search(r"ref: ([0-9a-f]+)", r.json()["reply"]).group(1)

    # kirim CONFIRM dua kali (message_id beda — simulasi retry aplikasi)
    for _ in range(2):
        r = await client.post("/api/v1/webhooks/whatsapp", json={
            "from": sender, "text": f"CONFIRM:{ref}", "message_id": f"m-{uuid.uuid4().hex}",
        })
        assert r.status_code == 200

    orders = (await db.execute(select(Order))).scalars().all()
    assert len(orders) == 1
    # stok hanya berkurang sekali: 5 -> 4
    summary = await client.get("/api/v1/inventory/summary", headers=h)
    row = next(x for x in summary.json() if x["product_id"] == pid)
    assert row["current_stock"] == 4


# ---------------------------------------------------------------- Fix 2.2


@pytest.mark.asyncio
async def test_scheduled_promo_price_consistency_summary_vs_order(client: AsyncClient, db, monkeypatch):
    """Fix 2.2: promosi ACTIVE dengan start_date masa depan TIDAK boleh
    didiskon di summary lalu hilang saat order (total harus identik)."""
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    # promosi terjadwal: ACTIVE tapi start_date 30 hari ke depan
    r = await client.post("/api/v1/promotions", headers=h, json={
        "product_id": pid, "discount_percentage": 20.0,
        "start_date": "2030-01-01T00:00:00+00:00", "end_date": "2030-12-31T00:00:00+00:00",
        "status": "ACTIVE",
    })
    assert r.status_code == 201, r.text

    monkeypatch.setattr(sa, "get_llm", lambda model=None: SummaryScriptedLLM(pid, quantity=1))

    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Budi|08999"})
    conv = r.json()["conversation_id"]
    r = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "saya mau 1 kopi"})
    assert r.status_code == 200
    data = r.json()
    # summary TIDAK memakai diskon (promosi belum mulai)
    assert data["order_summary"]["items"][0]["discount"] == 0
    assert data["order_summary"]["total"] == 60000
    ref = data["order_summary"]["summary_ref"]

    r = await client.post(
        f"/api/v1/chat/{conv}/confirm",
        json={"order_summary_ref": ref, "idempotency_key": "sched-1", "customer": {"name": "Budi"}},
    )
    assert r.status_code == 200
    # total order SAMA dengan summary (UC-02 step 5)
    assert r.json()["total"] == data["order_summary"]["total"] == 60000
