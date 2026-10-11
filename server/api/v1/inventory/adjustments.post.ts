import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, logAudit, num, recordTx } from '../../../utils/business'
import { OrderError } from '../../../utils/errors'

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
  // PERBAIKAN: validasi quantity di sini. Sebelumnya hanya dicek truthiness, jadi
  // -5 / 1.5 / "abc" lolos lalu recordTx() melempar OrderError yang TIDAK ditangkap
  // handler ini -> HTTP 500. Sekarang ditolak 422 sebelum menyentuh DB.
  const qty = Number(body.quantity)
  if (!Number.isInteger(qty) || qty <= 0) {
    const msg = 'quantity harus bilangan bulat positif'
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'INVALID_QTY', message: msg } } })
  }
  const p = (await db.select().from(products).where(eq(products.id, body.product_id as never)).limit(1))[0]
  if (!p) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  if (p.status !== 'ACTIVE') {
    throw createError({ statusCode: 409, message: `${p.name} tidak aktif`, data: { detail: { code: 'PRODUCT_INACTIVE', message: `${p.name} tidak aktif` } } })
  }
  if (body.movement === 'OUT') {
    const stock = await currentStock(db, String(p.id))
    if (stock < qty) {
      throw createError({ statusCode: 409, message: `Stok ${p.name} hanya ${stock}`, data: { detail: { code: 'INSUFFICIENT_STOCK', message: `Stok ${p.name} hanya ${stock}` } } })
    }
  }
  try {
    await recordTx(db, { productId: String(p.id), type: 'ADJUSTMENT', movement: body.movement as 'IN' | 'OUT', referenceType: 'MANUAL', quantity: qty, actorId: owner.id })
  }
  catch (e) {
    if (e instanceof OrderError) {
      throw createError({ statusCode: e.code === 'INSUFFICIENT_STOCK' ? 409 : 422, message: e.message, data: { detail: { code: e.code, message: e.message, ...e.details } } })
    }
    throw e
  }
  await logAudit(db, 'STOCK_ADJUSTED', 'USER', {
    actorId: owner.id, detail: { product_id: String(p.id), movement: body.movement, quantity: qty }
  })
  setResponseStatus(event, 201)
  return { ok: true, product_id: String(p.id), movement: body.movement, quantity: qty, current_stock: num(await currentStock(db, String(p.id))) }
})