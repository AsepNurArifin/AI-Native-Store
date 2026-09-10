# PLAN — AI-Native Store Management System

> **Dokumen master perencanaan pengembangan.** Sumber requirement: `SRS_v3.1_AI_Native_Store_Management_System (1).md` (baseline tunggal, self-contained) dan `Product Requirements Document — AI-Native Store Management System.md` (PRD).
>
> Dokumen ini **hanya perencanaan**. Tidak ada file kode/konfigurasi implementasi yang ditulis. Semua pilihan di bawah masih terbuka untuk direview sebelum implementasi dimulai.
>
> Semua referensi FR/NFR/UC/TC mengikuti penomoran SRS v3.1 (§3, §4, §7, §9).

---

## 0. Ringkasan Eksekutif

| Item | Nilai |
|---|---|
| **Produk** | AI-Native Store Management System (conversational commerce + AI-assisted operations) |
| **Tim** | 3 anggota (paruh waktu), timeline 8 Sep 2026 – Des 2026 (~3,5 bulan) |
| **Frontend** | Nuxt 4 (sudah di-setup, masih kosong — hanya template awal) |
| **Backend** | Python FastAPI (folder `backend/` masih kosong) |
| **Database** | Supabase (PostgreSQL) |
| **AI** | 3 agent: AI Sales Agent (SELL), AI Business Analyst (UNDERSTAND), AI Action Assistant (ACT) |
| **Channel** | 2 channel: Web Chat Widget + WhatsApp (keduanya masuk MVP) |
| **WABA** | **Meta WhatsApp Cloud API resmi** (keputusan rekomendasi) |
| **Data uji** | **Synthetic test data dulu** (MockWA + seed generator), lalu real WABA di fase akhir |
| **Deployment** | Docker (docker compose: frontend + backend), Supabase sebagai managed Postgres |
| **Scope di luar MVP** | Payment/POS, Cart entity, marketplace integrasi, video/vector DB, identitas lintas-channel |

---

## 1. Konteks dan Pembacaan SRS yang Kritis

Sebelum mulai, seluruh anggota tim harus paham **6 keputusan desain yang menentukan arsitektur** ini. Ini adalah fondasi; salah memahaminya akan menyebabkan kontradiksi di implementasi.

### 1.1 Dua jalur perubahan data (SRS §2.3, Constraint C2)
Ini aturan paling penting. Ada **dua jalur** yang berbeda **otorisasi-nya**:

| Jalur | Inisiator | Otorisasi | Contoh |
|---|---|---|---|
| **Jalur 1 — Customer Transaction** | Konfirmasi eksplisit customer sendiri | **Tidak perlu approval Owner**, cukup validasi backend (stok, harga, produk aktif) | Membuat Order (UC-02) |
| **Jalur 2 — AI Administrative Action** | Instruksi Staff/Owner ke AI Action Assistant | **Wajib approval Owner** sebelum eksekusi | Membuat/ubah Promotion (UC-04) |

> **Implikasi implementasi:** AI Action Assistant **tidak boleh** langsung mengeksekusi promosi. AI hanya membuat draft (status DRAFT, tidak berdampak), lalu menunggu approval Owner. Approval hanya boleh oleh role OWNER (termasuk draft buatan Owner sendiri, FR-AA-03).

### 1.2 Order tanpa Cart (SRS §2.4, Constraint C7)
Sistem **tidak punya entity Cart/CartItem tersimpan**.
- AI mengekstrak semua item + quantity dari percakapan (disimpan sebagai bagian context sesi, bukan baris DB terpisah).
- AI menyusun **Order Summary** (item, quantity, harga, total) — **representasi sementara**, bukan entity DB.
- Order + Order Item dibuat **sekali, atomik**, tepat saat konfirmasi eksplisit (FR-SA-05, FR-SMS-06).

> **Implikasi implementasi:** Tidak boleh ada tabel `cart` / `cart_items`. `build_order_summary()` dan `create_order()` adalah fungsi tool-calling yang dipanggil hanya setelah konfirmasi UI eksplisit (tombol di Web Chat / *interactive reply button* di WhatsApp), bukan pada teks bebas seperti "oke"/"gas".

