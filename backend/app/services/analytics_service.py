from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InventoryTransaction, Order, OrderItem, Product
from app.services.inventory_service import InventoryService


class AnalyticsService:
    """AI Business Analyst backend — every number comes from SQL here (FR-BA-01/02, NFR-10)."""

    # ---------- FR-BA-01: sales query ----------
    @staticmethod
    async def analyze_sales(
        db: AsyncSession,
        *,
        from_date: datetime,
        to_date: datetime,
        group_by: str = "product",  # product | day | week | month | channel
        top: int | None = 10,
    ) -> dict:
        """Aggregate order_items joined to CONFIRMED/COMPLETED orders in period."""
        # Objek ekspresi yang SAMA dipakai di SELECT dan GROUP BY: bila dibangun
        # dua kali, SQLAlchemy me-bind literal 'day'/'week'/'month' sebagai parameter
        # berbeda ($1 vs $6) sehingga Postgres menolaknya (GroupingError).
        day = func.date_trunc("day", Order.created_at).label("day")
        week = func.date_trunc("week", Order.created_at).label("week")
        month = func.date_trunc("month", Order.created_at).label("month")
        base = (
            select(
                Order.channel_origin.label("channel"),
                day,
                week,
                month,
                OrderItem.product_id.label("product_id"),
                func.sum(OrderItem.quantity).label("units"),
                func.sum(OrderItem.line_total).label("revenue"),
            )
            .join(OrderItem, OrderItem.order_id == Order.id)
            .where(
                Order.status.in_(["CONFIRMED", "COMPLETED"]),
                Order.created_at >= from_date,
                Order.created_at < to_date,
            )
            .group_by(
                Order.channel_origin,
                day,
                week,
                month,
                OrderItem.product_id,
            )
        )
        rows = (await db.execute(base)).all()

        agg: dict = {}
        product_names: dict = {}
        for r in rows:
            key = None
            if group_by == "product":
                key = str(r.product_id)
            elif group_by == "day":
                key = r.day.isoformat() if r.day else None
            elif group_by == "week":
                key = r.week.isoformat() if r.week else None
            elif group_by == "month":
                key = r.month.isoformat() if r.month else None
            elif group_by == "channel":
                key = r.channel
            if key is None:
                continue
            agg.setdefault(key, {"units": 0, "revenue": 0.0})
            agg[key]["units"] += int(r.units or 0)
            agg[key]["revenue"] += float(r.revenue or 0)
            if group_by == "product":
                product_names[key] = (await db.get(Product, r.product_id)).name if await db.get(Product, r.product_id) else key

        ranked = sorted(agg.items(), key=lambda kv: kv[1]["units"], reverse=True)
        if top and group_by == "product":
            ranked = ranked[:top]
        result = {
            "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
            "group_by": group_by,
            "data": [{"key": k, **v} for k, v in ranked],
        }
        if group_by == "product":
            result["product_names"] = product_names
        return result

    # ---------- FR-BA-02: stockout risk ----------
    @staticmethod
    async def analyze_inventory(db: AsyncSession, threshold_days: int | None = None) -> dict:
        threshold_days = threshold_days or 7
        products = (await db.execute(select(Product).where(Product.status == "ACTIVE"))).scalars().all()
        now = datetime.now()
        month_ago = now - timedelta(days=30)

        rows_out: list[dict] = []
        for p in products:
            stock = await InventoryService.current_stock(db, str(p.id))
            avg = (
                await db.execute(
                    select(func.coalesce(func.sum(OrderItem.quantity), 0) / 30.0)
                    .join(Order, Order.id == OrderItem.order_id)
                    .where(
                        OrderItem.product_id == p.id,
                        Order.status.in_(["CONFIRMED", "COMPLETED"]),
                        Order.created_at >= month_ago,
                    )
                )
            ).scalar_one()
            avg = float(avg)
            if avg > 0:
                est_days = round(stock / avg, 1)
                risk = est_days <= threshold_days
                est_label = str(est_days)
            else:
                risk = False
                est_label = "N/A"  # edge case FR-BA-02: avg=0 -> N/A, not infinity
            rows_out.append(
                {
                    "product_id": str(p.id),
                    "name": p.name,
                    "category": p.category,
                    "current_stock": stock,
                    "avg_daily_sales_30d": round(avg, 3),
                    "estimated_days_left": est_label,
                    "stockout_risk": risk,
                }
            )
        rows_out.sort(key=lambda r: r["estimated_days_left"] if r["estimated_days_left"] != "N/A" else 10**9)
        return {"threshold_days": threshold_days, "data": rows_out}

    # ---------- channel distribution (FR-BA-06 stretch — cheap, include) ----------
    @staticmethod
    async def channel_distribution(db: AsyncSession, from_date: datetime, to_date: datetime) -> dict:
        base = (
            select(Order.channel_origin.label("channel"), func.count(Order.id).label("orders"))
            .where(
                Order.status.in_(["CONFIRMED", "COMPLETED"]),
                Order.created_at >= from_date,
                Order.created_at < to_date,
            )
            .group_by(Order.channel_origin)
        )
        rows = (await db.execute(base)).all()
        total = sum(int(r.orders) for r in rows)
        return {
            "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
            "total_orders": total,
            "by_channel": [
                {"channel": r.channel, "orders": int(r.orders), "percent": round(100 * int(r.orders) / total, 1) if total else 0}
                for r in rows
            ],
        }
