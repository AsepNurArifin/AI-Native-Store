"""Test AnalyticsService (FR-BA-01/02).

Regresi utama: analyze_inventory dengan campuran produk berpenjualan dan TIDAK
berpenjualan (estimated_days_left "N/A") — dulu sort mencampur str vs int
sehingga endpoint /analytics/inventory 500 (TypeError).
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Customer, InventoryTransaction, Order, OrderItem, Product
from app.services.analytics_service import AnalyticsService


async def _make_products(db: AsyncSession, n: int = 2) -> list[Product]:
    products = []
    for i in range(n):
        p = Product(
            name=f"Produk {i}",
            category="elektronik",
            specification={},
            price=100_000 + i,
            status="ACTIVE",
        )
        db.add(p)
        products.append(p)
    await db.flush()
    return products


@pytest.mark.asyncio
async def test_inventory_mixed_na_and_numeric_sort(db: AsyncSession):
    """2 produk: satu punya penjualan (angka), satu tidak ("N/A") — tidak boleh TypeError."""
    p_laris, p_sepi = await _make_products(db)

    # stok keduanya
    for p in (p_laris, p_sepi):
        db.add(InventoryTransaction(product_id=p.id, movement="IN", quantity=50))
    # penjualan hanya untuk p_laris (1 unit -> rata2 1/30 per hari)
    customer = Customer(channel="WEB", identifier="Andi|0812", name="Andi")
    db.add(customer)
    await db.flush()
    order = Order(customer_id=customer.id, channel_origin="WEB", status="CONFIRMED", total_amount=100_000)
    db.add(order)
    await db.flush()
    db.add(OrderItem(
        order_id=order.id, product_id=p_laris.id, quantity=1,
        price_at_order=100_000, line_total=100_000,
    ))
    await db.commit()

    result = await AnalyticsService.analyze_inventory(db, threshold_days=7)

    keys = [r["estimated_days_left"] for r in result["data"]]
    # tidak raise TypeError + produk berpenjualan di atas yang "N/A"
    assert keys[0] != "N/A"
    assert keys[-1] == "N/A"
    by_name = {r["name"]: r for r in result["data"]}
    assert by_name["Produk 0"]["current_stock"] == 50
    assert by_name["Produk 0"]["avg_daily_sales_30d"] == pytest.approx(1 / 30, abs=1e-3)
    assert by_name["Produk 1"]["avg_daily_sales_30d"] == 0
    assert by_name["Produk 1"]["stockout_risk"] is False  # N/A tidak dianggap berisiko


@pytest.mark.asyncio
async def test_inventory_bulk_matches_per_product(db: AsyncSession):
    """Agregat bulk harus setara dengan hitung stok per produk (InventoryService)."""
    from app.services.inventory_service import InventoryService

    products = await _make_products(db, n=3)
    for i, p in enumerate(products):
        db.add(InventoryTransaction(product_id=p.id, movement="IN", quantity=10 * (i + 1)))
        db.add(InventoryTransaction(product_id=p.id, movement="OUT", quantity=i))
    await db.commit()

    result = await AnalyticsService.analyze_inventory(db)
    for row in result["data"]:
        p = next(p for p in products if str(p.id) == row["product_id"])
        assert row["current_stock"] == await InventoryService.current_stock(db, str(p.id))
