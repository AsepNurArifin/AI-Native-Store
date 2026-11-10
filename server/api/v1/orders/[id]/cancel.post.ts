import { sql } from 'drizzle-orm'
import { requireOwner } from '../../../../utils/auth'
import { cancelOrderTx, ensureSeeded, orderOut } from '../../../../utils/business'
import { apiError, isUuid, OrderError, toOrderHttpCode } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  const body = await readBody<{ reason?: unknown } | undefined>(event)
  if (body?.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 1000)) apiError(422, 'VALIDATION', 'reason harus berupa teks maksimal 1000 karakter.')
  const reason = typeof body?.reason === 'string' ? body.reason.trim() || 'manual' : 'manual'
  // 1 transaksi + kunci baris order: cancel & complete/expire paralel tidak mungkin
  // double-restock (dulu check-then-update tanpa lock = stok bisa kembali 2x).
  // status + payment_state + conversation_id: bukan lagi "stock reservation".
  // Stock SANGAT dikembalikan saat cancel/expire — reserve hanya menahan sampai TTL.
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`)
      const r = await cancelOrderTx(tx, id, { actorId: owner.id, actorType: 'USER', reason })
      if (!r.cancelled) apiError(409, 'INVALID_STATE', `Order berstatus ${r.order.status} tidak bisa dibatalkan`)
    })
  }
  catch (error) {
    if (error instanceof OrderError) apiError(toOrderHttpCode(error.code), error.code, error.message, error.details)
    throw error
  }
  return await orderOut(db, id)
})