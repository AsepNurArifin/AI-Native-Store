import { and, eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { catalogList } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const q = getQuery(event)
  const category = String(q.category || '')
  if (!category) {
    throw createError({ statusCode: 422, message: 'Parameter category wajib', data: { detail: 'Parameter category wajib' } })
  }
  const stockOnly = String(q.stock_only || '') === 'true'
  const rows = await db.select().from(products).where(and(eq(products.status, 'ACTIVE'), eq(products.category, category)))
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  const out = await catalogList(db, rows, lowDefault)
  return stockOnly ? out.filter(p => (p.current_stock as number) > 0) : out
})
