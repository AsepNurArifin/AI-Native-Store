import { eq } from 'drizzle-orm'
import { orders } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, orderOut } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, id as never)).limit(1)
  if (!rows[0]) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
  // Proyeksi bersama — payment_status/paid_at/expires_at otomatis ikut terisi.
  return await orderOut(db, id)
})