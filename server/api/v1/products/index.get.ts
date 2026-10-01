import { desc, eq, ilike, or, sql } from 'drizzle-orm'
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

  let rows = await db.select().from(products).limit(limit)
  if (search) {
    const s = search.toLowerCase()
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || JSON.stringify(r.specification).toLowerCase().includes(s))
  }
  if (category) rows = rows.filter(r => r.category === category)
  if (status) rows = rows.filter(r => r.status === status)
  if (budgetMax) rows = rows.filter(r => num(r.price) <= budgetMax)
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  const sliced = rows.slice(0, limit)
  const stocks = await stocksFor(db, sliced.map(p => String(p.id)))
  return sliced.map((p) => {
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
