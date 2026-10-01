import { and, asc, desc, eq, exists, ilike, or, sql } from 'drizzle-orm'
import { inventoryTransactions, products, promotions } from '../../../database/schema'
import { catalogList } from '../../../utils/business'

/**
 * Pencarian katalog publik (marketplace): q opsional, category opsional,
 * sort: termurah | termahal | terbaru. Tanpa JWT.
 * Filter + sort + limit dikerjakan di SQL (hemat transfer & komputasi).
 */
export default defineEventHandler(async (event) => {
  const db = getDb()
  const q = getQuery(event)
  const keyword = String(q.q || '').toLowerCase().trim()
  const category = String(q.category || '').trim()
  const sort = String(q.sort || '')
  const promoOnly = String(q.promo_only || '') === 'true'
  const stockOnly = String(q.stock_only || '') === 'true'
  const limit = Math.min(Math.max(Number(q.limit || 24), 1), 100)

  const conds = [eq(products.status, 'ACTIVE')]
  if (category) conds.push(sql`lower(${products.category}) = ${category.toLowerCase()}`)
  if (keyword) {
    // Escape wildcard LIKE supaya sama persis dengan substring match lama
    const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`
    const kw = or(ilike(products.name, like), ilike(products.category, like), sql`${products.specification}::text ilike ${like}`)
    if (kw) conds.push(kw)
  }
  if (promoOnly) {
    conds.push(exists(
      db.select({ x: sql`1` }).from(promotions).where(and(
        eq(promotions.productId, products.id),
        eq(promotions.status, 'ACTIVE'),
        sql`${promotions.startDate} <= now()`,
        sql`${promotions.endDate} > now()`
      ))
    ))
  }
  if (stockOnly) {
    conds.push(sql`(select coalesce(sum(case when ${inventoryTransactions.movement} = 'IN' then ${inventoryTransactions.quantity} else -${inventoryTransactions.quantity} end), 0)
      from ${inventoryTransactions} where ${inventoryTransactions.productId} = ${products.id}) > 0`)
  }

  let query = db.select().from(products).where(and(...conds))
  const orderBy = sort === 'termurah' ? [asc(products.price)]
    : sort === 'termahal' ? [desc(products.price)]
    : sort === 'terbaru' ? [desc(products.createdAt)]
    : []

  const rows = await query.orderBy(...orderBy).limit(limit)
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  return await catalogList(db, rows, lowDefault)
})
