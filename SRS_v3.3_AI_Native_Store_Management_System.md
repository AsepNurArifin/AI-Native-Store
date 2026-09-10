<style>
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5; /* Spasi baris 1.5 (standar laporan/makalah) */
    color: #000000;
    text-align: justify; /* Rata kanan-kiri (opsional) */
  }

  /* Menyesuaikan ukuran judul (Heading) agar tetap proporsional */
  h1 { font-size: 16pt; font-weight: bold; }
  h2 { font-size: 14pt; font-weight: bold; }
  h3 { font-size: 13pt; font-weight: bold; }
  h4, h5, h6 { font-size: 12pt; font-weight: bold; }

  /* Blok kode sebaiknya tetap monospace agar tetap terbaca rapi */
  code, pre {
    font-family: "Consolas", "Courier New", monospace;
    font-size: 10pt;
  }

  /* Pengaturan margin kertas A4 standar */
  @page {
    size: A4;
    margin: 3cm 2.5cm 2.5cm 2.5cm; /* Atas, Kanan, Bawah, Kiri */
  }
</style>

# Software Requirements Specification (SRS)
## AI-Native Store/Retail Management System dengan AI Intelligence Layer

| Item | Detail |
|---|---|
| Proyek | Capstone Project  AI-Native Store/Retail Management System |
| Tim | Nama Tim nya Twins Fitri |
| Anggota | Asep Nur Arifin, Fitriani, Fitria Azzahra |

---

