# WABA_SETUP — Setup Meta WhatsApp Cloud API

> Panduan setup provider WhatsApp terpilih (**Meta Cloud API resmi**) + strategi test number & synthetic-first. Menjawab Constraint C6 (verifikasi bisnis tak pasti waktunya — mulai F0!) dan item SRS §11 (Provider WABA, Fallback sandbox).

---

## 1. Kenapa Meta Cloud API (ringkasan keputusan)

- Biaya per-pesan paling rendah → masuk NFR-13 (≤ Rp 200 rb/bulan masa uji).
- Native webhook + **interactive reply button** (wajib untuk konfirmasi order eksplisit FR-SA-05).
- **Test number gratis** — kirim ke maks 5 nomor terdaftar tanpa verifikasi bisnis → cocok strategi synthetic-first.
- Kontrol penuh payload → cocok arsitektur Channel Adapter (BR-09).
- Risiko: verifikasi bisnis bisa makan waktu berminggu-minggu (C6) → mitigasi §4.

---

## 2. Roadmap Setup Meta (urutan nyata di dashboard)

### Tahap A — F0 (segera, ~1–2 jam kerja + tunggu)
1. Buat **Meta Developer Account** (developers.facebook.com).
2. Buat **Business Portfolio** (Meta Business Suite) — akan dipakai untuk verifikasi nanti.
3. Buat **App** tipe *Business* → tambahkan produk **WhatsApp**.
4. Buka **WhatsApp → API Setup**: Meta otomatis menyediakan **test number** + `PHONE_NUMBER_ID` + `ACCESS_TOKEN` sementara.
5. Daftarkan **hingga 5 nomor recipient** (HP anggota tim) sebagai penerima test.
6. Simpan ke `backend/.env` (lihat ENVIRONMENT.md §6): `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` (buat random sendiri).
7. Jalankan proses **verifikasi bisnis sejak awal** (Business Settings → Security Center → Start Verification). Isi dokumen legal (KTP/NIB/akta toko dummy untuk capstone boleh pakai data usaha anggota). Status: *pending* berhari–berminggu → **jangan blokir development** (lanjut pakai test number).

### Tahap B — F3 (dev dengan Mock provider)
- `WA_PROVIDER=mock` — semua alur WA dikembangkan & dites via MockWhatsAppProvider; tidak hit Meta.

### Tahap C — F7 (integrasi real)
1. Konfigurasi **webhook** di Meta App:
   - Callback URL: `https://<backend-public-url>/api/v1/webhooks/whatsapp`
   - Verify token: nilai `WA_VERIFY_TOKEN`
   - Subscribe fields: `messages` (dan `message_template_status_update` bila pakai template).
2. *(Butuh URL publik — lihat §5.)*
3. Ganti `WA_PROVIDER=meta`, kirim pesan dari nomor test → pastikan webhook masuk & balasan terkirim.
4. Bila verifikasi bisnis **sudah** disetujui: tambahkan nomor bisnis riil (display name approval + payment method untuk akun di atas tier gratis).
5. Bila **belum** disetujui: tetap pakai test number (fallback resmi SRS §11) — document status-nya di progress report.

---

## 3. Aturan Platform yang Harus Dihormati Kode

| Aturan | Sumber | Implementasi |
|---|---|---|
| **24-hour window** | Free-form message hanya ≤24 jam sejak pesan customer terakhir | `check_24h_window()` pakai `conversations.last_activity_at`; tertutup → kirim template atau tahan + log (FR-SA-07) |
| **Interactive reply button** | Maks 3 tombol quick reply; payload maks 256 char | Tombol [Konfirmasi Pesanan] payload `CONFIRM:<summary_ref>` |
| **Template message** | Harus named + approved +kategori utility/marketing | Usulan 1 template utility: `order_confirmation` — dibuat & disubmit approve di F7 (opsional bila 24h window cukup untuk demo) |
| **Webhook signature** | Header `X-Hub-Signature-256` = HMAC-SHA256(body, app_secret) | Middleware verifikasi; invalid → 401 tanpa proses |
| **Webhook harus 200 cepat** | Meta retry bila lambat/gagal | Terima → ack 200 segera → proses async (queue) — E6/NFR-12 |
| **Rate limit / burst** | Batas per detik per nomor | Retry + backoff di provider; WA failure tidak menjatuhkan Web Chat |

---

## 4. Strategi Fallback (C6 & NFR-12)

```
Verifikasi bisnis selesai sebelum F7? ── ya ──▶ nomor bisnis riil (prod)
                    │
                    tidak
                    ▼
        Test number (5 recipient, gratis, full fitur)
                    │
        Provider down / rate limit / webhook gagal?
                    ▼
        Log + status jelas di /health; WEB CHAT TETAP NORMAL (NFR-12)
```

- `WA_PROVIDER` = `mock` | `meta` — switch via env, tanpa ubah business logic (BR-09).
- Jangan pernah menunggu Meta untuk mulai/melanjutkan fase lain — semua fase sebelum F7 tidak bergantung Meta.

---

## 5. Kebutuhan URL Publik untuk Webhook (F7)

Webhook Meta harus bisa diakses publik HTTPS. Opsi (pilih satu di F7):

| Opsi | Cocok untuk | Catatan |
|---|---|---|
| **Cloudflare Tunnel** (`cloudflared`) dari mesin dev/demo | Demo & development | Gratis, cepat setup — **usulan utama** |
| Deploy container ke VPS/cloud kecil | Demo jangka panjang | Butuh domain + TLS |
| ngrok | Alternatif cepat | Domain berubah tiap restart (gratis tier) |

> Supabase sudah HTTPS; masalah hanya pada backend lokal yang menerima webhook.

---

## 6. Biaya (perkiraan — pantau, NFR-13)

- Tier percakapan service **gratis** (Meta): gratis conversation service dalam window 24 jam per customer — untuk skala capstone, biaya mendekati Rp 0.
- Test number: **gratis** (recipient terbatas 5).
- Verifikasi bisnis: gratis.
- Template/utility di luar window: berbayar per pesan (kecil).
- Kesimpulan: anggaran Rp 200 rb/bulan sangat aman bila demo didominasi window-24h + test number. **Pantau billing di dashboard Meta** dan catat di laporan NFR-13.

---

## 7. Checklist Status (perbarui di progress report)

- [ ] Akun Meta Developer dibuat (siapa? tanggal?)
- [ ] Business portfolio dibuat
- [ ] App + produk WhatsApp aktif
- [ ] Test number aktif; 5 recipient didaftarkan
- [ ] `.env` WA terisi (dev)
- [ ] **Verifikasi bisnis DIMULAI** (tanggal submit) — status: pending/approved/rejected
- [ ] Webhook terhubung (F7) — handshake sukses
- [ ] Interactive button konfirmasi bekerja (F7)
- [ ] (Opsional) Template `order_confirmation` approved
- [ ] Bila rejected/tertunda > X minggu: putuskan lanjut test number (default SRS §11)
