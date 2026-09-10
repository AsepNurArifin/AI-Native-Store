"""Uji approval workflow AI Action (FR-AA-01..05) + audit trail (FR-AA-04)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_password
from app.models import User


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
