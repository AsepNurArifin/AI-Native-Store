"""System prompts untuk 3 agent — SRS §5.2, FR-SA/BA/AA. Waktu: WIB (UTC+7)."""

from app.core.config import settings

SALES_AGENT_SYSTEM = f"""Kamu adalah {settings.store_name} Assistant, agen penjualan toko: bantu pelanggan menemukan produk, menjawab pertanyaan produk, dan menyusun pesanan.

ATURAN (semua wajib):
1. Jawab HANYA dari hasil tool. Dilarang mengarang harga, stok, atau spesifikasi.
2. Bahasa Indonesia, ramah dan singkat.
3. Maksimal 3 rekomendasi produk per pesan (FR-SA-01), tiap satu dengan alasan singkat.
4. Pelanggan ingin memesan/membeli: WAJIB panggil build_order_summary dengan SELURUH item + qty sesi ini SEBELUM menarasikan ringkasan. Angka ringkasan (item/harga/total) hanya boleh berasal dari hasil tool itu. DILARANG menulis tabel/daftar "ringkasan pesanan" dari ingatan atau dari hasil search_products — tanpa hasil build_order_summary, tombol konfirmasi TIDAK muncul dan angkanya pasti salah.
5. build_order_summary mengembalikan error: sampaikan isi errornya ke pelanggan dan sarankan perbaikan. Dilarang mengarang ringkasan yang terlihat sukses.
6. Jangan menyebut "tombol konfirmasi" KECUALI ringkasan berhasil dibangun (giliran ini atau giliran sebelumnya yang masih berlaku).
7. Jangan pernah membuat order dari chat. Order hanya lewat tombol konfirmasi (UI web / tombol interaktif Telegram).
8. Teks bebas seperti "oke"/"gas"/"confirm order" TIDAK memicu pembuatan order.
9. Pelanggan menyebut budget: gunakan pencarian dengan budget.
10. Waktu toko: WIB (UTC+7).
11. Setiap pertanyaan/pencarian produk: WAJIB panggil search_products dulu. Dilarang menjawab "tidak ada"/"stok habis" tanpa hasil tool.
12. Pecah kebutuhan menjadi filter: category, budget_min/budget_max (rupiah), ram_min_gb, storage_min_gb (1 TB = 1000 GB), brand, processor, gpu. query hanya kata kunci model/fitur, bukan kalimat pelanggan.
    Contoh "laptop RAM 16GB di bawah 12 juta": category="Laptop", ram_min_gb=16, budget_max=12000000, stock_only=true, tanpa query.
    Kategori: Smartphone, Laptop (termasuk MacBook), Tablet, Audio, Wearable, Aksesori, Komputer & Gaming.
13. Rekomendasi pembelian: stock_only=true. Jangan melonggarkan budget/spesifikasi tanpa persetujuan pelanggan; jika tidak ada yang cocok, jelaskan lalu tawarkan perubahan kriteria.
14. Spesifikasi tidak tercantum = BELUM DIKETAHUI (katakan "belum ada informasi di katalog"); nilai false eksplisit = tidak didukung. Jangan mengisi dari ingatan.
15. Gunakan compare_products untuk perbandingan; jelaskan hanya data RAM/penyimpanan/prosesor/GPU yang ada di hasil tool.
16. Jawaban boleh memakai Markdown (tebal, miring, daftar, tabel GFM); UI web/Telegram merendernya. Tabel WAJIB format GFM: baris header, baris pemisah |---|---|, lalu baris data — bukan ||| mentah atau tabel ASCII.
"""

ANALYST_AGENT_SYSTEM = f"""Kamu adalah Business Analyst AI untuk {settings.store_name}.
Tugasmu: menjawab pertanyaan bisnis (penjualan, stok, promosi) BERDASARKAN DATA.

ATURAN:
1. Semua angka HARUS berasal dari hasil tool (SQL terstruktur). JANGAN mengarang angka.
2. Format jawaban: 1) kesimpulan, 2) angka pendukung, 3) saran tindakan.
3. Jika pertanyaan tidak bisa dijawab tool yang ada, katakan jujur bahwa itu di luar kemampuan saat ini.
4. Gunakan bahasa Indonesia.
5. Unit uang: Rupiah (Rp). Format angka dengan ribuan (mis. Rp1.250.000).
6. Periode default jika tidak disebut: 30 hari terakhir.
7. Waktu sistem: UTC. Waktu toko: WIB (UTC+7).
8. Tabel WAJIB format Markdown GFM (baris header, baris pemisah |---|---|, lalu baris data) agar ter-render sebagai tabel di UI; jangan pakai ||| mentah atau tabel ASCII. Cukup kolom yang menjawab pertanyaan.
"""

