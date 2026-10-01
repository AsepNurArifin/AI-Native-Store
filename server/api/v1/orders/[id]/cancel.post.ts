import { eq } from 'drizzle-orm'
import { inventoryTransactions, orderItems, orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, num } from '../../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  const rows = await db.select().from(orders).where(eq(orders.id, id as never)).limit(1)
  const o = rows[0]
  if (!o) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  if (o.status !== 'CONFIRMED') {
    throw createError({ statusCode: 409, message: `Order berstatus ${o.status} tidak bisa dibatalkan`, data: { detail: { code: 'INVALID_STATE', message: `Order berstatus ${o.status} tidak bisa dibatalkan` } } })
  }
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
  for (const it of items) {
    await db.insert(inventoryTransactions).values({
      productId: it.productId, type: 'ADJUSTMENT', movement: 'IN', referenceType: 'CANCELLATION', quantity: it.quantity, referenceId: o.id
    })
  }
  await db.update(orders).set({ status: 'CANCELLED', cancelledAt: new Date() as never }).where(eq(orders.id, o.id))
  const fresh = (await db.select().from(orders).where(eq(orders.id, id as never)).limit(1))[0]
  return {
    id: String(fresh.id), customer_id: String(fresh.customerId), status: fresh.status,
    conversation_id: fresh.conversationId ? String(fresh.conversationId) : null,
    channel_origin: fresh.channelOrigin, total_amount: num(fresh.totalAmount),
    promotion_snapshot: fresh.promotionSnapshot || null, fulfillment: fresh.fulfillment || null,
    created_at: (fresh.createdAt as Date).toISOString(),
    completed_at: fresh.completedAt ? (fresh.completedAt as Date).toISOString() : null,
    cancelled_at: fresh.cancelledAt ? (fresh.cancelledAt as Date).toISOString() : null,
    items: items.map(i => ({ id: String(i.id), product_id: String(i.productId), quantity: i.quantity, price_at_order: num(i.priceAtOrder), line_total: num(i.lineTotal) }))
  }
})
