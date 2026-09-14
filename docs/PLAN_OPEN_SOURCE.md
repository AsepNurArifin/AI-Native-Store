# PLAN — Open Source Release & Live Demo

> **STATUS: DITUNDA** (2026-09-11) — arah produk berubah: repo beralih ke
> **private**, fokus ke peluncuran SaaS. Plan aktif sekarang:
> [`PLAN_PRODUCT_LAUNCH.md`](PLAN_PRODUCT_LAUNCH.md).
> Dokumen ini tetap disimpan — arsitektur & fase-fasenya valid kembali
> bila open source diaktifkan kembali (lihat §7 fase-nya, tetap berlaku).

> Turunan dari diskusi desain produk (2026-09-11). Status: **DRAFT — menunggu
> ratifikasi 3 keputusan terbuka di §9.**
>
> Dokumen terkait: [`plan.md`](../plan.md) (recovery & hardening — selesai),
> [`README.md`](../README.md) (root), [`docs/ENVIRONMENT.md`](ENVIRONMENT.md).

---

## 1. Ringkasan Keputusan Produk (hasil diskusi)

### 1.1 Posisi produk

```
Repo open source (Model A — self-host, per-instance)
        │
        │  dijalankan & dikelola oleh…
        ▼
Deployment hosted (dikelola kita — untuk demo sidang & calon pengguna non-IT)
        │
        │  dipakai oleh…
        ▼
Pemilik toko non-IT — cukup daftar & chat; tidak pernah menyentuh GitHub
```

### 1.2 Dua audiens, dua produk berbeda

| Audiens | Konsumsi apa | Tidak perlu |
|---|---|---|
| Developer, penguji sidang, kontributor | **Repo open source** — kode, quickstart, arsitektur | Memahami bisnis toko |
| Pemilik toko (target pengguna akhir) | **Live demo / instance hosted** — URL, langsung coba | Install apa pun; tahu Docker/Git |

### 1.3 Prinsip yang dipegang

1. **Open source menjawab "boleh lihat kodenya?", bukan "siapa menjalankannya".**
   Pemilik toko non-IT tidak akan pernah clone repo — itu normal dan bukan
   kegagalan model open source (pola WordPress.com, Chatwoot Cloud, Umami Cloud).
2. **Multi-tenant SaaS = out of scope.** Cukup "managed per-instance" untuk
   skala demo. Multi-tenant dicatat sebagai future work (§8).
3. **Repo publik harus bisa diverifikasi bebas rahasia** — semua kredensial
   milik pengguna masing-masing via `.env` (prinsip ini sudah diterapkan;
   plan ini memverifikasinya sebagai gerbang rilis).
4. **Demo publik = senjata sidang.** Penguji harus bisa mencoba sistem dalam
   < 1 menit tanpa install.

---

## 2. Scope dan Non-Scope

### 2.1 In scope

- Persiapan repo menjadi open source yang layak publik (lisensi, kebersihan,
  keamanan, README publik, quickstart, CI).
- Deployment live demo publik (FE Vercel + BE host + DB demo).
- Proteksi minimal untuk demo publik (rate-limit, config guard production).

### 2.2 Out of scope

- Multi-tenant SaaS (skema `store_id`, billing, onboarding self-serve).
- Channel Telegram (dibahas terpisah setelah plan ini diratifikasi).
- Vitest frontend P3 (tetap di [`plan.md`](../plan.md) — tidak digandakan).
- Hardening production penuh (WAF, observability, dsb.) — demo-grade saja.

---

## 3. Fase 1 — Lisensi & Legal (½ hari)

### Tindakan

1. Tambah `LICENSE` di root (pilihan di §9.1).
2. Tambah header/copyright singkat di `README.md` bagian bawah.
3. (Opsional) `NOTICE` bila pakai Apache-2.0.

### Acceptance criteria

- [ ] `LICENSE` ada dan sesuai pilihan.
- [ ] `git ls-files LICENSE` ter-track.
- [ ] README menyebut lisensi.

---

## 4. Fase 2 — Kebersihan & Keamanan Repo (1 hari)

### 4.1 Audit rahasia (gerbang wajib sebelum publik)

Status awal (diverifikasi 2026-09-11):

| Pemeriksaan | Hasil |
|---|---|
| `backend/.env` / `frontend/.env` pernah masuk git history | ✅ Tidak pernah |
| Kredensial nyata di file ter-track (password Supabase, `gsk_…` key, JWT) | ✅ Bersih — hanya komentar format di `.env.example` |
| Ekspor sesi `pi-session-*.html` yang ter-track | ✅ Bersih dari kredensial (diverifikasi grep) |

Tindakan tambahan:

1. Jalankan **gitleaks** (atau `trufflehog`) terhadap **seluruh riwayat git** —
   gerbang rilis otomatis, bukan keyakinan manual.
