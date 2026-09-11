# PLAN — Recovery, Hardening, dan Readiness AI-Native Store Management System

> **Status:** DRAFT — execution plan hasil investigasi repository
>
> **Tujuan dokumen:** menjadi rencana kerja teknis yang konkret untuk memperbaiki blocker, memvalidasi implementasi yang sudah ada, meningkatkan kualitas sistem, dan membawa project menuju integration test, UAT, demo final, serta deployment yang reproducible.
>
> **Baseline requirement:** SRS v3.3, PRD, `docs/ARCHITECTURE.md`, `docs/DATA_SCHEMA.md`, `docs/API_DESIGN.md`, dan `docs/SRS_AMENDMENTS.md`.
>
> **Prinsip utama:** jangan menambah fitur baru sebelum sistem yang sudah ada dapat di-install, dijalankan, diuji, dan didemokan end-to-end secara reproducible.

---

## 1. Executive Summary

### 1.1 Keputusan readiness

Hasil investigasi menunjukkan sistem sudah memiliki fondasi fitur yang cukup kuat, tetapi belum siap dinyatakan final atau masuk UAT penuh.

**Status yang disetujui untuk perencanaan ini: `CONDITIONAL GO`.**

Artinya:

- sistem **boleh masuk phase perbaikan dan integrasi**;
- sistem **belum boleh dianggap siap production, final demo, atau UAT resmi**;
- semua blocker pada Section 4 harus diselesaikan sebelum phase acceptance;
- seluruh klaim “fitur sudah bekerja” harus dibuktikan melalui test runtime, bukan hanya static inspection.

### 1.2 Kondisi saat investigasi

| Area | Kondisi | Penilaian |
|---|---|---|
| Backend FastAPI | Router, model, service, AI, channel, dan test sudah tersedia | Fondasi baik |
| Order flow | Web dan WhatsApp confirmation sudah memiliki implementasi remediation | Perlu runtime verification |
| AI Action | Draft/approve/reject sudah tersedia | Perlu validasi end-to-end |
| Analyst | Endpoint owner-only sudah tersedia | Perlu kontrak dan test verification |
| Frontend | Banyak halaman admin dan chat widget tersedia | Build pass, behavior test minim |
| Backend test | Tidak dapat dijalankan pada environment saat investigasi karena `asyncpg` tidak tersedia | Blocker |
| `uv` workflow | Gagal build karena `backend/src/backend/__init__.py` terhapus | Blocker |
| Docker | Hanya `backend/docker-compose.yaml`; root compose belum ada | Blocker NFR-11 |
| Database migration | Directory migration belum ada; startup menggunakan `create_all` | Risiko deployment tinggi |
| Documentation | Cukup lengkap, tetapi masih ada mismatch istilah/endpoint/version | Perlu freeze |
| UAT/NFR | Belum memiliki bukti benchmark lengkap | Belum siap |

### 1.3 Target akhir

Target akhir setelah plan ini selesai:

1. Developer baru dapat menjalankan project dari clean checkout.
2. `uv sync` atau installation workflow yang dipilih berhasil.
3. Backend test suite lulus tanpa error environment.
4. Frontend production build berhasil.
5. Root Docker Compose dapat menjalankan frontend dan backend.
6. Web Chat order flow berhasil end-to-end.
7. Mock WhatsApp order flow berhasil end-to-end.
8. Analyst hanya dapat diakses Owner.
9. AI Action selalu melalui draft dan approval.
10. Semua perubahan kritis tercatat di audit log.
11. Tidak ada Cart entity.
12. Tidak ada AI yang mengakses database secara langsung.
13. NFR utama memiliki bukti pengujian.
14. Documentation dan SRS amendment sudah diratifikasi.

---

## 2. Scope dan Non-Scope

### 2.1 In scope

- perbaikan environment Python dan packaging;
- validasi serta perbaikan backend test;
- validasi kontrak API backend-frontend;
- penguatan Web Chat dan Mock WhatsApp;
- validasi AI grounding dan explicit confirmation;
- validasi AI Action approval flow;
- penambahan smoke test frontend;
- root-level Docker Compose;
- migrasi database yang reproducible;
- security dan production configuration hardening;
- observability, health check, logging, dan failure handling;
- benchmark NFR dan UAT;
- sinkronisasi dokumentasi dan SRS amendment.

### 2.2 Out of scope

Fitur berikut tidak boleh dikerjakan sebelum semua Must requirement stabil:

- payment gateway;
- POS integration;
- marketplace integration;
- Cart/CartItem persistence;
- vector database/RAG tambahan;
- identity unification lintas channel;
- multi-tenant architecture;
- mobile application;
- fitur AI stretch yang belum diperlukan;
- refactor besar ke full hexagonal/CQRS architecture.

> **Aturan scope:** jika sebuah pekerjaan tidak membantu FR Must, NFR, reproducibility, security, atau demo utama UC-01/02/03/04, pekerjaan tersebut ditunda.

---

## 3. Prinsip Engineering yang Wajib Dipatuhi

### 3.1 Behavior over implementation

Test harus memverifikasi behavior requirement dari public entry point:

- API route;
- webhook;
- UI flow;
- atau service hanya untuk unit test business rule murni.

Test tidak boleh hanya menguji bahwa fungsi internal terpanggil.

### 3.2 Tidak ada test-only scaffolding pada happy path

Happy path order wajib:

```text
chat/webhook
  -> SalesAgent
  -> build_order_summary
  -> summary_store
  -> explicit confirmation
  -> OrderService
  -> order + inventory transaction
```

Test tidak boleh membuat summary melalui `summary_store.put()` untuk membuktikan flow order utama.

### 3.3 Single source of truth

Business rule berikut hanya boleh memiliki satu authority:

- effective promotion status;
- current stock calculation;
- order creation dan inventory deduction;
- authorization Owner;
- AI Action state transition;
- audit log write path;
- channel confirmation event.

