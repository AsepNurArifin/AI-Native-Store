import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { catalogList, ensureSeeded } from '../../../utils/business'

/**
 * Pencarian katalog publik (marketplace): q opsional, category opsional,
 * sort: termurah | termahal | terbaru. Tanpa JWT.
 */
export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const keyword = String(q.q || '').toLowerCase().trim()
  const category = String(q.category || '').trim()
  const sort = String(q.sort || '')
  const promoOnly = String(q.promo_only || '') === 'true'
  const stockOnly = String(q.stock_only || '') === 'true'
  const limit = Math.min(Math.max(Number(q.limit || 24), 1), 100)

  let rows = await db.select().from(products).where(eq(products.status, 'ACTIVE')).limit(500)
  if (category) rows = rows.filter(r => r.category.toLowerCase() === category.toLowerCase())
  if (keyword) {
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(keyword)
      || r.category.toLowerCase().includes(keyword)
      || JSON.stringify(r.specification || {}).toLowerCase().includes(keyword)
    )
  }

  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)

  if (sort === 'termurah') rows.sort((a, b) => Number(a.price) - Number(b.price))
  else if (sort === 'termahal') rows.sort((a, b) => Number(b.price) - Number(a.price))
  else if (sort === 'terbaru') rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

  let out = await catalogList(db, rows, lowDefault)
  if (promoOnly) out = out.filter(p => (p.discount_percentage as number) > 0)
  if (stockOnly) out = out.filter(p => (p.current_stock as number) > 0)

  return out.slice(0, limit)
})
