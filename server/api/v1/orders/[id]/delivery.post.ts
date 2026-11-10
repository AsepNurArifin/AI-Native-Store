import { eq, sql } from 'drizzle-orm'
import { orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, isDeliveryOrder, logAudit, orderOut } from '../../../../utils/business'
import { apiError, isUuid } from '../../../../utils/errors'

/** Manual courier/customer confirmation only; no elapsed-time delivery inference. */
export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) apiError(404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan.')
  const body = await readBody<{ status?: unknown }>(event)
  const target = body?.status
  if (target !== 'SHIPPING' && target !== 'DELIVERED') apiError(422, 'VALIDATION', 'status wajib SHIPPING atau DELIVERED.')
  const db = getDb()
  await ensureSeeded(db)
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`)
    const order = (await tx.select().from(orders).where(eq(orders.id, id)).limit(1))[0]
    if (!order) apiError(404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan.')
    if (!isDeliveryOrder(order)) apiError(409, 'INVALID_STATE', 'Status pengiriman hanya berlaku untuk pesanan antar.')
    if (order.paymentStatus !== 'PAID' || (order.paymentMethod === 'QRIS' && order.paymentReview !== 'VERIFIED')) apiError(409, 'NOT_PAID', 'Pembayaran harus diverifikasi sebelum mengirim pesanan.')
    // Matching replay keeps the original shipment/receipt timestamps.
    if (order.deliveryStatus === target && (order.status === 'CONFIRMED' || order.status === 'COMPLETED')) return
    if (order.status !== 'CONFIRMED') apiError(409, 'INVALID_STATE', `Order berstatus ${order.status} tidak bisa diperbarui pengirimannya.`)
    const current = order.deliveryStatus ?? 'NOT_SHIPPED'
    if (!((current === 'NOT_SHIPPED' && target === 'SHIPPING') || (current === 'SHIPPING' && target === 'DELIVERED'))) apiError(409, 'INVALID_STATE', 'Pengiriman harus maju dari NOT_SHIPPED ke SHIPPING lalu DELIVERED.')
    const now = new Date()
    await tx.update(orders).set({ deliveryStatus: target as 'SHIPPING' | 'DELIVERED', ...(target === 'SHIPPING' ? { shippedAt: now } : { deliveredAt: now }) }).where(eq(orders.id, order.id))
    await logAudit(tx, target === 'SHIPPING' ? 'ORDER_SHIPPED' : 'ORDER_DELIVERED', 'USER', { actorId: owner.id, detail: { order_id: id, previous_status: current, delivery_status: target, confirmation: 'manual' } })
  })
  return await orderOut(db, id)
})