### 3.4 AI tidak memiliki authority operasional

LLM hanya boleh:

- memahami instruksi;
- memilih tool;
- merangkum hasil tool;
- menghasilkan draft.

LLM tidak boleh:

- query database langsung;
- mengubah stok langsung;
- membuat order tanpa explicit confirmation;
- mengaktifkan promotion tanpa approval Owner;
- membuat klaim harga/stok tanpa hasil tool yang grounded.

### 3.5 Setiap perubahan harus memiliki bukti

Setiap task dianggap selesai hanya jika terdapat:

- perubahan code/config/documentation;
- test atau bukti manual yang sesuai;
- hasil command yang tersimpan di issue/sprint note;
- update traceability atau amendment bila ada deviasi.

---

## 4. Blocker Kritis yang Harus Diselesaikan Terlebih Dahulu

Tidak boleh masuk UAT sebelum semua blocker ini selesai.

### B1 — Python environment tidak reproducible

#### Temuan

`python -m pytest -q` gagal sebelum test dimulai karena:

```text
ModuleNotFoundError: No module named 'asyncpg'
```

Dependency sebenarnya sudah tercantum di `backend/requirements.txt`, tetapi belum ter-install pada environment yang dipakai.

#### Tindakan

1. Pilih satu workflow resmi:
   - opsi A: `uv sync` dan `uv run`;
   - opsi B: virtual environment + `pip install -r requirements.txt`.
2. Rekomendasi: gunakan `uv` sebagai workflow development karena repository sudah memiliki `pyproject.toml` dan `uv.lock`.
3. Pastikan `asyncpg`, `pytest`, dan seluruh dependency terpasang.
4. Dokumentasikan versi Python dan package manager.
5. Tambahkan command verification ke README.

#### Acceptance criteria

```bash
cd backend
uv sync
uv run python -c "import asyncpg, fastapi, sqlalchemy; print('dependencies ok')"
uv run pytest -q
```

Semua command harus dapat dijalankan pada clean environment.

---

### B2 — `uv` packaging rusak

#### Temuan

`uv run pytest -q` gagal dengan:

```text
Expected a Python module at: src\\backend\\__init__.py
```

Git juga menunjukkan:

```text
D backend/src/backend/__init__.py
```

#### Tindakan

Pilih salah satu opsi, lalu dokumentasikan keputusan:

**Opsi rekomendasi: restore package marker**

- restore `backend/src/backend/__init__.py`;
- pastikan entry point `backend:main` valid, atau hapus entry point jika tidak digunakan;
- jalankan `uv sync` dan `uv run pytest`.

**Opsi alternatif: sederhanakan packaging**

- hapus konfigurasi package build yang tidak digunakan;
- jalankan aplikasi melalui `uvicorn app.main:app`;
- pastikan `uv sync` tidak lagi memerlukan package yang tidak ada.

#### Acceptance criteria

- `uv sync` pass;
- tidak ada package build error;
- `uv run pytest -q` dapat masuk ke tahap collection;
- command start backend terdokumentasi dan dapat dijalankan.

---

### B3 — Deployment container (REVISI: FE tidak di-container)

#### Temuan

Yang tersedia hanya:

```text
backend/docker-compose.yaml
```

File tersebut hanya menjalankan backend.

#### Keputusan tim (RATIFIKASI)

> **Frontend TIDAK di-container.** FE (Nuxt 4) di-hosting di **Vercel**.
> Docker **hanya untuk backend**; DB tetap Supabase managed.
> Alasan: Vercel menangani build/deploy/CDN FE lebih baik dan menghilangkan
> duplikasi konfigurasi. CORS backend wajib memuat origin domain Vercel.

#### Tindakan (sesuai keputusan)

- `backend/docker-compose.yaml` — backend saja, sudah ada **healthcheck** ke `/health`;
- `backend/docker-compose.local.yaml` — override dev: tambah Postgres lokal (tanpa Supabase);
- Frontend: deploy ke Vercel, set `NUXT_PUBLIC_API_BASE` di env Vercel.

#### Kebutuhan backend container

- base image Python 3.12 slim;
- install dependency dari `requirements.txt`;
- `uvicorn app.main:app --host 0.0.0.0 --port 8000`;
- healthcheck ke `/health`;
- `APP_ENV=production`, `DEBUG=false`, `SEED_ON_STARTUP=false`;
- mock dev endpoint tidak aktif di production (guard `validate_runtime_config`).

#### Acceptance criteria

Dari direktori `backend/`:

```bash
cd backend
docker compose config
docker compose build
docker compose up -d
curl http://localhost:8000/health
```

Frontend: `cd frontend && npm run build` (deploy Vercel memakai build ini).

---

### B4 — Database migration belum tersedia

#### Temuan

Dokumentasi merencanakan migration, tetapi directory migration belum ada. Startup memakai:

```python
Base.metadata.create_all
```

#### Risiko

- schema deployment tidak versioned;
- perubahan model dapat berbeda dengan schema Supabase;
- trigger append-only audit belum dijamin;
- view stok dan index belum reproducible;
- fresh deployment bergantung pada side effect startup.

#### Tindakan bertahap

**Tahap sementara untuk development**

- `create_all` boleh dipertahankan hanya pada `APP_ENV=development/testing`;
- seed otomatis tidak boleh berjalan pada production.

**Tahap target**

Buat:

```text
backend/migrations/
  001_initial_schema.sql
  002_indexes_and_stock_view.sql
  003_audit_append_only_trigger.sql
  004_seed_marker.sql
```

Migration runner harus:

- menjalankan migration berurutan;
- menyimpan migration yang sudah diterapkan;
- aman jika dijalankan ulang;
- gagal dengan jelas jika migration tidak valid.

#### Acceptance criteria

- fresh database dapat dibuat dari migration saja;
- seluruh tabel dari `DATA_SCHEMA.md` tersedia;
- tidak ada tabel `cart` atau `cart_items`;
- view stock tersedia;
- trigger audit menolak update/delete;
- schema dapat diverifikasi menggunakan query checklist.