### 1.3 Channel Adapter (SRS §2.5, PRD §11–12)
AI Sales Agent Core harus **channel-agnostic**. Semua perbedaan protokol diisolasi di `Channel Adapter`:
```
Web Chat Widget ──▶ Web Adapter ──┐
                                  ├──▶ AI Sales Agent (CORE) ──▶ Tool Call ──▶ SMS Backend
WhatsApp (WABA) ──▶ WhatsApp Adapter ─┘
```

> **Implikasi implementasi:** Business logic rekomendasi/order **hanya satu**, tidak duplikat per channel. Komponen `WhatsAppProvider` (interface) mengisolasi Meta Cloud API sehingga bisa di-mock saat dev.

### 1.4 AI tanpa akses DB langsung (SRS §5.2, NFR-06, PRD Risk 1)
AI (LLM) **tidak boleh** query database langsung. Semua baca/tulis lewat **tool/function calling** ke backend yang menjalankan validasi & otorisasi yang sama dengan jalur manual.

**Daftar function/tool dari SRS §5.2:**

| Tool | Dipakai oleh | Fungsi |
|---|---|---|
| `get_product(id)` | Sales Agent, Business Analyst | Ambil 1 produk |
| `search_products(filter)` | Sales Agent | Cari produk (stock-aware) |
| `get_stock(product_id)` | Sales Agent, Business Analyst | Ambil stok |
| `compare_products(id_list)` | Sales Agent | Bandingkan ≥2 produk |
| `build_order_summary(conversation_id)` | Sales Agent | Susun Order Summary dari context (tanpa Cart) |
| `create_order(conversation_id, confirmed_items)` | Sales Agent | Buat Order+Item atomik (hanya setelah konfirmasi) |
| `analyze_sales(period, filter)` | Business Analyst | Agregasi penjualan |
| `analyze_inventory(threshold)` | Business Analyst | Hitung stockout risk |
| `create_promotion_draft(params)` | Action Assistant | Buat draft promosi (Jalur 2) |
| `approve_draft(draft_id, actor_id)` | Action Assistant | Approve (hanya Owner) |
| `execute_draft(draft_id)` | Action Assistant | Eksekusi draft yang sudah disetujui |
| `log_audit(actor_type, actor_id, event, detail)` | Semua modul AI | Catat AuditLog |
| `receive_channel_message(channel, payload)` | Channel Adapter → Core | Terima pesan masuk |
| `send_channel_message(channel, customer_ref, content, is_template)` | Core → Adapter | Kirim pesan keluar |
| `check_24h_window(customer_ref)` | Adapter (WhatsApp) | Cek jendela 24 jam |

### 1.5 Grounding & anti-hallucination (SRS FR-SA-06, NFR-10)
Setiap klaim AI soal **harga, stok, spesifikasi, status order, status promosi** harus punya record DB pendukung pada saat response diproses. Produk fiktif → jawab "tidak ditemukan", tidak mengarang. **Ini dipenuhi lewat tool-calling, bukan RAG bebas.** (C5: tanpa vector/graph DB.)

### 1.6 Enam hal yang harus diingat bersama
1. Ada **2 jalur perubahan data** dengan otorisasi berbeda (C2).
2. **Tidak ada Cart** — order langsung dari Order Summary sementara (C7).
3. **Channel Adapter** mengisolasi protokol, AI core channel-agnostic.
4. **AI tidak pegang DB langsung** — semua lewat tool calling.
5. **Grounding wajib** — no hallucination (FR-SA-06, NFR-10).
6. **AuditLog append-only** + actor_type USER/AI_SYSTEM (FR-AA-04).

---

## 2. Pilihan Stack dan Disclaimer

