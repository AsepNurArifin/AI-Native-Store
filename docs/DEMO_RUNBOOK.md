# Runbook Demo Lokal — Toko Elektronik Bu Ratna

## 1. Sebelum hari presentasi

1. Pastikan `backend/.env` dan `frontend/.env` tersedia (jangan ikut commit).
2. Pilih database demo. `DATABASE_URL_TEST` hanya untuk test otomatis, bukan demo:
   tabelnya dihapus/dibuat ulang setiap test.
3. Untuk demo LLM nyata, cek konfigurasi provider dan API key yang sudah digunakan
   proyek. Provider `mock` hanya baseline sederhana, **bukan** simulasi rekomendasi
   elektronik lengkap. Lihat `docs/ENVIRONMENT.md`.
4. Jika DB masih berisi katalog lama, backup dahulu. Setelah konfirmasi pemilik,
   jalankan `backend/scripts/reset_demo.sql` pada **DB demo yang benar**, kemudian:

   ```bash
   cd backend
   uv run python -m app.seed.generate
   ```

   Perintah seed tidak mengganti toko yang sudah terisi. Jangan menjalankan reset
   di database yang menyimpan transaksi penting.
5. Periksa lewat admin: kategori Laptop/Smartphone, spesifikasi RAM/storage numerik,
   stok produk yang akan diperagakan, dan masa berlaku promo (promo seed 7 hari).

## 2. Menjalankan aplikasi

Terminal backend:

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Jika Docker backend sudah memakai port 8000, gunakan backend tersebut atau pilih
port berbeda dan sesuaikan `NUXT_PUBLIC_API_BASE`. Jangan menutup proses yang
belum jelas pemiliknya.

Terminal frontend:

```bash
cd frontend
npm run dev
```

Buka `http://localhost:3000`, periksa `http://localhost:8000/health`, lalu login
Owner dengan kredensial dari `.env`. Endpoint health bukan bukti bahwa LLM bisa
menjawab; kirim satu pertanyaan chat untuk mengecek koneksi provider juga.

Backend lokal + Supabase remote + LLM remote masih membutuhkan internet.
Demo Telegram webhook membutuhkan bot aktif dan endpoint HTTPS yang dapat
dijangkau Telegram; setup lihat `TELEGRAM_SETUP.md`.

## 3. Skenario presentasi 3–5 menit

1. **Etalase:** jelaskan satu toko elektronik, bukan layanan SaaS. Harga simulasi.
2. **Cari:** “Laptop RAM 16GB dan SSD minimal 512GB di bawah 12 juta.”
3. **Bandingkan:** bandingkan dua hasil. Buka spesifikasi pada kartu chat.
4. **Batas pengetahuan:** tanya garansi yang belum ada di data; asisten harus mengaku
   belum memiliki informasi. Jika tidak, catat sebagai temuan UAT, jangan disembunyikan.
5. **Pesan:** pilih satu produk, cek nama/varian, jumlah, harga, diskon, total.
6. **Konfirmasi:** tekan tombol, bukan sekadar mengetik “oke”.
7. **Admin:** tunjukkan order tercatat dan stok berkurang.
8. **Bukti teknis:** tunjukkan hasil test retry/idempotensi dan race stok terakhir.

Jangan menyebut pesanan “sudah dibayar” atau “sedang dikirim”: modul tersebut
bukan bagian scope. Layanan AI gagal akan menampilkan pesan sementara tidak
tersedia, bukan berpura-pura memberi jawaban normal.

## 4. Regresi sebelum freeze

PostgreSQL test lokal (jika container belum ada):

```bash
docker run -d --name ai-store-test-pg -e POSTGRES_USER=store -e POSTGRES_PASSWORD=store -e POSTGRES_DB=store_test -p 5433:5432 postgres:16-alpine
```

Pastikan `DATABASE_URL_TEST=postgresql+asyncpg://store:store@localhost:5433/store_test`.
DB harus terpisah dari database toko.

```bash
cd backend
uv run pytest -q
# atau fokus finalisasi:
uv run pytest -q tests/test_seed.py tests/test_product_search.py tests/test_electronics_e2e.py tests/test_concurrency.py
```

```bash
cd frontend
npm run build
```

Simpan bukti test dan rekaman layar di folder presentasi (di luar repo bila
mengandung data pribadi). Test scripted membuktikan alur backend, **bukan**
kualitas LLM nyata. Isi hasil UAT di `FINALIZATION_CHECKLIST.md`.

## 5. Cadangan bila internet bermasalah

- Siapkan rekaman demo yang telah berhasil sebelumnya.
- Tampilkan bukti test lokal dan arsitektur; jujur bahwa LLM remote tidak tersedia.
- Jangan mengklaim mode offline penuh bila DB demo masih Supabase remote.
- Deployment publik dan payment gateway tidak perlu ditambahkan menjelang sidang.