---

### B5 — Git repository hygiene

#### Temuan

Git status menunjukkan:

```text
D backend/src/backend/__init__.py
?? backend/nul
```

#### Tindakan

1. Tentukan apakah deletion `__init__.py` disengaja.
2. Restore jika diperlukan oleh packaging.
3. Hapus artifact `backend/nul` jika tidak memiliki fungsi.
4. Pastikan `.gitignore` mencakup:
   - `.env`;
   - `.venv`;
   - `__pycache__`;
   - `.pytest_cache`;
   - `.nuxt`;
   - `.output`;
   - `node_modules`;
   - generated database files.
5. Pastikan file generated tidak di-commit.

#### Acceptance criteria

```bash
git status --short
```

Tidak boleh ada artifact tidak dikenal atau file generated yang tidak sengaja masuk version control.

---

## 5. Urutan Phase yang Direkomendasikan

```text
P0 Environment Recovery
  -> P1 Backend Test Stabilization
  -> P2 Contract & Core Flow Verification
  -> P3 Frontend Verification
  -> P4 Deployment & Database Reproducibility
  -> P5 Security & Observability Hardening
  -> P6 NFR Benchmark & UAT
  -> P7 Final Freeze & Demo Rehearsal
```

Phase berikutnya tidak boleh dimulai bila gate phase sebelumnya gagal, kecuali task yang independen dan tidak menyembunyikan failure.

---

# 6. Detail Work Plan per Phase

## Phase P0 — Environment Recovery

### Tujuan

Membuat local development dan test environment dapat digunakan secara konsisten.

### Task

| ID | Task | File/area | Prioritas |
|---|---|---|---|
| P0-01 | Verifikasi versi Python | `backend/.python-version` | P0 |
| P0-02 | Perbaiki package marker/`uv` build | `backend/src/backend`, `pyproject.toml` | P0 |
| P0-03 | Sinkronkan dependency | `requirements.txt`, `pyproject.toml`, `uv.lock` | P0 |
| P0-04 | Hapus artifact `backend/nul` | repository | P0 |
| P0-05 | Pastikan test DB tidak memakai production DB | `.env`, `conftest.py`, config | P0 |
| P0-06 | Tambahkan setup guide | root `README.md` | P1 |

### Validasi

```bash
cd backend
uv sync
uv run python -c "import asyncpg"
uv run python -c "from app.main import app; print(app.title)"
```

### Gate P0

- dependency import berhasil;
- aplikasi dapat di-import;
- `pytest` dapat melakukan collection;
- tidak ada test yang terhubung ke database production secara tidak sengaja.

---

## Phase P1 — Backend Test Stabilization

### Tujuan

Membuat seluruh backend test suite dapat dijalankan dan hasilnya menjadi baseline yang dapat dipercaya.

### Task

1. Jalankan test collection.
2. Klasifikasikan failure:
   - environment;
   - schema/database;
   - route contract;
   - business logic;
   - test isolation;
   - flaky/concurrency.
3. Perbaiki failure dari kategori P0 terlebih dahulu.
4. Jalankan test secara keseluruhan.
5. Jalankan test secara individual untuk failure yang sulit direproduksi.
6. Pastikan fixture membersihkan database dan in-memory store antar test.
7. Pastikan scheduler tidak aktif pada `APP_ENV=testing`.

### Command resmi

```bash
cd backend
uv run pytest -q
uv run pytest --collect-only -q
uv run pytest tests/test_flow_e2e.py -q
uv run pytest tests/test_concurrency.py -q
```

### Coverage minimum target

Untuk MVP, target awal:

| Area | Target |
|---|---:|
| Order/inventory service | >= 90% business branch penting |
| Auth/authorization | 100% endpoint critical |
| AI Action state transition | >= 90% |
| Channel confirmation | 100% happy path dan failure path |
| API route | seluruh endpoint Must memiliki smoke test |

Coverage tool boleh ditambahkan setelah suite stabil. Jangan mengorbankan behavior test hanya demi angka coverage.

### Gate P1

- test collection pass;
- seluruh test pass;
- tidak ada test happy path yang menyuntik production-managed result;
- concurrency test dapat direproduksi;
- test dapat dijalankan dua kali berturut-turut dengan hasil sama.

---

## Phase P2 — Contract dan Core Flow Verification

### Tujuan

Memastikan API, service, AI, dan channel benar-benar terhubung sesuai arsitektur.

## P2.1 Authentication

### Skenario wajib

1. Login credential valid → token berhasil.
2. Password salah → `401`.
3. Token tidak ada → `401`.
4. Token invalid/expired → `401`.
5. Customer/public endpoint tidak memerlukan Owner JWT.
6. Endpoint internal memerlukan Owner JWT.
7. User role selain Owner ditolak `403`.
8. JWT secret default tidak boleh dipakai pada production.

### Acceptance

Semua endpoint internal konsisten memakai `require_owner` atau dependency authorization yang disetujui.

---

## P2.2 Product dan Inventory

### Skenario wajib

1. Owner membuat product aktif.
2. Owner mengubah product.
3. Product inactive tidak muncul pada rekomendasi.
4. Product yang direferensikan tidak dapat dihapus secara destruktif.
5. Stock dihitung dari `inventory_transactions`.
6. Restock menambah stock.
7. Adjustment IN/OUT menghitung arah dengan benar.
8. Quantity non-positive ditolak.
9. Low-stock threshold product dan default global bekerja.
10. Tidak ada kolom mutable `current_stock` sebagai source of truth.

### Acceptance

Hasil API stock sama dengan hasil agregasi transaction langsung.

---

## P2.3 Web Chat order flow

### Skenario happy path

```text
POST /chat/sessions
  -> POST /chat/sessions/{id}/messages
  -> SalesAgent menggunakan product/stock tool
  -> response memiliki order_summary
  -> summary_ref tersimpan secara otomatis
  -> POST /chat/sessions/{id}/confirm
  -> order CONFIRMED
  -> stock berkurang
```

