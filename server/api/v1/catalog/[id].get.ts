import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { activePromosFor, catalogOut, stocksFor } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

/** Detail produk publik untuk halaman /produk/[id] — tanpa JWT, hanya ACTIVE. */
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  const p = rows[0]
  if (!p || p.status !== 'ACTIVE') throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  const [stocks, promos] = await Promise.all([stocksFor(db, [id]), activePromosFor(db, [id])])
  // catalogOut sudah memuat promotion + harga efektif kanonik.
  return catalogOut(p, stocks.get(id) ?? 0, lowDefault, promos.get(id) ?? null)
})
