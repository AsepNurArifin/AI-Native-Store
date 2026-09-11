"""Tool executor untuk Sales Agent / Analyst / Action Assistant.

Semua tool memanggil service layer — LLM tidak pernah akses DB langsung (NFR-06).
Tool mutasi berat (create_order, approve_draft, execute_draft) sengaja TIDAK
diekspos ke LLM: konfirmasi order dan approval Owner adalah event manusia
(UC-02 E5, FR-AA-03), bukan keputusan model — jalurnya lewat endpoint REST
(/chat/{id}/confirm, /ai-actions/{id}/approve). Lihat docs/SRS_AMENDMENTS.md B3.
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import OrderItem, Product
from app.schemas.chat import OrderSummary, OrderSummaryItem
from app.services.inventory_service import InventoryService
from app.services.product_service import ProductService
from app.services.promotion_service import PromotionService
from app.services.analytics_service import AnalyticsService
from app.services.summary_store import put as put_summary


class ToolExecutor:
    def __init__(self, db: AsyncSession):
        self.db = db

    # daftar tool eksplisit (R9) — tidak pakai getattr/reflection.
    _TOOLS = {
        "get_product": "get_product",
        "search_products": "search_products",
        "get_stock": "get_stock",
        "compare_products": "compare_products",
        "build_order_summary": "build_order_summary",
        "analyze_sales": "analyze_sales",
        "analyze_inventory": "analyze_inventory",
        "channel_distribution": "channel_distribution",
        "create_promotion_draft": "create_promotion_draft",
        "create_stock_adjustment_draft": "create_stock_adjustment_draft",
    }

    async def call(self, name: str, args: dict) -> dict:
        method = self._TOOLS.get(name)
        if method is None:
            return {"error": f"Tool {name} tidak dikenal."}
        return await getattr(self, method)(**args)

    @staticmethod
    def _as_uuid(value: str) -> uuid.UUID | None:
        """Guard: LLM kadang mengisi product_id dengan nama/SKU (bukan UUID).

        Tanpa guard ini asyncpg melempar DataError -> HTTP 500. Dengan guard,
        tool mengembalikan error instruksional sehingga LLM bisa self-correct
        (panggil search_products dulu) pada iterasi berikutnya.
        """
        try:
            return uuid.UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            return None

    # ==================== SALES ====================

    async def get_product(self, product_id: str) -> dict:
        if self._as_uuid(product_id) is None:
            return {"error": "product_id harus UUID produk — panggil search_products dulu untuk mendapatkannya."}
        product = await ProductService.get(self.db, product_id)
        if not product:
            return {"error": "Produk tidak ditemukan."}
        return await ProductService.with_stock(self.db, product)

    async def search_products(self, query: str | None = None, category: str | None = None,
                              budget_max: float | None = None, stock_only: bool = False) -> dict:
        products = await ProductService.search(
            self.db, query=query, category=category, status="ACTIVE",
            stock_only=stock_only, budget_max=budget_max, limit=10,
        )
        items = [await ProductService.with_stock(self.db, p) for p in products]
        return {"count": len(items), "items": items}

    async def get_stock(self, product_id: str) -> dict:
        if self._as_uuid(product_id) is None:
            return {"error": "product_id harus UUID produk — panggil search_products dulu untuk mendapatkannya."}
        stock = await InventoryService.current_stock(self.db, product_id)
        product = await ProductService.get(self.db, product_id)
        return {"product_id": product_id, "name": product.name if product else None, "current_stock": stock}

    async def compare_products(self, product_ids: list[str]) -> dict:
        items = []
        for pid in product_ids[:3]:
            if self._as_uuid(pid) is None:
                continue
            product = await ProductService.get(self.db, pid)
            if not product:
                continue
            items.append(await ProductService.with_stock(self.db, product))
        return {"compared": items}

    async def build_order_summary(self, items: list[dict]) -> dict:
        """Membangun Order Summary. BUKAN membuat order — hanya preview (FR-SMS-06)."""
        if not items or len(items) > 50:
            return {"error": "Jumlah item tidak valid (1-50)."}
        lines: list[OrderSummaryItem] = []
        total = 0.0
        errors = []
        for it in items:
            if self._as_uuid(it["product_id"]) is None:
                errors.append("product_id harus UUID produk — panggil search_products dulu")
                continue
            product = await ProductService.get(self.db, it["product_id"])
            if not product:
                errors.append(f"Produk {it['product_id']} tidak ditemukan")
                continue
            qty = int(it.get("quantity", 1))
            if qty <= 0:
                errors.append("Quantity harus > 0")
                continue
            stock = await InventoryService.current_stock(self.db, str(product.id))
            if stock < qty:
                errors.append(f"Stok {product.name} tidak cukup (tersisa {stock})")
                continue
            discount = 0.0
            promo = await PromotionService.list(self.db, product_id=str(product.id))
            active = [p for p in promo if PromotionService.effective_status(p) == "ACTIVE"]
            if active:
                discount = round(float(product.price) * float(active[0].discount_percentage) / 100.0, 2)
            unit_effective = max(float(product.price) - discount, 0.0)
            line_total = round(unit_effective * qty, 2)
            total += line_total
            lines.append(
                OrderSummaryItem(
                    product_id=str(product.id), name=product.name, quantity=qty,
                    unit_price=float(product.price), discount=discount, line_total=line_total,
                )
            )
        if errors:
            return {"error": "; ".join(errors[:5])}
        summary = OrderSummary(
            summary_ref=uuid.uuid4().hex,
            items=lines,
            total=round(total, 2),
        )
        # simpan summary supaya bisa dikonfirmasi (UC-02 E5) — Web & WhatsApp.
        # Tanpa ini, chat_confirm selalu 410 SUMMARY_EXPIRED.
        put_summary(summary)
        return {"summary": summary.model_dump()}

    # ==================== ANALYST ====================

    async def analyze_sales(self, from_date: str, to_date: str, group_by: str = "product", top: int | None = 10) -> dict:
        try:
            f = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            t = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Format tanggal tidak valid. Gunakan ISO 8601."}
        if t <= f:
            return {"error": "to_date harus setelah from_date."}
        return await AnalyticsService.analyze_sales(self.db, from_date=f, to_date=t, group_by=group_by, top=top)

    async def analyze_inventory(self, threshold_days: int | None = None) -> dict:
        return await AnalyticsService.analyze_inventory(self.db, threshold_days=threshold_days or 7)

    async def channel_distribution(self, from_date: str, to_date: str) -> dict:
        try:
            f = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            t = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Format tanggal tidak valid. Gunakan ISO 8601."}
        if t <= f:
            return {"error": "to_date harus setelah from_date."}
        return await AnalyticsService.channel_distribution(self.db, from_date=f, to_date=t)

    # ==================== ACTION ====================

    async def create_promotion_draft(self, product_id: str, discount_percentage: float,
                                     start_date: str, end_date: str) -> dict:
        """Hanya menghasilkan draft data (dieksekusi via approval flow)."""
        if self._as_uuid(product_id) is None:
            return {"error": "product_id harus UUID produk — panggil search_products dulu untuk mendapatkannya."}
        return {
            "draft": {
                "action_type": "CREATE_PROMOTION",
                "payload": {
                    "product_id": product_id,
                    "discount_percentage": discount_percentage,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            }
        }

    async def create_stock_adjustment_draft(self, product_id: str, movement: str, quantity: int) -> dict:
        """FR-AA-06 — draft penyesuaian stok (dieksekusi via approval flow).

        movement: IN = tambah stok, OUT = kurangi stok. quantity selalu positif —
        arah perubahan ditentukan movement, bukan tanda quantity.
        """
        if self._as_uuid(product_id) is None:
            return {"error": "product_id harus UUID produk — panggil search_products dulu untuk mendapatkannya."}
        return {
            "draft": {
                "action_type": "ADJUST_STOCK",
                "payload": {
                    "product_id": product_id,
                    "movement": movement,
                    "quantity": quantity,
                },
            }
        }
