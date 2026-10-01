import { and, desc, eq, ilike, lte, or, sql } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, num, stocksFor } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const search = String(q.q || '')
  const category = String(q.category || '')
  const status = String(q.status || '')
  const budgetMax = q.budget_max ? Number(q.budget_max) : null
  const limit = Math.min(Number(q.limit || 500), 500)

  // Filter + limit di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (search) {
    const s = `%${search.replace(/[%_\\]/g, '\\$&')}%`
    conds.push(or(ilike(products.name, s), ilike(sql`${products.specification}::text`, s))!)
  }
  if (category) conds.push(eq(products.category, category))
  if (status) conds.push(eq(products.status, status))
  if (budgetMax) conds.push(lte(products.price, String(budgetMax)))
  const rows = await db.select().from(products)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(products.createdAt))
    .limit(limit)

  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  const stocks = await stocksFor(db, rows.map(p => String(p.id)))
  return rows.map((p) => {
    const stock = stocks.get(String(p.id)) ?? 0
    const thr = (p.lowStockThreshold as number | null) ?? lowDefault
    return {
      id: String(p.id), name: p.name, category: p.category, specification: p.specification || {},
      price: num(p.price), status: p.status, low_stock_threshold: p.lowStockThreshold ?? null,
      current_stock: stock, is_low_stock: stock <= thr,
      image_url: (p.imageUrl as string | null) ?? null
    }
  })
})
