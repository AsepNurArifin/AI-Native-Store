"""Paket channel Telegram — Fase 3 PLAN_PRODUCT_LAUNCH.md.

Bot Telegram dibuat self-service via BotFather (gratis, tanpa verifikasi
bisnis seperti WABA Meta) — cocok untuk target non-IT.

Struktur paket:
- provider_base : antarmuka provider (parse_webhook / send_message)
- provider_mock : dev/test tanpa API nyata
- provider_bot  : Bot API asli (api.telegram.org)
- adapter       : TelegramAdapter (routing diwarisi MessagingChannelAdapter)
"""
