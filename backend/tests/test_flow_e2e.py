"""Uji alur END-TO-END lewat entry point publik (Fix 1.1, 1.4, 2.2).

Aturan test hygiene (R10, REMEDIATION_PLAN):
    Test alur happy-path HARUS mendapatkan summary_ref dari jalur produksi
    (tool build_order_summary via chat/webhook), TIDAK dengan summary_store.put
    manual. Injeksi manual hanya boleh untuk mensimulasikan keadaan basi
    (stok berubah, summary kedaluwarsa) — lihat test_orders/test_concurrency.

LLM di-script per test (ScriptedLLM) supaya deterministik; ToolExecutor,
service, dan DB tetap jalur produksi penuh.
"""

import json
import uuid

import pytest
from httpx import AsyncClient

from app.ai.llm import LLMResponse, LLMToolCall
from app.core.security import hash_password
from app.models import User


class ScriptedLLM:
    """LLM deterministik untuk test: respons berurutan, dipakai via monkeypatch."""

    def __init__(self, responses):
        self._responses = list(responses)

    async def complete(self, *, system, messages, tools=None):
        return self._responses.pop(0)


class SummaryScriptedLLM:
    """LLM yang memanggil build_order_summary lalu menarasikan hasilnya.

    Narasi iterasi-2 menyertakan summary_ref yang diambil dari hasil tool —
    sehingga ref bisa diparse dari balasan publik (termasuk webhook Telegram).
    """

    def __init__(self, product_id: str, quantity: int = 2):
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


# ------------------------------------------------- anti-halusinasi ringkasan


class HallucinatingScriptedLLM:
    """LLM yang MENARASIKAN ringkasan pesanan tanpa memanggil tool
    (angka karangan), lalu benar setelah dikoreksi sistem."""

    def __init__(self, product_id: str, quantity: int = 1):
        self.product_id = product_id
        self.quantity = quantity
        self.corrected = False

    async def complete(self, *, system, messages, tools=None):
        corrected = any("(koreksi sistem)" in m.get("content", "") for m in messages)
        if tools and corrected and not self.corrected:
            self.corrected = True
            return LLMResponse("", [LLMToolCall(
                "build_order_summary",
                {"items": [{"product_id": self.product_id, "quantity": self.quantity}]},
            )])
        if corrected:
            return LLMResponse("Berikut ringkasan pesanan Anda yang sudah diverifikasi.", [])
        return LLMResponse(
            "Siap! Berikut ringkasan pesanan Anda:\n\n"
            "| Produk | Qty | Subtotal |\n|---|---|---|\n"
            f"| Kopi Toraja | {self.quantity} | Rp60.000 |\n"
            "Total: Rp60.000\n\nSilakan tekan tombol konfirmasi di bawah.",
            [],
        )


@pytest.mark.asyncio
async def test_hallucinated_summary_gets_corrected_and_button_data_returned(client: AsyncClient, db, monkeypatch):
    """LLM menulis ringkasan tanpa build_order_summary -> SalesAgent melakukan
    iterasi koreksi; order_summary HARUS terisi agar tombol konfirmasi web
    dirender (regresi: dulu order_summary null, tombol tidak muncul sama sekali)."""
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: HallucinatingScriptedLLM(pid, quantity=1))

    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Cici|0877"})
    conv = r.json()["conversation_id"]
    r = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "gas, jadi pesan 1 kopi"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["order_summary"] is not None, "koreksi harus menghasilkan order_summary (tombol konfirmasi)"
    assert data["order_summary"]["total"] == 60000
    assert "sudah diverifikasi" in data["reply"]


class StubbornHallucinatingScriptedLLM:
    """LLM yang tetap tidak memanggil tool meski sudah dikoreksi."""

    def __init__(self, product_id: str):
        self.product_id = product_id

    async def complete(self, *, system, messages, tools=None):
        return LLMResponse("Berikut ringkasan pesanan Anda: Kopi Toraja 1x, total Rp60.000. "
                           "Silakan tekan tombol konfirmasi di bawah.", [])


@pytest.mark.asyncio
async def test_stubborn_hallucination_replaced_with_honest_reply(client: AsyncClient, db, monkeypatch):
    """Koreksi gagal -> narasi halusinatif DIGANTI pesan jujur, bukan dibiarkan
    (jangan tampilkan 'tekan tombol di bawah' tanpa tombol)."""
    import app.ai.sales_agent as sa

    h, pid = await _setup(client, db)
    monkeypatch.setattr(sa, "get_llm", lambda model=None: StubbornHallucinatingScriptedLLM(pid))

    r = await client.post("/api/v1/chat/start", json={"channel": "WEB", "customer_ref": "Dedi|0866"})
    conv = r.json()["conversation_id"]
    r = await client.post(f"/api/v1/chat/{conv}/messages", json={"content": "ya, jadi pesan"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["order_summary"] is None
    assert "belum berhasil" in data["reply"]
    # pesan jujur menyuruh mengulang, bukan mengonfirmasi
    assert "tulis ulang" in data["reply"].lower()