## Daftar Isi

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [External Interfaces](#5-external-interfaces)
6. [Data Requirements](#6-data-requirements)
7. [Use Cases](#7-use-cases)
8. [State Machines](#8-state-machines)
9. [Traceability](#9-traceability)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Open / Ratification Items](#11-open--ratification-items)

---

## 1. Introduction

### 1.1 Tujuan Dokumen

Mendefinisikan seluruh kebutuhan fungsional dan non-fungsional sistem secara lengkap, testable, dan bebas kontradiksi internal sejauh yang telah diaudit (tiga putaran audit internal tim), sebagai baseline tunggal pengembangan (3 orang, September–Desember 2026).

### 1.2 Ruang Lingkup

Sistem terdiri dari:
- **Customer-facing interaction layer**: dua channel  **Web Chat Widget** (landing page toko) dan **WhatsApp**  keduanya terhubung ke **AI Sales Agent Core** yang sama lewat **Channel Adapter**.
- **Store Management System (SMS)**: data operasional toko (produk, inventory, pelanggan, promosi, order, percakapan).
- **AI Intelligence Layer**: AI Sales Agent (SELL), AI Business Analyst (UNDERSTAND), AI Action Assistant (ACT).
- **Admin Panel** (web, internal): satu antarmuka untuk Owner mencakup Product, Inventory, Order, Promotion, Analytics, Conversation Monitoring, dan AI-Assisted Operation.

**Di luar lingkup**: payment gateway, kasir/cash drawer, integrasi marketplace/Instagram/Telegram, multi-branch, autonomous action tanpa approval, retur/refund, unifikasi identitas customer lintas channel, dan **Cart sebagai entity tersimpan** (order dibuat langsung dari ringkasan percakapan).

### 1.3 Definisi, Akronim, Singkatan

| Istilah | Definisi |
|---|---|
| SMS | Store Management System |
| Channel | Titik masuk interaksi customer  `WEB` atau `WHATSAPP` |
| Channel Adapter | Komponen penerjemah format pesan/tombol per platform, menjaga AI Sales Agent Core tetap channel-agnostic |
| Order Summary | Ringkasan item + quantity + harga yang disusun AI dari konteks percakapan, ditampilkan untuk konfirmasi customer **bukan entity tersimpan**, hanya representasi sementara sebelum Order dibuat |
| WABA | WhatsApp Business API |
| Template Message | Pesan WhatsApp berformat baku yang disetujui Meta, wajib dipakai di luar jendela 24 jam |
| 24-hour window | Aturan WABA: pesan bebas hanya boleh dikirim dalam 24 jam sejak pesan terakhir dari customer |
| Customer Transaction | Aksi yang berasal dari konfirmasi eksplisit customer sendiri (mis. membuat order) **tidak** memerlukan approval Owner, cukup validasi backend |
| AI Administrative Action | Aksi yang diinisiasi lewat instruksi Owner ke AI Action Assistant yang berdampak pada data operasional toko (mis. promosi)  **wajib** approval Owner sebelum eksekusi |
| InventoryTransaction | Catatan pergerakan stok source of truth untuk current_stock |
| AuditLog | Catatan tunggal seluruh siklus AI Action: draft dibuat, disetujui/ditolak, dieksekusi, atau gagal validasi, beserta aktor dan waktu |
| actor_type | `USER` atau `AI_SYSTEM`, penanda pelaku suatu entri di AuditLog |
| DEFAULT DIUSULKAN | Nilai konkret yang diusulkan agar requirement testable, menunggu ratifikasi tim |

### 1.4 Referensi

Proposal Capstone awal; hasil tiga putaran audit requirement-engineering internal tim; IEEE Std 830-1998 (acuan struktur).

---

## 2. Overall Description

### 2.1 Perspektif Produk

SMS adalah source of truth untuk seluruh data faktual. AI Intelligence Layer (LLM/reasoning component) tidak memiliki akses database langsung  seluruh operasi baca/tulis lewat backend tools/API yang menjalankan validasi dan otorisasi.

### 2.2 Peran Pengguna

| Peran | Autentikasi? | Interface | Hak Akses |
|---|---|---|---|
| **Customer** | Tidak (guest) | Web Chat Widget atau WhatsApp | Chat dengan AI Sales Agent; menyelesaikan order lewat konfirmasi eksplisit |
| **Owner** | Ya | Admin Panel | CRUD data operasional; membuat draft AI Action; AI Business Analyst; Conversation Monitoring; **satu-satunya peran yang dapat approve/reject draft AI Action (termasuk draft buatan sendiri)**; dan AuditLog |


### 2.3 Dua Jalur Perubahan Data

**Jalur 1  Customer Transaction** (tidak memerlukan approval Owner):
```
Customer confirmation (eksplisit, lewat tombol/reply terstruktur)
        ↓
Backend validation (stok cukup, produk aktif, harga sesuai  atomik)
        ↓
Order dibuat
```
Berlaku untuk: pembuatan Order (FR-SA-05, FR-SMS-06). AI Sales Agent memfasilitasi, tapi keputusan akhir ada di konfirmasi eksplisit customer sendiri terhadap datanya sendiri (order miliknya)  bukan AI yang "memutuskan" secara otonom.

**Jalur 2  AI Administrative Action** (wajib approval Owner):
```
Instruksi Owner ke AI Action Assistant
        ↓
AI membuat draft (belum berdampak apa pun)
        ↓
Owner approve/reject
        ↓
Validasi backend
        ↓
Eksekusi (jika lolos)
```
Berlaku untuk: pembuatan/perubahan Promotion dan aksi administratif lain di luar transaksi milik customer sendiri (FR-AA-01 s.d. FR-AA-05).

**Constraint C2 (versi final, tidak ambigu)**: *AI tidak diperkenankan melakukan perubahan data operasional secara otonom di luar dua jalur di atas. Perubahan yang berasal dari transaksi customer (Jalur 1) sah dilakukan setelah konfirmasi eksplisit customer dan validasi backend, tanpa approval Owner. Perubahan administratif yang diinisiasi AI atas instruksi Owner (Jalur 2) wajib melalui approval Owner sebelum eksekusi.*

### 2.4 Order Tanpa Cart  Model Percakapan Langsung

**Keputusan desain (menggantikan konsep Cart)**: Sistem **tidak** memiliki entity Cart/CartItem tersimpan. Alur pemesanan multi-item (mis. *"saya mau laptop A satu dan mouse B dua"*) ditangani sebagai berikut:

1. AI Sales Agent mengekstrak seluruh item + quantity yang disebutkan customer sepanjang sesi percakapan (disimpan sementara sebagai bagian dari context percakapan yang sedang berjalan, bukan sebagai baris database terpisah).
2. AI menyusun **Order Summary** (daftar item, quantity, harga per item, total) dan menampilkannya ke customer untuk ditinjau.
3. Customer dapat meminta perubahan (tambah/kurangi/hapus item)  AI memperbarui Order Summary yang ditampilkan (masih belum tersimpan sebagai Order).
4. Customer menekan tombol konfirmasi eksplisit (FR-SA-05).
5. **Saat konfirmasi inilah**, sistem langsung membuat baris **Order** dan **Order Item** sekaligus (satu operasi atomik), tanpa tahap Cart perantara.

Ini menyederhanakan data model dan menghindari state Cart yang harus dikelola (expired cart, cart abandonment, dll.) yang tidak proporsional untuk scope MVP.

### 2.5 Arsitektur Multi-Channel

```
┌───────────────┐        ┌──────────────────┐
│  Web Chat      │        │   WhatsApp        │
│  Widget        │        │   (via WABA)       │
└───────┬────────┘        └─────────┬─────────┘
        │  Channel Adapter (WEB)    │  Channel Adapter (WHATSAPP)
        └─────────────┬─────────────┘
                       ▼
         ┌───────────────────────────┐
         │   AI Sales Agent (CORE)    │   ← channel-agnostic
         └─────────────┬──────────────┘
                       ▼
              Tool/Function Calling → SMS Backend
```

### 2.6 Identitas Customer Lintas Channel dan Implikasi Analitik

**[DEFAULT DIUSULKAN]** Identitas customer **tidak disatukan** lintas channel untuk MVP: Web menggunakan nama+kontak manual, WhatsApp menggunakan nomor telepon otomatis. Customer yang sama yang menghubungi lewat kedua channel akan tercatat sebagai **dua profil Customer terpisah**.

**Implikasi eksplisit untuk AI Business Analyst**: seluruh analitik berbasis customer (mis. "customer mana yang paling sering order") dihitung **per profil per channel**, bukan per individu riil. Sistem **tidak menjamin** bahwa dua profil pada channel berbeda merepresentasikan orang yang sama. Batasan ini harus dinyatakan eksplisit setiap kali AI Business Analyst menjawab pertanyaan terkait customer (lihat FR-BA-05).

### 2.7 Trade-off Scope: Dua Channel Sekaligus

Tim telah memutuskan **kedua channel (Web Chat dan WhatsApp) masuk MVP**, bukan salah satu saja. Ini keputusan sah, tapi efeknya nyata: effort mencakup Admin Panel + Backend + Database + tiga AI capability + integrasi WABA (webhook, rate limit, verifikasi bisnis) + Web Chat Widget sekaligus. Tim disadarkan bahwa ini scope yang cukup besar untuk 3 orang/3,5 bulan, dan **kandidat pertama yang dikorbankan jika waktu mepet** adalah item stretch di 3.3–3.5 (upselling, slow-moving detection, customer/channel analysis, product/inventory draft)  **bukan** salah satu channel, karena kombinasi dua channel adalah pembeda utama konsep sistem ini dari chatbot biasa.

### 2.8 Batasan (Constraints)

- **C1**: Tim 3 orang, paruh waktu, tenggat Desember 2026.
- **C2**: Lihat rumusan final di 2.3  dua jalur perubahan data, bukan satu aturan mutlak.
- **C3**: Seluruh informasi faktual dari AI harus bersumber dari query database (grounding, NFR-10).
- **C4**: Sistem tidak menangani pembayaran/kasir.
- **C5**: Tidak menggunakan vector/graph database untuk MVP.
- **C6**: Proses verifikasi bisnis WABA berada di luar kendali tim dan dapat memakan waktu tidak pasti  tim wajib memulai proses ini di awal September, dengan fallback sandbox/test number jika verifikasi belum selesai mendekati Desember.
- **C7 (baru)**: Sistem tidak memiliki entity Cart tersimpan  order multi-item ditangani lewat Order Summary sementara dalam konteks percakapan (2.4).

### 2.9 Asumsi dan Ketergantungan

- **A1**: Tersedia akses LLM API stabil.
- **A2**: Sumber data uji (mitra riil vs sintetis)  belum diputuskan (11).
- **A3**: Pembagian peran teknis 3 anggota tim  belum diputuskan (11).
- **A4**: Provider WABA (Meta Cloud API langsung vs perantara)  belum diputuskan (11).

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization

#### FR-AUTH-01  Autentikasi Owner
- **Deskripsi**: Owner harus login dengan kredensial valid sebelum mengakses Admin Panel atau endpoint internal apa pun.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Akses dashboard tanpa sesi/token valid ditolak (unauthorized).

#### FR-AUTH-02  Penolakan Akses Tanpa Kredensial Valid
- **Deskripsi**: Seluruh endpoint internal (CRUD produk, approval, AuditLog, business query) menolak permintaan tanpa sesi/token valid.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Percobaan akses tanpa token menghasilkan penolakan, tidak membocorkan data/struktur.

#### FR-AUTH-03  Interaksi Customer Tanpa Login, Multi-Channel
- **Deskripsi**: Customer dapat berinteraksi dengan AI Sales Agent tanpa login lewat Web Chat Widget (identitas: nama+kontak diketik saat order) atau WhatsApp (identitas: nomor telepon otomatis dari metadata pesan).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Customer menyelesaikan alur rekomendasi-hingga-order lewat kedua channel tanpa membuat akun; WhatsApp tidak meminta customer mengetik ulang kontaknya.

#### FR-AUTH-04  Otorisasi Approval Terbatas Owner
- **Deskripsi**: Hanya akun berperan Owner yang dapat approve/reject draft AI Action apa pun, termasuk draft buatannya sendiri (lihat Jalur 2, 2.3).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Approval oleh akun non-Owner ditolak sistem; approval oleh Owner berhasil, termasuk untuk draft buatan Owner sendiri.

---

### 3.2 Store Management System (SMS)

#### FR-SMS-01  CRUD Produk dengan Aturan Penghapusan
- **Deskripsi**: Sistem menyediakan Create, Read, Update untuk data produk (nama, kategori, spesifikasi, harga, status ACTIVE/INACTIVE) tanpa batasan. **Delete** hanya diperbolehkan jika produk belum pernah direferensikan oleh Order Item, Promotion, atau InventoryTransaction manapun; jika sudah pernah dipakai, sistem hanya mengizinkan perubahan status menjadi INACTIVE.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Produk belum pernah dipakai → delete berhasil. Produk pernah dipakai → delete ditolak, sistem menyarankan set INACTIVE.

#### FR-SMS-02  InventoryTransaction
- **Deskripsi**: Setiap pergerakan stok dicatat sebagai entri InventoryTransaction dengan struktur:
  - `type`: `IN` | `OUT` | `ADJUSTMENT`
  - `reference_type`: `MANUAL` | `ORDER` | `CANCELLATION` (penyebab transaksi, terpisah dari efeknya)
  - `movement`: `IN` | `OUT` (arah efek terhadap stok, wajib ada agar ADJUSTMENT tidak ambigu)
  - `quantity`: selalu positif; arah ditentukan `movement`
  - `reference_id`, `timestamp`
- **Formula**: `current_stock = SUM(quantity WHERE movement=IN) − SUM(quantity WHERE movement=OUT)`, berlaku sama untuk semua `type`.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Untuk setiap produk, formula di atas identik dengan current_stock yang ditampilkan; tidak ada baris ADJUSTMENT tanpa `movement` eksplisit.

#### FR-SMS-03  Indikator Low-Stock
- **Deskripsi**: Sistem menampilkan indikator untuk produk dengan current_stock ≤ ambang batas yang dapat dikonfigurasi.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Produk di bawah threshold muncul di daftar "perlu perhatian" di Admin Panel.

#### FR-SMS-04a  Profil dan Histori Pelanggan
- **Deskripsi**: Sistem menyimpan profil pelanggan (channel, identifier sesuai channel, tanggal daftar) dan histori order, ditangkap saat order pertama dibuat.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Profil dan histori order pelanggan tampil di Admin Panel, dengan indikasi channel asal.

#### FR-SMS-05  Pengelolaan Promosi
- **Deskripsi**: Sistem mendukung pembuatan dan pengelolaan promosi (product_id, discount_percentage, start_date, end_date, status DRAFT/ACTIVE/EXPIRED).
- **Business Rule 1 (lifecycle)**: **[DEFAULT DIUSULKAN]** Status efektif promosi dihitung on-read (dibandingkan current_timestamp vs end_date); status di database diperbarui EXPIRED secara asinkron via background job.
- **Business Rule 2 (no overlap)**: Untuk produk yang sama, tidak boleh ada dua promosi ACTIVE dengan periode tumpang tindih.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Promosi lewat end_date tidak pernah tampil ACTIVE ke customer. Percobaan mengaktifkan promosi kedua yang tumpang tindih ditolak.

#### FR-SMS-06  Order: Pembuatan Langsung, State Machine, dan Konkurensi
- **Deskripsi**: Order dibuat **langsung** (tanpa Cart perantara, lihat 2.4) saat customer menekan tombol konfirmasi terhadap Order Summary yang ditampilkan AI. Satu operasi atomik membuat baris Order + seluruh Order Item sekaligus, memverifikasi ulang harga & stok tepat saat commit.
- **State machine**: `DRAFT → CONFIRMED → COMPLETED`, dan `CONFIRMED → CANCELLED`. *(Status DRAFT di sini adalah status internal transien tepat sebelum commit atomik  bukan Cart yang persisten dan dapat ditinggalkan tanpa batas waktu.)*
- **Business Rule (concurrency/overselling)**: Sistem tidak boleh mengizinkan order CONFIRMED apabila quantity yang diminta melebihi current_stock pada saat commit  pengecekan dan pengurangan stok adalah satu operasi atomik.
- **Business Rule (stock effect)**: CONFIRMED → InventoryTransaction (`type=OUT`, `movement=OUT`, `reference_type=ORDER`). CONFIRMED→CANCELLED → InventoryTransaction (`type=ADJUSTMENT`, `movement=IN`, `reference_type=CANCELLATION`). Order COMPLETED tidak dapat dibatalkan lewat alur ini (retur di luar scope).
- **Prioritas**: Must
- **Kriteria Penerimaan**: *Given* stock=1, dua customer konfirmasi order quantity=1 bersamaan → tepat satu CONFIRMED. *Given* order CONFIRMED lalu CANCELLED → current_stock kembali ke nilai semula, terverifikasi lewat InventoryTransaction.

#### FR-SMS-07  Model Percakapan
- **Deskripsi**: Percakapan disimpan sebagai tiga entitas: **Conversation** (sesi: customer_id, channel, started_at, ended_at, outcome), **ConversationMessage** (tiap pesan: sender CUSTOMER/AI, content, timestamp), **Recommendation** (rekomendasi produk dalam sesi: product_id, reason, timestamp).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Satu sesi dengan banyak pesan bolak-balik dapat direkonstruksi utuh secara berurutan waktu dari ConversationMessage.

#### FR-SMS-08  Field Channel pada Conversation
- **Deskripsi**: Setiap Conversation mencatat `channel` (`WEB` atau `WHATSAPP`).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Conversation Monitoring dapat memfilter sesi berdasarkan channel.

#### FR-SMS-09  Conversation Monitoring di Admin Panel
- **Deskripsi**: Owner dapat melihat histori percakapan (ConversationMessage) beserta metadata (channel, outcome, Recommendation) lewat Admin Panel.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Owner membuka satu sesi tertentu dan melihat seluruh pesan berurutan waktu, dari channel manapun.

---

### 3.3 AI Sales Agent  SELL

#### FR-SA-01  Ekstraksi Kebutuhan Pelanggan
- **Deskripsi**: Mengekstrak kategori produk, rentang anggaran, preferensi dari input bahasa natural, channel-agnostic.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Input *"cari laptop untuk kuliah teknik, budget 8 juta"* → kategori=laptop, budget_max=8.000.000.

#### FR-SA-02  Pencarian Produk Stock-Aware
- **Deskripsi**: Mencari produk ACTIVE dan current_stock > 0, dengan re-check stok tepat sebelum response dikirim.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Tidak ada produk stok 0/INACTIVE dalam hasil, termasuk saat stok berubah di antara query dan pengiriman.

#### FR-SA-03  Perbandingan Produk
- **Deskripsi**: Membandingkan ≥2 produk berdasarkan spesifikasi dan harga aktual database.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Setiap atribut perbandingan dapat diverifikasi terhadap data produk di database.

#### FR-SA-04  Rekomendasi dengan Justifikasi
- **Deskripsi**: Memberikan rekomendasi beserta alasan yang merujuk data produk aktual.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Alasan rekomendasi tertelusur ke field data produk spesifik.

#### FR-SA-05  Order Summary dan Konfirmasi Eksplisit (Tanpa Cart)
- **Deskripsi**: AI menyusun **Order Summary** (item, quantity, harga, total) dari seluruh item yang disebutkan customer sepanjang sesi percakapan (2.4) dan menampilkannya untuk ditinjau. Customer dapat meminta perubahan sebelum konfirmasi. Order **hanya** terbentuk lewat aksi konfirmasi eksplisit: tombol UI di Web Chat, atau *interactive reply button* di WhatsApp  **bukan** interpretasi bebas atas teks seperti "oke"/"gas"/"boleh".
- **Prioritas**: Must
- **Kriteria Penerimaan**: Tidak ada Order terbentuk dari teks bebas di channel manapun; Order Summary yang ditampilkan sebelum konfirmasi selalu mencerminkan harga & stok terkini (bukan data basi).

#### FR-SA-06  Guardrail Anti-Hallucination
- **Deskripsi**: Sistem tidak boleh merekomendasikan, menyebut harga, atau menyatakan ketersediaan produk yang tidak ada di database.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Pertanyaan tentang produk fiktif → "tidak ditemukan", bukan jawaban karangan.

#### FR-SA-07  Kepatuhan Jendela 24 Jam WhatsApp
- **Deskripsi**: Untuk channel WhatsApp, sistem mematuhi aturan WABA: pesan bebas hanya dikirim dalam 24 jam sejak pesan terakhir customer. Di luar jendela ini, sistem memakai template message yang disetujui, atau menahan pengiriman.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Sistem tidak pernah mengirim pesan bebas WhatsApp di luar jendela 24 jam; otomatis dialihkan ke template atau dibatalkan dengan log jelas.

#### FR-SA-08  Upselling/Cross-selling/Down-selling *(Stretch)*
- **Prioritas**: Could

#### FR-SA-09  Konteks Histori Pembelian *(Stretch)*
- **Deskripsi**: AI Sales Agent dapat menggunakan histori pembelian pelanggan (FR-SMS-04a) sebagai konteks tambahan rekomendasi.
- **Prioritas**: Could

#### FR-SA-10  Unifikasi Identitas Lintas Channel *(Stretch)*
- **Deskripsi**: Mengenali customer yang sama meski berinteraksi lewat channel berbeda.
- **Prioritas**: Could  eksplisit di luar MVP (2.6).

---

### 3.4 AI Business Analyst  UNDERSTAND

#### FR-BA-01  Query Bahasa Natural atas Data Penjualan
- **Deskripsi**: Menjawab pertanyaan bahasa natural terkait data penjualan (produk terlaris, tren per periode).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Jawaban identik dengan hasil query agregasi langsung terhadap Order/Order Item.

#### FR-BA-02  Deteksi Risiko Stockout
- **Deskripsi**: `estimasi_hari_tersisa = current_stock ÷ rata-rata_penjualan_harian_30_hari`. **[DEFAULT DIUSULKAN]** Berisiko stockout jika `estimasi_hari_tersisa ≤ 7 hari`. **Kasus tepi**: jika rata-rata penjualan harian = 0, maka `stockout_risk = false` dan estimasi ditampilkan sebagai **N/A** (bukan infinity/error).
- **Prioritas**: Must
- **Kriteria Penerimaan**: stock=10, avg=2/hari → stockout_risk=true (5 hari ≤ 7). stock=30, avg=2/hari → false. stock=100, avg=0/hari → false, N/A.

#### FR-BA-03  Deteksi Slow-Moving Inventory *(Stretch)*
- **Deskripsi**: **[DEFAULT DIUSULKAN, jika dikerjakan]** rasio `current_stock ÷ rata-rata_penjualan_mingguan > 8 minggu` dikategorikan slow-moving, termasuk kasus rata-rata=0.
- **Prioritas**: Could

#### FR-BA-04  Traceability Jawaban ke Data Terstruktur
- **Deskripsi**: Setiap jawaban AI Business Analyst dapat ditelusuri ke query data terstruktur yang mendasarinya.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Jawaban pada sampel uji cocok dengan hasil query database langsung (lihat NFR-09).

#### FR-BA-05  Analisis Pelanggan dan Percakapan, dengan Disclaimer Lintas-Channel *(Stretch)*
- **Deskripsi**: Sistem dapat menganalisis data pelanggan dan percakapan untuk insight tambahan. **Wajib** menyertakan disclaimer bahwa analitik dihitung per profil per channel, bukan per individu riil, karena identitas customer tidak disatukan lintas channel (2.6).
- **Prioritas**: Could

#### FR-BA-06  Analisis Distribusi Channel *(Stretch)*
- **Deskripsi**: Menjawab pertanyaan seperti "berapa persen order berasal dari WhatsApp vs web?"
- **Prioritas**: Could

---

### 3.5 AI Action Assistant  ACT

#### FR-AA-01  Pembuatan Draft Promosi dari Bahasa Natural
- **Deskripsi**: Menerjemahkan instruksi bahasa natural (mis. *"buat promo 10% untuk Produk Y selama 7 hari"*) menjadi draft terstruktur (product_id, discount_percentage, start_date, end_date, status=DRAFT). Dapat dibuat oleh Owner (Jalur 2, 2.3).
- **Prioritas**: Must

#### FR-AA-02  Draft Tidak Berdampak Sebelum Disetujui
- **Deskripsi**: Draft berstatus DRAFT tidak memengaruhi harga tampil ke customer.
- **Prioritas**: Must

#### FR-AA-03  Human Approval (Owner Only, Termasuk Self-Approval)
- **Deskripsi**: Hanya akun berperan Owner yang dapat approve/reject draft apa pun, termasuk draft yang dibuatnya sendiri.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Approval oleh akun non-Owner ditolak; approval oleh Owner berhasil, termasuk draft buatan Owner sendiri.

#### FR-AA-04  AuditLog dengan Actor Type
- **Deskripsi**: Setiap peristiwa dalam siklus AI Action (draft dibuat, disetujui, ditolak, gagal validasi, dieksekusi) dicatat sebagai satu entri **AuditLog** dengan `actor_type` (`USER`|`AI_SYSTEM`), `actor_id` (nullable, null jika actor_type=AI_SYSTEM), jenis peristiwa, waktu, dan detail before/after. AuditLog bersifat append-only.
- **Prioritas**: Must
- **Kriteria Penerimaan**: Urutan log dapat menunjukkan `AI_SYSTEM created draft` → `OWNER (user X) approved draft` → `SYSTEM executed draft`, dapat dibedakan siapa/apa pelaku tiap entri. Percobaan UPDATE/DELETE terhadap baris log ditolak.

#### FR-AA-05  Validasi Sebelum Eksekusi
- **Deskripsi**: Sebelum eksekusi, sistem memvalidasi: (1) produk masih ada dan ACTIVE; (2) `start_date < end_date`; (3) `discount_percentage > 0` dan `≤ maximum_allowed_discount` (**[DEFAULT DIUSULKAN]** 50%); (4) tidak ada promosi ACTIVE lain untuk produk sama dengan periode tumpang tindih (FR-SMS-05 Business Rule 2).
- **Prioritas**: Must
- **Kriteria Penerimaan**: Draft yang melanggar salah satu dari 4 kondisi gagal validasi, berstatus `APPROVED_VALIDATION_FAILED`, tidak dieksekusi, approver diberi tahu kondisi yang gagal, tercatat di AuditLog.

#### FR-AA-06  Draft Product Update dan Inventory Action *(Stretch)*
- **Prioritas**: Could

---

## 4. Non-Functional Requirements

### 4.1 Response Time
- **NFR-01**: **[DEFAULT DIUSULKAN]** 95% respons AI Sales Agent selesai ≤ 5 detik, diukur pada single-user functional test environment, dataset ≤500 SKU, termasuk latency LLM API. *(Response-time requirement, bukan klaim scalability/load.)*

### 4.2 Reliability
- **NFR-02**: Kegagalan satu modul AI tidak menghentikan modul lain (graceful degradation), diuji dengan mematikan satu service AI secara sengaja.

### 4.3 Security
- **NFR-03**: RBAC (2.2) dan autentikasi Owner (3.1) diberlakukan pada seluruh endpoint internal, diverifikasi untuk peran Owner termasuk percobaan tanpa kredensial.
- **NFR-14**: Kredensial Owner wajib disimpan dalam bentuk yang tidak dapat dibaca/disusun kembali (satu arah, mis. di-hash), dan tidak pernah ditampilkan kembali ke pengguna.

### 4.4 Data Integrity
- **NFR-04**: 0 kejadian eksekusi AI Administrative Action tanpa approval Owner; 0 kejadian order CONFIRMED yang melebihi current_stock pada saat commit.

### 4.5 Auditability
- **NFR-05**: 100% peristiwa draft/approval/reject/eksekusi/gagal-validasi tercatat di AuditLog dengan actor_type benar, bersifat append-only.

### 4.6 Maintainability
- **NFR-06**: AI reasoning component tidak memiliki akses database langsung; seluruh read/write lewat backend tools/API yang menjalankan validasi & otorisasi yang sama dengan jalur manual. Diverifikasi lewat code review manual.

### 4.7 Usability
- **NFR-07**: **[DEFAULT DIUSULKAN]** Usability test dengan minimal 3 calon pengguna non-teknis representatif (peran Owner), target ≥80% task completion rate tanpa bantuan untuk task inti (melihat insight, approve draft).

### 4.8 Cost
- **NFR-08**: **[DEFAULT DIUSULKAN]** Biaya LLM API ≤ Rp 300.000/bulan selama masa uji, dipantau lewat dashboard billing provider.
- **NFR-13**: **[DEFAULT DIUSULKAN]** Biaya WABA ≤ Rp 200.000/bulan selama masa uji, terpisah dari NFR-08. Kedua nominal wajib direvisi setelah provider dipilih (11).

### 4.9 AI Data Accuracy
- **NFR-09**: **[DEFAULT DIUSULKAN]** ≥95% dari 100 pertanyaan benchmark AI Business Analyst (kategori: sales query, stockout query) konsisten dengan ground truth database, diverifikasi manual.

### 4.10 AI Factuality / Grounding
- **NFR-10**: **Definisi operasional hallucination**: setiap klaim AI tentang harga, stok, spesifikasi, status order, atau status promosi harus punya record database yang bersesuaian, diambil selama pemrosesan response tersebut. Target: 0 klaim faktual tanpa record pendukung pada seluruh sampel uji NFR-09.

### 4.11 Portability
- **NFR-11**: Sistem dapat dijalankan pada environment containerized standar tanpa infrastruktur khusus di luar relational database dan LLM API eksternal.

### 4.12 WhatsApp Integration Resilience
- **NFR-12**: Sistem tetap berfungsi penuh lewat Web Chat meski integrasi WhatsApp mengalami gangguan (rate limit, downtime provider, verifikasi bisnis belum selesai)  graceful degradation per channel, bukan seluruh sistem down.
- **Kriteria Penerimaan**: Simulasi kegagalan webhook WhatsApp tidak memengaruhi fungsi AI Sales Agent di Web Chat Widget.

---

## 5. External Interfaces

### 5.1 Antarmuka Pengguna
- **Web Chat Widget** (landing page, guest, tanpa login).
- **WhatsApp** (guest, identitas otomatis dari nomor telepon).
- **Admin Panel** (Owner  login wajib): Product, Inventory, Order, Promotion, Analytics, Conversation Monitoring, AI-Assisted Operation.

### 5.2 Antarmuka Perangkat Lunak

- REST API (HTTPS/JSON) internal.
- LLM API eksternal.
- WhatsApp Business API/provider  webhook untuk pesan masuk, endpoint untuk pesan/template/interactive button keluar.
- Tool/Function Calling Layer:

| Fungsi | Digunakan Oleh |
|---|---|
| `get_product(id)` | Sales Agent, Business Analyst |
| `search_products(filter)` | Sales Agent |
| `get_stock(product_id)` | Sales Agent, Business Analyst |
| `compare_products(id_list)` | Sales Agent |
| `build_order_summary(conversation_id)` | Sales Agent  menyusun Order Summary dari context percakapan, tanpa entity Cart |
| `create_order(conversation_id, confirmed_items)`  dipanggil hanya setelah konfirmasi UI eksplisit; membuat Order+Order Item dalam satu operasi atomik | Sales Agent |
| `analyze_sales(period, filter)` | Business Analyst |
| `analyze_inventory(threshold)` | Business Analyst |
| `create_promotion_draft(params)` | Action Assistant |
| `approve_draft(draft_id, actor_id)`  actor harus role Owner | Action Assistant |
| `execute_draft(draft_id)` | Action Assistant |
| `log_audit(actor_type, actor_id, event, detail)` | Seluruh modul AI |
| `receive_channel_message(channel, payload)` | Channel Adapter → Sales Agent Core |
| `send_channel_message(channel, customer_ref, content, is_template)` | Sales Agent Core → Channel Adapter |
| `check_24h_window(customer_ref)` | Channel Adapter (WhatsApp) |

---

## 6. Data Requirements

> **Cakupan bagian ini (normatif).** 6 mendefinisikan **kebutuhan data**, bukan desain basis data. Yang dinyatakan di sini adalah: (a) entitas bisnis yang harus dikenali sistem, (b) relasi antar entitas, (c) atribut yang **wajib ada** karena dituntut oleh requirement fungsional di 3, dan (d) aturan integritas yang harus dijamin sistem. Nama atribut ditulis sebagai *identitas konseptual* agar requirement dapat diuji (9–10)  **bukan** sebagai nama kolom, tipe data, indeks, maupun struktur penyimpanan. Keputusan skema fisik (tipe, panjang, indeks, normalisasi, migrasi) berada di ranah desain dan tidak diikat oleh dokumen ini.

### 6.1 Entitas Utama (Lengkap  Tanpa Cart)

| Entitas | Atribut Kunci | Relasi |
|---|---|---|
| **User** | id, name, identitas login, kredensial (disimpan satu arah/ter-hash  lihat NFR-14), role (OWNER), status | Direferensikan Approval.actor_id, AuditLog.actor_id (nullable) |
| **Product** | id, nama, kategori, spesifikasi, harga, status (ACTIVE/INACTIVE) | 1–N InventoryTransaction, 1–N Promotion, N–N Order (via Order Item) |
| **InventoryTransaction** | id, product_id, type (IN/OUT/ADJUSTMENT), movement (IN/OUT), reference_type (MANUAL/ORDER/CANCELLATION), quantity (positif), reference_id, timestamp, actor_id (nullable) | N–1 Product |
| **Customer** | id, channel (WEB/WHATSAPP), identifier (nama+kontak untuk WEB; nomor telepon untuk WHATSAPP), tanggal_daftar | 1–N Order, 1–N Conversation |
| **Promotion** | id, product_id, discount_percentage, start_date, end_date, status (DRAFT/ACTIVE/EXPIRED) | N–1 Product |
| **Order** | id, customer_id, status (DRAFT/CONFIRMED/COMPLETED/CANCELLED), created_at | N–1 Customer, 1–N Order Item  **dibuat langsung, tanpa Cart perantara** |
| **Order Item** | id, order_id, product_id, quantity, harga_produk_saat_order | N–1 Order, N–1 Product |
| **Conversation** | id, customer_id, channel (WEB/WHATSAPP), started_at, ended_at, outcome | 1–N ConversationMessage, 1–N Recommendation |
| **ConversationMessage** | id, conversation_id, sender (CUSTOMER/AI), content, timestamp | N–1 Conversation |
| **Recommendation** | id, conversation_id, product_id, reason, timestamp | N–1 Conversation, N–1 Product |
| **AI Action** | id, jenis, payload, status (DRAFT/APPROVED/REJECTED/APPROVED_VALIDATION_FAILED/EXECUTED) | terhubung ke entitas terkait (mis. Promotion) |
| **Approval** | id, ai_action_id, actor_id (User, harus role OWNER), keputusan, timestamp | N–1 AI Action, N–1 User |
| **AuditLog** *(rename dari Execution Log)* | id, ai_action_id, event (CREATED/APPROVED/REJECTED/VALIDATION_FAILED/EXECUTED), actor_type (USER/AI_SYSTEM), actor_id (nullable), timestamp, detail | N–1 AI Action, append-only |

**Catatan eksplisit**: **Tidak ada entity Cart atau CartItem.** Order multi-item dibuat langsung dari Order Summary yang disusun sementara dalam konteks percakapan (2.4), bukan dari state Cart yang tersimpan.

### 6.2 Aturan Integritas Data

- `current_stock` tidak pernah diubah langsung  hanya via agregasi InventoryTransaction.
- Delete Product hanya diizinkan jika tidak direferensikan Order Item/Promotion/InventoryTransaction manapun.
- `Order Item.harga_produk_saat_order` disimpan terpisah dari `Product.harga`.
- `AuditLog` append-only.
- `Approval.actor_id` harus User dengan role OWNER.
- Untuk produk yang sama, tidak boleh ada dua Promotion ACTIVE dengan periode tumpang tindih.
- Order CONFIRMED→CANCELLED wajib menghasilkan InventoryTransaction pengembalian.
- `Customer.channel` menentukan field wajib pada `identifier`.
- Tidak ada foreign key yang menyatukan dua Customer dari channel berbeda (2.6).

### 6.3 Catatan Arsitektural

Retrieval AI bekerja di atas data terstruktur lewat tool/function calling, bukan RAG dokumen bebas  vector/graph database tidak diperlukan untuk MVP (Constraint C5).

---

## 7. Use Cases

### UC-01: Rekomendasi Produk untuk Customer

| Field | Detail |
|---|---|
| Aktor | Customer (guest), via Web Chat Widget atau WhatsApp |
| Prasyarat | Conversation baru dibuat dengan channel yang sesuai |
| Trigger | Customer mengirim pesan kebutuhan produk |
| Alur Utama | 1. Channel Adapter menerima pesan, meneruskan ke AI Sales Agent Core.<br>2. Sistem mencatat ConversationMessage.<br>3. Ekstraksi kebutuhan (FR-SA-01).<br>4. Pencarian stock-aware (FR-SA-02).<br>5. Perbandingan (FR-SA-03).<br>6. Rekomendasi + justifikasi, dicatat sebagai Recommendation (FR-SA-04), dikirim balik lewat Channel Adapter. |
| Alur Alternatif | 3a. Tidak ada produk cocok → sistem menyatakan eksplisit, tanpa mengarang (FR-SA-06). |
| Exception Flow | **E1** LLM gagal/timeout. **E2** DB timeout. **E3** Stock berubah 0 di tengah proses → hasil difilter ulang. **E4** Produk INACTIVE di tengah sesi. **E5** Channel WhatsApp di luar jendela 24 jam tanpa template → sistem menahan pesan proaktif (FR-SA-07). **E6** Webhook WhatsApp gagal/provider down → pesan dicatat pending, Web Chat tetap normal (NFR-12). |
| Requirement Terkait | FR-SA-01–04, FR-SA-06, FR-SA-07, FR-SMS-07, FR-SMS-08 |

### UC-02: Bantuan Pembuatan Order (Tanpa Cart)

| Field | Detail |
|---|---|
| Aktor | Customer (guest) |
| Prasyarat | UC-01 selesai, customer menyebutkan produk yang diinginkan (bisa lebih dari satu) |
| Trigger | Customer menyatakan ingin memesan |
| Alur Utama | 1. AI menyusun Order Summary dari seluruh item yang disebutkan sepanjang sesi (FR-SA-05).<br>2. Sistem menampilkan Order Summary dengan harga & stok terkini.<br>3. Customer dapat meminta perubahan (tambah/kurangi/hapus item)  Order Summary diperbarui.<br>4. Customer menekan tombol **[Konfirmasi Pesanan]** (bukan interpretasi bahasa bebas).<br>5. Sistem melakukan verifikasi ulang harga & stok tepat saat konfirmasi (atomik).<br>6. Sistem membuat Order + Order Item sekaligus, status CONFIRMED, membuat InventoryTransaction OUT (FR-SMS-06). |
| Alur Alternatif | 5a. Stok tidak cukup saat verifikasi ulang → item tersebut dibatalkan dari Order Summary sebelum commit, customer diberi tahu. |
| Exception Flow | **E1** LLM gagal saat menyusun Order Summary → tidak ada order dibuat, customer diminta ulang. **E2** DB timeout saat create_order → rollback penuh, tidak ada InventoryTransaction/Order parsial. **E3** Stock=0 tepat sebelum konfirmasi → item dibatalkan otomatis. **E4** Produk INACTIVE tepat sebelum konfirmasi → sama seperti E3. **E5** Duplicate order akibat double-klik tombol konfirmasi → dicegah lewat idempotency key per sesi konfirmasi. **E6** Dua customer memesan item terakhir bersamaan → operasi atomik memastikan hanya satu berhasil CONFIRMED. **E7** Konfirmasi WhatsApp di luar jendela 24 jam tanpa template disetujui → customer diarahkan memulai ulang sesi. |
| Postkondisi | Order CONFIRMED tercatat langsung (tanpa Cart perantara); current_stock berkurang sesuai quantity; tepat satu order berhasil pada skenario konkuren. |
| Requirement Terkait | FR-SA-05, FR-SMS-02, FR-SMS-06 |

### UC-03: Query Bisnis oleh Owner

| Field | Detail |
|---|---|
| Aktor | Owner (terautentikasi) |
| Prasyarat | Owner login ke Admin Panel |
| Trigger | Owner mengajukan pertanyaan bahasa natural |
| Alur Utama | 1. Owner mengajukan pertanyaan.<br>2. Sistem menerjemahkan menjadi query terstruktur (FR-BA-01/02).<br>3. Sistem menjalankan query ke database.<br>4. Sistem menyusun jawaban dengan traceability dan penanganan kasus tepi (FR-BA-04, FR-BA-02). Jika pertanyaan menyangkut customer, sistem menyertakan disclaimer lintas-channel (FR-BA-05). |
| Alur Alternatif | 2a. Pertanyaan di luar cakupan data → sistem menyatakan keterbatasan eksplisit. |
| Exception Flow | **E1** Pertanyaan di luar cakupan → jawaban eksplisit, tidak mengarang. **E2** Query DB gagal/timeout → sistem menyatakan kegagalan, tidak menampilkan hasil parsial sebagai final. |
| Requirement Terkait | FR-BA-01, FR-BA-02, FR-BA-04, FR-BA-05, FR-AUTH-01 |

### UC-04: Pembuatan Draft Promosi dan Approval

| Field | Detail |
|---|---|
| Aktor | Owner (pembuat draft sekaligus approver, satu-satunya peran berwenang, termasuk untuk draftnya sendiri) |
| Prasyarat | Aktor login |
| Trigger | Instruksi bahasa natural untuk membuat promosi (Jalur 2, 2.3) |
| Alur Utama | 1. Owner memberi instruksi.<br>2. Sistem membuat draft DRAFT, dicatat di AuditLog sebagai `AI_SYSTEM created draft` (FR-AA-01, FR-AA-02, FR-AA-04).<br>3. Sistem menampilkan draft ke Owner untuk ditinjau (termasuk jika Owner sendiri pembuatnya).<br>4. Owner menyetujui/menolak (FR-AA-03), dicatat `OWNER (user X) approved/rejected draft`.<br>5a. Jika disetujui → validasi 4 kondisi (FR-AA-05).<br>6a. Jika valid → eksekusi, Promotion menjadi ACTIVE, dicatat `SYSTEM executed draft`.<br>5b. Jika ditolak → REJECTED, tidak ada perubahan data, tercatat di AuditLog. |
| Exception Flow | **E1** Validasi gagal setelah approval → `APPROVED_VALIDATION_FAILED`, tidak dieksekusi, approver diberi tahu kondisi yang gagal. **E2** Overlapping promotion → ditolak validasi (bagian formal FR-AA-05/FR-SMS-05). **E3** Owner menolak → REJECTED, alasan opsional dicatat. |
| Postkondisi | Promosi ACTIVE hanya jika seluruh tahap berhasil; seluruh tahap tercatat lengkap di AuditLog dengan actor_type benar. |
| Requirement Terkait | FR-AA-01–05, FR-SMS-05, FR-AUTH-01, FR-AUTH-04 |

### UC-05: Conversation Monitoring

| Field | Detail |
|---|---|
| Aktor | Owner |
| Prasyarat | Login ke Admin Panel |
| Trigger | Owner membuka menu Conversation Monitoring |
| Alur Utama | 1. Sistem menampilkan daftar Conversation, dapat difilter per channel.<br>2. Owner memilih satu sesi.<br>3. Sistem menampilkan seluruh ConversationMessage berurutan waktu beserta Recommendation dalam sesi tersebut. |
| Requirement Terkait | FR-SMS-08, FR-SMS-09 |

---

## 8. State Machines

### 8.1 Order
```
(internal transient) ──(confirm, atomik: cek stok)──▶ CONFIRMED ──(complete)──▶ COMPLETED
                                                            │
                                                       (cancel)
                                                            ▼
                                                       CANCELLED ──▶ InventoryTransaction(ADJUSTMENT, movement=IN, reference_type=CANCELLATION)
```
Tidak ada status Cart/tersimpan sebelum CONFIRMED  Order Summary adalah representasi sementara, bukan status database.

### 8.2 Promotion
```
DRAFT ──(approve Owner + validasi FR-AA-05 lolos)──▶ ACTIVE ──(current_timestamp > end_date, on-read + job async)──▶ EXPIRED
DRAFT ──(reject Owner)──▶ REJECTED
```

### 8.3 AI Action
```
DRAFT ──(Owner approve)──▶ APPROVED ──(validasi FR-AA-05)──┬─▶ EXECUTED
                                                              └─▶ APPROVED_VALIDATION_FAILED
DRAFT ──(Owner reject)──▶ REJECTED
```

### 8.4 WhatsApp Message Window
```
Customer mengirim pesan ──▶ Jendela 24 jam terbuka
        │
        ▼
Bisnis dapat kirim pesan bebas selama < 24 jam
        │
   (24 jam terlewati tanpa pesan baru)
        ▼
Jendela tertutup ──▶ Bisnis hanya dapat kirim Template Message
```

---

## 9. Traceability

### 9.1 Functional Requirements → Use Case → Test Case

| Requirement | Use Case | Test Case | Expected Result |
|---|---|---|---|
| FR-AUTH-01 |  | TC-AUTH-01 | Akses dashboard tanpa login ditolak |
| FR-AUTH-02 |  | TC-AUTH-02 | Endpoint internal tanpa token ditolak |
| FR-AUTH-03 | UC-01, UC-02 | TC-AUTH-03 | Customer selesai order lewat web maupun WhatsApp tanpa akun |
| FR-AUTH-04 | UC-04 | TC-AUTH-04 | Approval akun non-Owner ditolak; Owner approve berhasil (termasuk draft sendiri) |
| FR-SMS-01 |  | TC-SMS-01 | Delete produk terpakai ditolak; belum terpakai berhasil |
| FR-SMS-02 |  | TC-SMS-02 | SUM(quantity, movement) = current_stock |
| FR-SMS-03 |  | TC-SMS-03 | Produk di bawah threshold muncul di peringatan |
| FR-SMS-04a | UC-02 | TC-SMS-04 | Profil & histori order tersimpan, channel tercatat |
| FR-SMS-05 | UC-04 | TC-SMS-05a | Promosi lewat end_date tidak tampil ACTIVE |
| FR-SMS-05 | UC-04 | TC-SMS-05b | Dua promosi tumpang tindih ditolak |
| FR-SMS-06 | UC-02 | TC-SMS-06a | CONFIRMED → stok berkurang |
| FR-SMS-06 | UC-02 | TC-SMS-06b | CONFIRMED→CANCELLED → stok kembali |
| FR-SMS-06 | UC-02 | TC-SMS-06c | Dua order konkuren stok=1 → tepat satu CONFIRMED |
| FR-SMS-07 | UC-01 | TC-SMS-07 | Sesi multi-pesan direkonstruksi utuh |
| FR-SMS-08 | UC-01, UC-05 | TC-SMS-08 | Conversation tercatat dengan channel benar |
| FR-SMS-09 | UC-05 | TC-SMS-09 | Owner membaca sesi percakapan lengkap |
| FR-SA-01 | UC-01 | TC-SA-01 | Ekstraksi kategori & budget sesuai input |
| FR-SA-02 | UC-01 | TC-SA-02 | Produk stok 0/inactive tidak muncul |
| FR-SA-03 | UC-01 | TC-SA-03 | Perbandingan sesuai data DB |
| FR-SA-04 | UC-01 | TC-SA-04 | Alasan rekomendasi tertelusur ke field produk |
| FR-SA-05 | UC-02 | TC-SA-05 | Order hanya dari tombol konfirmasi eksplisit, di kedua channel |
| FR-SA-06 | UC-01 | TC-SA-06 | Produk fiktif → "tidak ditemukan" |
| FR-SA-07 | UC-01, UC-02 | TC-SA-07 | Tidak ada pesan bebas WhatsApp di luar jendela 24 jam |
| FR-BA-01 | UC-03 | TC-BA-01 | Jawaban produk terlaris = hasil query manual |
| FR-BA-02 | UC-03 | TC-BA-02a/b | stock=10,avg=2→true; stock=100,avg=0→false,N/A |
| FR-BA-04 | UC-03 | TC-BA-04 | 100 pertanyaan benchmark dicocokkan manual |
| FR-BA-05 | UC-03 | TC-BA-05 | Disclaimer lintas-channel muncul pada jawaban terkait customer |
| FR-AA-01 | UC-04 | TC-AA-01 | Instruksi promosi → draft lengkap, status DRAFT |
| FR-AA-02 | UC-04 | TC-AA-02 | Harga tampil tidak berubah selama DRAFT |
| FR-AA-03 | UC-04 | TC-AA-03 | Hanya Owner bisa approve, termasuk draft sendiri |
| FR-AA-04 | UC-04 | TC-AA-04 | AuditLog mencatat actor_type benar tiap tahap |
| FR-AA-05 | UC-04 | TC-AA-05a/b/c | Produk terhapus/discount>50%/overlap → validasi gagal |

### 9.2 Non-Functional Requirements → Test Case

| NFR | Test Case | Expected Result |
|---|---|---|
| NFR-01 | NFR-TC-01 | P95 ≤5s, single-user, ≤500 SKU |
| NFR-02 | NFR-TC-02 | Modul AI lain tetap jalan saat satu dimatikan |
| NFR-03 | NFR-TC-03 | Akses tanpa hak ditolak di seluruh endpoint |
| NFR-04 | NFR-TC-04 | 0 eksekusi tanpa approval; 0 order melebihi stok |
| NFR-05 | NFR-TC-05 | 100% peristiwa tercatat; UPDATE/DELETE log ditolak |
| NFR-06 | NFR-TC-06 | Code review: tidak ada query DB langsung dari AI |
| NFR-07 | NFR-TC-07 | ≥3 user uji, ≥80% completion |
| NFR-08 | NFR-TC-08 | Biaya LLM ≤ Rp300.000/bulan |
| NFR-09 | NFR-TC-09 | ≥95/100 benchmark konsisten ground truth |
| NFR-10 | NFR-TC-10 | 0 klaim tanpa record pendukung |
| NFR-11 | NFR-TC-11 | Berjalan dari container fresh, dependency minimal |
| NFR-12 | NFR-TC-12 | Web Chat tetap jalan saat webhook WA disimulasikan gagal |
| NFR-13 | NFR-TC-13 | Biaya WABA ≤ Rp200.000/bulan |
| NFR-14 | NFR-TC-14 | Kredensial tidak tersimpan dalam bentuk terbaca dan tidak pernah ditampilkan kembali |

---

## 10. Acceptance Criteria

1. Seluruh FR **Must** pada 3 lulus test case terkait di 9.1.
2. Seluruh NFR pada 4 lulus test case terkait di 9.2.
3. Tidak ada kontradiksi antara constraint (2), requirement (3), dan data model (6)  diverifikasi ulang sebelum freeze.
4. Seluruh exception flow pada 7 memiliki penanganan terverifikasi.
5. State machine 8 diimplementasikan persis sesuai diagram.
6. Customer dapat menyelesaikan alur rekomendasi-hingga-order lewat kedua channel secara independen, tanpa entity Cart.
7. Kegagalan satu channel tidak memengaruhi channel lain (NFR-12).

---

## 11. Open / Ratification Items

| Item | Default Diusulkan | Status |
|---|---|---|
| Threshold stockout (FR-BA-02) | ≤7 hari | Menunggu ratifikasi |
| Threshold slow-moving (FR-BA-03, stretch) | rasio >8 minggu | Menunggu ratifikasi |
| Maximum allowed discount (FR-AA-05) | 50% | Menunggu ratifikasi |
| NFR-01 response time | P95 ≤5 detik, single-user | Menunggu baseline pengukuran |
| NFR-08 anggaran LLM API | Rp 300.000/bulan | Menunggu konfirmasi provider |
| NFR-13 anggaran WABA | Rp 200.000/bulan | Menunggu konfirmasi provider |
| NFR-09 benchmark set | 100 pertanyaan (sales+stockout) | Belum disusun konkret |
| NFR-07 usability | ≥3 user, ≥80% completion | Menunggu pelaksanaan test |
| Provider WABA | Meta Cloud API vs Twilio/perantara | **Belum diputuskan**  prioritas tinggi karena verifikasi bisnis makan waktu (C6) |
| Sumber data uji | Mitra riil vs sintetis | **Belum ada usulan**  di luar wewenang dokumen ini |
| Pembagian peran teknis 3 anggota tim |  | **Belum ada usulan**  di luar wewenang dokumen ini |
| Vector DB untuk semantic search | Tidak digunakan di MVP | Menunggu ratifikasi (default: tidak perlu) |
| Fallback verifikasi WABA belum selesai | Sandbox/test number | Menunggu ratifikasi |

