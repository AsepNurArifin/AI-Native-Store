"""Bot API asli Telegram (TELEGRAM_PROVIDER=bot) — Fase 3.

Kredensial: token bot dari BotFather (env TELEGRAM_BOT_TOKEN).
Webhook diverifikasi via secret token (setWebhook secret_token) yang
dikirim Telegram pada header `X-Telegram-Bot-Api-Secret-Token`.
"""

import hashlib
import hmac
import logging

import httpx

from app.channels.base import InboundMessage
from app.channels.telegram.provider_base import TelegramProviderBase
from app.channels.telegram.provider_mock import parse_telegram_update
from app.core.config import settings

logger = logging.getLogger(__name__)


class BotTelegramProvider(TelegramProviderBase):
    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        return parse_telegram_update(payload)

    def verify_secret(self, secret_header: str | None) -> bool:
        """Fail-closed: tanpa secret terkonfigurasi -> tolak semua webhook.

        (Men-deploy bot tanpa secret = webhook bisa dipalsukan siapa pun.)
        """
        expected = settings.telegram_webhook_secret
        if not expected:
            return False
        return hmac.compare_digest(secret_header or "", expected)

    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        body: dict = {"chat_id": recipient_id, "text": content}
        if interactive and "inline_keyboard" in interactive:
            body["reply_markup"] = {"inline_keyboard": interactive["inline_keyboard"]}

        url = f"{settings.telegram_api_base}/bot{settings.telegram_bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body)
        except httpx.HTTPError as e:  # jaringan/timeout — log & laporkan gagal, jangan crash webhook
            logger.warning("[telegram] send_message error: %s", e)
            return False
        if resp.status_code != 200:
            logger.warning("[telegram] sendMessage %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
