"""Synthetic seed generator — NFR-01: max 500 SKU.

Membuat: owner, 120 produk 6 kategori, inventory history 30 hari,
beberapa order contoh, dan promo aktif. Data deterministik (random.seed)
agar reproducible untuk benchmark NFR-07/NFR-09.
"""

import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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

CATEGORIES = {
    "Elektronik": ["Smartphone", "Laptop", "Tablet", "Headphone", "Smartwatch", "Speaker"],
    "Fashion": ["Kaos", "Kemeja", "Celana", "Jaket", "Sepatu", "Tas"],
    "Makanan": ["Kopi", "Teh", "Snack", "Beras", "Minyak", "Gula"],
    "Minuman": ["Air Mineral", "Jus", "Soda", "Susu", "Energi"],
    "Kesehatan": ["Vitamin", "Masker", "Sanitizer", "Obat", "Suplemen"],
    "Rumah Tangga": ["Sabun", "Shampoo", "Detergen", "Tissue", "Peralatan Dapur"],
}


async def generate_seed(db: AsyncSession, product_count: int = 120) -> None:
    rng = random.Random(SEED)
    now = datetime.now()

    # ---------- users (FR-AUTH-01/02) — SRS §2.2: hanya Owner ----------
    from app.core.config import settings

    owner = User(
        name="Owner Demo",
        email=settings.seed_owner_email,
        password_hash=hash_password("owner123"),
        role="OWNER",
    )
    db.add(owner)
    await db.flush()

    # ---------- products ----------
    category_names = list(CATEGORIES.keys())
    products: list[Product] = []
    for i in range(product_count):
        cat = category_names[i % len(category_names)]
        base = CATEGORIES[cat][i % len(CATEGORIES[cat])]
        name = f"{base} {chr(65 + (i % 20))}{i:03d}"
        products.append(
            Product(
                name=name,
                category=cat,
                specification={"brand": f"Brand{i % 7}", "variant": f"V{i % 3}"},
                price=round(rng.uniform(15000, 25_000_000), -2),
                status="ACTIVE",
                low_stock_threshold=rng.choice([3, 5, 8, 10]),
            )
        )
    db.add_all(products)
    await db.flush()
    product_ids = [str(p.id) for p in products]

    # ---------- inventory history 30 hari (random in/out) ----------
    for pid in product_ids:
        base_stock = rng.randint(2, 80)
        # opening balance
        db.add(
            InventoryTransaction(
                product_id=pid, type="IN", movement="IN",
                reference_type="MANUAL", quantity=base_stock,
            )
        )
        for _ in range(rng.randint(3, 12)):
            days_ago = rng.randint(0, 29)
            ts = now - timedelta(days=days_ago)
            direction = rng.choice(["IN", "OUT"])
            tx = InventoryTransaction(
                product_id=pid,
                type="IN" if direction == "IN" else "OUT",
                movement=direction,
                reference_type="MANUAL" if direction == "IN" else "ORDER",
                quantity=rng.randint(1, 15),
                timestamp=ts,
            )
            db.add(tx)

    # ---------- customers + sample orders ----------
    demo_customers = [
        ("WHATSAPP", "6281234567890", "Budi", "6281234567890"),
        ("WHATSAPP", "6289876543210", "Sari", "6289876543210"),
        ("WEB", "guest|Dewi|081234567", "Dewi", "081234567"),
    ]
    customers: list[Customer] = []
    for ch, ident, name, contact in demo_customers:
        c = Customer(channel=ch, identifier=ident, name=name, contact=contact)
        db.add(c)
        customers.append(c)
        await db.flush()

    for idx, c in enumerate(customers[:2]):
        order = Order(
            customer_id=str(c.id),
            status="CONFIRMED",
            channel_origin=c.channel,
            total_amount=0,
            created_at=now - timedelta(days=idx * 3),
        )
        db.add(order)
        await db.flush()
        total = 0.0
        for _ in range(rng.randint(1, 4)):
            pid = rng.choice(product_ids)
            product = next(p for p in products if str(p.id) == pid)
            qty = rng.randint(1, 3)
            line = float(product.price) * qty
            total += line
            db.add(
                OrderItem(
                    order_id=str(order.id), product_id=pid, quantity=qty,
                    price_at_order=float(product.price), line_total=line,
                )
            )
            db.add(
                InventoryTransaction(
                    product_id=pid, type="OUT", movement="OUT",
                    reference_type="ORDER", quantity=qty, reference_id=str(order.id),
                    timestamp=order.created_at,
                )
            )
        order.total_amount = round(total, 2)

    # ---------- active promotion example ----------
    promo_product = next(p for p in products if str(p.id) == product_ids[0])
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
