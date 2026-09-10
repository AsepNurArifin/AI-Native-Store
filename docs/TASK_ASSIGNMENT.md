# TASK_ASSIGNMENT — Pembagian Peran Teknis 3 Anggota

> Menjawab open item SRS §11 ("Pembagian peran teknis 3 anggota tim — belum ada usulan"). Ini **usulan** — wajib diratifikasi tim sebelum F1. Anggota diasumsikan: **A**, **B**, **C** (ganti nama asli saat ratifikasi).

---

## 1. Prinsip Pembagian

1. **Kepemilikan jelas** — setiap modul punya satu pemilik utama (accountable), anggota lain kontributor (review/backup).
2. **Backend tetap satu codebase** — pembagian per modul, bukan repo terpisah.
3. **Semua orang paham dua jalur data (SRS §2.3)** dan batasan AI (NFR-06) — review lintas modul wajib.
4. Beban dirancang seimbang: masing-masing ~1/3 area inti + tanggung jawab silang.

---

## 2. Peran Utama

| | **A — Backend & Data Engineer** | **B — AI Engineer** | **C — Frontend Engineer** |
|---|---|---|---|
| **Misi** | SMS core, DB, integrasi | AI layer 3 agent | Admin Panel + Web Chat |
| **Modul** | `api/`, `services/`, `models/`, `migrations/`, `channels/` (infra) | `ai/`, `channels/` (logika), prompts, benchmark | `frontend/` seluruhnya |
| **Deliverable fase** | F1 DB+auth, F2 order/promo, F3 channel infra, webhook WA | F4 Sales Agent, F5 Analyst+Action, NFR-09 benchmark | F6 admin panel, F7 web chat widget, NFR-07 usability |

### A — Backend & Data
- Skema & migration Supabase (DATA_SCHEMA.md), seed generator.
- Auth JWT + RBAC (FR-AUTH-01..04).
- Services: Order (atomik, lock, idempotency), Inventory (formula FR-SMS-02), Promotion (on-read + no-overlap), Conversation, Audit (append-only + trigger).
- Channel Adapter infra + WhatsApp webhook endpoint + provider Meta/Mock switching.
- Docker compose backend + health.
- **Backup untuk:** C (API contract QA).

### B — AI
- LLM client (timeout/retry/logging), pemilihan model (open item plan.md §7.2 — usulan: model murah+cepat dengan tool-calling stabil).
- Sales Agent: prompt, tools (search/compare/stock/order summary), grounding guardrail (FR-SA-01..06).
- 24h window logic + integrasi tombol konfirmasi dengan A (FR-SA-05/07).
- Business Analyst: analyze_sales/analyze_inventory + edge case FR-BA-02 (avg=0 → N/A) + disclaimer FR-BA-05.
- Action Assistant: draft structured + katalog CREATE_PROMOTION (FR-AA-01/02).
- Benchmark NFR-09 (100 soal) + pengukuran NFR-01/NFR-10.
- **Backup untuk:** A (service layer).

### C — Frontend
- Admin Panel penuh (login, products, inventory, orders, promotions, conversations monitoring, analytics chat, AI action approval, audit) — F6.
- Web Chat Widget (guest session, product cards, order summary + tombol konfirmasi eksplisit) — F7.
- State management (Pinia), API client (API_DESIGN.md), error UX (E1–E7 mapping).
- Usability test NFR-07 (rekrut ≥3 user, skrip task, laporkan completion rate).
- Docker frontend + build.
- **Backup untuk:** B (benchmark runner UI/logging).

---

## 3. Peta FR/NFR → Pemilik (Accountable / Support)

| Area | FR | A | B | C |
|---|---|---|---|---|
| Auth | FR-AUTH-01..04 | **Owner** | — | Support (UI login, guard) |
| Produk & inventory | FR-SMS-01..03 | **Owner** | — | Support (UI) |
| Customer | FR-SMS-04a | **Owner** | — | Support (UI) |
| Promosi (manual) | FR-SMS-05 | **Owner** | — | Support (UI) |
| Order & konkurensi | FR-SMS-06 | **Owner** | Support (flow AI) | Support (UI konfirmasi) |
| Percakapan & monitoring | FR-SMS-07..09 | **Owner** (storage) | Support (event) | **Support→Owner UI** |
| Sales Agent | FR-SA-01..07 | Support (tools/service) | **Owner** | Support (widget UX) |
| Business Analyst | FR-BA-01,02,04 | Support (query) | **Owner** | Support (UI chat) |
| Action Assistant | FR-AA-01..05 | **Owner** (approval exec, audit) | Support (draft) | Support (UI approval) |
| NFR-01 latency | | Support | **Owner** | — |
| NFR-02/12 degradation | | **Owner** | Support | — |
| NFR-03 security | | **Owner** | — | Support |
| NFR-04/05 integrity+audit | | **Owner** | — | — |
| NFR-06 no direct DB | | Review | **Owner** | — |
| NFR-07 usability | | — | — | **Owner** |
| NFR-08/13 cost | | Support (WA) | **Owner** (LLM) | — |
| NFR-09/10 AI accuracy | | Support (ground truth SQL) | **Owner** | — |
| NFR-11 Docker | | **Owner** (compose) | — | Support (Dockerfile FE) |

---

## 4. Ritual & Kolaborasi

| Ritual | Frekuensi | Isi |
|---|---|---|
| Sync singkat | 2×/minggu | Blocker, gate fase, update task board |
| Code review | Setiap merge | Wajib 1 reviewer lintas peran (A↔B↔C) — terutama NFR-06 (tidak ada akses DB dari `ai/`) |
| Gate review | Akhir tiap fase | Cek TC fase (plan.md §6) lulus sebelum lanjut |
| Demo internal | Akhir F4, F6, F8 | Jalankan UC-01/02/04 end-to-end |
| Update open items | Tiap 2 minggu | Status ratifikasi §11 SRS + keputusan D*/P*/A* di docs |

---

## 5. Rencana Cadangan Beban (load balancing)

- F1–F2 (C agak ringan): C mengerjakan setup layout admin panel, komponen UI dasar, API client mock, dan menyiapkan skrip usability test.
- F4–F5 (A agak ringan): A menyiapkan webhook WA + provider Meta, Docker, dan hardening concurrency test (TC-SMS-06c).
- F6 (B agak ringan): B menyiapkan benchmark set NFR-09 + logging tool call.
- F8: seluruh tim fokus UAT + NFR + perbaikan.

---

## 6. Status Ratifikasi

- [ ] Anggota A: ________ — setuju / revisi: ________
- [ ] Anggota B: ________ — setuju / revisi: ________
- [ ] Anggota C: ________ — setuju / revisi: ________
- Tanggal ratifikasi: ________
