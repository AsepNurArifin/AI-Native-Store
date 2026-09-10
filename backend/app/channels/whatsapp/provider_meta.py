"""Meta Cloud API WhatsApp provider (WA_PROVIDER=meta, WABA resmi — F7).

- Signature verification: X-Hub-Signature-256 (HMAC SHA256 app secret)
- Messages API: https://graph.facebook.com/v21.0/{phone_number_id}/messages
- Template fallback ketika di luar 24h window (check_24h_window)
"""

import hashlib
import hmac
import logging
from datetime import datetime

import httpx

from app.channels.base import InboundMessage
from app.channels.whatsapp.provider_base import WhatsAppProviderBase
from app.core.config import settings

logger = logging.getLogger(__name__)


class MetaCloudWhatsAppProvider(WhatsAppProviderBase):
    def __init__(self):
        self.phone_number_id = settings.wa_phone_number_id
        self.access_token = settings.wa_access_token
        self.api_version = settings.wa_api_version
        self._client = httpx.AsyncClient(timeout=20)

    # ---------- inbound ----------

    def verify_signature(self, payload_body: bytes, signature_header: str | None) -> bool:
        if not signature_header:
            return False
        expected = hmac.new(
            settings.wa_app_secret.encode(), payload_body, hashlib.sha256
        ).hexdigest()
        provided = signature_header.removeprefix("sha256=")
        return hmac.compare_digest(expected, provided)

    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        try:
            entry = payload["entry"][0]
            changes = entry["changes"][0]
            value = changes["value"]
            messages = value.get("messages") or []
            if not messages:
                return None  # status/delivery update — ignore
            m = messages[0]
            sender = m["from"]
            text = ""
            if m.get("type") == "text":
                text = m["text"]["body"]
            elif m.get("type") == "interactive" and m.get("interactive", {}).get("type") == "button_reply":
                text = m["interactive"]["button_reply"]["id"]  # CONFIRM:ref / CANCEL
            elif m.get("type") == "button":  # legacy button
                text = m["button"]["text"]
            if not text:
                return None
            # catat waktu pesan inbound untuk 24h window (FR-SA-07) — MVP in-memory
            self._seen_sessions[sender] = datetime.now().isoformat()
            return InboundMessage(
                channel="WHATSAPP",
                sender_id=sender,
                content=text,
                message_id=m.get("id"),
                raw=payload,
            )
        except (KeyError, IndexError, TypeError):
            logger.warning("payload Meta tidak dikenali")
            return None

    # ---------- outbound ----------

    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        """FR-SMS-10 — hanya kirim jika dalam 24h window (template di luar window)."""
        from app.channels.whatsapp.util import check_24h_window

        body: dict = {"messaging_product": "whatsapp", "to": recipient_id}
        if not check_24h_window(recipient_id, self._seen_sessions):
            body["type"] = "template"
            body["template"] = {"name": settings.wa_template_name, "language": {"code": "id"}}
            logger.info("di luar 24h window — kirim template %s", settings.wa_template_name)
        elif interactive:
            body["type"] = "interactive"
            body["interactive"] = interactive
        else:
            body["type"] = "text"
            body["text"] = {"body": content}

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        resp = await self._client.post(
            url,
            headers={"Authorization": f"Bearer {self.access_token}"},
            json=body,
        )
        if resp.status_code >= 400:
            logger.error("WA send failed: %s %s", resp.status_code, resp.text)
            return False
        return True

    # session map for 24h window (in-memory MVP; F7 upgrade: tabel sessions)
    _seen_sessions: dict[str, str] = {}
