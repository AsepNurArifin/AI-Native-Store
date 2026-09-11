# PLAN — Peluncuran Produk: Landing + Subscribe + Demo SaaS

> Supersedes `PLAN_OPEN_SOURCE.md` (ditunda — repo beralih ke **private**,
> lihat §6). Turunan diskusi arah produk 2026-09-11.
>
> Arah yang diratifikasi pemilik produk:
> 1. Repo **private** (open source release ditunda tanpa batas waktu).
> 2. Skema produk: **SaaS fasad** — landing page promosi → subscribe →
>    panel admin + webchat + bot Telegram per tenant.
> 3. Billing = **mock** (tanpa payment gateway nyata pada tahap ini).
> 4. Multi-tenant penuh = future work (didokumentasikan, tidak dibangun).

---

## 1. Model Produk

```
Landing page publik (promosi AI-Native Store)
   │  "Coba gratis 14 hari"
   ▼
Form subscribe (mock billing) ──► provisioning tenant (manual: 1–3 demo)
   │
   ▼
Panel admin + webchat + bot Telegram milik tenant
```

- **Audiens repo**: tidak ada (private). Penguji sidang mengakses via
  live demo, bukan via kode publik.
- **Audiens produk**: pemilik toko non-IT (persona "Bu Ratna" — lihat
  catatan diskusi; dirumuskan lengkap saat seed data demo direvisi).
- **Yang nyata**: landing, funnel UI, panel admin + webchat + Telegram,
  deployment demo.
- **Yang disimulasikan/dokumentasikan**: pembayaran, provisioning
  otomatis, multi-tenant DB.

## 2. Pricing (diratifikasi, untuk halaman pricing & mock billing)

| Paket | Harga | Isi |
|---|---|---|
| Coba | Gratis 14 hari | Semua fitur, tanpa kartu kredit |
| Toko | Rp79.000/bln · Rp790.000/thn | Full fitur + 1.000 chat AI/bln |
| Top-up AI | Rp25.000 / 500 chat | opsional |

WhatsApp = fitur paket lanjutan (future), alasan: biaya per-pesan +
verifikasi bisnis Meta per tenant.

---

## 3. Fase Eksekusi

### Fase 0 — Housekeeping arah baru (½ hari)

1. Tandai `PLAN_OPEN_SOURCE.md` sebagai **DITUNDA** (header + status).
   Tidak dihapus — arsitekturnya tetap valid bila suatu saat open source
   diaktifkan kembali.
2. File ini menjadi plan aktif.
3. Verifikasi tidak ada file rahasia yang salah tempat (tetap disiplin
   `.env` vs `.env.example` — repo private bukan alasan bocor, karena
   repo bisa berubah publik kelak).

### Fase 1 — Landing page publik (1,5–2 hari)

Halaman baru `frontend/app/pages/index.vue` **didesain ulang total** sebagai
landing promosi (menggunakan sistem desain Toko Digital dari `design.md`):

- Hero: value proposition satu kalimat + CTA "Coba gratis 14 hari".
- Masalah→solusi (3 poin: kewalahan balas chat, stok tidak sinkron,
  tidak punya IT).
- Fitur utama (webchat, 3 AI agent, anti-overbooking, panel admin).
- **Pricing** (tabel §2).
- FAQ singkat (non-IT friendly).
- CTA penutup + footer.

Halaman chat toko yang sekarang (`index.vue` lama) dipindah ke rute
`/chat` (atau subdomain saat demo multi-tenant).

**Acceptance**: build pass, SSR 200, mobile 320–768px terverifikasi,
copy tanpa angka/metrik fiktif.

### Fase 2 — Funnel subscribe mock (1–1,5 hari)

1. Halaman `/subscribe`: form (nama toko, nama pemilik, email/HP, pilih
   paket Coba/Toko/thn) + tombol bayar (mock).
2. Halaman sukses: "Toko sedang disiapkan" + penjelasan alur manual
   (jujur: pada tahap ini provisioning oleh admin).
3. Backend: tabel kecil `subscriptions` (atau cukup email/log pada mock
   tahap 1) + endpoint `POST /api/v1/subscriptions` dengan validasi.
   Data ini juga bahan demo sidang ("ada yang mendaftar").
4. Proteksi: rate-limit endpoint subscribe (lanjutan P5, makin wajib
   karena form publik).

**Acceptance**: alur landing → subscribe → sukses bisa diperagakan
end-to-end tanpa error; data masuk terlihat di sisi admin (minimal log).

### Fase 3 — Channel Telegram (2–3 hari) ⭐ nilai teknis utama

1. Adapter `app/channels/telegram/` mengikuti pola `provider_base.py`
   (webhook verify → normalisasi `InboundMessage` → routing agent yang
   sama dengan webchat/WA).
2. Konfigurasi per-tenant: `TELEGRAM_BOT_TOKEN` (dari BotFather —
   self-service, gratis, tanpa verifikasi bisnis).
3. Admin UI: kolom token + tombol "uji koneksi".
4. Test: unit adapter + webhook security (pola `test_webhook_security.py`
   — secret token header Telegram).
5. Docs: `docs/TELEGRAM_SETUP.md` (langkah BotFather 5 menit).

**Acceptance**: pesan masuk Telegram → Sales Agent membalas → order
terbentuk → terlihat di admin (alur e2e teruji via mock/scripted LLM).

### Fase 4 — Deployment live demo (1–2 hari)

- FE: Vercel (subdomain + `NUXT_PUBLIC_API_BASE`).
- BE: host container (Railway/Fly/Render — pilih saat eksekusi).
- DB: Supabase project demo terpisah.
- `WA_PROVIDER=mock`, `LLM_PROVIDER=groq`, budget LLM dipantau.
- Rate-limit aktif di rute publik (chat, webhook, subscribe).
- (Opsional) PWA: `@vite-pwa/nuxt` + manifest tema Toko Digital —
  penguji bisa "install" demo ke HP.

**Acceptance**: URL publik; alur demo < 1 menit (landing → subscribe →
admin → chat → Telegram).

### Fase 5 — Polish & narasi sidang (1 hari)

1. Seed data demo selaras persona ("Toko Bu Ratna": nama + ±100 SKU realistis).
2. Screenshot/record demo untuk presentasi.
3. Sync README + docs (hapus narasi open source bila mengganggu).

---

## 4. Estimasi Total

±7–9 hari kerja. Urutan dependensi: 0 → 1 → 2 → 3 → 4 → 5
(Fase 3 bisa paralel dengan 1–2 karena backend/frontend terpisah).

## 5. Future Work (dokumentasikan, jangan bangun)

- Multi-tenant DB (`tenant_id`, row-level isolation) — prasyarat SaaS nyata.
- Billing nyata (Midtrans/Xendit), siklus langganan, suspend otomatis.
- WhatsApp Cloud API per tenant (paket premium).
- PWA penuh + push notification.
- Open source release (lihat `PLAN_OPEN_SOURCE.md` — arsitektur tetap valid).

## 6. Status Tracking

| Item | Status | Catatan |
|---|---|---|
| `PLAN_OPEN_SOURCE.md` → ditunda | ✅ Fase 0 | header status ditambahkan |
| Landing page baru | ✅ Fase 1 | commit `d8d2784` |
| Funnel subscribe | ✅ Fase 2 | POST/GET `/subscriptions` + rate-limit (P5 lunas) + 14 test |
| Adapter Telegram | ⬜ Fase 3 | token per-tenant, e2e test |
| Deploy demo publik | ⬜ Fase 4 | FE Vercel + BE host |
| Seed "Toko Bu Ratna" | ⬜ Fase 5 | |
