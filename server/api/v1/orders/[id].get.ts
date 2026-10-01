import { eq } from 'drizzle-orm'
import { orderItems, orders } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  const rows = await db.select().from(orders).where(eq(orders.id, id as never)).limit(1)
  const o = rows[0]
  if (!o) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
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
})
