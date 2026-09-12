# SRS Amendments — Log Deviasi Implementasi

> **Tujuan:** mendokumentasikan setiap deviasi sadar antara SRS v3.3 dan implementasi,
> beserta alasannya, supaya dokumentasi dan kode konsisten untuk sidang capstone.
> Referensi audit: laporan konsistensi code-vs-SRS + `docs/REMEDIATION_PLAN.md`.
>
> Status: 🟢 = deviasi disetujui (ratifikasi disarankan) · 🟡 = butuh keputusan tim.

---

## A. Perbaikan yang SUDAH diimplementasikan (kembali patuh SRS)

| # | Requirement | Perbaikan | Bukti test |
|---|---|---|---|
| F1 | FR-SA-05/FR-SMS-06/UC-02 — order tidak pernah tercipta end-to-end | `ToolExecutor.build_order_summary` kini menyimpan summary via `summary_store.put()` | `test_flow_e2e.py::test_web_flow_message_to_confirm_end_to_end` |
| F2 | FR-AA-01/UC-04 — Action Assistant tanpa entry point | `POST /ai-actions/draft` (owner-only) + panel instruksi NL di halaman admin AI Actions | `test_ai_actions.py::test_draft_endpoint_*` (4 test) |
| F3 | FR-AUTH-02/NFR-03/UC-03 — `/chat/analyst/ask` publik | Endpoint kini wajib `require_owner` (JWT) | `test_chat.py::test_analyst_ask_*` |
| F4 | FR-SA-05 (WA) / UC-02 E5,E7 — tombol `CONFIRM:<ref>` tidak ditangani | Adapter WhatsApp mengintersepsi `CONFIRM:` → `OrderService.create_from_summary` (idempotency key stabil `wa:{ref}`); percakapan WA di-reuse (tidak baru per pesan) | `test_flow_e2e.py::test_whatsapp_*` (3 test) |
| F5 | FR-SA-07 — 24h window tidak pernah terbuka | `parse_webhook` provider Meta mencatat `_seen_sessions` saat pesan inbound | (manual/mock; MVP in-memory) |
| F6 | UC-02 step 5 — diskon summary ≠ order (promosi terjadwal) | `effective_status`: start_date masa depan → `SCHEDULED` (bukan ACTIVE); `OrderService._active_promotion` kini memakai `effective_status` sebagai satu sumber kebenaran | `test_flow_e2e.py::test_scheduled_promo_price_consistency_summary_vs_order` |
| F7 | FR-SMS-05 BR-1 — job async EXPIRED | Scheduler APScheduler di lifespan (`maintenance_interval_minutes`, default 5 menit): `PromotionService.expire_due` + purge `IdempotencyKey` TTL + `summary_store.purge_expired`; refresh-on-read tetap ada | (tidak aktif saat pytest: `app_env == testing`) |

## B. Deviasi yang DIPERTAHANKAN (perlu ratifikasi tertulis)

### B1. 🟢 Semantik stok kurang — seluruh order ditolak, bukan per-item (UC-02 5a/E3)

SRS menyatakan item stok-nya kurang **dibuang dari Order Summary** sebelum commit
(parsial per item). Implementasi menolak **seluruh order** secara atomik
(`INSUFFICIENT_STOCK`, rollback penuh).

**Alasan:** lebih aman (tidak ada order "kejutan" berisi item yang tidak diminta
customer) dan konsisten dengan FR-SMS-06 (operasi atomik tanpa Cart).
**Rekomendasi:** ratifikasi perilaku kode, amende ucapan SRS UC-02 5a/E3.

### B2. ✅ Role STAFF dihapus total dari sistem (keputusan tim — deviasi #9 TERTUTUP)

SRS hanya mendefinisikan Owner dan Customer. Implementasi sebelumnya menambah
`UserRole.STAFF` dengan akses CRUD internal (`require_staff_or_owner`).

**Keputusan tim:** STAFF dihapus seluruhnya — semua operasi internal (CRUD produk/inventory/
order/promotion, monitoring, analytics, audit, draft + approval AI action) langsung
dikuasai Owner. Alasan: STAFF hanya memperpanjang alur tanpa nilai bisnis di sistem ini
(approval tetap berakhir di Owner), sedangkan SRS §2.2 tidak pernah memintanya.

**Perubahan:** enum `UserRole` hanya `OWNER`; dependency tunggal `require_owner` untuk
seluruh router internal; user seed STAFF + `SEED_STAFF_EMAIL` dihapus; UI teks
"Staff/Owner" diluruskan. Baris user legacy ber-role non-owner di DB tetap ditolak 403
(diuji `test_owner_only_endpoint_rejects_non_owner_role`).