### Skenario failure

- product tidak ditemukan;
- product inactive;
- stock berubah setelah summary dibuat;
- insufficient stock;
- summary expired;
- summary reference invalid;
- duplicate confirmation;
- database error/rollback;
- customer data invalid;
- harga berubah sebelum confirmation.

### Acceptance

- confirmation hanya dapat dilakukan dari explicit endpoint/button;
- teks bebas seperti “oke” tidak langsung membuat order;
- order dan inventory movement atomik;
- duplicate confirmation menghasilkan replay atau response aman tanpa order ganda;
- summary total dan order total konsisten.

---

## P2.4 WhatsApp Mock flow

### Skenario wajib

1. Webhook inbound pesan customer diparse.
2. Customer WA dibuat/reused berdasarkan channel + identifier.
3. Conversation OPEN direuse lintas pesan.
4. Sales Agent menjawab pertanyaan produk.
5. Order summary menghasilkan confirmation button.
6. Button confirmation diintercept sebelum LLM.
7. Order berhasil dibuat.
8. `CONFIRM:<ref>` atau format final yang disepakati konsisten di semua layer.
9. `CANCEL` mengakhiri conversation tanpa order.
10. Summary invalid menghasilkan response ramah, bukan `500`.
11. Webhook retry tidak membuat order ganda.
12. Status event Meta tidak diperlakukan sebagai customer message.

### Acceptance

Mock WhatsApp dan Web Chat memakai OrderService yang sama; perbedaan hanya berada pada adapter/protocol layer.

---

## P2.5 Promotion

### Skenario wajib

1. Draft promotion belum berlaku ke customer.
2. Promotion ACTIVE dan berada pada rentang waktu berlaku.
3. Promotion future berstatus SCHEDULED/equivalent dan belum memberi diskon.
4. Promotion expired tidak memberi diskon.
5. Dua promotion aktif yang overlap untuk product yang sama ditolak.
6. Discount di atas maximum ditolak.
7. Summary dan order menggunakan effective promotion rule yang sama.
8. Expired promotion diproses scheduler.
9. Read path tetap aman jika scheduler terlambat.

### Acceptance

Tidak boleh ada kondisi summary menampilkan harga berbeda dari order karena perbedaan logic promotion.

---

## P2.6 AI Business Analyst

### Skenario wajib

1. Request tanpa JWT ditolak.
2. Request non-Owner ditolak.
3. Pertanyaan sales memakai hasil SQL.
4. Pertanyaan inventory memakai hasil SQL.
5. Angka yang ditampilkan berasal dari structured data, bukan angka karangan LLM.
6. Query invalid menghasilkan error ramah.
7. Data kosong ditangani dengan benar.
8. Pertanyaan cross-channel menampilkan disclaimer khusus.
9. Query atau result traceability tersedia pada response/audit yang ditentukan.

### Acceptance

Endpoint final yang dipakai harus satu dan konsisten: rekomendasi saat ini adalah:

```text
POST /api/v1/chat/analyst/ask
```

Semua dokumentasi lain harus mengikuti keputusan tersebut.

---

## P2.7 AI Action Assistant

### Skenario wajib

1. Owner mengirim instruction natural language.
2. Sistem membuat `AIAction` berstatus `DRAFT`.
3. Instruction ambigu/invalid ditolak dengan error ramah.
4. Draft tidak mengubah promotion operasional.
5. Owner melihat draft di admin panel.
6. Owner approve.
7. Validasi product, discount, date range, overlap, dan status dilakukan ulang.
8. Promotion dibuat hanya setelah approval dan validasi lolos.
9. Owner reject → tidak ada perubahan operasional.
10. Approval non-Owner ditolak.
11. Double approval aman.
12. Semua state transition tercatat di audit log.

### State machine target

```text
DRAFT
  -> APPROVED
  -> REJECTED

APPROVED
  -> EXECUTED
  -> APPROVED_VALIDATION_FAILED
```

### Acceptance

Tidak ada jalur dari LLM langsung ke `ACTIVE` promotion.

---

## P2.8 Audit log

### Skenario wajib

Audit harus tercatat minimal untuk:

- AI Action CREATED;
- APPROVED;
- REJECTED;
- VALIDATION_FAILED;
- EXECUTED;
- error/failure penting sesuai desain;
- actor type USER atau AI_SYSTEM;
- actor id untuk USER;
- detail before/after atau konteks yang relevan.

### Enforcement

- tidak ada endpoint update/delete;
- service audit menjadi satu-satunya writer;
- database trigger menolak update/delete jika memungkinkan;
- test mencoba mutation langsung dan memastikan ditolak.

---

## Phase P3 — Frontend Verification

### Tujuan

Memastikan UI bukan hanya berhasil build, tetapi juga menjalankan behavior utama dan menangani response backend.

### P3.1 Smoke test minimum

Tambahkan test framework frontend yang disepakati, direkomendasikan Vitest.

Test minimum:

1. auth store menyimpan dan membersihkan token;
2. API wrapper menambahkan Bearer token untuk endpoint internal;
3. auth middleware mengarahkan guest ke login;
4. owner middleware menolak role yang tidak sesuai;
5. login page menampilkan error credential;
6. chat widget membuat session;
7. chat widget mengirim message;
8. order summary menampilkan item, quantity, total;
9. confirm button mengirim `summary_ref` dan idempotency key;
10. AI Actions page mengirim instruction draft;
11. AI Actions page menampilkan draft baru;
12. approve/reject memicu refresh;
13. loading, empty, dan API error state tampil dengan benar.

### P3.2 API contract check

Bandingkan type frontend dengan response aktual:

- login;
- products;
- inventory;
- orders;
- promotions;
- conversations;
- analyst;
- AI actions;
- chat summary/confirm.

