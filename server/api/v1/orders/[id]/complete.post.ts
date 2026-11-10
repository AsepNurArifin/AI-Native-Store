import { eq, sql } from 'drizzle-orm'
import { orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, isDeliveryOrder, logAudit, orderOut } from '../../../../utils/business'
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
    // Bukti QRIS wajib diverifikasi manual; UNPAID tidak boleh selesai.
    if (o.paymentStatus !== 'PAID') {
      throw createError({
        statusCode: 409,
        message: 'Order belum dibayar — konfirmasi pembayaran dulu (Mark Paid).',
        data: { detail: { code: 'NOT_PAID', message: 'Order belum dibayar — konfirmasi pembayaran dulu (Mark Paid).' } }
      })
    }
    if (o.paymentMethod === 'QRIS' && o.paymentReview !== 'VERIFIED') throw createError({ statusCode: 409, message: 'Bukti QRIS belum diverifikasi.', data: { detail: { code: 'NOT_PAID', message: 'Bukti QRIS belum diverifikasi.' } } })
    if (isDeliveryOrder(o) && (o.paymentMethod !== null || o.deliveryStatus !== null) && o.deliveryStatus !== 'DELIVERED') throw createError({ statusCode: 409, message: 'Konfirmasi barang diterima sebelum menyelesaikan pesanan antar.', data: { detail: { code: 'DELIVERY_NOT_DELIVERED', message: 'Konfirmasi barang diterima sebelum menyelesaikan pesanan antar.' } } })
    await tx.update(orders).set({ status: 'COMPLETED', completedAt: new Date() as never }).where(eq(orders.id, o.id))
    await logAudit(tx, 'ORDER_COMPLETED', 'USER', { actorId: owner.id, detail: { order_id: id } })
  })
  return await orderOut(db, id)
})