**Dampak SRS:** tidak ada — justru kembali sepenuhnya patuh §2.2 (2 actor: Owner, Customer).

### B3. 🟢 Lapisan tool SRS §5.2 diimplementasikan sebagai endpoint + service

SRS §5.2 melisting `create_order`, `approve_draft`, `execute_draft`, `log_audit`,
`receive_channel_message`, `send_channel_message` sebagai *tool/function calling*.
Implementasi menyediakannya sebagai **endpoint REST + service**; hanya tool baca/analitik
+ `build_order_summary` + `create_promotion_draft` yang diekspos ke LLM.

**Alasan:** konfirmasi order (UC-02 E5) dan approval Owner (UC-04) adalah *event
manusia*, bukan keputusan LLM — mengeksposnya sebagai tool berisiko eksekusi tanpa
konfirmasi. Keputusan desain disengaja; komentar `tools.py` yang mengutip §5.2 sebagai
mandat sudah diluruskan. **Rekomendasi:** amende §5.2 menjadi "tool baca untuk LLM;
mutasi data via jalur manusia/konfirmasi".

### B4. 🟢 Profil Customer dibuat saat `chat/start`, bukan saat order pertama (FR-SMS-04a)

Lazy identity (`name|contact`) sudah menangkap profil sejak percakapan dimulai.
Lebih awal dari SRS, tetapi tidak melanggar aturan apa pun (identitas per-channel, BR-10).

### B5. 🟢 `build_order_summary(items)` vs spesifikasi `(conversation_id)` (§5.2, §2.4)

Agregasi item lintas-giliran dilakukan **LLM dari konteks 12 pesan terakhir**
(plus instruksi prompt eksplisit "SELURUH item sepanjang sesi"), bukan agregasi
server-side per conversation. Konsisten C7 (tanpa Cart). Risiko: percakapan sangat
panjang bisa kehilangan item awal — diterima untuk MVP.

### B6. 🟢 24h window & dedupe webhook bersifat in-memory (MVP)

`_seen_sessions` dan `_seen` hilang bila proses restart. Untuk demo/dev acceptable;
produksi butuh persistensi (mis. tabel `webhook_events`). Aman terhadap aturan Meta
(salah arah hanya membuat semua balasan jadi template).

### B7. 🟢 Outcome percakapan

`NO_MATCH` belum pernah diset (hanya `OPEN`, `ORDERED`, `ABANDONED`, `ERROR`).
`ABANDONED` diset saat CANCEL via WhatsApp; `ERROR` saat agent exception. `ended_at`
diisi service. `NO_MATCH` dihapus dari pemakaian aktif / dibiarkan sebagai nilai masa depan.

## C. Catatan keputusan teknis terkait perbaikan

- **Idempotency WhatsApp:** key stabil per summary (`wa:{summary_ref}`) — retry webhook
  tidak menduplikasi order (UC-02 E5), selaras dengan perilaku key stabil per ref di Web.
- **Scheduler maintenance:** interval via `MAINTENANCE_INTERVAL_MINUTES` (default 5);
  dinonaktifkan saat `APP_ENV=testing`; job gagal tidak mematikan app (log-only).
- **`LLM_MONTHLY_BUDGET_IDR`:** kini terbaca Settings (NFR-08, monitoring manual) —
  sebelumnya di-ignore (`extra="ignore"`).
- **Test hygiene (R10):** happy-path order wajib lewat jalur produksi (lihat catatan
  `tests/conftest.py`); injeksi `summary_store.put` hanya untuk simulasi keadaan basi.

## D. Keputusan ratifikasi sesi integrasi (plan.md B3/B4/P5)

### D1. 🟢 Payload konfirmasi kanonik: `CONFIRM:<summary_ref>` (bukan `CONFIRM_ORDER:`)

Wire payload (Web button & WA interactive reply button) dan intercept adapter
menggunakan `CONFIRM:<summary_ref>`; idempotency key `wa:{ref}`. Dokumen
(ARCHITECTURE/AI_PROMPTS/WABA_SETUP/API_DESIGN) sudah disinkronkan ke format ini.
Konsep internal tetap "confirm order" — hanya representasi wire yang dibakukan.

### D2. 🟢 Migration DB: raw SQL berurutan + runner `app.db.migrate`

