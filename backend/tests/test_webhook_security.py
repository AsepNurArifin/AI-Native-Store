"""P5/F7 — verifikasi signature webhook Meta (X-Hub-Signature-256).

Gap yang ditutup: `MetaCloudWhatsAppProvider.verify_signature` sudah ada tetapi
tidak pernah dipanggil di route webhook, sehingga request palsu bisa memicu
SalesAgent. Route kini memverifikasi body RAW sebelum memproses.

Mock provider (dev/test) tetap menerima tanpa signature.
"""

import hashlib
import hmac

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.whatsapp.adapter import WhatsAppAdapter
from app.core.config import settings

APP_SECRET = "test-app-secret"
BODY = b'{"entry": [{"changes": [{"value": {"messages": []}}]}]}'


@pytest.fixture
def meta_mode(monkeypatch):
    """Aktifkan provider Meta + app secret untuk skenario verifikasi signature."""
    monkeypatch.setattr(settings, "wa_provider", "meta")
    monkeypatch.setattr(settings, "wa_app_secret", APP_SECRET)


def _valid_signature(body: bytes) -> str:
    return "sha256=" + hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()


# ---------- unit: WhatsAppAdapter.verify_request ----------

async def test_verify_request_mock_accepts_without_signature(db: AsyncSession):
    # default .env: WA_PROVIDER=mock -> tidak memverifikasi (dev/test)
    assert settings.wa_provider == "mock"
    adapter = WhatsAppAdapter(db)
    assert adapter.verify_request(BODY, None) is True


async def test_verify_request_meta_rejects_missing_signature(db: AsyncSession, meta_mode):
    adapter = WhatsAppAdapter(db)
    assert adapter.verify_request(BODY, None) is False


async def test_verify_request_meta_rejects_invalid_signature(db: AsyncSession, meta_mode):
    adapter = WhatsAppAdapter(db)
    assert adapter.verify_request(BODY, "sha256=deadbeef") is False


async def test_verify_request_meta_accepts_valid_signature(db: AsyncSession, meta_mode):
    adapter = WhatsAppAdapter(db)
    assert adapter.verify_request(BODY, _valid_signature(BODY)) is True


# ---------- HTTP: route menolak sebelum memproses ----------

async def test_webhook_http_rejects_missing_signature(client: AsyncClient, meta_mode):
    resp = await client.post("/api/v1/webhooks/whatsapp", content=BODY)
    assert resp.status_code == 401


async def test_webhook_http_rejects_invalid_signature(client: AsyncClient, meta_mode):
    resp = await client.post(
        "/api/v1/webhooks/whatsapp",
        content=BODY,
        headers={"X-Hub-Signature-256": "sha256=deadbeef"},
    )
    assert resp.status_code == 401