Pastikan naming tidak berbeda seperti:

- `summary_ref` vs `order_summary_ref`;
- `total` vs `total_amount`;
- `status_` query parameter vs `status`;
- `CONFIRM` vs `CONFIRM_ORDER`.

### P3.3 Manual UX test

Minimal 3 user non-teknis, sesuai target NFR-07.

Uji task:

- login;
- mencari product;
- melihat stock;
- memeriksa order;
- menjawab pertanyaan analyst;
- membuat draft promotion;
- approve/reject draft;
- membaca audit log;
- melakukan order melalui Web Chat.

Catat:

- completion rate;
- waktu penyelesaian;
- error user;
- titik kebingungan;
- feedback kualitatif.

### Gate P3

- production build pass;
- smoke test pass;
- API contract tidak mismatch;
- critical UI path dapat digunakan manual;
- error state tidak menghasilkan blank page.

---

## Phase P4 — Deployment dan Database Reproducibility

### P4.1 Root README

Buat `README.md` root yang memuat:

1. deskripsi project;
2. arsitektur singkat;
3. requirement software;
4. setup backend;
5. setup frontend;
6. setup `.env` dari `.env.example`;
7. seed data;
8. menjalankan backend;
9. menjalankan frontend;
10. menjalankan test;
11. menjalankan Docker;
12. demo credentials untuk development;
13. API docs;
14. troubleshooting;
15. security warning untuk secret.

### P4.2 Environment validation

Tambahkan validasi konfigurasi berdasarkan environment:

#### Development

- default mock LLM boleh digunakan;
- Mock WhatsApp boleh digunakan;
- seed startup boleh diaktifkan;
- debug boleh aktif dengan catatan.

#### Testing

- database test wajib terpisah;
- scheduler nonaktif;
- seed fixture dikontrol test;
- network LLM/Meta tidak boleh dipanggil.

#### Production/staging

- `JWT_SECRET_KEY` wajib non-default;
- `DEBUG=false`;
- `SEED_ON_STARTUP=false`;
- `LLM_PROVIDER` harus eksplisit;
- `WA_PROVIDER` harus eksplisit;
- mock endpoint nonaktif;
- CORS tidak boleh wildcard;
- secret wajib ada atau startup gagal dengan pesan jelas.

### P4.3 Health endpoint

`/health` harus membedakan:

- liveness aplikasi;
- koneksi database;
- konfigurasi LLM;
- provider WhatsApp;
- status scheduler jika relevan.

Health response tidak boleh membocorkan secret.

### P4.4 Docker fresh-state test

Jalankan:

```bash
git clean -xfd   # hanya pada clone/sandbox yang aman
git clone <repo> clean-checkout
cd clean-checkout
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose build --no-cache
docker compose up
```

Lakukan smoke test dari browser/API setelah startup.

### Gate P4

- root compose valid;
- backend dan frontend hidup;
- database dapat diakses;
- schema tersedia;
- startup production tidak menjalankan seed yang tidak diinginkan;
- clean checkout berhasil.

---

## Phase P5 — Security, Reliability, dan Observability Hardening

### P5.1 Authentication/security

- ganti default JWT secret pada staging/production;
- validasi expiry JWT;
- jangan mengirim service role key ke frontend;
- redact token, password, API key, dan raw secret dari log;
- batasi CORS;
- validasi input dan ukuran payload;
- rate limit endpoint chat/webhook bila tersedia;
- pastikan dev endpoint disabled di production;
- validasi HMAC `X-Hub-Signature-256` untuk Meta webhook;
- jangan trust `actor_id` dari request body; ambil dari JWT.

### P5.2 LLM reliability

- timeout;
- retry terbatas;
- fallback response jelas;
- jangan retry mutating event tanpa idempotency;
- log model, latency, error code, dan token/cost metadata tanpa prompt secret;
- pastikan response tool invalid tidak langsung diterima;
- validasi schema tool arguments.

### P5.3 WhatsApp reliability

Untuk MVP, in-memory window/dedupe boleh dipertahankan dengan amendment. Namun:

- dokumentasikan bahwa restart dapat menghilangkan state;
- gunakan stable idempotency key untuk confirmation;
- validasi webhook message id;
- jangan mengirim free-form message di luar 24-hour window;
- gunakan template jika tersedia;
- failure WhatsApp tidak boleh menjatuhkan Web Chat.

Target hardening jika waktu memungkinkan:

```text
webhook_events(message_id UNIQUE, payload_hash, processed_at, status)
```

### P5.4 Logging

Gunakan structured logging dengan:

- request id;
- channel;
- conversation id;
- user id bila ada;
- action id bila ada;
- event;
- latency;
- error category.

Jangan log:

- password;
- JWT penuh;
- WA access token;
- LLM API key;
- service role key;
- data personal yang tidak dibutuhkan.

### Gate P5

- security checklist pass;
- production config menolak unsafe defaults;
- error satu channel tidak mematikan channel lain;
- critical action memiliki audit trail;
- log dapat digunakan untuk tracing demo failure.

---

## Phase P6 — NFR Benchmark dan UAT

## P6.1 NFR-01 response time

Definisikan test condition:

- dataset maksimal 500 SKU;
- single-user baseline;
- environment dicatat;
- LLM provider/model dicatat;
- cold start dipisahkan dari warm request;
- ukur P50, P95, P99.

Skenario:

- product search;
- stock lookup;
- chat recommendation;
- build order summary;
- confirmation order;
- analyst query;
- AI draft.

Target yang diratifikasi harus dicantumkan di hasil benchmark, misalnya P95 <= 5 detik untuk scope yang disetujui.

## P6.2 NFR-09 AI benchmark

Buat dataset minimal 100 pertanyaan:

| Kategori | Jumlah minimum |
|---|---:|
| Product search/recommendation | 30 |
| Stock/status | 20 |
| Product comparison | 15 |
| Order summary | 10 |
| Sales analytics | 15 |
| Inventory risk | 10 |

