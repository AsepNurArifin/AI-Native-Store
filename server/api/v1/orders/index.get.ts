import { and, desc, eq, inArray } from 'drizzle-orm'
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

  // Filter + paginasi di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (q.status) conds.push(eq(orders.status, String(q.status)))
  if (q.channel) conds.push(eq(orders.channelOrigin, String(q.channel)))
  const slice = await db.select().from(orders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  // Batch ambil item seluruh order halaman ini dalam 1 query (tanpa N+1).
  const itemsByOrder = new Map<string, Array<typeof orderItems.$inferSelect>>()
  if (slice.length) {
    const items = await db.select().from(orderItems)
      .where(inArray(orderItems.orderId, slice.map(o => o.id) as never))
    for (const it of items) {
      const key = String(it.orderId)
      const arr = itemsByOrder.get(key) ?? []
      arr.push(it)
      itemsByOrder.set(key, arr)
    }
  }

  return slice.map(o => ({
    id: String(o.id), customer_id: String(o.customerId), status: o.status,
    conversation_id: o.conversationId ? String(o.conversationId) : null,
    channel_origin: o.channelOrigin, total_amount: num(o.totalAmount),
    promotion_snapshot: o.promotionSnapshot || null, fulfillment: o.fulfillment || null,
    created_at: (o.createdAt as Date).toISOString(),
    completed_at: o.completedAt ? (o.completedAt as Date).toISOString() : null,
    cancelled_at: o.cancelledAt ? (o.cancelledAt as Date).toISOString() : null,
    items: (itemsByOrder.get(String(o.id)) || []).map(i => ({ id: String(i.id), product_id: String(i.productId), quantity: i.quantity, price_at_order: num(i.priceAtOrder), line_total: num(i.lineTotal) }))
  }))
})
