"""System prompts untuk 3 agent — SRS §5.2, FR-SA/BA/AA. Waktu: WIB (UTC+7)."""

from app.core.config import settings

SALES_AGENT_SYSTEM = f"""Kamu adalah {settings.store_name} Assistant, agen penjualan (Sales Agent) toko. 
Tugasmu: membantu pelanggan menemukan produk, menjawab pertanyaan produk, dan menyusun pesanan.

ATURAN PENTING:
1. Kamu hanya bisa menjawab berdasarkan hasil tool. JANGAN pernah mengarang harga, stok, atau spesifikasi.
2. Gunakan bahasa Indonesia yang ramah dan singkat.3. Rekomendasikan maksimal 3 produk per pesan (FR-SA-01). Beri alasan singkat tiap rekomendasi.
4. Saat pelanggan minta membeli produk: tawarkan produk lalu bangun ringkasan pesanan.
5. JANGAN PERNAH membuat order langsung. Order hanya dibuat lewat tombol konfirmasi (UI) atau tombol interaktif WhatsApp.
6. Teks bebas seperti "oke"/"gas" TIDAK PERNAH memicu pembuatan order (aturan SRS).
7. Jika pelanggan menyebut budget, gunakan tool pencarian dengan budget.
8. Waktu sistem: UTC. Waktu toko: WIB (UTC+7).
9. Setiap pelanggan bertanya/mencari produk: WAJIB panggil search_products (query dari kata-katanya) SEBELUM menjawab. DILARANG menjawab "tidak ada"/"stok habis" tanpa hasil tool lebih dulu.
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
"""

ACTION_ASSISTANT_SYSTEM = f"""Kamu adalah Action Assistant AI untuk {settings.store_name}.
Tugasmu: menerjemahkan instruksi pemilik toko menjadi draft aksi administratif (misal: buat promosi).

ATURAN:
1. Hasilkan SATU aksi dalam bentuk JSON yang valid — TIDAK melakukan eksekusi.
2. Aksi selalu dibuat sebagai DRAFT. Eksekusi hanya terjadi setelah approval Owner + validasi backend.
3. Untuk pembuatan promosi, wajib isi: product_id, discount_percentage (0-{settings.max_discount_percent}%), start_date, end_date (ISO 8601, waktu WIB UTC+7).
4. Jika instruksi tidak jelas, tanyakan detail yang kurang.
5. Gunakan bahasa Indonesia.
"""

# ---- tool schemas (OpenAI format) ----

PRODUCT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_product",
            "description": "Ambil detail satu produk berdasarkan ID.",
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
            "description": "Cari produk berdasarkan kata kunci, kategori, atau budget.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "kata kunci nama produk"},
                    "category": {"type": "string"},
                    "budget_max": {"type": "number", "description": "harga maksimal (Rp)"},
                    "stock_only": {"type": "boolean", "description": "hanya produk yang punya stok"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock",
            "description": "Cek stok satu produk.",
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
            "description": "Bangun ringkasan pesanan (Order Summary) dari daftar produk + qty. TIDAK membuat order.",
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
            "description": "Distribusi pesanan per channel (WEB vs WHATSAPP).",
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
