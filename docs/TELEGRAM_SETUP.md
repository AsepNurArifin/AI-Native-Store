# Setup Bot Telegram — AI-Native Store

> Fase 3 `PLAN_PRODUCT_LAUNCH.md`. Membuat bot Telegram itu **self-service,
> gratis, dan tanpa verifikasi bisnis** — pemilik toko non-IT bisa
> melakukannya sendiri dalam ±5 menit. (Channel WhatsApp Cloud API pernah
> diimplementasikan lalu dihapus saat finalisasi — git history menyimpannya.)

## 1. Buat bot via BotFather (±2 menit)

1. Buka Telegram, cari **@BotFather** (centang biru).
2. Kirim `/newbot`.
3. Isi nama tampilan (mis. `Toko Bu Ratna`) lalu username bot
   (harus diakhiri `bot`, mis. `tokoburatna_bot`).
4. BotFather membalas dengan **token** — simpan (format `123456:ABC-DEF...`).

## 2. Konfigurasi backend

Tambahkan ke `backend/.env`:

```env
TELEGRAM_PROVIDER=bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...      # dari BotFather
TELEGRAM_WEBHOOK_SECRET=<string acak>     # mis. hasil: python -c "import secrets; print(secrets.token_hex(24))"
```

> **Penting (fail-closed):** tanpa `TELEGRAM_WEBHOOK_SECRET`, webhook bot
> akan menolak SEMUA request. Secret ini mencegah pemalsuan webhook.

## 3. Daftarkan webhook

Cukup sekali (Telegram menyimpan setting ini untuk bot):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<backend-anda>/api/v1/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verifikasi:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Menjalankan lokal (tanpa hosting)

Server Telegram tidak bisa mengirim webhook ke `localhost`. Solusi tanpa biaya:
**tunnel publik** sementara (cloudflared / ngrok), lalu arahkan webhook ke URL tunnel.

1. Jalankan backend seperti biasa (`localhost:8000`), lalu buka tunnel:

   ```bash
   # cloudflared (gratis, tanpa akun): https://github.com/cloudflare/cloudflared/releases
   cloudflared tunnel --url http://localhost:8000
   # → tercetak URL publik, mis. https://contoh-coba.trycloudflare.com
   ```

2. Daftarkan webhook memakai URL tunnel itu:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://contoh-coba.trycloudflare.com/api/v1/webhooks/telegram" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

3. Kirim pesan ke bot dari akun Telegram pribadi → AI membalas.

> **Catatan:** URL quick tunnel cloudflared **berubah setiap kali dijalankan** —
> ulangi langkah 2 setelah tunnel baru aktif. Alternatif tanpa tunnel sama sekali:
> `TELEGRAM_PROVIDER=mock` + `POST /api/v1/dev/mock-tg` (simulasi, hanya `DEBUG=true`).

## 4. Uji

Kirim pesan apa pun ke bot Anda dari akun Telegram pribadi → AI Sales Agent
membalas dengan rekomendasi/stok dari katalog toko. Saat AI mengirim
ringkasan pesanan, muncul tombol **✅ Konfirmasi / ❌ Batalkan** — pesanan
tercatat di panel admin, stok terpotong atomik.

### Mode dev tanpa bot nyata

```env
TELEGRAM_PROVIDER=mock   # default
```

Lalu simulasi pesan masuk (hanya mode `DEBUG=true`):

```bash
# bentuk sederhana
curl -X POST http://localhost:8000/api/v1/dev/mock-tg \
  -H "Content-Type: application/json" \
  -d '{"from": "12345", "text": "halo, ada kopi?"}'

# bentuk Update Telegram asli (message)
curl -X POST http://localhost:8000/api/v1/dev/mock-tg \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1, "message": {"chat": {"id": 12345, "type": "private"}, "text": "halo", "from": {"id": 12345, "first_name": "Andi"}}}'
```

## Arsitektur (ringkas)

```
Telegram server --(Update + secret header)--> /api/v1/webhooks/telegram
  -> TelegramAdapter.verify_request (secret token, fail-closed)
  -> provider.parse_webhook -> InboundMessage(channel="TELEGRAM")
  -> MessagingChannelAdapter (dedupe update_id, CONFIRM/CANCEL, SalesAgent)
  -> provider.send_message (Bot API sendMessage + inline keyboard)
```

- Routing logic di `app/channels/messaging_base.py`
  (BR-09: Sales Agent channel-agnostic).
- Konfirmasi order via `callback_query` dengan idempotency key `tg:<ref>`
  — retry webhook tidak mendobel order.
- Rate-limit webhook: 60 req/menit/IP (`app/core/rate_limit.py`).
- Test: `tests/test_telegram.py` (15 test — security, parsing, e2e, idempotensi).

## Batas yang disadari (MVP)

- Respons **callback_query** belum memanggil `answerCallbackQuery` (tombol
  terlihat "loading" beberapa detik di aplikasi Telegram sampai balasan
  teks tiba). Estetis, bukan fungsional — diperbaiki saat polish.
- Pemrosesan AI sinkron di handler webhook (cukup untuk skala demo; Telegram
  membatas waktu respons, antrean/polling = future work).
- Media (foto produk, voice) diabaikan — hanya pesan teks.
