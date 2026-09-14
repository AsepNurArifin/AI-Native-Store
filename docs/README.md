# Dokumentasi Proyek — AI-Native Store Management System

> Baseline requirement: `SRS_v3.3_AI_Native_Store_Management_System.md` (normatif, self-contained) dan `Product Requirements Document — AI-Native Store Management System.md` (product-level). Master plan: [`plan.md`](../plan.md).

## Indeks Dokumen

| Dokumen | Isi | Dibaca sebelum |
|---|---|---|
| [`FINALIZATION_CHECKLIST.md`](FINALIZATION_CHECKLIST.md) | Checklist aktif final single-store elektronik: bukti test, UAT, scope, freeze | Menuju final |
| [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md) | Menjalankan demo lokal, skenario presentasi, cadangan, reset aman | Sebelum demo |
| [`CATALOG_DATA_QUALITY.md`](CATALOG_DATA_QUALITY.md) | Harga simulasi, koreksi bersumber, kontrak spesifikasi/filter, batas audit | Mengubah katalog |
| [`plan.md`](../plan.md) | Master plan: roadmap fase, milestone, traceability, risiko, open items | Semua anggota, F0 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arsitektur sistem, alur data, komponen, layer AI, channel adapter | F1 |
| [`DATA_SCHEMA.md`](DATA_SCHEMA.md) | Skema database Supabase: entitas, kolom, relasi, aturan integritas | F1 |
| [`API_DESIGN.md`](API_DESIGN.md) | Kontrak REST API backend (BE↔FE), autentikasi, format error | F1, F6 |
| [`AI_PROMPTS.md`](AI_PROMPTS.md) | Desain system prompt + tool/function calling untuk 3 AI agent | F4 |
| [`ENVIRONMENT.md`](ENVIRONMENT.md) | Daftar environment variable & secrets, contoh nilai | F0 |
| [`TASK_ASSIGNMENT.md`](TASK_ASSIGNMENT.md) | Pembagian tugas 3 anggota + peta FR/NFR → pemilik | F0 |
| [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) | Rencana perbaikan temuan audit konsistensi code-vs-SRS (fase, acceptance criteria, DoD) | Setelah audit konsistensi |
| [`SRS_AMENDMENTS.md`](SRS_AMENDMENTS.md) | Log deviasi implementasi vs SRS + status ratifikasi (wajib dibaca sebelum sidang) | Setelah REMEDIATION_PLAN |

## Hierarki Keputusan

1. **SRS v3.3** — sumber requirement final (FR/NFR/UC/TC). Jika ada konflik, SRS menang.
2. **PRD** — konteks produk, vision, boundary, prinsip.
3. **plan.md** — eksekusi: urutan, jadwal, pembagian kerja.
4. **docs/*** — desain teknis yang menurunkan SRS ke implementasi (arsitektur, skema, API, prompt, ops).

## Aturan Perubahan Dokumen

- Perubahan scope (channel, ordering model, AI capability, role model, approval model, MVP boundary) = **scope change** (PRD §56), bukan perubahan kecil.
- Setiap dokumen punya status DRAFT hingga diratifikasi tim.
- Istilah baru yang muncul di satu dokumen harus diperiksa konsistensinya di dokumen lain (pola audit SRS v3.3).
