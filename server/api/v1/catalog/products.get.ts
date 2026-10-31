import { and, asc, eq, sql } from 'drizzle-orm'
import { inventoryTransactions, products } from '../../../database/schema'
import { catalogList } from '../../../utils/business'

/**
 * Katalog satu kategori untuk halaman /rak/[category] — tanpa JWT.
 * PERBAIKAN performa: ORDER BY + LIMIT pindah ke SQL (sebelumnya TANPA limit —
 * memuat SEMUA produk kategori), dan filter `stock_only` di SQL (subquery stok,
 * pola yang sama dengan /catalog/search) alih-alih difilter di JS setelah
 * seluruh stok diambil. Tanpa sort eksplisit URUTAN HARUS DETERMINISTIK —
 * urutan arbitrer Postgres membuat isi halaman rak berganti-sendiri antar request.
 */
export default defineEventHandler(async (event) => {
  const db = getDb()
  const q = getQuery(event)
  const category = String(q.category || '')
  if (!category) {
    throw createError({ statusCode: 422, message: 'Parameter category wajib', data: { detail: 'Parameter category wajib' } })
  }
  const stockOnly = String(q.stock_only || '') === 'true'
  const limit = Math.min(Math.max(Number(q.limit || 60), 1), 100)
const offset = Math.max(Number(q.offset || 0), 0)
  const conds = [eq(products.status, 'ACTIVE'), eq(products.category, category)]
  if (stockOnly) {
    conds.push(sql`(select coalesce(sum(case when ${inventoryTransactions.movement} = 'IN' then ${inventoryTransactions.quantity} else -${inventoryTransactions.quantity} end), 0)
      from ${inventoryTransactions} where ${inventoryTransactions.productId} = ${products.id}) > 0`)
  }
  const rows = await db.select().from(products).where(and(...conds)).orderBy(asc(products.name)).limit(limit).offset(offset)
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  return await catalogList(db, rows, lowDefault)
})
