# Finalization Checklist — Toko Elektronik Bu Ratna

Checklist aktif menuju final capstone. `PLAN_PRODUCT_LAUNCH.md` adalah riwayat
rencana lama, bukan acceptance checklist saat ini.

## Scope yang dikunci

- Satu toko elektronik per instalasi; Owner mengelola toko, pelanggan memakai chat.
- Tidak ada SaaS, langganan, multi-tenant, pembayaran online, atau pengiriman otomatis.
- Demo lokal cukup untuk tahap ini. Supabase remote, LLM nyata, dan Telegram tetap
  membutuhkan internet. Lokal **bukan** otomatis offline.
- Harga seed adalah simulasi, bukan penawaran pasar. Jumlah 98 adalah kapasitas
  katalog contoh penuh, bukan hitungan stok live. `SEED_SKU_COUNT` dapat membatasinya.

## A. Data dan pencarian

- [x] 98 produk / 7 kategori, nama unik, harga positif, identitas Owner dari `.env`.
- [x] RAM dan storage numerik (`ram_gb`, `storage_gb`); 1 TB = 1000 GB.
- [x] Koreksi awal Watch SE 2 dan Kingston NV2 dengan sumber pabrikan.
- [ ] Audit faktual seluruh model/varian lainnya — lihat `CATALOG_DATA_QUALITY.md`.
- [x] Saldo stok setiap titik waktu tidak negatif; stok pembuka sebelum transaksi.
- [x] Transaksi ORDER memiliki order/item rujukan; total order sesuai item.
- [x] Pergerakan manual tidak disamarkan sebagai penjualan.
- [x] Seed ulang pada toko berisi data tidak menambah/menghapus data.
- [x] Pencarian kata kunci pada nama, kategori, dan spesifikasi.
- [x] Filter budget, RAM, storage, brand, prosesor/chipset, GPU; stok sebelum LIMIT.
- [x] Nilai spesifikasi hilang/rusak tidak memenuhi filter numerik dan tidak membuat SQL gagal.
- [ ] Terapkan seed terbaru pada DB demo yang akan dipakai presentasi (backup/reset oleh pemilik).

## B. Pengujian dan bukti

| Kebutuhan / risiko | Bukti otomatis | Batas bukti |
|---|---|---|
| Seed konsisten | `tests/test_seed.py` | Data/invarian, bukan verifikasi seluruh spesifikasi pabrikan |
| FR-SA-01/02: rekomendasi stok/spec/budget | `tests/test_product_search.py` | Filter SQL + API + tool |
| FR-SA: perbandingan spesifikasi | `tests/test_electronics_e2e.py` | Hasil compare berasal dari DB; LLM scripted |
| UC-02: ringkasan → konfirmasi → admin | `tests/test_electronics_e2e.py`, `test_flow_e2e.py` | Endpoint produksi, hanya LLM diganti |
| Konfirmasi ulang | `test_electronics_e2e.py`, `test_orders.py` | Satu order dan satu pengurangan stok |
| Stok terakhir | `test_concurrency.py` | Dua summary asli dari chat, confirm paralel: 200 + 409 |
| LLM timeout | `test_electronics_e2e.py` | Pesan unavailable eksplisit, tanpa order otomatis |
| Keamanan webhook / rate limit | `test_webhook_security.py`, `test_rate_limit.py` | Test lokal |

Verifikasi pada pengerjaan finalisasi ini: **72 backend tests passed**;
`npm run build` berhasil. Ini bukan hasil uji LLM nyata.

Test runner sekarang menolak `DATABASE_URL_TEST` kosong, host nonlokal, nama DB
bukan `*test*`, atau URL identik dengan DB toko. Suite melakukan drop/create
per test, sehingga database test tidak boleh menyimpan data penting.

## C. UI dan acceptance manual

- [x] Kartu chat dan tabel admin bisa membuka daftar spesifikasi; nama/varian tidak dipotong satu baris.
- [x] Nilai `false` ditampilkan “Tidak”, null/kosong “Belum tersedia”.
- [x] Editor JSON admin berformat rapi, menolak array dan memberi petunjuk RAM/storage numerik.
- [x] Klaim uptime 24/7/status live statis dihapus; harga simulasi disebutkan.
- [x] Browser `/` dan `/chat` pada 320/375/414/768px: lebar viewport/root sesuai, tidak ada overflow horizontal. Kartu spesifikasi dan ringkasan diuji memakai respons fixture lokal, **bukan LLM nyata**; console chat tanpa error/warning. Bug grid chat melebar di 320px telah diperbaiki.
- [ ] Form spesifikasi ramah pemilik non-IT (saat ini masih JSON dengan validasi/petunjuk).
- [ ] UAT lengkap admin pada mobile dan desktop; uji tambah/ubah produk, promo, stok, order.
- [ ] Uji model nyata: minimal 10 pertanyaan, simpan input, hasil tool, jawaban, dan penilaian.
- [ ] Pertanyaan spesifikasi tak diketahui tidak dijawab dengan tebakan oleh model nyata.
- [ ] Uji Telegram nyata (jika masuk skenario sidang), bukan hanya mock webhook.

Prompt live yang disarankan:
1. “Laptop RAM 16GB, SSD minimal 512GB di bawah 12 juta.”
2. “Bandingkan dua laptop itu.”
3. “Apakah garansinya internasional?” (jika field tidak ada, harus mengaku belum tahu).
4. “Ada laptop RAM 64GB di bawah 2 juta?” (jangan melonggarkan filter diam-diam).
5. “Saya mau Lenovo satu unit.” → cek ringkasan → konfirmasi → lihat order admin.
6. “Apakah Apple Watch SE 2 punya ECG?” → gunakan field `ecg: false`.

## D. Paket demo dan freeze

- [ ] Ikuti `DEMO_RUNBOOK.md` dari terminal baru sampai aplikasi siap.
- [ ] Screenshot/rekaman demo cadangan; jangan tampilkan token/credential.
- [ ] Susun slide: masalah → arsitektur → demo → bukti pengujian → batasan.
- [ ] Cocokkan matriks kebutuhan SRS/Amendments dengan implementasi akhir.
- [ ] Review diff dan secrets, commit perubahan, baru tag kandidat final.
- [ ] Deploy publik hanya jika dibutuhkan dan tersedia anggaran; tidak menghalangi final lokal.

**Tidak boleh memberi label “final siap sidang” hanya karena build/test otomatis hijau.**
UAT model nyata, data demo yang benar, serta rekaman cadangan masih diperlukan.
