import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  const p = rows[0]
  if (!p) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const stock = await currentStock(db, String(p.id))
  const thr = (p.lowStockThreshold as number | null) ?? Number(useRuntimeConfig().lowStockDefault ?? 5)
  return {
    id: String(p.id), name: p.name, category: p.category, specification: p.specification || {},
    price: num(p.price), status: p.status, low_stock_threshold: p.lowStockThreshold ?? null,
    current_stock: stock, is_low_stock: stock <= thr,
    image_url: (p.imageUrl as string | null) ?? null
  }
})