| Lapisan | Stack | Status | Catatan |
|---|---|---|---|
| Frontend | Nuxt 4 (Vue 3, TS), @nuxt/ui, Tailwind 4 | ✅ Sudah di-setup, masih template kosong | Perlu konfigurasi ulang untuk app |
| Backend | Python 3.12 + FastAPI | ⬜ Belum dibuat (folder kosong) | Async, Pydantic, SQLAlchemy |
| Database | Supabase (PostgreSQL) | ⬜ Belum dibuat | Managed → tidak bisa SQLAlchemy `create_all` untuk produksi; pakai migration (SQL) |
| ORM/DB driver | SQLAlchemy 2.x (async) + `psycopg` (v3) | — | Untuk koneksi Supabase via connection string |
| WABA | Meta Cloud API (resmi) | Keputusan | Interface provider + Mock untuk dev |
| AI/LLM | LLM API eksternal (provider belum diputuskan — lihat §7). *Usulan: model murah & cepat.* | ⬜ Belum diputuskan | **Open item §11 SRS — wajib diputuskan sebelum fase AI** |
| Container | Docker + docker compose | ⬜ Belum dibuat | frontend + backend |
| Auth | JWT (access token) — usulan | ⬜ Belum diputuskan detail | Sesuaikan FR-AUTH |
| Testing | Pytest (BE), Vitest (FE), test build CI opsional | ⬜ Belum dibuat | — |

> **Catatan penting:** Stack backend/db/auth masih berupa usulan di atas. **Item yang WAJIB diputuskan tim sebelum implementasi** ada di §8, §9, dan §11.

---

## 3. Struktur Repositori (Target)

Struktur target setelah fase implementasi (untuk visualisasi saja — **belum dibuat**):

```text
capstone/
├── plan.md                        ← dokumen ini (master plan)
├── README.md
├── docker-compose.yml
├── .gitignore                       ← jaring pengaman: abaikan .env
├── backend/.env.example             ← template env BE (salin jadi backend/.env)
├── frontend/.env.example            ← template env FE (salin jadi frontend/.env)
├── docs/
│   ├── README.md                  ← indeks dokumentasi
│   ├── ARCHITECTURE.md            ← arsitektur detail
│   ├── DATA_SCHEMA.md             ← skema DB Supabase
│   ├── API_DESIGN.md              ← kontrak REST API
│   ├── AI_PROMPTS.md              ← prompt + tool calling 3 agent
│   ├── WABA_SETUP.md              ← setup Meta Cloud API + test number
│   ├── ENVIRONMENT.md             ← env vars & secrets
│   └── TASK_ASSIGNMENT.md         ← pembagian peran teknis
├── frontend/                      (sudah ada, Nuxt)
│   ├── app/
│   │   ├── app.vue
│   │   ├── pages/                 ← routes admin panel + landing + chat widget
│   │   ├── components/
│   │   ├── composables/
│   │   └── stores/                ← Pinia (untuk auth, data)
│   └── nuxt.config.ts
└── backend/                       (kosong, akan diisi)
    ├── app/
    │   ├── main.py
    │   ├── api/                   ← routers: auth, products, inventory, orders, promotions, conversations, analytics, ai_actions, audit, webhook_wa
    │   ├── core/                  ← config, security (JWT), deps
    │   ├── models/                ← SQLAlchemy models (ref §6 SRS)
    │   ├── schemas/               ← Pydantic schemas (ref DATA_SCHEMA.md)
    │   ├── services/              ← business logic (SMS, Order, Inventory, Promotion, Audit)
    │   ├── ai/                    ← agents: sales, analyst, action; tools; prompts
    │   ├── channels/              ← adapters: web, whatsapp; providers: meta, mock
    │   ├── migrations/            ← Alembic / SQL Supabase migration
    │   └── seed/                  ← synthetic data generator
    ├── tests/
    ├── Dockerfile
    ├── requirements.txt
    └── pyproject.toml
```

---

## 4. Roadmap — Fase dan Milestone

Timeline: 8 Sep 2026 → Des 2026 (~14 minggu / ~3,5 bulan), 3 anggota paruh waktu.

> **Aturan fase:** Setiap fase punya *gate* (kriteria keluar). Jangan melompat ke fase berikutnya sebelum gate fase sejalan lulus, karena SRS §10 menuntut FR Must lulus test case terkait.