2. Rotasi kredensial yang pernah tampil di layar sesi agen (password DB
   Supabase, Groq key) — kebiasaan aman, murah, sekali jalan.
3. Tambah `pi-session-*.html` ke `.gitignore` root (file 09-11 saat ini
   untracked — pastikan tidak ikut ter-commit di masa depan).

### 4.2 Pemisahan artefak proses pribadi vs produk

Artefak proses: `plan.md`, `SRS_v3.3*.md/.pdf`, PRD, `pi-session-*.html`,
`docs/REMEDIATION_PLAN.md`, `docs/SRS_AMENDMENTS.md`, `docs/TASK_ASSIGNMENT.md`.

Dua opsi (keputusan di §9.3):

- **Opsi R1 (direkomendasikan)**: pindah ke `docs/dev/` dalam repo yang sama.
  Sederhana, jejak proses tetap terlihat penguji, tidak menghalangi adopsi
  (developer publik bisa mengabaikan folder itu).
- **Opsi R2**: repo terpisah — repo capstone (private, berisi semua artefak)
  + repo produk (public, bersih). Lebih rapi publik, tapi ada beban sinkronisasi
  ganda dan riwayat git harus difilter (`git filter-repo`) bila dipakai ulang.

Untuk Opsi R1, tambahkan penjelasan satu paragraf di `docs/dev/README.md`:
"artefak proses pengembangan, bukan bagian dari dokumentasi produk".

### 4.3 Struktur root setelah fase ini

```
/LICENSE
/README.md              ← publik, ramah developer (Fase 3)
/CONTRIBUTING.md        ← Fase 3
/backend/  /frontend/  /docs/
/docs/dev/              ← artefak proses (Opsi R1)
```

### Acceptance criteria

- [ ] gitleaks bersih terhadap seluruh riwayat.
- [ ] Kredensial demo/dev sudah dirotasi.
- [ ] `pi-session-*.html` masuk `.gitignore`.
- [ ] Artefak proses terpisah (R1 atau R2) dan repo root terlihat seperti produk.

---

## 5. Fase 3 — README Publik, Quickstart, CI (1–1,5 hari)

### 5.1 README publik baru (root)

Struktur wajib:

1. **Apa & kenapa** — 3 kalimat + 1 diagram arsitektur (yang sudah ada,
   disederhanakan).
2. **Screenshot** — dashboard admin + chat widget (tema "Toko Digital");
   simpan di `docs/assets/screenshots/`.
3. **Fitur utama** — tabel singkat (bukan salinan SRS).
4. **Quickstart 5 menit**:
   ```bash
   git clone … && cd ai-native-store
   cp backend/.env.example backend/.env      # isi DATABASE_URL + GROQ_API_KEY
   docker compose -f backend/docker-compose.yaml -f backend/docker-compose.local.yaml up -d
   cd frontend && npm install && npm run dev
   ```
   (FE sengaja **tidak** di-container — keputusan arsitektur berdiri; quickstart
   lokal tetap `npm run dev`.)
5. **Konfigurasi** — ringkasan variabel penting + tautan `docs/ENVIRONMENT.md`.
6. **Testing** — cara jalankan pytest (termasuk DB test lokal).
7. **Roadmap & kontribusi** — tautan `CONTRIBUTING.md`.
8. **Lisensi**.

README capstone yang sekarang dipindah ke `docs/dev/` (bersama artefak lain)
atau dijadikan `README` internal di folder itu.

### 5.2 File pendukung

- `CONTRIBUTING.md` — branch naming, commit convention ( sudah dipakai:
  `feat/fix/chore(scope)`), cara menjalankan test, checklist PR.
- `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md`.
- `.github/workflows/ci.yml`:
  - job backend: `uv sync` → pytest dengan service `postgres:16` (DB test
    otomatis dibuat di CI — conftest sudah mendukung via `DATABASE_URL_TEST`).
  - job frontend: `npm ci && npm run build`.
  - Trigger: push & PR ke `main`.

### 5.3 Konfigurasi branding per-instance

Verifikasi bahwa identitas toko memang tidak hardcode (sudah benar via
`STORE_NAME` + seed data). Tambahkan satu tes kecil bila perlu agar tidak
regresi: assert nama toko di API dibaca dari settings/DB, bukan konstanta.

### Acceptance criteria

- [ ] Cloner baru bisa jalan dari nol hanya dengan README (diuji di mesin
      bersih / kontainer kosong).
- [ ] CI hijau di push pertama setelah aktif.
- [ ] Screenshot ter-render di README.

---

## 6. Fase 4 — Live Demo Publik (1–2 hari, tergantung pilihan host)

### 6.1 Keputusan topologi (lihat §9.2)

