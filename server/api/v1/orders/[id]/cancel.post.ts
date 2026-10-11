import { sql } from 'drizzle-orm'
import { requireOwner } from '../../../../utils/auth'
import { cancelOrderTx, ensureSeeded, orderOut } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  // 1 transaksi + kunci baris order: cancel & complete/expire paralel tidak mungkin
  // double-restock (dulu check-then-update tanpa lock = stok bisa kembali 2x).
  // status + payment_state + conversation_id: bukan lagi "stock reservation".
  // Stock SANGAT dikembalikan saat cancel/expire — reserve hanya menahan sampai TTL.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`)
    const r = await cancelOrderTx(tx as never, id, { actorId: owner.id, actorType: 'USER', reason: 'manual' })
    if (!r.cancelled) {
      const st = String(r.order.status)
      throw createError({
        statusCode: 409,
        message: `Order berstatus ${st} tidak bisa dibatalkan`,
        data: { detail: { code: 'INVALID_STATE', message: `Order berstatus ${st} tidak bisa dibatalkan` } }
      })
    }
  })
  return await orderOut(db, id)
})