File `backend/migrations/001..004_*.sql` diterapkan via `uv run python -m app.db.migrate`
(asyncpg, multi-statement per file dalam satu transaksi), tercatat di tabel
`schema_migrations` (idempotent, up-only). `Base.metadata.create_all` tetap dipakai
untuk dev/test (app/db/init_db.py); file migration adalah jalur kanonik
produksi/Supabase. Verifikasi: fresh DB berhasil dibuat dari migration saja;
trigger append-only menolak update/delete audit_logs.

### D3. 🟢 PK UUID untuk SEMUA tabel (termasuk `audit_logs`, `conversation_messages`)

DATA_SCHEMA D5 semula mengusulkan BIGINT IDENTITY untuk tabel append-only
high-volume. Karena model ORM memakai UUID dan konsistensi schema dev/prod
lebih penting untuk capstone (≤500 SKU, single store), seluruh tabel memakai
UUID PK. Dampak NFR/volume tidak signifikan pada skala ini.

### D4. 🟢 Deployment: FE di Vercel, DOCKER HANYA BACKEND

Keputusan tim (ratifikasi sesi integrasi): frontend Nuxt tidak di-container;
hosting FE = Vercel (`npm run build` preset Vercel, `NUXT_PUBLIC_API_BASE`
diset di Vercel env). Docker hanya untuk backend (`backend/docker-compose.yaml`,
plus override Postgres lokal `backend/docker-compose.local.yaml` bila ada),
DB = Supabase managed. CORS backend wajib mencantumkan origin domain Vercel
(`CORS_ORIGINS`).

### D5. 🟢 Production config guards (P5) — fail-fast saat startup

`validate_runtime_config()` di `app/core/config.py` dipanggil di lifespan:
pada `APP_ENV=production` kondisi berikut membatalkan startup (RuntimeError):
JWT_SECRET_KEY default/lemah, `DEBUG=true`, `SEED_ON_STARTUP=true`,
`LLM_PROVIDER=mock`, CORS wildcard. `WA_PROVIDER=mock` di production = warning
(fallback demo yang disadari tim). Dev/test hanya menampilkan warning.

### D6. 🟢 Isolasi env test eksplisit

`tests/conftest.py` menetapkan `settings.app_env="testing"`, `seed_on_startup=False`,
`debug=False` sebelum import session — scheduler maintenance nonaktif saat test,
seed startup tidak pernah menyentuh DB test, endpoint dev terkunci.

## E. Pivot model produk: SaaS fasad → single-user (2026-09-12)

### E1. 🟢 Funnel subscribe dihapus — produk menjadi single-user (satu toko per instalasi)

Keputusan pemilik produk: sistem tidak lagi diposisikan sebagai SaaS.
Aplikasi kini menjadi sistem manajemen toko AI-native untuk **satu toko
tunggal** (satu akun Owner per instalasi) — konsisten dengan realitas
implementasi yang memang tidak pernah multi-tenant (tanpa `tenant_id`, tanpa
billing, tanpa provisioning).

**Yang dihapus:**
- Model `Subscription`, schema, dan routes `POST/GET /api/v1/subscriptions`
- Halaman `/subscribe` + semua CTA subscribe/pricing di landing page
- Migrasi `006_drop_subscriptions.sql` (tabel `subscriptions` di-drop)
- Test funnel subscribe (`test_subscriptions.py`, 7 test dihapus)

**Yang dipertahankan:**
- Rate-limit P5 tetap aktif di endpoint publik (chat, webhook); pengujian
  429/Retry-After dipindah ke `test_rate_limit.py` (via webhook Telegram)
- Landing page tetap ada — CTA kini "Lihat Demo Toko" (pembeli) dan "Masuk ke
  Panel Admin" (pemilik); section pricing diganti section "akses sistem"
- Admin panel, webchat `/chat`, dan bot Telegram tidak berubah (memang sudah
  single-store)

**Alasan:** narasi SaaS menggantung (billing mock, provisioning manual) lebih
merugikan untuk sidang daripada positioning yang jujur dan konsisten.
Jalur evolusi ke multi-tenant tetap terdokumentasi sebagai future work.

**Dampak SRS/PRD:** bagian pricing/paket langganan pada dokumen produk tidak
lagi mengikat untuk implementasi; requirement fungsional inti (FR-SMS, FR-AA,
FR-BA, FR-AUTH) tidak terpengaruh.

---

> **Status dokumen:** DRAFT — butuh review + tanda tangan tim (mirip mekanisme
> ratifikasi SRS §11) sebelum freeze.