| Fase | Rentang (perkiraan) | Fokus | Milestone / Gate |
|---|---|---|---|
| **F0** | Sep minggu 1 | Setup & penegasan keputusan | Ratifikasi open item; env; repo layout; **mulai verifikasi bisnis Meta** (C6) |
| **F1** | Sep minggu 1–3 | Backend core + DB + auth | Supabase migration dibuat; CRUD User/Product/InventoryTransaction/Customer; JWT auth (FR-AUTH-01..04) |
| **F2** | Sep minggu 3–5 | Order & Promo state machine | FR-SMS-01..06 lolos TC; order atomik + concurrency; promotion lifecycle & no-overlap |
| **F3** | Sep minggu 5–6 | Channel + konversasi | Conversation/Message/Recommendation; Channel Adapter interface; MockWA provider; webhook sinkron |
| **F4** | Okt minggu 1–3 | AI Sales Agent (SELL) | FR-SA-01..07 lolos TC; grounding; tool calling; 24h window; order via konfirmasi |
| **F5** | Okt minggu 3–Nov minggu 1 | AI Business Analyst (UNDERSTAND) + Action Assistant (ACT) | FR-BA-01,02,04; FR-AA-01..05; AuditLog append-only |
| **F6** | Nov minggu 1–3 | Admin Panel (FE) integrasi | Seluruh menu admin: Product, Inventory, Order, Promotion, Analytics, Conversation Monitoring, AI-Assisted Op |
| **F7** | Nov minggu 3–Des minggu 1 | Web Chat Widget + **real WABA** | UC-01/02 live di 2 channel; real Meta provider (atau test number); NFR-12 graceful degradation |
| **F8** | Des minggu 1–2 | UAT, hardening, Docker, NFR | NFR-01..13 test; NFR-07 usability; Docker bake; NFR-09 benchmark |

**Jalur kritis (critical path):**
```
Meta verification (C6) ──────────────▶ (real WABA) ──┐
                                                     ▼
DB + Auth ──▶ Order/Promo ──▶ Channel ──▶ AI SELL ──▶ AI BA + ACT ──▶ Admin Panel ──▶ Web + WA live ──▶ UAT/NFR
```
> **Risiko C6:** verifikasi bisnis Meta di luar kendali tim & waktunya tak pasti. **Mulai di F0.** Kalau belum selesai sampai F7, tetap lanjut pakai **test number** (5 nomor uji, gratis) — SRS §11 default fallback. Jangan blokir pipeline karena ini.

---

## 5. Pembagian Tugas (detail di `docs/TASK_ASSIGNMENT.md`)

> Dibuat lengkap di file pendukung, termasuk map FR/NFR → tugas. Ringkasan peran:

| Anggota | Fokus | Tugas inti |
|---|---|---|
| **A (BE/Data)** | Backend, data, integrasi | DB schema, migration, CRUD SMS, order inventory logic, promotion state machine, auth, channel/provider interface, webhook WABA |
| **B (AI)** | AI layer | Prompt & tool-calling 3 agent, grounding/guardrail, benchmark NFR-09, 24h window logic, integration tool → service |
| **C (FE)** | Nuxt admin + client | Admin panel full, Web Chat Widget, auth frontend, API integration, usability test NFR-07, Docker frontend |

> **Catatan:** pembagian bersifat fleksibel. Tim boleh menyesuaikan, tapi **wajib menuliskan hasilnya** (item terbuka §11). Detail di `docs/TASK_ASSIGNMENT.md`.

---

## 6. Peta Fase → FR/NFR (Traceability Implementasi)

Setiap fase harus menyelesaikan target test case ini (dari SRS §9). **Ini adalah deklarasi umpan-balik: fase dinyatakan selesai bila TC terkait lulus.**

