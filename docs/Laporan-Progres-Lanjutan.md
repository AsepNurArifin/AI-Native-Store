# Laporan Progres Lanjutan Project Capstone

**Tahap Lanjutan: Penyempurnaan Antarmuka, Performa, dan Stabilitas Aplikasi**

| Item | Keterangan |
|---|---|
| Judul proyek | AI-Native Store Management System |
| Periode pelaporan | 28 Oktober 2026 |
| Tahap yang dilaporkan | Progres lanjutan — penyempurnaan antarmuka, performa, dan stabilitas aplikasi |

## 1. Ringkasan

Sampai dengan laporan progres lanjutan ini, aplikasi SHAF STORE telah berjalan
dan dapat diakses publik pada alamat
[shafs-store.vercel.app](https://shafs-store.vercel.app). Sistem sudah
meliputi katalog produk, percakapan bertenaga AI pada web, Bot Telegram,
checkout langsung, panel admin, serta analitik dan jejak audit. Fokus periode
ini, yang dicakup pada rentang 1 sampai 25 Oktober 2026, bukan menambahkan
modul baru secara besar, melainkan menyempurnakan antarmuka, performa, dan
stabilitas aplikasi yang sudah berjalan.

Pekerjaan periode ini terbagi ke lima kelompok. Pertama, penyempurnaan
antarmuka pelanggan dan panel admin, termasuk penyusunan ulang halaman login,
tampilan spesifikasi produk, serta penambahan popup peninjauan dan popup
penambahan katalog. Kedua, peningkatan performa berupa cache halaman admin dan
optimasi kecepatan muat. Ketiga, kelengkapan aset toko berupa fitur upload
gambar produk dan perubahan logo. Keempat, perbaikan cacat yang ditemukan pada
pemakaian nyata, antara lain bug penghapusan produk dan galat basis data,
disertai dua putaran audit antarmuka. Kelima, penyiapan kehadiran media sosial
toko pada Instagram dan TikTok sesuai arahan dosen. Rincian capaian dan
statusnya dirangkum pada Bagian 3, sementara akun media sosial dijelaskan pada
Bagian 4.5.

## 2. Tujuan dan lingkup periode

Tujuan yang ditetapkan untuk periode ini:

1. Memperbaiki antarmuka pelanggan dan panel admin agar lebih mudah digunakan,
   terutama pada tampilan spesifikasi produk dan pengelolaan katalog.
2. Meningkatkan kecepatan aplikasi, baik pada sisi pelanggan maupun panel
   admin.
3. Menutup cacat yang ditemukan pada pemakaian nyata: bug penghapusan produk,
   galat basis data, dan notifikasi yang belum jelas.
4. Melengkapi aset toko, yaitu upload gambar produk dan identitas visual
   (logo).
5. Memulai kehadiran media sosial toko pada Instagram dan TikTok sebagai kanal
   pemasaran digital.

Lingkup periode ini dibatasi pada penyempurnaan aplikasi yang sudah berjalan
untuk satu toko dengan satu pemilik. Di luar lingkup: integrasi payment
gateway (QRIS masih simulasi), penambahan kanal WhatsApp, dan aplikasi mobile.

## 3. Capaian periode

| No | Deliverable | Isi ringkas | Status |
|---|---|---|---|
| 1 | Redesign form login | Halaman masuk panel admin disusun ulang | Selesai |
| 2 | Redesign tampilan spesifikasi produk | Spesifikasi produk pada sisi pelanggan ditampilkan terstruktur agar mudah dibandingkan | Selesai |
| 3 | Fitur edit spesifikasi | Spesifikasi produk dapat disunting dari panel admin | Selesai |
| 4 | Popup lihat spesifikasi | Peninjauan spesifikasi produk dari panel admin tanpa berpindah halaman | Selesai |
| 5 | Popup tambah katalog | Penambahan produk baru melalui formulir popup yang lebih ringkas | Selesai |
| 6 | Upload gambar produk | Berkas gambar produk diunggah ke storage dan ditautkan ke produk | Selesai |
| 7 | Optimasi kecepatan muat | Perbaikan waktu muat aplikasi pada beberapa titik | Selesai |
| 8 | Cache halaman admin | Halaman admin memanfaatkan cache untuk mempercepat respons | Selesai |
| 9 | Optimasi hak akses role admin | Pembagian peran dan hak akses pada panel dirapikan | Selesai |
| 10 | Perbaikan bug hapus produk | Kegagalan penghapusan produk diperbaiki disertai popup notifikasi | Selesai |
| 11 | Perbaikan galat basis data | Sumber galat pada basis data ditemukan dan ditutup | Selesai |
| 12 | Pembaruan seed katalog | Data contoh katalog diperbarui agar wakil dari produk nyata | Selesai |
| 13 | Identitas visual | Perubahan logo dan penyesuaian tampilan menyeluruh | Selesai |
| 14 | Audit antarmuka | Dua putaran audit antarmuka, termasuk audit kenyamanan penggunaan | Selesai |
| 15 | Akun media sosial | Akun Instagram dan TikTok toko dibuat sesuai arahan dosen | Selesai, rincian pada Bagian 4.5 |

## 4. Rincian pekerjaan yang telah dilakukan

### 4.1 Penyempurnaan antarmuka pelanggan

Halaman spesifikasi produk pada sisi pelanggan disusun ulang. Spesifikasi
perangkat yang sebelumnya berupa teks panjang kini disajikan terstruktur, sehingga
pelanggan dapat membandingkan iPhone dan Samsung Galaxy flagship tanpa membaca
deskripsi secara utuh. Perubahan ini menyertai kebutuhan nyata: pelanggan toko
elektronik biasanya mengajukan pertanyaan perbandingan, dan tampilan terstruktur
mempercepat keputusan pembelian.

Halaman login panel admin juga disusun ulang agar kesan pertama pemilik toko
lebih rapi dan konsisten dengan identitas visual terbaru. Seluruh penyesuaian
tampilan ditutup dengan penggantian logo aplikasi.

### 4.2 Penyempurnaan panel admin

Pengelolaan katalog di panel admin dipercepat dengan dua popup baru. Popup lihat
spesifikasi memungkinkan peninjauan spesifikasi produk tanpa berpindah
halaman, dan popup tambah katalog memperpendek formulir penambahan produk
baru. Spesifikasi kini juga dapat disunting langsung dari panel, sehingga
pembaruan data produk tidak lagi menunggu campur tangan teknis.

Tabel baru ditambahkan pada panel disertai optimasi tampilan, pembagian hak
akses role admin dirapikan, dan halaman-halaman admin memperoleh cache agar
respons terasa cepat. Konsekuensi cache ditangani dengan masa berlaku singkat
seperti dijelaskan pada Bagian 6.

### 4.3 Upload gambar dan aset toko

Fitur upload gambar produk ditambahkan melalui endpoint unggah ke storage.
Gambar produk tidak disimpan di dalam basis data, melainkan diunggah ke storage
lalu ditautkan ke data produk, sehingga basis data tetap ringan. Periode ini
juga memperbarui identitas visual toko melalui penggantian logo.

### 4.4 Perbaikan bug dan stabilitas

Cacat yang ditemukan pada pemakaian ditutup satu per satu. Bug penghapusan
produk diperbaiki dan disertai popup notifikasi agar setiap aksi memberi
umpan balik yang jelas. Galat basis data yang muncul dilacak sumbernya lalu
ditutup. Data contoh katalog (seed) diperbarui agar mendekati produk yang
dijual toko, sehingga demo dan pemakaian nyata tidak memakai data yang
menyesatkan.

Dua putaran audit antarmuka dilakukan untuk memeriksa konsistensi hasil
penyempurnaan, termasuk audit yang berfokus pada kenyamanan penggunaan. Hasil
audit menjadi dasar penyesuaian tampilan lanjutan pada periode berikutnya.

### 4.5 Penyiapan media sosial

Sesuai arahan dosen pada pertemuan terakhir, akun media sosial brand SHAF
STORE pada Instagram dan TikTok telah dibuat. Kedua akun akan digunakan untuk
memublikasikan konten sesuai lima pilar konten pada `Naskah-Konten.md`
(edukasi garansi, panduan memilih, kurasi dan perbandingan, kepercayaan dan
sosial bukti, serta promo dan stok masuk).

| Platform | Nama akun | Username | Tautan profil | Status |
|---|---|---|---|---|
| Instagram | [ISI: nama akun IG] | [ISI: @username IG] | [ISI: tautan profil IG] | Sudah dibuat |
| TikTok | [ISI: nama akun TikTok] | [ISI: @username TikTok] | [ISI: tautan profil TikTok] | Sudah dibuat |

> Catatan: dokumen `Naskah-Konten.md` mencantumkan akun utama Instagram
> [@shaftech.id](https://instagram.com/shaftech.id). Apabila username yang
> terlanjur dibuat berbeda, mohon disesuaikan. Konten belum mulai
> dipublikasikan pada periode ini.

## 5. Status per modul

| Modul | Analisis | Desain | Implementasi | Pengujian | Catatan |
|---|---|---|---|---|---|
| Antarmuka pelanggan | Selesai | Selesai | Selesai | Sebagian | Redesign spesifikasi produk periode ini; pengujian manual |
| Antarmuka panel admin | Selesai | Selesai | Selesai | Sebagian | Popup, edit spesifikasi, cache, dan role periode ini |
| Upload gambar | Selesai | Selesai | Selesai | Sebagian | Perlu pengujian lintas perangkat |
| Katalog dan seed | Selesai | Selesai | Selesai | Sebagian | Data contoh diperbarui |
| Basis data | Selesai | Selesai | Selesai | Sebagian | Galat periode ini ditutup |
| Media sosial | Selesai | Selesai | Sebagian | Belum | Akun dibuat; konten belum dipublikasikan |

## 6. Keputusan desain yang diambil pada periode ini

Keputusan berikut diambil sadar beserta alasannya:

1. Upload gambar disimpan pada storage, bukan di dalam basis data. Berkas
   gambar berpotensi membesar, dan menyimpannya di basis data membuat
   cadangan serta kinerja kueri memburuk. Gambar diunggah ke storage lalu
   hanya tautannya yang disimpan pada data produk.
2. Halaman admin memakai cache dengan masa berlaku singkat. Kecepatan akses
   panel meningkat nyata; konsekuensinya perubahan data baru terlihat setelah
   cache kedaluwarsa, dan hal ini diterima karena perubahan data admin
   tidak terjadi setiap detik.
3. Peninjauan dan penambahan katalog dibuat berbentuk popup. Popup
   mengurangi perpindahan halaman dan mengurangi salah input saat pengelolaan
   katalog dilakukan berulang.
4. Spesifikasi produk disajikan terstruktur pada sisi pelanggan. Pertanyaan
   pelanggan didominasi perbandingan perangkat; tampilan terstruktur
   mempersingkat proses tersebut tanpa menambah beban percakapan.
5. Notifikasi aksi admin dibuat konsisten berbentuk popup. Setiap aksi yang
   berhasil maupun gagal memberi umpan balik yang jelas, mengurangi
   kebingungan saat aksi tidak tampak berjalan.
6. Akun media sosial dipisah per platform, Instagram dan TikTok, dengan satu
   identitas brand yang sama. Pemisahan ini mengikuti arahan dosen dan
   karakter kedua platform yang berbeda pola konsumsi kontennya, sementara
   arah konten tetap satu sumber pada `Naskah-Konten.md`.

## 7. Kendala dan penanganan

| Kendala | Dampak | Penanganan |
|---|---|---|
| QRIS masih simulasi, tanpa payment gateway | Pembayaran online belum otomatis | Konfirmasi pembayaran dilakukan manual oleh kasir; integrasi payment gateway masuk rencana kerja |
| Kanal WhatsApp belum aktif | Kanal pemesanan pihak ketiga belum lengkap | Bot Telegram dipakai sebagai kanal utama dengan abstraksi kanal; WhatsApp menyusul |
| Konten media sosial belum mulai diproduksi | Akun baru dibuat, belum aktif menarik pembeli | Produksi konten mengikuti lima pilar pada `Naskah-Konten.md` masuk rencana kerja berikutnya |
| [ISI: kendala lain bila ada] | [ISI: dampaknya] | [ISI: penanganannya] |

## 8. Pembagian tugas

| Anggota | Peran |
|---|---|
| Asep Nur Arifin | FULLSTACK dan integrasi AI |
| Fitria Azahra | DESAIN ANTARMUKA |
| Fitriani | pembuatan laporan |