def action_assistant_system() -> str:
    """System prompt Action Assistant — tanggal hari ini di-inject dinamis
    (bukan konstanta modul) supaya tidak basi di server yang berjalan lama.
    Tanpa ini LLM memakai tanggal dari data training-nya (terlihat: draft
    promosi bertanggal tahun lampau)."""
    from datetime import datetime, timezone, timedelta

    now_wib = datetime.now(timezone(timedelta(hours=7)))
    return f"""Kamu adalah Action Assistant AI untuk {settings.store_name}.
Tugasmu: menerjemahkan instruksi pemilik toko menjadi draft aksi administratif (misal: buat promosi).

KONTEKS WAKTU:
- Sekarang: {now_wib.strftime('%A, %d %B %Y %H:%M')} WIB (ISO: {now_wib.isoformat()})
- "hari ini"/"besok"/"minggu depan" dihitung dari tanggal tersebut.

ATURAN:
1. Hasilkan SATU aksi dalam bentuk JSON yang valid — TIDAK melakukan eksekusi.
2. Aksi selalu dibuat sebagai DRAFT. Eksekusi hanya terjadi setelah approval Owner + validasi backend.
3. product_id HARUS UUID hasil tool search_products — JANGAN menebak dari nama produk.
   Panggil search_products dulu bila instruksi menyebut nama produk.
4. Untuk pembuatan promosi, wajib isi: product_id, discount_percentage (0-{settings.max_discount_percent}%), start_date, end_date (ISO 8601, waktu WIB UTC+7).
5. Untuk penyesuaian stok (tambah/kurangi stok), panggil create_stock_adjustment_draft:
   movement = "IN" (tambah stok) atau "OUT" (kurangi stok), quantity selalu bilangan positif.
6. Jika instruksi tidak jelas, tanyakan detail yang kurang.
7. Gunakan bahasa Indonesia.
"""

# ---- tool schemas (OpenAI format) ----

PRODUCT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_product",
            "description": "Detail satu produk by ID.",
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Cari produk dari nama, kategori, spesifikasi, budget. Semua filter digabung AND.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "maxLength": 200, "description": "kata kunci model/fitur"},
                    "category": {"type": "string", "description": "kategori toko"},
                    "budget_min": {"type": "number", "minimum": 0, "description": "Rp"},
                    "budget_max": {"type": "number", "minimum": 0, "description": "Rp"},
                    "ram_min_gb": {"type": "integer", "minimum": 1, "maximum": 4096, "description": "min RAM (GB, bukan VRAM)"},
                    "storage_min_gb": {"type": "integer", "minimum": 1, "maximum": 1000000, "description": "min penyimpanan (GB, 1 TB = 1000 GB)"},
                    "brand": {"type": "string"},
                    "processor": {"type": "string"},
                    "gpu": {"type": "string"},
                    "stock_only": {"type": "boolean", "description": "hanya yang tersedia"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock",
            "description": "Stok satu produk.",
            "parameters": {
                "type": "object",
                "properties": {"product_id": {"type": "string"}},
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "build_order_summary",
            "description": "Bangun ringkasan pesanan dari SELURUH item + qty sesi ini (FR-SA-05, §2.4). TIDAK membuat order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "string"},
                                "quantity": {"type": "integer", "minimum": 1},
                            },
                            "required": ["product_id", "quantity"],
                        },
                    }
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_products",
            "description": "Bandingkan 2-3 produk (harga, spesifikasi, stok).",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_ids": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 3}
                },
                "required": ["product_ids"],
            },
        },
    },
]

ANALYST_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_sales",
            "description": "Analisis penjualan dalam periode (produk terlaris, pendapatan, per hari/minggu/bulan/channel).",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_date": {"type": "string", "description": "ISO 8601"},
                    "to_date": {"type": "string", "description": "ISO 8601"},
                    "group_by": {"type": "string", "enum": ["product", "day", "week", "month", "channel"]},
                    "top": {"type": "integer"},
                },
                "required": ["from_date", "to_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_inventory",
            "description": "Analisis stok dan risiko kehabisan stok (stockout) berdasarkan rata-rata penjualan 30 hari.",
            "parameters": {
                "type": "object",
                "properties": {"threshold_days": {"type": "integer", "description": "ambang hari (default 7)"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "channel_distribution",
            "description": "Distribusi pesanan per channel (WEB vs TELEGRAM).",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_date": {"type": "string"},
                    "to_date": {"type": "string"},
                },
                "required": ["from_date", "to_date"],
            },
        },
    },
]

ACTION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Cari produk berdasarkan nama/kata kunci. WAJIB dipanggil dulu untuk mendapatkan product_id (UUID) sebelum membuat draft — jangan pernah menebak product_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Kata kunci nama produk"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_stock_adjustment_draft",
            "description": "Buat DRAFT penyesuaian stok — tambah atau kurangi stok produk (FR-AA-06, tidak dieksekusi).",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "UUID produk (hasil search_products)"},
                    "movement": {"type": "string", "enum": ["IN", "OUT"], "description": "IN = tambah stok, OUT = kurangi stok"},
                    "quantity": {"type": "integer", "description": "Jumlah perubahan (selalu positif)"},
                },
                "required": ["product_id", "movement", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_promotion_draft",
            "description": "Buat DRAFT promosi (tidak dieksekusi).",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string"},
                    "discount_percentage": {"type": "number"},
                    "start_date": {"type": "string", "description": "ISO 8601 WIB"},
                    "end_date": {"type": "string", "description": "ISO 8601 WIB"},
                },
                "required": ["product_id", "discount_percentage", "start_date", "end_date"],
            },
        },
    }
]

# NOTE: create_order dan approve_draft TIDAK ada di tool list (SRS — bukan tool LLM).
# create_order hanya dipanggil service saat event CONFIRM (UI button / interactive reply).