| Fase | FR target | TC utama | NFR terkait |
|---|---|---|---|
| F1 | FR-AUTH-01,02,03,04, FR-SMS-01 | TC-AUTH-01..04, TC-SMS-01 | NFR-03 |
| F2 | FR-SMS-02,03,05,06 | TC-SMS-02,03,05a,05b,06a,06b,06c | NFR-04 |
| F3 | FR-SMS-07,08,09 | TC-SMS-07,08,09 | NFR-12 |
| F4 | FR-SA-01,02,03,04,05,06,07 | TC-SA-01..07 | NFR-01, NFR-09, NFR-10 |
| F5 | FR-BA-01,02,04; FR-AA-01..05 | TC-BA-01,02a,02b,04; TC-AA-01..05 | NFR-05, NFR-09, NFR-10 |
| F6 | FR-BA-05; FR-AA-03; FR-AUTH-01 | TC-BA-05, TC-AA-03, TC-AUTH-04 | NFR-07 |
| F7 | FR-SA-05,07; FR-SMS-08,09 | TC-SA-05,07; TC-SMS-08,09 | NFR-12 |
| F8 | Semua Must | Semua TC Must | NFR-01..13 |

> FR stretch (Could): FR-SA-08..10, FR-BA-03, FR-BA-06, FR-AA-06 → **prioritas rendah**, hanya bila waktu tersisa (SRS §2.7: kandidat pertama yang dikorbankan).

---

## 7. Keputusan yang Masih Terbuka (WAJIB Dirapatkan)

Ini berasal dari SRS §11 + keputusan teknis yang perlu konfirmasi sebelum implementasi. **Kolom "Status" akan diperbarui tim.**

### 7.1 Dari SRS §11 (wajib ratifikasi tertulis)

| Item | Default diusulkan | Status |
|---|---|---|
| Threshold stockout (FR-BA-02) | ≤7 hari | ⬜ menunggu |
| Threshold slow-moving (FR-BA-03, stretch) | rasio >8 minggu | ⬜ menunggu |
| Maximum allowed discount (FR-AA-05) | 50% | ⬜ menunggu |
| NFR-01 response time | P95 ≤5 detik, single-user | ⬜ menunggu baseline |
| NFR-08 anggaran LLM API | Rp 300 rb/bulan | ⬜ menunggu |
| NFR-13 anggaran WABA | Rp 200 rb/bulan | ⬜ menunggu |
| NFR-09 benchmark set | 100 pertanyaan (sales+stockout) | ⬜ belum disusun |
| NFR-07 usability | ≥3 user, ≥80% completion | ⬜ menunggu |
| Provider WABA | **Meta Cloud API** (rekomendasi) | 🟢 diusulkan |
| Sumber data uji | **Synthetic** (rekomendasi) | 🟢 diusulkan |
| Pembagian peran teknis 3 anggota | — | ⬜ diusulkan di TASK_ASSIGNMENT |
| Vector DB | Tidak digunakan (C5) | 🟢 default |
| Fallback verifikasi WABA | Sandbox/test number | 🟢 default |

### 7.2 Keputusan teknis tambahan (perlu konfirmasi)

| Item | Usulan | Alasan |
|---|---|---|
| **LLM provider** | 🟢 DIPUTUSKAN: Groq (`qwen/qwen3.8-27b` untuk semua agen; Sales→FAST, Analyst+Action→REASONING) | Murah & cepat (NFR-01, NFR-08); Qwen mendukung tool-calling (terverifikasi live). Env: `GROQ_*` di `backend/.env` |
| **Auth mekanisme** | JWT (access + refresh) | Sederhana, sesuai FR-AUTH. Alternatif: Supabase Auth. Keputusan di F1 |
| **Definisi "konfirmasi eksplisit"** | Tombol UI (Web) / interactive reply button (WA) | SRS FR-SA-05 — **bukan** teks bebas |
| **Idempotency key** untuk cegah double-order (UC-02 E5) | UUID per sesi konfirmasi | Wajib, karena SRS menyebutkan ini |
| **Naming role** | "Owner" = administrator toko | SRS §2.2 catatan presentasi |

---

## 8. Strategi Data Uji Synthetic

Keputusan: **synthetic dulu** (A2, SRS §11). Tujuannya — dev tidak bergantung pada data mitra riil maupun WABA live.

### 8.1 Dua lapis synthetic
1. **Seed data operasional** (dalam DB): ~500 SKU max (batas NFR-01), produk → kategori, stok, customer, order historis. Dibuat oleh `backend/seed/generate_seed.py` → jalankan sebagai migration/seed di Supabase.
   - **Batasan penting:** dataset ≤500 SKU untuk validasi NFR-01; kualitas harus cukup untuk benchmark NFR-09 (sales + stockout).
