import { eq } from 'drizzle-orm'
import { orderItems, orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, num } from '../../../../utils/business'

async function orderOut(db: ReturnType<typeof getDb>, id: string) {
  const o = (await db.select().from(orders).where(eq(orders.id, id as never)).limit(1))[0]
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id as never))
  return {
    id: String(o.id), customer_id: String(o.customerId), status: o.status,
    conversation_id: o.conversationId ? String(o.conversationId) : null,
    channel_origin: o.channelOrigin, total_amount: num(o.totalAmount),
    promotion_snapshot: o.promotionSnapshot || null, fulfillment: o.fulfillment || null,
    created_at: (o.createdAt as Date).toISOString(),
    completed_at: o.completedAt ? (o.completedAt as Date).toISOString() : null,
    cancelled_at: o.cancelledAt ? (o.cancelledAt as Date).toISOString() : null,
    items: items.map(i => ({ id: String(i.id), product_id: String(i.productId), quantity: i.quantity, price_at_order: num(i.priceAtOrder), line_total: num(i.lineTotal) }))
  }
}

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  const rows = await db.select().from(orders).where(eq(orders.id, id as never)).limit(1)
  const o = rows[0]
  if (!o) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  if (o.status !== 'CONFIRMED') {
    throw createError({ statusCode: 409, message: `Order berstatus ${o.status} tidak bisa diselesaikan`, data: { detail: { code: 'INVALID_STATE', message: `Order berstatus ${o.status} tidak bisa diselesaikan` } } })
  }
  await db.update(orders).set({ status: 'COMPLETED', completedAt: new Date() as never }).where(eq(orders.id, o.id))
  return await orderOut(db, id)
})