Setiap case memiliki:

- question;
- expected tool;
- expected facts;
- forbidden claims;
- expected fallback jika data tidak ada;
- pass/fail;
- notes.

Measure:

- factual accuracy;
- groundedness;
- tool selection;
- hallucination rate;
- invalid request handling;
- response latency;
- estimated cost.

## P6.3 NFR-10 grounding

Test wajib:

1. product fiktif → “tidak ditemukan”;
2. harga tidak tersedia → tidak mengarang harga;
3. stok tidak tersedia → tidak mengarang stok;
4. status order tidak ada → tidak mengarang status;
5. tool error → response fallback;
6. LLM mencoba mengarang field → hanya data tool yang dipakai;
7. summary dan order diverifikasi ulang saat confirmation.

## P6.4 NFR-12 channel isolation

Simulasikan:

- Meta API timeout;
- invalid WhatsApp payload;
- webhook signature invalid;
- LLM error di WhatsApp;
- provider mock error;
- Web Chat tetap digunakan;
- WhatsApp gagal tetapi admin panel tetap hidup.

## P6.5 NFR-13 cost monitoring

Dokumentasikan:

- LLM budget;
- WABA budget;
- model yang digunakan;
- estimasi request per hari/bulan;
- fallback behavior ketika budget threshold terlampaui.

`LLM_MONTHLY_BUDGET_IDR` harus memiliki behavior nyata atau dihapus dari konfigurasi. Tidak boleh ada silent no-op configuration.

## P6.6 UAT checklist

### UC-01 — rekomendasi

- customer masuk via Web Chat;
- customer masuk via WhatsApp mock/test number;
- AI menanyakan klarifikasi bila requirement belum lengkap;
- rekomendasi hanya produk aktif dan tersedia;
- alasan rekomendasi grounded;
- produk tidak ditemukan ditangani ramah.

### UC-02 — order

- order dibuat hanya melalui explicit confirmation;
- customer identity dibuat sesuai channel;
- order dan item tersimpan;
- harga dan promo snapshot benar;
- stock transaction OUT tercatat;
- insufficient stock aman;
- duplicate confirmation idempotent;
- Web dan WhatsApp berhasil.

### UC-03 — analyst

- Owner login;
- analyst query dapat digunakan;
- hasil angka dari SQL;
- disclaimer cross-channel tersedia;
- data kosong dan query unsupported ditangani.

### UC-04 — AI Action

- Owner membuat draft;
- draft tidak langsung aktif;
- Owner approve/reject;
- validasi discount/date/overlap;
- audit trail lengkap;
- non-Owner tidak dapat melakukan action.

### Gate P6

- seluruh critical UAT scenario pass;
- hasil benchmark disimpan;
- defect Must = 0;
- defect High hanya boleh ada jika sudah memiliki workaround dan disetujui tim;
- semua deviation masuk amendment log.

---

## Phase P7 — Final Freeze dan Demo Rehearsal

### P7.1 Freeze criteria

Project hanya boleh diberi status final jika:

- backend test suite pass;
- frontend build dan smoke test pass;
- Docker fresh-state pass;
- migration pass;
- Web Chat flow pass;
- WhatsApp Mock flow pass;
- analyst auth dan output pass;
- AI Action approval pass;
- audit append-only pass;
- NFR benchmark tersedia;
- UAT selesai;
- open decision tidak ada atau sudah diratifikasi;
- SRS amendments ditandatangani;
- root README lengkap;
- tidak ada secret ter-commit.

### P7.2 Demo rehearsal

Lakukan minimal dua rehearsal:

#### Rehearsal A — happy path

- jalankan seluruh stack dari Docker;
- login Owner;
- cek product/inventory;
- jalankan Web Chat recommendation dan order;
- jalankan analyst query;
- buat dan approve AI promotion draft;
- buka audit log;
- jalankan WhatsApp mock order.

#### Rehearsal B — failure path

- invalid login;
- product inactive;
- stock habis;
- duplicate confirm;
- expired summary;
- invalid webhook signature;
- LLM unavailable;
- invalid AI instruction;
- overlap promotion;
- unauthorized approval.

Catat durasi, error, dan recovery.

---

## 7. Prioritas Perbaikan Berdasarkan Dampak

### P0 — wajib segera

1. Perbaiki dependency `asyncpg`/Python environment.
2. Perbaiki `uv` package error.
3. Jalankan backend tests.
4. Bersihkan `backend/nul` dan status Git.
5. Validasi test database isolation.

### P1 — wajib sebelum integrasi resmi

1. Buat root Docker Compose.
2. Selesaikan Web Chat end-to-end.
3. Selesaikan WhatsApp Mock end-to-end.
4. Validasi AI Action draft/approve/reject.
5. Validasi Analyst authorization.
6. Samakan API contract dan confirmation payload.
7. Tambahkan root README.

### P2 — wajib sebelum UAT

1. Migration database.
2. Frontend smoke test.
3. Security hardening.
4. Audit append-only database enforcement.
5. Channel isolation test.
6. Scheduler/maintenance verification.
7. NFR benchmark.

### P3 — improvement setelah core stabil

1. Persistent webhook dedupe.
2. Persistent 24h window state.
3. Refresh token bila diputuskan diperlukan.
4. Observability dashboard.
5. Performance optimization.
6. Refactor adapter/router untuk maintainability.

---

## 8. Dokumentasi dan Keputusan yang Harus Dibekukan

Sebelum final freeze, ratifikasi keputusan berikut secara tertulis.