2. **Mock WhatsApp provider** (`MockWhatsAppProvider`): tidak hit network, generate payload webhook sintetis (nomor uji, tombol konfirmasi, pesan customer) untuk menguji alur UC-01/UC-02 end-to-end.

### 8.2 Mengapa synthetic-first
- Tidak perlu menunggu verifikasi bisnis Meta (C6) untuk menguji alur.
- Deterministik → bisa dibuat test otomatis & benchmark.
- Menghindari biaya real WABA selama dev (NFR-13).

### 8.3 Transisi ke real WABA
- `WhatsAppProvider` interface dipakai `MockWhatsAppProvider` di dev → `MetaCloudWhatsAppProvider` di prod/staging (F7).
- **Timeline verifikasi Meta mulai F0** supaya real WABA siap di F7.
- Jika real WABA belum siap di F7 → tetap pakai test number (5 nomor uji) atau mock.

---

## 9. Strategi Testing (Konsep)

> Proyek memiliki target pengujian eksplisit di SRS §9 & §10. Semua FR **Must** harus lulus TC terkait.

| Jenis | Target | Tools |
|---|---|---|
| Unit test BE | Service logic (order atomik, inventory formula, promo lifecycle, audit) | Pytest |
| Kontrak API | Endpoint menghormati `API_DESIGN.md` | Pytest + httpx |
| Concurrency | FR-SMS-06c: 2 customer, stok=1 → tepat satu CONFIRMED | Pytest (race test) |
| AI factuality | NFR-09 benchmark 100 pertanyaan; NFR-10 no hallucination | Pytest + harness |
| FE | Komponen admin panel, Web Chat widget | Vitest |
| E2E | UC-01, UC-02, UC-04 (2 channel) | Playwright (opsional) |
| Usability | NFR-07: ≥3 user non-teknis, ≥80% completion | Manual test script |

---

## 10. Docker — Rencana Container (deskripsi, bukan implementasi)

Sesuai NFR-11 (portability containerized). Target: `docker compose up` → sistem jalan tanpa infra khusus selain Supabase managed + LLM API.

| Service | Image/dasar | Catatan |
|---|---|---|
| **frontend** | `node:24-alpine` → `nuxt build` → serve (usulan `node` / `nginx`) | Build-time: npm install; prod: static/preview |
| **backend** | `python:3.12-slim` | Uvicorn; dependency `requirements.txt` |
| **db** | **Tidak di-docker-kan** — Supabase managed | Dikoneksikan via `DATABASE_URL` env |
| env | `backend/.env` + `frontend/.env` (dari `.env.example` masing-masing) | Jangan commit file `.env` |

> **Catatan:** Supabase tidak masuk `docker compose` karena bersifat *managed*. Ini tetap memenuhi NFR-11, karena SRS menyatakan sistem hanya boleh bergantung pada *relational database* dan LLM API eksternal — keduanya di luar container.

---

## 11. Konfigurasi Environment (detail di `docs/ENVIRONMENT.md`)

Grup variabel: **app**, **db (Supabase)**, **auth**, **ai/llm**, **waba**, **misc** — terbagi per service (`backend/.env`, `frontend/.env`). Semua rahasia via file `.env` per-service (tidak di-commit). Lihat `docs/ENVIRONMENT.md` untuk daftar lengkap.

---

## 12. Risk Register (dari PRD §49 + SRS)

| # | Risiko | Probabilitas | Dampak | Mitigasi | Pemilik |
|---|---|---|---|---|---|
| R1 | LLM hallucination | Sedang | Tinggi | Grounding (tool calling), 0 klaim tanpa record (NFR-10) | B |
| R2 | WhatsApp complexity | Tinggi | Tinggi | Channel Adapter, MockWA, provider abstraction, fallback Web Chat (NFR-12) | A |
| R3 | Scope creep | Tinggi | Sangat tinggi | Freeze MVP; stretch items didelegasikan | Tim |
| R4 | AI action mis-execution | Sedang | Sangat tinggi | Jalur 2 (approval Owner), validasi FR-AA-05, AuditLog | B+A |
| R5 | Verifikasi Meta (C6) lambat | Sedang | Tinggi | Mulai F0; fallback test number/mock | A |
| R6 | Biaya LLM (NFR-08) melebihi budget | Sedang | Sedang | Model murah, monitoring billing | B |
| R7 | Concurrency/overselling | Sedang | Tinggi | Operasi atomik + idempotency (FR-SMS-06) | A |
| R8 | Isolasi channel gagal (Web Chat ikut down) | Sedang | Tinggi | Graceful degradation per channel (NFR-12) | A |

