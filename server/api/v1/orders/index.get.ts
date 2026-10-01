import { desc, eq } from 'drizzle-orm'
import { orderItems, orders } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, num } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 20))
  let all = await db.select().from(orders).orderBy(desc(orders.createdAt))
  if (q.status) all = all.filter(o => o.status === String(q.status))
  if (q.channel) all = all.filter(o => o.channelOrigin === String(q.channel))
  const total = all.length
  const slice = all.slice((page - 1) * pageSize, page * pageSize)
  const data = []
  for (const o of slice) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    data.push({
      id: String(o.id), customer_id: String(o.customerId), status: o.status,
      conversation_id: o.conversationId ? String(o.conversationId) : null,
      channel_origin: o.channelOrigin, total_amount: num(o.totalAmount),
      promotion_snapshot: o.promotionSnapshot || null, fulfillment: o.fulfillment || null,
      created_at: (o.createdAt as Date).toISOString(),
      completed_at: o.completedAt ? (o.completedAt as Date).toISOString() : null,
      cancelled_at: o.cancelledAt ? (o.cancelledAt as Date).toISOString() : null,
      items: items.map(i => ({ id: String(i.id), product_id: String(i.productId), quantity: i.quantity, price_at_order: num(i.priceAtOrder), line_total: num(i.lineTotal) }))
    })
  }
  return data
})
