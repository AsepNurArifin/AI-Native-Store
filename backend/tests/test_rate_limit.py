"""Uji rate-limit P5 (dipindah dari tests/test_subscriptions.py saat pivot single-user).

Endpoint subscribe dihapus saat pivot dari SaaS ke single-user
(docs/SRS_AMENDMENTS.md §E) — pengujian rate-limit P5 dipertahankan lewat
webhook Telegram, endpoint publik lain yang memakai dependency `rate_limit`
(60/menit/IP).

- Lewat kuota dari IP sama -> 429 + Retry-After.
- IP berbeda punya bucket terpisah — satu IP kena limit tidak memblokir lainnya.
"""
import pytest
from httpx import AsyncClient

from app.core import rate_limit as rl
from app.core.config import settings

# Update Telegram non-pesan (edited_message) -> 200 + reply None, tidak
# menyentuh LLM/DB — aman dipakai berulang kali untuk menguji limit.
_UPDATE = {"update_id": 999, "edited_message": {"text": "x"}}


@pytest.mark.asyncio
async def test_rate_limit_returns_429_with_retry_after(client: AsyncClient, monkeypatch):
    """P5: lewat 60 request/menit/IP dari IP sama -> 429 + Retry-After."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True, raising=False)
    monkeypatch.setattr(rl, "_buckets", {})  # bucket bersih per test

    for i in range(60):
        resp = await client.post(
            "/api/v1/webhooks/telegram",
            json={**_UPDATE, "update_id": 1000 + i},
            headers={"X-Forwarded-For": "203.0.113.7"},
        )
        assert resp.status_code == 200

    resp = await client.post(
        "/api/v1/webhooks/telegram",
        json=_UPDATE,
        headers={"X-Forwarded-For": "203.0.113.7"},
    )
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


@pytest.mark.asyncio
async def test_rate_limit_per_ip(client: AsyncClient, monkeypatch):
    """IP berbeda punya bucket terpisah — satu IP kena limit tidak memblokir lainnya."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True, raising=False)
    monkeypatch.setattr(rl, "_buckets", {})

    for i in range(60):
        await client.post(
            "/api/v1/webhooks/telegram",
            json={**_UPDATE, "update_id": 2000 + i},
            headers={"X-Forwarded-For": "198.51.100.1"},
        )
    blocked = await client.post(
        "/api/v1/webhooks/telegram",
        json=_UPDATE,
        headers={"X-Forwarded-For": "198.51.100.1"},
    )
    assert blocked.status_code == 429

    other = await client.post(
        "/api/v1/webhooks/telegram",
        json=_UPDATE,
        headers={"X-Forwarded-For": "198.51.100.2"},
    )
    assert other.status_code == 200