| Komponen | Rencana | Catatan |
|---|---|---|
| FE | **Vercel** (sudah diputuskan) | `NUXT_PUBLIC_API_BASE` → URL BE publik |
| BE | host terpilih (§9.2) | Docker image yang sama dengan compose |
| DB | **Supabase project terpisah khusus demo** | jangan campur dengan DB dev; reset berkala aman |
| Telegram | `TELEGRAM_PROVIDER=mock` (atau `bot` bila webhook publik sudah diset) | tanpa beban verifikasi; endpoint `/api/v1/dev/*` untuk simulasi |
| LLM | Groq (key milik sendiri) | set `LLM_MONTHLY_BUDGET_IDR`; pantau pemakaian |

### 6.2 Prasyarat keamanan demo publik

1. **Rate-limit (lanjutan P5)** — demo publik tanpa rate-limit mengundang
   pemborosan token LLM. Scope minimal: limiter per-IP di rute chat/webhook
   (mis. `slowapi` atau middleware sederhana), ambang konservatif, env-driven.
2. **Production guards aktif** — `validate_runtime_config()` sudah ada; pastikan
   demo jalan dengan `APP_ENV` benar dan masalah tercatat di log.
3. **JWT_SECRET_KEY demo acak kuat** — bukan default.
4. **Reset demo terjadwal** (opsional): skrip kecil re-seed DB demo berkala
   supaya pengalaman penguji selalu konsisten.

### 6.3 Definisi "demo siap sidang"

- [ ] URL publik FE + BE health endpoint 200 dari jaringan luar.
- [ ] Alur lengkap bisa dicoba penguji < 1 menit: buka web → chat dengan
      Sales Agent → lihat order muncul di admin → setujui action AI.
- [ ] Badge "Live Demo" di README menautkan URL.
- [ ] Biaya LLM bulanan dipantau (budget IDR tercantum di log startup).

---

## 7. Fase 5 — Rilis (½ hari)

1. Tag `v0.1.0` + release notes (ringkas: fitur, cara coba, known issues).
2. GitHub: deskripsi repo, topics (`fastapi`, `nuxt`, `conversational-commerce`,
   `ai-agents`, `supabase`, `open-source`), social preview image.
3. Umumkan (opsional): komunitas yang relevan.

---

## 8. Future Work (bukan scope plan ini)

- **Multi-tenant SaaS** — skema `store_id` semua tabel, row-level isolation,
  onboarding self-serve, billing. Dipicu bila jumlah toko hosted > ±20.
- **Channel Telegram** — diskusi terpisah (Bot API terbuka, tanpa verifikasi
  bisnis seperti Meta; arsitektur `provider_base.py` sudah siap menampung
  adapter baru).
- **Vitest frontend (P3)** dan **benchmark/UAT (P6)** — tetap dilacak di
  [`plan.md`](../plan.md).
- Observability (Sentry, metrik), backup DB otomatis.

---

## 9. Keputusan Terbuka (butuh ratifikasi pemilik produk)

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| 9.1 | Lisensi | MIT / Apache-2.0 / AGPL-3.0 | **Apache-2.0** (ramah + pelindung paten) |
| 9.2 | Host BE demo | Railway / Fly.io / Render / VPS sendiri | **Railway** (deploy Docker paling ringan untuk demo; VPS bila sudah ada) |
| 9.3 | Struktur repo | R1: `docs/dev/` satu repo / R2: dua repo | **R1** (sederhana, jejak proses tetap tampak ke penguji) |

---

## 10. Estimasi & Urutan Eksekusi

| Fase | Estimasi | Dependensi |
|---|---|---|
| 1. Lisensi | ½ hari | keputusan 9.1 |
| 2. Kebersihan & keamanan | 1 hari | — |
| 3. README + quickstart + CI | 1–1,5 hari | Fase 2 |
| 4. Live demo | 1–2 hari | keputusan 9.2; rate-limit dari P5 |
| 5. Rilis | ½ hari | semua fase |

**Total: ±4–5 hari kerja.** Urutan wajib: 2 → 3 → 4 → 5 (repo harus bersih
sebelum publik; demo butuh repo final untuk badge & tag).

---

## 11. Status Tracking

| Item | Status | Catatan |
|---|---|---|
| Audit `.env` history | ✅ selesai (2026-09-11) | tidak pernah ter-commit |
| Audit file ter-track | ✅ selesai (2026-09-11) | bersih dari kredensial |
| gitleaks full-history | ⬜ Fase 2 | gerbang rilis |
| Rotasi kredensial | ⬜ Fase 2 | |
| LICENSE | ⬜ Fase 1 | menunggu 9.1 |
| README publik | ⬜ Fase 3 | |
| CI GitHub Actions | ⬜ Fase 3 | |
| Rate-limit demo | ⬜ Fase 4 | lanjutan P5 |
| Deploy FE Vercel | ⬜ Fase 4 | |
| Deploy BE | ⬜ Fase 4 | menunggu 9.2 |
| Tag v0.1.0 | ⬜ Fase 5 | |