---

## 13. Kamus Singkat (untuk kesamaan bahasa)

| Istilah | Arti |
|---|---|
| WABA | WhatsApp Business API |
| Channel Adapter | Penerjemah protokol per channel, jaga AI core channel-agnostic |
| Order Summary | Representasi sementara (bukan entity DB) sebelum Order dibuat |
| Customer Transaction | Jalur 1 — konfirmasi customer, tanpa approval Owner |
| AI Administrative Action | Jalur 2 — draft wajib approval Owner |
| `actor_type` | `USER` \| `AI_SYSTEM` pada AuditLog |
| Grounding | Setiap klaim AI harus punya record DB pendukung |

---

## 14. Definisi Selesai (Definition of Done)

Proyek dinyatakan **Final/Frozen** bila seluruh kriteria ini terpenuhi:

1. [ ] Seluruh FR **Must** pada SRS §3 lulus TC terkait (§9.1).
2. [ ] Seluruh NFR pada §4 lulus TC terkait (§9.2) — termasuk NFR-01, NFR-07, NFR-09, NFR-11, NFR-12, NFR-13.
3. [ ] Tidak ada kontradiksi antara constraint (§2), FR (§3), data model (§6) — diverifikasi ulang sebelum freeze.
4. [ ] Seluruh exception flow §7 punya penanganan terverifikasi.
5. [ ] State machine §8 diimplementasikan persis diagram.
6. [ ] Customer selesai alur rekomendasi→order di kedua channel, tanpa Cart.
7. [ ] Kegagalan satu channel tidak memengaruhi channel lain (NFR-12).
8. [ ] SRS §11 baris ratifikasi ditandatangani tertulis oleh tim.
9. [ ] Sistem jalan dari container fresh (NFR-11), `docker compose up` sukses.
10. [ ] AuditLog append-only, 100% peristiwa draft/approve/reject/execute/gagal tervalidasi (NFR-05).

---

## 15. Rencana Review dan Iterasi

- **Setiap akhir fase:** sprint review internal, cek gate, perbarui status traceability (§6).
- **SRS §11 ratifikasi:** sebelum implementasi F4 (AI), seluruh default diusulkan dirapatkan tertulis.
- **Verifikasi terakhir (SRS catatan penutup):** satu putaran audit lintas-bagian sebelum freeze — fokus konsistensi (istilah baru di satu bagian harus tercermin seragam di semua bagian).
- **Tracking:** gunakan kartu/board per fase; tiap task map ke FR/TC.

---

## 16. File Pendukung (Peta Dokumen)

| Dokumen | Isi | Wajib dibaca sebelum |
|---|---|---|
| `docs/README.md` | Indeks dokumentasi | — |
| `docs/ARCHITECTURE.md` | Arsitektur detail, alur data, komponen | F1 |
| `docs/DATA_SCHEMA.md` | Skema DB Supabase (entity+relasi+perilaku) | F1 |
| `docs/API_DESIGN.md` | Kontrak REST API (BE↔FE) | F1, F6 |
| `docs/AI_PROMPTS.md` | Prompt + tool-calling 3 agent | F4 |
| `docs/WABA_SETUP.md` | Setup Meta Cloud API + test number | F0, F7 |
| `docs/ENVIRONMENT.md` | Env vars & secrets | F0 |
| `docs/TASK_ASSIGNMENT.md` | Pembagian tugas 3 anggota | F0 |

---

> **Status dokumen:** DRAFT — menunggu review tim dan ratifikasi item di §7.
