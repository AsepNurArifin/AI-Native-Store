import { desc, eq } from 'drizzle-orm'
import { customers, orderItems, orders } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Customer tidak ditemukan', data: { detail: 'Customer tidak ditemukan' } })
  const rows = await db.select().from(customers).where(eq(customers.id, id as never)).limit(1)
  const c = rows[0]
  if (!c) throw createError({ statusCode: 404, message: 'Customer tidak ditemukan', data: { detail: 'Customer tidak ditemukan' } })
  const ords = await db.select().from(orders).where(eq(orders.customerId, c.id)).orderBy(desc(orders.createdAt))
  return {
    id: String(c.id), channel: c.channel, identifier: c.identifier, name: c.name,
    contact: c.contact, registered_at: (c.registeredAt as Date).toISOString(),
    orders: ords.map(o => ({ id: String(o.id), status: o.status, total: num(o.totalAmount), created_at: (o.createdAt as Date).toISOString() }))
  }
})
