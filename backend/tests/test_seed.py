"""Seed invariants: every stock prefix is nonnegative; sales have real orders."""
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import Customer, InventoryTransaction, Order, OrderItem, Product, Promotion, User
from app.seed.generate import CATALOG, _flat_catalog, generate_seed


@pytest.mark.asyncio
async def test_seed_catalog_ledger_and_order_integrity(db):
    now = datetime(2026, 1, 15, 12, tzinfo=timezone.utc)
    await generate_seed(db, product_count=100, now=now)
    await db.commit()
    products = (await db.execute(select(Product))).scalars().all()
    assert len(products) == 98
    assert len({p.name for p in products}) == 98
    assert {p.category for p in products} == set(CATALOG)
    for product in products:
        assert product.price > 0 and product.specification.get("brand")
        if product.category in {"Laptop", "Smartphone", "Tablet"}:
            assert isinstance(product.specification["ram_gb"], int)
            assert isinstance(product.specification["storage_gb"], int)
    watch = next(p for p in products if p.name.startswith("Apple Watch SE 2"))
    assert watch.specification["ecg"] is False
    ssd = next(p for p in products if "Kingston NV2" in p.name)
    assert ssd.specification["interface"] == "PCIe 4.0 x4 NVMe"
    assert "USB-C" not in str(ssd.specification)
    # Normalization must not mutate the reusable catalog constant.
    assert "storage_gb" not in CATALOG["Laptop"][0][2]
    assert _flat_catalog()[18][3]["storage_gb"] == 256

    orders = (await db.execute(select(Order))).scalars().all()
    items = (await db.execute(select(OrderItem))).scalars().all()
    assert len(orders) == 2
    by_order = {str(o.id): o for o in orders}
    sold = defaultdict(int)
    totals = defaultdict(lambda: Decimal("0"))
    for item in items:
        key = (str(item.order_id), str(item.product_id))
        assert key not in sold, "duplicate lines in demo order"
        sold[key] = item.quantity
        assert item.line_total == item.price_at_order * item.quantity
        totals[str(item.order_id)] += item.line_total
    for order in orders:
        assert order.total_amount == totals[str(order.id)]

    transactions = (await db.execute(select(InventoryTransaction).order_by(
        InventoryTransaction.timestamp, InventoryTransaction.id,
    ))).scalars().all()
    balances = defaultdict(int)
    linked = defaultdict(int)
    for tx in transactions:
        assert tx.quantity > 0 and tx.timestamp <= now
        pid = str(tx.product_id)
        balances[pid] += tx.quantity if tx.movement == "IN" else -tx.quantity
        assert balances[pid] >= 0, (pid, tx.timestamp, balances[pid])
        if tx.reference_type == "ORDER":
            key = (str(tx.reference_id), pid)
            assert key in sold and tx.movement == "OUT"
            assert tx.timestamp == by_order[str(tx.reference_id)].created_at
            linked[key] += tx.quantity
        else:
            assert tx.reference_type == "MANUAL"
    assert linked == sold
    promo = (await db.execute(select(Promotion))).scalar_one()
    assert promo.start_date <= now < promo.end_date
    assert all(o.created_at < promo.start_date for o in orders)

    # Second invocation must not add owner, products, orders or ledger entries.
    before = len(transactions)
    await generate_seed(db, now=now)
    assert (await db.execute(select(func.count(User.id)))).scalar_one() == 1
    assert (await db.execute(select(func.count(Product.id)))).scalar_one() == 98
    assert (await db.execute(select(func.count(InventoryTransaction.id)))).scalar_one() == before
    assert (await db.execute(select(func.count(Customer.id)))).scalar_one() == 2


@pytest.mark.asyncio
async def test_seed_small_catalog_and_invalid_arguments(db):
    with pytest.raises(ValueError, match="positif"):
        await generate_seed(db, product_count=0)
    with pytest.raises(ValueError, match="timezone"):
        await generate_seed(db, now=datetime(2026, 1, 1))
    await generate_seed(db, product_count=1)
    await db.flush()
    assert (await db.execute(select(func.count(Product.id)))).scalar_one() == 1
    assert (await db.execute(select(func.count(Order.id)))).scalar_one() == 2
