# Kualitas Data Katalog Demo

Katalog di `backend/app/seed/generate.py` adalah **fixture demo**, bukan feed
resmi distributor. Harga bersifat simulasi dan tidak diverifikasi sebagai harga
pasar terkini. Jangan menjadikannya dasar penawaran nyata.

## Koreksi bersumber pada tahap finalisasi

| Produk | Koreksi | Sumber pabrikan |
|---|---|---|
| Apple Watch SE generasi 2 40mm GPS | Hapus klaim ECG dari fitur; `ecg: false`; pilih varian GPS, bukan “LTE opsional” sebagai satu SKU; Bluetooth 5.3 | [Apple — technical specifications](https://support.apple.com/en-us/111853) |
| Kingston NV2 1TB (SNV2S/1000G) | SSD **internal M.2 2280 PCIe 4.0 x4 NVMe**, bukan SSD eksternal USB-C; baca/tulis hingga 3500/2100 MB/s; hapus klaim kompatibilitas PS5 tanpa dasar | [Kingston — datasheet NV2](https://www.kingston.com/datasheets/snv2s_en.pdf) |

Klaim subjektif “ANC terbaik di kelasnya” pada Sony WH-1000XM5 juga dihapus.
**Audit seluruh 98 produk belum selesai.** Varian regional, nama model laptop,
fitur audio/wearable, dan kompatibilitas aksesori lainnya perlu dicocokkan lagi
ke halaman pabrikan sebelum dipakai sebagai katalog nyata. Keberhasilan test
integritas tidak membuktikan kebenaran faktual setiap field spesifikasi.

## Kontrak spesifikasi

- `ram_gb`: integer RAM sistem, bukan VRAM GPU.
- `storage_gb`: integer kapasitas nominal decimal GB (1 TB = 1000 GB).
- `storage`: teks media/kapasitas untuk tampilan (opsional, bukan filter numerik).
- `prosesor` untuk laptop, `chipset` untuk HP/tablet; tool `processor` mencari keduanya.
- `gpu`: model GPU sebagai teks, misalnya `NVIDIA RTX 4060 8GB`.
- `false` = secara eksplisit tidak didukung. Field hilang/null = belum diketahui.
- Jangan isi garansi, kondisi barang, IMEI, warna, atau kompatibilitas tanpa informasi sumber.

Seed menormalisasi `storage` laptop/konsol menjadi `storage_gb`, tanpa mengubah
konstanta katalog. Ini **tidak mengubah record lama di Supabase**. Record lama
perlu diperbarui oleh Owner atau reset/re-seed khusus DB demo setelah backup.
Pencarian minimum numerik tidak memasukkan produk yang nilainya hilang atau
berisi teks seperti `unknown`/`SSD 512GB` di field numerik.

## Kontrak pencarian

Semua filter digabung dengan AND:

```json
{
  "category": "Laptop",
  "ram_min_gb": 16,
  "storage_min_gb": 512,
  "budget_max": 12000000,
  "stock_only": true
}
```

Tool juga mendukung `budget_min`, `brand`, `processor`, `gpu`, dan `query`.
`query` adalah kata kunci, **bukan parser bahasa alami penuh**. Setiap token
dicari pada nama/kategori/JSON spesifikasi dengan AND. Pola ringkas `RAM 16GB`
dan `SSD 1TB` diekstrak menjadi minimum numerik. Kalimat seperti “di bawah 12 juta”
harus dipetakan model menjadi `budget_max`, bukan dimasukkan seluruhnya ke query.

Batas budget memakai harga dasar produk, bukan harga setelah promosi. Harga
promo dihitung oleh ringkasan pesanan dan diverifikasi kembali saat konfirmasi.
Filter minimum tidak berarti nilai persis; jika pengguna meminta varian persis,
AI perlu memeriksa hasil tool atau meminta klarifikasi. Hasil kosong tidak boleh
menyebabkan budget/spesifikasi dilonggarkan tanpa persetujuan.

API Owner: `GET /api/v1/products?q=...&ram_min_gb=16&storage_min_gb=512&budget_max=12000000&stock_only=true`.
API tetap memerlukan token Owner. Input tidak valid menghasilkan 422;
filter tool tidak valid menghasilkan error yang bisa diperbaiki model.

## Kontrak seed stok

- Stok pembuka dibuat 30 hari sebelum waktu seed.
- Pergerakan manual berikutnya kronologis dan tidak pernah melewati saldo tersedia.
- Pergerakan manual bukan penjualan, sehingga tidak memakai reference_type ORDER.
- Dua order contoh memakai produk unik per order, aritmetika Decimal, dan
  transaksi OUT dengan reference_id order yang benar.
- Jika diperlukan, restock dicatat sebelum order, bukan sesudahnya.
- Order contoh mendahului promo aktif, sehingga tidak ada diskon historis fiktif.
- Seed hanya mengisi toko kosong; jangan menjalankan beberapa seed bersamaan.

Bukti: `backend/tests/test_seed.py`, `test_product_search.py`, dan
`test_electronics_e2e.py`.
