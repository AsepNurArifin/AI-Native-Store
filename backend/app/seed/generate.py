"""Seed data demo "Toko Bu Ratna" (elektronik) — Fase 5 PLAN_PRODUCT_LAUNCH.md.

Persona: pemilik toko elektronik lokal, non-IT. Katalog 98 SKU realistis
(harga simulasi, bukan penawaran pasar terkini), spesifikasi per kategori (dipakai Sales Agent
saat rekomendasi via field JSONB `specification`), riwayat inventory 30 hari,
pelanggan contoh per channel (WA/WEB/Telegram), order contoh, dan satu promo aktif.

Konfigurasi akun Owner via .env:
  SEED_OWNER_EMAIL (default owner@store.demo)
  SEED_DEFAULT_PASSWORD (default ChangeMe123!)
  SEED_SKU_COUNT (default 100 — dibatasi ukuran katalog 98)

Data deterministik (random.seed) agar reproducible (NFR-07/NFR-09).
Dipanggil otomatis oleh init_db saat DB kosong, atau manual:
  uv run python -m app.seed.generate
"""

import random
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    Customer,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
    Promotion,
    User,
)

SEED = 42

# (nama, harga simulasi, spesifikasi) — bukan harga pasar terverifikasi.
# Koreksi bersumber dan keterbatasan audit: docs/CATALOG_DATA_QUALITY.md.
# Spesifikasi mengalir ke LLM via JSONB; jangan tambahkan klaim tanpa sumber.
CATALOG: dict[str, list[tuple[str, int, dict]]] = {
    "Smartphone": [
        ("iPhone 15 Pro Max 256GB", 22_999_000, {"brand": "Apple", "chipset": "Apple A17 Pro", "ram_gb": 8, "storage_gb": 256, "layar": '6.7" Super Retina XDR 120Hz', "kamera": "48MP + 12MP ultrawide + 12MP tele 5x", "baterai_mah": 4441, "os": "iOS 17"}),
        ("iPhone 15 Pro 128GB", 17_499_000, {"brand": "Apple", "chipset": "Apple A17 Pro", "ram_gb": 8, "storage_gb": 128, "layar": '6.1" Super Retina XDR 120Hz', "kamera": "48MP + 12MP ultrawide + 12MP tele 3x", "baterai_mah": 3274, "os": "iOS 17"}),
        ("iPhone 15 128GB", 11_499_000, {"brand": "Apple", "chipset": "Apple A16 Bionic", "ram_gb": 6, "storage_gb": 128, "layar": '6.1" Super Retina XDR 60Hz', "kamera": "48MP + 12MP ultrawide", "baterai_mah": 3349, "os": "iOS 17"}),
        ("iPhone 14 128GB", 9_299_000, {"brand": "Apple", "chipset": "Apple A15 Bionic", "ram_gb": 6, "storage_gb": 128, "layar": '6.1" Super Retina XDR 60Hz', "kamera": "12MP + 12MP ultrawide", "baterai_mah": 3279, "os": "iOS 16"}),
        ("iPhone 13 128GB", 7_999_000, {"brand": "Apple", "chipset": "Apple A15 Bionic", "ram_gb": 4, "storage_gb": 128, "layar": '6.1" Super Retina XDR 60Hz', "kamera": "12MP + 12MP ultrawide", "baterai_mah": 3240, "os": "iOS 15"}),
        ("Samsung Galaxy S24 Ultra 512GB", 21_999_000, {"brand": "Samsung", "chipset": "Snapdragon 8 Gen 3", "ram_gb": 12, "storage_gb": 512, "layar": '6.8" QHD+ AMOLED 120Hz', "kamera": "200MP + 50MP tele 5x + 10MP tele 3x + 12MP ultrawide", "baterai_mah": 5000, "os": "Android 14 One UI 6"}),
        ("Samsung Galaxy S24 256GB", 14_499_000, {"brand": "Samsung", "chipset": "Exynos 2400", "ram_gb": 8, "storage_gb": 256, "layar": '6.2" FHD+ AMOLED 120Hz', "kamera": "50MP + 10MP tele 3x + 12MP ultrawide", "baterai_mah": 4000, "os": "Android 14 One UI 6"}),
        ("Samsung Galaxy A55 256GB", 6_199_000, {"brand": "Samsung", "chipset": "Exynos 1480", "ram_gb": 8, "storage_gb": 256, "layar": '6.6" FHD+ Super AMOLED 120Hz', "kamera": "50MP OIS + 12MP ultrawide + 5MP macro", "baterai_mah": 5000, "os": "Android 14 One UI 6"}),
        ("Samsung Galaxy A15 128GB", 2_399_000, {"brand": "Samsung", "chipset": "Helio G99", "ram_gb": 6, "storage_gb": 128, "layar": '6.5" FHD+ Super AMOLED 90Hz', "kamera": "50MP + 5MP ultrawide + 2MP macro", "baterai_mah": 5000, "os": "Android 14 One UI 6"}),
        ("Xiaomi 14T Pro 512GB", 8_999_000, {"brand": "Xiaomi", "chipset": "Dimensity 9300+", "ram_gb": 12, "storage_gb": 512, "layar": '6.67" 1.5K AMOLED 144Hz', "kamera": "50MP Leica + 50MP tele 2.6x + 12MP ultrawide", "baterai_mah": 5000, "os": "Android 14 HyperOS"}),
        ("Redmi Note 13 Pro 256GB", 3_999_000, {"brand": "Xiaomi", "chipset": "Snapdragon 7s Gen 2", "ram_gb": 8, "storage_gb": 256, "layar": '6.67" 1.5K AMOLED 120Hz', "kamera": "200MP OIS + 8MP ultrawide + 2MP macro", "baterai_mah": 5100, "os": "Android 13 MIUI 14"}),
        ("Redmi Note 13 128GB", 2_199_000, {"brand": "Xiaomi", "chipset": "Snapdragon 685", "ram_gb": 8, "storage_gb": 128, "layar": '6.67" FHD+ AMOLED 120Hz', "kamera": "108MP + 8MP ultrawide + 2MP macro", "baterai_mah": 5000, "os": "Android 13 MIUI 14"}),
        ("Poco X6 Pro 256GB", 3_699_000, {"brand": "Xiaomi", "chipset": "Dimensity 8300 Ultra", "ram_gb": 8, "storage_gb": 256, "layar": '6.67" 1.5K AMOLED 120Hz', "kamera": "64MP OIS + 8MP ultrawide + 2MP macro", "baterai_mah": 5000, "os": "Android 14 HyperOS"}),
        ("Poco C65 128GB", 1_299_000, {"brand": "Xiaomi", "chipset": "Helio G85", "ram_gb": 6, "storage_gb": 128, "layar": '6.74" HD+ 90Hz', "kamera": "50MP + 2MP macro", "baterai_mah": 5000, "os": "Android 13 MIUI 14"}),
        ("Vivo V30 256GB", 5_299_000, {"brand": "Vivo", "chipset": "Snapdragon 7 Gen 3", "ram_gb": 8, "storage_gb": 256, "layar": '6.78" 1.5K AMOLED 120Hz', "kamera": "50MP OIS + 50MP ultrawide", "baterai_mah": 5000, "os": "Android 14 Funtouch 14"}),
        ("Vivo Y100 256GB", 3_199_000, {"brand": "Vivo", "chipset": "Snapdragon 695", "ram_gb": 8, "storage_gb": 256, "layar": '6.38" FHD+ AMOLED 120Hz', "kamera": "64MP OIS + 2MP bokeh", "baterai_mah": 4500, "os": "Android 13 Funtouch 13"}),
        ("Oppo Reno 11F 256GB", 4_499_000, {"brand": "Oppo", "chipset": "Dimensity 7050", "ram_gb": 8, "storage_gb": 256, "layar": '6.7" FHD+ AMOLED 120Hz', "kamera": "64MP + 8MP ultrawide + 2MP macro", "baterai_mah": 5000, "os": "Android 14 ColorOS 14"}),
        ("Infinix Note 40 256GB", 2_499_000, {"brand": "Infinix", "chipset": "Helio G99 Ultimate", "ram_gb": 8, "storage_gb": 256, "layar": '6.78" FHD+ AMOLED 120Hz', "kamera": "108MP OIS + 2MP macro", "baterai_mah": 5000, "os": "Android 14 XOS 14"}),
    ],
    "Laptop": [
        ("MacBook Air M2 13 inci 8/256GB", 14_999_000, {"brand": "Apple", "prosesor": "Apple M2 8-core", "ram_gb": 8, "storage": "SSD 256GB", "gpu": "Integrated 8-core", "layar": '13.6" Liquid Retina 2560x1664', "os": "macOS", "berat_kg": 1.24}),
        ("MacBook Air M3 13 inci 8/256GB", 16_999_000, {"brand": "Apple", "prosesor": "Apple M3 8-core", "ram_gb": 8, "storage": "SSD 256GB", "gpu": "Integrated 8-core", "layar": '13.6" Liquid Retina 2560x1664', "os": "macOS", "berat_kg": 1.24}),
        ("MacBook Air M3 15 inci 8/256GB", 19_499_000, {"brand": "Apple", "prosesor": "Apple M3 8-core", "ram_gb": 8, "storage": "SSD 256GB", "gpu": "Integrated 10-core", "layar": '15.3" Liquid Retina 2880x1864', "os": "macOS", "berat_kg": 1.51}),
        ("MacBook Pro M3 14 inci 8/512GB", 26_999_000, {"brand": "Apple", "prosesor": "Apple M3 8-core", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Integrated 10-core", "layar": '14.2" Liquid Retina XDR 120Hz', "os": "macOS", "berat_kg": 1.55}),
        ("ASUS Vivobook 14 A1404ZA i3/8/512GB", 6_999_000, {"brand": "ASUS", "prosesor": "Intel Core i3-1215U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel UHD Graphics", "layar": '14" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.4}),
        ("ASUS Vivobook 15 X1504ZA i5/8/512GB", 8_499_000, {"brand": "ASUS", "prosesor": "Intel Core i5-1235U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel Iris Xe", "layar": '15.6" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.7}),
        ("ASUS ROG Zephyrus G14 RTX 4060 16/1TB", 24_999_000, {"brand": "ASUS", "prosesor": "AMD Ryzen 9 8945HS", "ram_gb": 16, "storage": "SSD 1TB", "gpu": "NVIDIA RTX 4060 8GB", "layar": '14" QHD+ 165Hz', "os": "Windows 11", "berat_kg": 1.5}),
        ("Lenovo IdeaPad Slim 3 Ryzen 5/8/512GB", 7_299_000, {"brand": "Lenovo", "prosesor": "AMD Ryzen 5 7520U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "AMD Radeon 610M", "layar": '15.6" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.62}),
        ("Lenovo IdeaPad Slim 5 i5/16/512GB", 10_499_000, {"brand": "Lenovo", "prosesor": "Intel Core i5-13500H", "ram_gb": 16, "storage": "SSD 512GB", "gpu": "Intel Iris Xe", "layar": '14" WUXGA 1920x1200', "os": "Windows 11", "berat_kg": 1.46}),
        ("Lenovo Legion 5 RTX 4060 16/512GB", 18_999_000, {"brand": "Lenovo", "prosesor": "AMD Ryzen 7 7840HS", "ram_gb": 16, "storage": "SSD 512GB", "gpu": "NVIDIA RTX 4060 8GB", "layar": '15.6" WQHD 165Hz', "os": "Windows 11", "berat_kg": 2.4}),
        ("Acer Aspire 5 i5/8/512GB", 7_999_000, {"brand": "Acer", "prosesor": "Intel Core i5-12450H", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel UHD Graphics", "layar": '15.6" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.75}),
        ("Acer Swift Go 14 Ryzen 7/16/512GB", 11_499_000, {"brand": "Acer", "prosesor": "AMD Ryzen 7 7730U", "ram_gb": 16, "storage": "SSD 512GB", "gpu": "AMD Radeon Graphics", "layar": '14" FHD+ 1920x1200', "os": "Windows 11", "berat_kg": 1.25}),
        ("HP Pavilion 14 i5/8/512GB", 8_899_000, {"brand": "HP", "prosesor": "Intel Core i5-1335U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel Iris Xe", "layar": '14" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.41}),
        ("HP Victus 15 RTX 3050 8/512GB", 11_499_000, {"brand": "HP", "prosesor": "Intel Core i5-12450H", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "NVIDIA RTX 3050 6GB", "layar": '15.6" FHD 144Hz', "os": "Windows 11", "berat_kg": 2.29}),
        ("Dell Inspiron 14 i5/8/512GB", 9_299_000, {"brand": "Dell", "prosesor": "Intel Core i5-1334U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel Iris Xe", "layar": '14" FHD+ 1920x1200', "os": "Windows 11", "berat_kg": 1.53}),
        ("MSI Modern 14 i5/8/512GB", 7_999_000, {"brand": "MSI", "prosesor": "Intel Core i5-1235U", "ram_gb": 8, "storage": "SSD 512GB", "gpu": "Intel Iris Xe", "layar": '14" FHD 1920x1080', "os": "Windows 11", "berat_kg": 1.4}),
    ],
    "Tablet": [
        ("iPad 10 64GB WiFi", 5_499_000, {"brand": "Apple", "chipset": "Apple A14 Bionic", "ram_gb": 4, "storage_gb": 64, "layar": '10.9" Liquid Retina', "os": "iPadOS 17"}),
        ("iPad Air M2 11 inci 128GB WiFi", 10_999_000, {"brand": "Apple", "chipset": "Apple M2", "ram_gb": 8, "storage_gb": 128, "layar": '11" Liquid Retina 2360x1640', "os": "iPadOS 17"}),
        ("iPad Pro M4 11 inci 256GB WiFi", 16_999_000, {"brand": "Apple", "chipset": "Apple M4", "ram_gb": 8, "storage_gb": 256, "layar": '11" Ultra Retina XDR Tandem OLED 120Hz', "os": "iPadOS 17"}),
        ("Samsung Galaxy Tab S9 FE 128GB", 6_999_000, {"brand": "Samsung", "chipset": "Exynos 1380", "ram_gb": 6, "storage_gb": 128, "layar": '10.9" WUXGA+ LCD 90Hz + S Pen', "os": "Android 13 One UI 5"}),
        ("Samsung Galaxy Tab A9+ 128GB", 2_899_000, {"brand": "Samsung", "chipset": "Snapdragon 695", "ram_gb": 4, "storage_gb": 128, "layar": '11" WUXGA+ LCD 90Hz', "os": "Android 13 One UI 5"}),
        ("Redmi Pad SE 128GB", 1_799_000, {"brand": "Xiaomi", "chipset": "Snapdragon 680", "ram_gb": 4, "storage_gb": 128, "layar": '11" FHD+ LCD 90Hz', "os": "Android 13 MIUI 14"}),
        ("Lenovo Tab M11 128GB", 2_499_000, {"brand": "Lenovo", "chipset": "Helio G88", "ram_gb": 4, "storage_gb": 128, "layar": '11" FHD+ LCD 90Hz', "os": "Android 13"}),
        ("Xiaomi Pad 6 128GB", 4_499_000, {"brand": "Xiaomi", "chipset": "Snapdragon 870", "ram_gb": 6, "storage_gb": 128, "layar": '11" 2.8K LCD 144Hz', "os": "Android 13 MIUI 14"}),
    ],
    "Audio": [
        ("AirPods Pro 2 USB-C", 3_299_000, {"brand": "Apple", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.3", "fitur": "ANC adaptif + mode transparansi + Adaptive Audio", "baterai": "6 jam (30 jam dengan case)"}),
        ("AirPods 3 Lightning", 2_199_000, {"brand": "Apple", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.0", "fitur": "Spatial Audio + sensor force", "baterai": "6 jam (30 jam dengan case)"}),
        ("AirPods Max", 7_999_000, {"brand": "Apple", "tipe": "Over-ear", "koneksi": "Bluetooth 5.0", "fitur": "ANC + spatial audio + digital crown", "baterai": "20 jam"}),
        ("Sony WH-1000XM5", 5_499_000, {"brand": "Sony", "tipe": "Over-ear", "koneksi": "Bluetooth 5.2", "fitur": "ANC + LDAC + multipoint", "baterai": "30 jam"}),
        ("Sony WF-1000XM5", 3_499_000, {"brand": "Sony", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.3", "fitur": "ANC + LDAC + speak-to-chat", "baterai": "8 jam (24 jam dengan case)"}),
        ("JBL Tune 720BT", 899_000, {"brand": "JBL", "tipe": "On-ear", "koneksi": "Bluetooth 5.3 + kabel 3.5mm", "fitur": "JBL Pure Bass + multipoint", "baterai": "76 jam"}),
        ("JBL Tune 130NC TWS", 749_000, {"brand": "JBL", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.2", "fitur": "ANC + Smart Ambient", "baterai": "10 jam (40 jam dengan case)"}),
        ("Soundcore Life Q30", 1_099_000, {"brand": "Anker Soundcore", "tipe": "Over-ear", "koneksi": "Bluetooth 5.0", "fitur": "Hybrid ANC + mode transparansi", "baterai": "40 jam"}),
        ("Soundcore R50i TWS", 299_000, {"brand": "Anker Soundcore", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.3", "fitur": "Mode gaming 22ms", "baterai": "10 jam (30 jam dengan case)"}),
        ("Sennheiser HD 450BT", 1_899_000, {"brand": "Sennheiser", "tipe": "Over-ear", "koneksi": "Bluetooth 5.0", "fitur": "ANC + aptX AAC", "baterai": "30 jam"}),
        ("Realme Buds Air 5", 549_000, {"brand": "Realme", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.3", "fitur": "ANC 50dB + LDAC", "baterai": "8 jam (38 jam dengan case)"}),
        ("Anker Soundcore Life Note 3", 459_000, {"brand": "Anker Soundcore", "tipe": "TWS in-ear", "koneksi": "Bluetooth 5.0", "fitur": "ANC + IPX5", "baterai": "7 jam (40 jam dengan case)"}),
        ("Baseus Bowie E9", 379_000, {"brand": "Baseus", "tipe": "TWS semi-in-ear", "koneksi": "Bluetooth 5.3", "fitur": "ENC dual mic", "baterai": "8 jam (25 jam dengan case)"}),
    ],
    "Wearable": [
        ("Apple Watch SE 2 40mm GPS", 3_799_000, {"brand": "Apple", "layar": 'Retina LTPO OLED 40mm', "fitur": "deteksi jatuh + pelacak tidur + tahan air 50m", "ecg": False, "baterai": "hingga 18 jam (tergantung penggunaan)", "koneksi": "GPS + Wi-Fi + Bluetooth 5.3"}),
        ("Apple Watch Series 9 45mm", 6_999_000, {"brand": "Apple", "layar": 'Retina LTPO OLED 45mm 2000 nits', "fitur": "ECG + oksigen darah + Double Tap + tahan air 50m", "baterai": "18 jam", "koneksi": "GPS + LTE opsional"}),
        ("Apple Watch Ultra 2", 12_999_000, {"brand": "Apple", "layar": 'Retina LTPO OLED 49mm 3000 nits', "fitur": "ECG + siren + dual-band GPS + tahan air 100m + titanium", "baterai": "36 jam", "koneksi": "GPS dual-band + LTE"}),
        ("Samsung Galaxy Watch 6 44mm", 4_299_000, {"brand": "Samsung", "layar": 'Super AMOLED 44mm', "fitur": "ECG + analisis tidur + BIA + tahan air 50m + Sapphire glass", "baterai": "425 mAh", "koneksi": "Bluetooth + LTE opsional"}),
        ("Samsung Galaxy Watch FE 40mm", 2_399_000, {"brand": "Samsung", "layar": 'Super AMOLED 40mm', "fitur": "HR + sleep + IP68", "baterai": "247 mAh", "koneksi": "Bluetooth"}),
        ("Xiaomi Smart Band 8", 599_000, {"brand": "Xiaomi", "layar": 'AMOLED 1.62" 60Hz', "fitur": "150+ mode olahraga + SpO2 + 5ATM", "baterai": "16 hari", "koneksi": "Bluetooth 5.1"}),
        ("Xiaomi Watch S3", 1_899_000, {"brand": "Xiaomi", "layar": 'AMOLED 1.43" 60Hz + bezel dapat diganti', "fitur": "SpO2 + 150 mode olahraga + 5ATM + HyperOS", "baterai": "15 hari", "koneksi": "Bluetooth 5.2"}),
        ("Amazfit GTS 4 Mini", 1_199_000, {"brand": "Amazfit", "layar": 'AMOLED 1.65"', "fitur": "GPS dual-band + 120 mode olahraga + 5ATM + Alexa", "baterai": "15 hari", "koneksi": "Bluetooth 5.2"}),
    ],
    "Aksesori": [
        ("Charger Apple 20W USB-C", 349_000, {"brand": "Apple", "daya": "20W USB-C PD", "fitur": "pengisian cepat iPhone"}),
        ("Charger Anker 65W GaN II", 599_000, {"brand": "Anker", "daya": "65W GaN II (2 port USB-C + 1 USB-A)", "fitur": "isi laptop & HP bersamaan"}),
        ("Kabel USB-C 100W 2m UGREEN", 149_000, {"brand": "UGREEN", "konektor": "USB-C ke USB-C", "fitur": "100W PD + data 480Mbps", "panjang": "2m"}),
        ("Kabel USB-C ke Lightning 1m", 449_000, {"brand": "Apple", "konektor": "USB-C ke Lightning", "fitur": "original MFi", "panjang": "1m"}),
        ("Powerbank Anker 20.000mAh 22.5W", 749_000, {"brand": "Anker", "kapasitas_mah": 20000, "output": "22.5W", "fitur": "PD + QC + layar LED"}),
        ("Powerbank Xiaomi 10.000mAh 22.5W", 299_000, {"brand": "Xiaomi", "kapasitas_mah": 10000, "output": "22.5W", "fitur": "PD + QC + dua kabel bawaan"}),
        ("Logitech MX Master 3S", 1_599_000, {"brand": "Logitech", "tipe": "mouse wireless premium", "sensor": "8000 DPI Darkfield", "fitur": "scroll MagSpeed + silent click + multi-device", "koneksi": "Bluetooth + Logi Bolt"}),
        ("Logitech M170 Wireless", 189_000, {"brand": "Logitech", "tipe": "mouse wireless", "sensor": "1000 DPI", "fitur": "nano receiver", "koneksi": "2.4GHz USB"}),
        ("Logitech K380 Keyboard Multi-Device", 699_000, {"brand": "Logitech", "tipe": "keyboard Bluetooth compact", "fitur": "3 device + kompatibel Windows/Mac/iPad/Android", "baterai": "2 tahun AAA"}),
        ("Laptop Stand Aluminium Adjustable", 249_000, {"brand": "Generic", "tipe": "stand laptop", "fitur": "tinggi dapat diatur + aluminium + lipat", "kompatibel": "10-17 inci"}),
        ("Casing Spigen iPhone 15 Pro", 249_000, {"brand": "Spigen", "tipe": "casing HP", "material": "TPU + polycarbonate", "fitur": "Mil-grade + tombol responsif", "kompatibel": "iPhone 15 Pro"}),
        ("Screen Protector iPhone 15 Pro", 99_000, {"brand": "Generic", "tipe": "tempered glass", "fitur": "9H + case friendly", "kompatibel": "iPhone 15 Pro"}),
        ("Mousepad XL 90x40cm", 89_000, {"brand": "Generic", "ukuran": "90x40cm", "fitur": "anti-slip + jahitan tepi"}),
        ("USB Hub UGREEN 4-Port USB 3.0", 199_000, {"brand": "UGREEN", "port": "4x USB 3.0", "fitur": "5Gbps + kabel 30cm"}),
        ("Adapter USB-C ke HDMI 4K UGREEN", 259_000, {"brand": "UGREEN", "konektor": "USB-C ke HDMI", "fitur": "4K@60Hz + PD 100W pass-through"}),
        ("MicroSD Samsung EVO Plus 128GB", 249_000, {"brand": "Samsung", "kapasitas": "128GB", "kecepatan": "130MB/s", "kelas": "U3 / A2 / V30"}),
        ("SSD Internal Kingston NV2 1TB", 999_000, {"brand": "Kingston", "model": "SNV2S/1000G", "storage_gb": 1000, "kapasitas": "1TB NVMe", "form_factor": "M.2 2280", "interface": "PCIe 4.0 x4 NVMe", "kecepatan": "baca hingga 3500MB/s; tulis hingga 2100MB/s"}),
        ("Apple Pencil USB-C", 1_399_000, {"brand": "Apple", "tipe": "stylus", "fitur": "magnetik + low latency", "kompatibel": "iPad 10/Air/Pro M-series"}),
        ("Kabel HDMI 2.1 8K 2m UGREEN", 179_000, {"brand": "UGREEN", "konektor": "HDMI ke HDMI", "fitur": "8K@60Hz / 4K@120Hz + eARC", "panjang": "2m"}),
        ("Wireless Charger Anker 15W", 299_000, {"brand": "Anker", "daya": "15W Qi2", "fitur": "case-friendly + LED kecil + anti-slip"}),
    ],
    "Komputer & Gaming": [
        ("Monitor LG 24 IPS 75Hz", 1_899_000, {"brand": "LG", "ukuran": '24"', "resolusi": "FHD 1920x1080", "fitur": "IPS + 75Hz + FreeSync + HDMI/VGA"}),
        ("Monitor Samsung Odyssey G5 27 165Hz", 3_999_000, {"brand": "Samsung", "ukuran": '27"', "resolusi": "WQHD 2560x1440", "fitur": "165Hz + 1ms + curved 1000R + HDR10"}),
        ("Keyboard Mekanik Keychron K8", 1_499_000, {"brand": "Keychron", "switch": "Gateron Brown hot-swap", "fitur": "Bluetooth + kabel + backlight putih", "layout": "TKL 87-key"}),
        ("Keyboard Razer BlackWidow V4", 2_299_000, {"brand": "Razer", "switch": "Razer Green", "fitur": "Chroma RGB + macro pad + magnetic wrist rest", "layout": "Full-size"}),
        ("Mouse Logitech G Pro X Superlight 2", 1_899_000, {"brand": "Logitech", "sensor": "HERO 2 32K DPI", "berat": "60 gram", "fitur": "LIGHTSPEED wireless + 95 jam baterai"}),
        ("Mouse Logitech G502 Hero", 799_000, {"brand": "Logitech", "sensor": "HERO 25K 25600 DPI", "fitur": "11 tombol programmable + bobot dapat diatur", "koneksi": "kabel"}),
        ("Mouse Razer DeathAdder V3", 1_199_000, {"brand": "Razer", "sensor": "Focus Pro 30K", "berat": "63 gram", "fitur": "Optical switch Gen-3 + HyperPolling 8KHz", "koneksi": "kabel"}),
        ("Headset Logitech G733 Wireless", 1_699_000, {"brand": "Logitech", "tipe": "over-ear wireless", "fitur": "LIGHTSPEED + RGB + 29 jam + mic Blue VO!ce"}),
        ("Headset Razer Kraken V3 X", 999_000, {"brand": "Razer", "tipe": "over-ear", "fitur": "Chroma RGB + surround 7.1 + mic cardioid", "koneksi": "USB"}),
        ("Controller Xbox Series X|S", 899_000, {"brand": "Microsoft", "fitur": "share button + D-pad hybrid + Bluetooth", "koneksi": "Bluetooth + USB-C"}),
        ("PlayStation 5 Slim Disc Edition", 8_999_000, {"brand": "Sony", "tipe": "konsol", "storage": "SSD 1TB", "fitur": "4K 120Hz + ray tracing + DualSense"}),
        ("Nintendo Switch OLED", 5_299_000, {"brand": "Nintendo", "tipe": "konsol hybrid", "storage": "64GB + microSD", "fitur": 'layar OLED 7" + dock HDMI + Joy-Con'}),
        ("Webcam Logitech C920 HD Pro", 1_099_000, {"brand": "Logitech", "resolusi": "1080p 30fps", "fitur": "autofocus + stereo mic + koreksi cahaya"}),
        ("Microphone USB Fifine A6T", 599_000, {"brand": "Fifine", "tipe": "condenser USB", "fitur": "gain control + headphone monitoring + mute tap"}),
        ("Keyboard MSI Vigor GK30", 499_000, {"brand": "MSI", "switch": "membrane mekanikal", "fitur": "RGB 6 zona + anti-ghosting", "layout": "Full-size"}),
    ],
}

# Stok dasar per kategori (elektronik: unit lebih sedikit dari kelontong).
_BASE_STOCK: dict[str, tuple[int, int]] = {
    "Smartphone": (2, 15),
    "Laptop": (2, 10),
    "Tablet": (2, 10),
    "Audio": (3, 20),
    "Wearable": (2, 12),
    "Aksesori": (10, 50),
    "Komputer & Gaming": (2, 12),
}


def _flat_catalog() -> list[tuple[str, str, int, dict]]:
    """(category, name, price, spec) — urutan stabil."""
    rows: list[tuple[str, str, int, dict]] = []
    for cat, items in CATALOG.items():
        for name, price, spec in items:
            normalized = dict(spec)
            # Preserve display text but expose a consistent numeric field for SQL
            # filtering. Decimal capacity: 1 TB = 1000 GB, not formatted text.
            if "storage_gb" not in normalized and "storage" in normalized:
                capacity = re.search(r"(\d+)\s*(GB|TB)", normalized["storage"])
                if capacity:
                    normalized["storage_gb"] = int(capacity[1]) * (1000 if capacity[2] == "TB" else 1)
            rows.append((cat, name, price, normalized))
    return rows


async def generate_seed(
    db: AsyncSession, product_count: int | None = None, *, now: datetime | None = None,
) -> None:
    """Seed only an empty store; caller owns commit. Never reset existing data.

    Pass a timezone-aware ``now`` for reproducible test/demo timelines.
    This guard is for sequential invocations; don't run concurrent seed jobs.
    """
    if (await db.execute(select(User.id).limit(1))).first() or (
        await db.execute(select(Product.id).limit(1))
    ).first():
        return
    rng = random.Random(SEED)
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now harus memiliki timezone")

    if product_count is None:
        product_count = settings.seed_sku_count
    if product_count < 1:
        raise ValueError("product_count harus positif")

    # ---------- users (FR-AUTH-01/02) — SRS §2.2: hanya Owner ----------
    owner = User(
        name="Ratna Wulandari",
        email=settings.seed_owner_email,
        password_hash=hash_password(settings.seed_default_password),
        role="OWNER",
    )
    db.add(owner)
    await db.flush()

    # ---------- products (98 SKU elektronik + spesifikasi detail) ----------
    catalog = _flat_catalog()[:product_count]
    products: list[Product] = []
    for cat, name, price, spec in catalog:
        products.append(
            Product(
                name=name,
                category=cat,
                specification=spec,
                price=price,
                status="ACTIVE",
                low_stock_threshold=rng.choice([3, 5, 8, 10]),
            )
        )
    db.add_all(products)
    await db.flush()

    # ---------- chronological inventory history (opening + manual adjustments) ----------
    # Historical demo adjustments are NOT sales: only the real orders below use
    # reference_type ORDER. Every prefix balance must stay >= 0.
    balances: dict[str, int] = {}
    for product in products:
        pid = str(product.id)
        lo, hi = _BASE_STOCK[product.category]
        balance = rng.randint(lo, hi)
        db.add(InventoryTransaction(
            product_id=pid, type="IN", movement="IN", reference_type="MANUAL",
            quantity=balance, actor_id=str(owner.id), timestamp=now - timedelta(days=30),
        ))
        for days_ago in sorted(rng.sample(range(4, 30), rng.randint(2, 8)), reverse=True):
            direction = rng.choice(["IN", "OUT"]) if balance else "IN"
            quantity = rng.randint(1, 5 if direction == "IN" else min(5, balance))
            balance += quantity if direction == "IN" else -quantity
            db.add(InventoryTransaction(
                product_id=pid, type="ADJUSTMENT", movement=direction,
                reference_type="MANUAL", quantity=quantity, actor_id=str(owner.id),
                timestamp=now - timedelta(days=days_ago),
            ))
        balances[pid] = balance

    # ---------- customers contoh (satu per channel aktif) ----------
    demo_customers = [
        ("TELEGRAM", "628123450099", "Sari", None),
        ("WEB", "guest|Dewi|081234567", "Dewi", "081234567"),
    ]
    customers: list[Customer] = []
    for ch, ident, name, contact in demo_customers:
        c = Customer(channel=ch, identifier=ident, name=name, contact=contact)
        db.add(c)
        customers.append(c)
        await db.flush()

    # ---------- order contoh (2 pelanggan pertama) ----------
    for idx, c in enumerate(customers[:2]):
        order = Order(
            customer_id=str(c.id),
            status="CONFIRMED",
            channel_origin=c.channel,
            total_amount=0,
            created_at=now - timedelta(days=3 - idx),
        )
        db.add(order)
        await db.flush()
        total = Decimal("0")
        for product in rng.sample(products, min(len(products), rng.randint(1, 3))):
            pid = str(product.id)
            qty = rng.randint(1, 2)
            if balances[pid] < qty:
                restock = qty - balances[pid] + 2
                db.add(InventoryTransaction(
                    product_id=pid, type="IN", movement="IN", reference_type="MANUAL",
                    quantity=restock, actor_id=str(owner.id),
                    timestamp=order.created_at - timedelta(seconds=1),
                ))
                balances[pid] += restock
            balances[pid] -= qty
            line = Decimal(product.price) * qty
            total += line
            db.add(
                OrderItem(
                    order_id=str(order.id), product_id=str(product.id), quantity=qty,
                    price_at_order=product.price, line_total=line,
                )
            )
            db.add(
                InventoryTransaction(
                    product_id=str(product.id), type="OUT", movement="OUT",
                    reference_type="ORDER", quantity=qty, reference_id=str(order.id),
                    timestamp=order.created_at,
                )
            )
        order.total_amount = total

    # ---------- promo aktif: diskon AirPods Pro 2 ----------
    promo_product = next(
        (p for p in products if p.name == "AirPods Pro 2 USB-C"), products[0]
    )
    db.add(
        Promotion(
            product_id=str(promo_product.id),
            discount_percentage=10.0,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=7),
            status="ACTIVE",
        )
    )
    await db.flush()


if __name__ == "__main__":
    import asyncio

    from app.db.init_db import init_db

    asyncio.run(init_db(seed=True))
    print("Seed Toko Bu Ratna selesai (DB kosong saja yang diisi).")