| Item | Keputusan yang direkomendasikan | Status |
|---|---|---|
| SRS baseline | Gunakan SRS v3.3 secara konsisten | Wajib ratifikasi |
| Analyst endpoint | `/api/v1/chat/analyst/ask` | Rekomendasi |
| Confirmation payload | Pilih satu: `CONFIRM_ORDER:<ref>` atau `CONFIRM:<ref>` | Wajib diseragamkan |
| Auth | Owner-only untuk internal endpoint | Sudah diterapkan, verifikasi |
| Refresh token | Access-only atau access+refresh | Wajib dipilih |
| Migration | Raw SQL versioned migration | Rekomendasi |
| DB startup | `create_all` hanya dev/test | Rekomendasi |
| Stock shortage | Reject whole order atau partial item removal | Wajib ratifikasi |
| STAFF role | Dihapus | Sudah dicatat |
| In-memory WA state | Diterima sebagai MVP atau dipersistenkan | Wajib dicatat |
| LLM provider | Groq/Qwen atau provider lain yang disetujui | Wajib final |
| Budget | LLM dan WABA budget | Wajib final |
| Threshold stockout | Default 7 hari atau nilai final | Wajib final |
| Max discount | Default 50% atau nilai final | Wajib final |
| Usability target | Minimal 3 user dan >=80% completion | Wajib final |

### Dokumentasi yang harus diperbarui

- `plan.md`;
- root `README.md`;
- `docs/ARCHITECTURE.md`;
- `docs/API_DESIGN.md`;
- `docs/DATA_SCHEMA.md`;
- `docs/ENVIRONMENT.md`;
- `docs/WABA_SETUP.md`;
- `docs/SRS_AMENDMENTS.md`;
- `docs/TASK_ASSIGNMENT.md`.

---

## 9. Pembagian Tugas Tim

### Role A — Backend, database, deployment

Tanggung jawab:

- P0 environment dan packaging backend;
- migration;
- Docker Compose;
- order/inventory/promotion;
- auth/security backend;
- webhook validation;
- health check;
- backend tests;
- production configuration.

Output:

- backend tests pass;
- migration pass;
- Docker backend pass;
- service behavior verified.

### Role B — AI, channel, reliability

Tanggung jawab:

- Sales Agent grounding;
- Analyst tool selection;
- AI Action draft guardrail;
- LLM timeout/retry/fallback;
- Mock WhatsApp flow;
- confirmation event;
- 24h window;
- NFR-09 benchmark;
- cost monitoring.

Output:

- benchmark dataset;
- AI factuality report;
- Web/WA flow evidence;
- channel isolation test.

### Role C — Frontend, UX, UAT

Tanggung jawab:

- frontend API contract;
- auth middleware;
- chat widget;
- admin pages;
- AI Action UI;
- Vitest smoke tests;
- manual usability test;
- UAT script;
- frontend Docker.

Output:

- frontend build pass;
- smoke test pass;
- usability report;
- demo-ready UI.

### Aturan koordinasi

- setiap task memiliki FR/NFR/TC reference;
- setiap PR wajib menyertakan test atau alasan eksplisit jika documentation-only;
- tidak boleh merge jika test environment gagal;
- perubahan contract harus diumumkan ke seluruh anggota;
- setiap deviation harus masuk `SRS_AMENDMENTS.md`.

---

## 10. Risk Register dan Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|---|---|---:|---|
| Dependency environment berbeda | Tinggi | Tinggi | Lockfile, setup guide, Docker verification |
| Test passing palsu karena fixture | Sangat tinggi | Sedang | Public-flow E2E tanpa manual summary injection |
| Overselling | Sangat tinggi | Sedang | DB transaction, row lock, concurrency test |
| LLM hallucination | Tinggi | Sedang | Tool grounding, benchmark, forbidden claims |
| WA webhook duplicate | Tinggi | Sedang | Stable idempotency, message dedupe, persistent table future |
| Meta verification terlambat | Tinggi | Sedang | Mock provider/test number fallback |
| Schema drift Supabase | Tinggi | Tinggi | Versioned migration, fresh DB test |
| Secret bocor | Sangat tinggi | Rendah | `.gitignore`, secret scan, env validation |
| Scope creep | Sangat tinggi | Tinggi | Freeze MVP dan P0/P1/P2 priority |
| Frontend-backend mismatch | Tinggi | Sedang | Contract tests dan shared response checklist |
| Scheduler duplicate process | Sedang | Sedang | Single instance rule, `max_instances=1`, deployment note |
| Budget LLM/WABA terlampaui | Sedang | Sedang | Usage logging dan budget alert/limit |

---

## 11. Definition of Done per Task

Sebuah task hanya boleh diberi status selesai jika:

- [ ] requirement terkait sudah diidentifikasi;
- [ ] code/config/documentation sudah diubah bila diperlukan;
- [ ] unit atau integration test tersedia;
- [ ] public-flow test tersedia untuk critical flow;
- [ ] failure path dipertimbangkan;
- [ ] tidak ada secret atau generated artifact masuk repository;
- [ ] command verification berhasil;
- [ ] dokumentasi diperbarui;
- [ ] deviation dicatat bila behavior berbeda dari SRS;
- [ ] reviewer lain memeriksa hasilnya.

---

## 12. Final Readiness Checklist

### Repository dan environment

- [ ] root `README.md` tersedia;
- [ ] `backend/.env.example` lengkap;
- [ ] `frontend/.env.example` lengkap;
- [ ] tidak ada `.env` ter-commit;
- [ ] `backend/nul` dihapus;
- [ ] package `uv` valid;
- [ ] lockfile sinkron;
- [ ] clean checkout berhasil.

### Backend

- [ ] FastAPI dapat start;
- [ ] semua route terdaftar;
- [ ] auth dan Owner guard pass;
- [ ] product/inventory pass;
- [ ] order atomic pass;
- [ ] promotion state machine pass;
- [ ] Web Chat pass;
- [ ] WhatsApp Mock pass;
- [ ] Analyst pass;
- [ ] AI Action pass;
- [ ] audit pass;
- [ ] scheduler pass;
- [ ] health endpoint pass.

### Database

- [ ] migration versioned tersedia;
- [ ] fresh schema pass;
- [ ] no Cart table;
- [ ] stock view/index pass;
- [ ] audit append-only trigger pass;
- [ ] seed idempotent pass;
- [ ] production tidak auto-seed.

