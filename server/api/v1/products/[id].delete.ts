import { eq, sql } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, logAudit } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  if (!rows[0]) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  // Tolak hapus destruktif bila direferensikan
  const refs = await db.execute(sql`SELECT 1 FROM order_items WHERE product_id = ${id}::uuid LIMIT 1`)
  const hasRef = Array.isArray(refs) ? refs.length > 0 : ((refs as unknown as { rows?: unknown[] })?.rows?.length || 0) > 0
  if (hasRef) {
    throw createError({ statusCode: 409, message: 'Produk sudah dipakai order, nonaktifkan saja', data: { detail: { code: 'PRODUCT_IN_USE', message: 'Produk sudah dipakai order, nonaktifkan saja' } } })
  }
  await db.execute(sql`DELETE FROM inventory_transactions WHERE product_id = ${id}::uuid`)
  await db.execute(sql`DELETE FROM promotions WHERE product_id = ${id}::uuid`)
  await db.delete(products).where(eq(products.id, id as never))
  await logAudit(db, 'PRODUCT_DELETED', 'USER', { actorId: owner.id, detail: { product_id: id } })
  setResponseStatus(event, 204)
  return null
})
