import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { customers, orders } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, expireStaleOrders, ordersOut } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  // Lazy expiry: order UNPAID yang lewat TTL dibatalkan + stok dikembalikan
  // sebelum halaman ini dilayani (butuh cron di serverless).
  await expireStaleOrders(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 20))

  // Filter + paginasi di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (q.status) conds.push(eq(orders.status, String(q.status)))
  if (q.channel) conds.push(eq(orders.channelOrigin, String(q.channel)))
  if (q.payment_status) conds.push(eq(orders.paymentStatus, String(q.payment_status)))
  if (q.payment_method) conds.push(eq(orders.paymentMethod, String(q.payment_method)))
  if (q.payment_review) conds.push(eq(orders.paymentReview, String(q.payment_review)))
  if (q.delivery_status) conds.push(eq(orders.deliveryStatus, String(q.delivery_status)))
  if (q.q) {
    // `q` = potongan ID order ATAU nama/kontak/identifier pelanggan (1 query,
    // escape wildcard LIKE seperti di catalog/search).
    const like = `%${String(q.q).trim().replace(/[\\%_]/g, '\\$&')}%`
    const searchable = or(
      sql`cast(${orders.id} as text) ilike ${like}`,
      ilike(orders.buyerName, like), ilike(orders.buyerContact, like), ilike(orders.buyerPhone, like),
      inArray(orders.customerId, db.select({ id: customers.id }).from(customers)
        .where(or(ilike(customers.name, like), ilike(customers.contact, like), ilike(customers.identifier, like))))
    )
    if (searchable) conds.push(searchable)
  }
  const slice = await db.select().from(orders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return await ordersOut(db, slice)
})
