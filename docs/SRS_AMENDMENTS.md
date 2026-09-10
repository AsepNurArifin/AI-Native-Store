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

---

> **Status dokumen:** DRAFT — butuh review + tanda tangan tim (mirip mekanisme
> ratifikasi SRS §11) sebelum freeze.