### Frontend

- [ ] `npm install`/lockfile pass;
- [ ] `npm run build` pass;
- [ ] login pass;
- [ ] admin guard pass;
- [ ] chat widget pass;
- [ ] order confirmation pass;
- [ ] AI Action UI pass;
- [ ] analyst UI pass;
- [ ] error/loading/empty state pass;
- [ ] frontend smoke test pass.

### AI dan channel

- [ ] AI tidak import model/ORM secara langsung;
- [ ] tool validation pass;
- [ ] product/stock claims grounded;
- [ ] explicit confirmation enforced;
- [ ] approval Owner enforced;
- [ ] LLM timeout/fallback pass;
- [ ] WA signature verification pass;
- [ ] WA 24h rule pass;
- [ ] channel isolation pass.

### Quality dan acceptance

- [ ] backend test 0 failed;
- [ ] frontend test pass;
- [ ] concurrency test pass;
- [ ] AI benchmark selesai;
- [ ] performance benchmark selesai;
- [ ] usability test selesai;
- [ ] UAT selesai;
- [ ] Docker fresh-state selesai;
- [ ] SRS amendments diratifikasi;
- [ ] demo rehearsal happy path selesai;
- [ ] demo rehearsal failure path selesai.

---

## 13. Perintah Verifikasi Resmi

### Backend

```bash
cd backend
uv sync
uv run pytest -q
uv run pytest tests/test_flow_e2e.py -q
uv run pytest tests/test_concurrency.py -q
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Jika test script sudah ditambahkan:

```bash
npm run test
```

### Docker

```bash
docker compose config
docker compose build --no-cache
docker compose up -d
curl http://localhost:8000/health
curl http://localhost:3000
```

### Repository hygiene

```bash
git status --short
git ls-files | grep -E '(^|/)(\.env$|node_modules|__pycache__|\.pyc$|\.output|\.nuxt)' || true
```

### Acceptance rule

Jika salah satu command kritis gagal, status sistem tetap:

```text
NOT READY FOR FINAL UAT
```

---

## 14. Status Tracking Template

Gunakan tabel berikut untuk sprint tracking.

| ID | Task | Owner | Priority | Status | Evidence | Blocker |
|---|---|---|---|---|---|---|
| B1 | Python dependency recovery | A | P0 | ✅ DONE | `uv sync` PASS; deps import OK | — |
| B2 | Fix uv packaging | A | P0 | ✅ DONE | `backend/src/backend/__init__.py` dipulihkan; `uv sync` PASS | — |
| B3 | Root Docker Compose | A | P0 | ✅ DONE (revisi) | Keputusan: **FE di Vercel, Docker hanya BE**. `backend/docker-compose.yaml` (+healthcheck) + `backend/docker-compose.local.yaml`; `docker compose config` PASS | — |
| B4 | Versioned migration | A | P1 | ✅ DONE | `backend/migrations/001–004` + runner `app.db.migrate`; fresh DB OK; trigger append-only menolak update/delete; idempotent | — |
| B5 | Backend test suite green | A/B | P0 | ✅ DONE | `uv run pytest -q` → **38 passed** (2×) | — |
| P2 | Web Chat E2E | B | P1 | ✅ DONE | `test_flow_e2e.py::test_web_flow_message_to_confirm_end_to_end` | — |
| P3 | WhatsApp Mock E2E | B | P1 | ✅ DONE | `test_flow_e2e.py::test_whatsapp_*` (3 test) | — |
| P4 | Analyst verification | B | P1 | ✅ DONE | `test_chat.py::test_analyst_ask_*` (owner-only) | — |
| P5 | AI Action E2E | B | P1 | ✅ DONE | `test_ai_actions.py` (9 test) | — |
| P6 | Frontend smoke tests | C | P1 | ⏳ TODO | build PASS; Vitest belum ditambah | — |
| P7 | Security hardening | A/B | P2 | 🟡 PARTIAL | ✅ production config guards, ✅ webhook HMAC verify (`test_webhook_security.py`); ⏳ rate limit, persistent dedupe | Core stable |
| P8 | NFR benchmark | B/C | P2 | ⏳ TODO | dataset 100 pertanyaan + harness belum dibuat | Core stable |
| P9 | Usability/UAT | C | P2 | ⏳ TODO | butuh 3 user eksternal | Frontend stable |
| P10 | Final demo rehearsal | Semua | P2 | ⏳ TODO | setelah P6–P9 | All gates |

**Progres sesi ini (plan.md):** B1, B2, B3, B4, B5, P2–P5 ✅ DONE; P7 sebagian;
P6/P8/P9/P10 masih TODO (butuh pekerjaan tim + LLM nyata + user eksternal).

Status yang diperbolehkan:

```text
TODO -> IN PROGRESS -> BLOCKED/IN REVIEW -> DONE
```

---

## 15. Keputusan Akhir Plan

Urutan kerja yang disetujui:

1. **Pulihkan environment dan packaging.**
2. **Jalankan serta stabilkan backend tests.**
3. **Validasi core flow Web dan WhatsApp dari public entry point.**
4. **Validasi Analyst dan AI Action authorization/state machine.**
5. **Tambahkan frontend behavior tests.**
6. **Buat root Docker Compose dan migration yang reproducible.**
7. **Lakukan security, reliability, dan observability hardening.**
8. **Jalankan benchmark NFR dan UAT.**
9. **Ratifikasi amendment dan freeze.**
10. **Lakukan demo rehearsal dua kali: happy path dan failure path.**

> **Kesimpulan:** project tidak perlu diulang dari nol. Fondasi implementasi sudah ada. Fokus yang benar sekarang adalah mengubah sistem dari “fitur terlihat sudah tersedia” menjadi “fitur terbukti berjalan, aman, reproducible, dan dapat dipertanggungjawabkan melalui test serta evidence.”
