import { eq, sql } from 'drizzle-orm'
import { orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, logAudit, orderOut } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  // Kunci baris order -> selesai/batal/pay paralal saling eksklusif.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`)
    const rows = await tx.select().from(orders).where(eq(orders.id, id as never)).limit(1)
    const o = rows[0]
    if (!o) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
    if (o.status !== 'CONFIRMED') {
      throw createError({ statusCode: 409, message: `Order berstatus ${o.status} tidak bisa diselesaikan`, data: { detail: { code: 'INVALID_STATE', message: `Order berstatus ${o.status} tidak bisa diselesaikan` } } })
    }
    // PERBAIKAN (migrasi 0004): order hanya boleh COMPLETED kalau SUDAH dibayar.
    // QRIS hanya simulasi jadi tidak ada webhook; tanpa gate ini kasir bisa
    // "complete" order yang tak pernah dibayar dan analitik menghitungnya revenue.
    if (o.paymentStatus !== 'PAID') {
      throw createError({
        statusCode: 409,
        message: 'Order belum dibayar — konfirmasi pembayaran dulu (Mark Paid).',
        data: { detail: { code: 'NOT_PAID', message: 'Order belum dibayar — konfirmasi pembayaran dulu (Mark Paid).' } }
      })
    }
    await tx.update(orders).set({ status: 'COMPLETED', completedAt: new Date() as never }).where(eq(orders.id, o.id))
    await logAudit(tx, 'ORDER_COMPLETED', 'USER', { actorId: owner.id, detail: { order_id: id } })
  })
  return await orderOut(db, id)
})