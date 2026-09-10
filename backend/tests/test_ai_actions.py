"""Uji approval workflow AI Action (FR-AA-01..05) + audit trail (FR-AA-04)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_password
from app.models import User


@pytest.mark.asyncio
async def test_draft_endpoint_nl_instruction_to_draft(client: AsyncClient, db, monkeypatch):
    """Fix 1.2 / FR-AA-01 — POST /ai-actions/draft: instruksi NL -> DRAFT (jalur 2).

    LLM di-script agar memanggil tool create_promotion_draft; ToolExecutor
    dan AIActionService tetap jalur produksi.
    """
    owner, owner_id = await _login(client, db, "owner-draft@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Produk Draft", "category": "Fashion", "price": 100000},
    )
    pid = r.json()["id"]

    import app.ai.action_agent as aa
    from app.ai.llm import LLMResponse, LLMToolCall

    class _ScriptedLLM:
        async def complete(self, *, system, messages, tools=None):
            return LLMResponse("", [LLMToolCall("create_promotion_draft", {
                "product_id": pid, "discount_percentage": 15.0,
                "start_date": "2020-01-01T00:00:00+07:00", "end_date": "2026-12-31T00:00:00+07:00",
            })])

    monkeypatch.setattr(aa, "get_llm", lambda model=None: _ScriptedLLM())

    r = await client.post(
        "/api/v1/ai-actions/draft", headers=h,
        json={"instruction": "buat promosi 15% untuk produk ini selama akhir tahun"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "DRAFT"
    assert data["action_type"] == "CREATE_PROMOTION"
    assert data["payload"]["product_id"] == pid

    # audit CREATED tercatat (FR-AA-04)
    logs = await client.get(f"/api/v1/audit/logs?ai_action_id={data['id']}", headers=h)
    assert "CREATED" in [l["event"] for l in logs.json()]


@pytest.mark.asyncio
async def test_draft_endpoint_requires_auth(client: AsyncClient, db):
    """Fix 1.2 — endpoint draft wajib token (FR-AUTH-02)."""
    r = await client.post("/api/v1/ai-actions/draft", json={"instruction": "buat promosi"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_draft_endpoint_owner_only(client: AsyncClient, db):
    """Fix 1.2 — hanya Owner yang boleh membuat draft (UC-04 actor = Owner).
    Role STAFF sudah dihapus; user dengan role non-owner wajib 403.
    """
    db.add(User(name="Legacy", email="legacy-draft@t.dev", password_hash=hash_password("x12345"), role="STAFF"))
    await db.commit()
    r = await client.post("/api/v1/auth/login", json={"email": "legacy-draft@t.dev", "password": "x12345"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = await client.post("/api/v1/ai-actions/draft", headers=h, json={"instruction": "buat promosi"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_draft_endpoint_garbled_instruction_422(client: AsyncClient, db):
    """Fix 1.2 — instruksi tak bisa dipahami -> 422 dengan pesan ramah (bukan 500)."""
    owner, _ = await _login(client, db, "owner-garbled@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}
    r = await client.post("/api/v1/ai-actions/draft", headers=h, json={"instruction": "halo apa kabar"})
    assert r.status_code == 422
    assert "tidak bisa dipahami" in r.json()["detail"]


async def _login(client: AsyncClient, db, email: str, role: str) -> tuple[str, str]:
    db.add(User(name=email, email=email, password_hash=hash_password("x12345"), role=role))
    await db.commit()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one()
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "x12345"})
    return r.json()["access_token"], str(user.id)


@pytest.mark.asyncio
async def test_create_draft_and_approve_executes(client: AsyncClient, db):
    owner, owner_id = await _login(client, db, "owner@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}

    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Produk Promo", "category": "Fashion", "price": 100000},
    )
    pid = r.json()["id"]

    from app.services.ai_action_service import AIActionService

    action = await AIActionService.create_draft(
        db,
        requested_by=owner_id,
        action_type="CREATE_PROMOTION",
        payload={
            "product_id": pid,
            "discount_percentage": 15.0,
            "start_date": "2020-01-01T00:00:00+07:00",
            "end_date": "2026-12-31T00:00:00+07:00",
        },
    )
    await db.commit()
    aid = str(action.id)
    assert action.status == "DRAFT"

    r = await client.post(f"/api/v1/ai-actions/{aid}/approve", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "EXECUTED"
    assert r.json()["result_target_id"]

    promos = await client.get(f"/api/v1/promotions?product_id={pid}", headers=h)
    assert any(p["status"] == "ACTIVE" for p in promos.json())

    logs = await client.get(f"/api/v1/audit/logs?ai_action_id={aid}", headers=h)
    events = [l["event"] for l in logs.json()]
    assert "CREATED" in events and "APPROVED" in events and "EXECUTED" in events


@pytest.mark.asyncio
async def test_approve_invalid_promotion_validation_failed(client: AsyncClient, db):
    owner, owner_id = await _login(client, db, "owner2@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Produk 2", "category": "Minuman", "price": 50000},
    )
    pid = r.json()["id"]

    from app.services.ai_action_service import AIActionService

    action = await AIActionService.create_draft(
        db, requested_by=owner_id, action_type="CREATE_PROMOTION",
        payload={
            "product_id": pid,
            "discount_percentage": 999.0,  # > max 50%
            "start_date": "2020-01-01T00:00:00+07:00",
            "end_date": "2026-12-31T00:00:00+07:00",
        },
    )
    await db.commit()
    r = await client.post(f"/api/v1/ai-actions/{str(action.id)}/approve", headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "APPROVED_VALIDATION_FAILED"
    assert "DISCOUNT_OUT_OF_RANGE" in r.json()["validation_failures"]


@pytest.mark.asyncio
async def test_reject_draft(client: AsyncClient, db):
    owner, owner_id = await _login(client, db, "owner3@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}

    from app.services.ai_action_service import AIActionService

    action = await AIActionService.create_draft(
        db, requested_by=owner_id, action_type="CREATE_PROMOTION",
        payload={"product_id": "x", "discount_percentage": 10,
                 "start_date": "2020-01-01T00:00:00+07:00", "end_date": "2026-12-31T00:00:00+07:00"},
    )
    await db.commit()
    r = await client.post(f"/api/v1/ai-actions/{str(action.id)}/reject", headers=h, json={"note": "tidak jadi"})
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"


# ==================== ADJUST_STOCK (FR-AA-06) ====================

@pytest.mark.asyncio
async def test_stock_adjustment_draft_and_approve(client: AsyncClient, db, monkeypatch):
    """FR-AA-06 — instruksi 'tambahkan stok...' -> DRAFT ADJUST_STOCK -> approve -> stok bertambah."""
    owner, owner_id = await _login(client, db, "owner-stock@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Smartphone G066", "category": "Elektronik", "price": 500000},
    )
    pid = r.json()["id"]

    import app.ai.action_agent as aa
    from app.ai.llm import LLMResponse, LLMToolCall

    class _ScriptedLLM:
        async def complete(self, *, system, messages, tools=None):
            return LLMResponse("", [LLMToolCall("create_stock_adjustment_draft", {
                "product_id": pid, "movement": "IN", "quantity": 20,
            })])

    monkeypatch.setattr(aa, "get_llm", lambda model=None: _ScriptedLLM())

    # draft dari instruksi NL — persis kasus user: "tambahkan stok ... sebanyak 20"
    r = await client.post(
        "/api/v1/ai-actions/draft", headers=h,
        json={"instruction": "tambahkan stok untuk produk Smartphone G066 sebanyak 20"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "DRAFT"
    assert data["action_type"] == "ADJUST_STOCK"
    assert data["payload"] == {"product_id": pid, "movement": "IN", "quantity": 20}

    # approve -> validasi lolos -> eksekusi
    r = await client.post(f"/api/v1/ai-actions/{data['id']}/approve", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "EXECUTED"

    # stok benar-benar bertambah 20
    r = await client.get(f"/api/v1/products/{pid}", headers=h)
    assert r.json()["current_stock"] == 20


@pytest.mark.asyncio
async def test_stock_adjustment_out_insufficient_stock_fails_validation(client: AsyncClient, db):
    """FR-AA-05 utk ADJUST_STOCK: OUT melebihi stok -> APPROVED_VALIDATION_FAILED, stok tak berubah."""
    owner, _ = await _login(client, db, "owner-stock2@t.dev", "OWNER")
    h = {"Authorization": f"Bearer {owner}"}
    r = await client.post(
        "/api/v1/products", headers=h,
        json={"name": "Soda R057", "category": "Makanan", "price": 10000},
    )
    pid = r.json()["id"]

    from app.models import AIAction
    from app.services.ai_action_service import AIActionService

    action = await AIActionService.create_draft(
        db, requested_by=await _owner_id(db, "owner-stock2@t.dev"),
        action_type="ADJUST_STOCK",
        payload={"product_id": pid, "movement": "OUT", "quantity": 50},  # stok 0, minta 50
    )
    await db.commit()

    action = await AIActionService.approve(db, action, actor_id=await _owner_id(db, "owner-stock2@t.dev"))
    assert action.status == "APPROVED_VALIDATION_FAILED"
    assert "INSUFFICIENT_STOCK" in action.validation_failures

    # stok tidak berubah (masih 0)
    r = await client.get(f"/api/v1/products/{pid}", headers=h)
    assert r.json()["current_stock"] == 0


async def _owner_id(db, email: str) -> str:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one()
    return str(user.id)
