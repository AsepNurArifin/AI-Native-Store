import { eq } from 'drizzle-orm'
import { inventoryTransactions, products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, logAudit, recordTx } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ product_id?: string, movement?: string, quantity?: number }>(event)
  if (!body?.product_id || !body?.movement || !body?.quantity) {
    throw createError({ statusCode: 422, message: 'product_id, movement, quantity wajib', data: { detail: { code: 'VALIDATION', message: 'product_id, movement, quantity wajib' } } })
  }
  if (!['IN', 'OUT'].includes(body.movement)) {
    throw createError({ statusCode: 422, message: 'movement harus IN/OUT', data: { detail: { code: 'VALIDATION', message: 'movement harus IN/OUT' } } })
  }
  const p = (await db.select().from(products).where(eq(products.id, body.product_id as never)).limit(1))[0]
  if (!p) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  if (p.status !== 'ACTIVE') {
    throw createError({ statusCode: 409, message: `${p.name} tidak aktif`, data: { detail: { code: 'PRODUCT_INACTIVE', message: `${p.name} tidak aktif` } } })
  }
  if (body.movement === 'OUT') {
    const stock = await currentStock(db, String(p.id))
    if (stock < body.quantity!) {
      throw createError({ statusCode: 409, message: `Stok ${p.name} hanya ${stock}`, data: { detail: { code: 'INSUFFICIENT_STOCK', message: `Stok ${p.name} hanya ${stock}` } } })
    }
  }
  await recordTx(db, { productId: String(p.id), type: 'ADJUSTMENT', movement: body.movement as 'IN' | 'OUT', referenceType: 'MANUAL', quantity: body.quantity!, actorId: owner.id })
  await logAudit(db, 'STOCK_ADJUSTED', 'USER', {
    actorId: owner.id, detail: { product_id: String(p.id), movement: body.movement, quantity: body.quantity }
  })
  setResponseStatus(event, 201)
  return { ok: true }
})
