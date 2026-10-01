import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { conversations, customers } from '../../../../database/schema'
import { createOrderFromSummary, ensureSeeded } from '../../../../utils/business'
import { getSummary } from '../../../../utils/summary'
import { OrderError, toOrderHttpCode } from '../../../../utils/errors'
import { isUuid } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  const convRows = await db.select().from(conversations).where(eq(conversations.id, id as never)).limit(1)
  const conv = convRows[0]
  if (!conv) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  const custRows = await db.select().from(customers).where(eq(customers.id, conv.customerId)).limit(1)
  const customer = custRows[0]
  if (!customer) throw createError({ statusCode: 404, message: 'Customer tidak ditemukan', data: { detail: 'Customer tidak ditemukan' } })

  const body = await readBody<{ order_summary_ref?: string, idempotency_key?: string | null, customer?: { name?: string, contact?: string }, fulfillment?: Record<string, unknown> | null }>(event)
  if (!body?.order_summary_ref) {
    throw createError({ statusCode: 422, message: 'order_summary_ref wajib', data: { detail: { code: 'VALIDATION', message: 'order_summary_ref wajib' } } })
  }
  const summary = getSummary(body.order_summary_ref)
  if (!summary) {
    throw createError({
      statusCode: 410, message: 'Ringkasan pesanan sudah kedaluwarsa. Ulangi pencarian produk.',
      data: { detail: { code: 'SUMMARY_EXPIRED', message: 'Ringkasan pesanan sudah kedaluwarsa. Ulangi pencarian produk.' } }
    })
  }
  const identity = conv.channel === 'TELEGRAM'
    ? { channel: 'TELEGRAM', identifier: customer.identifier, name: customer.name, contact: customer.contact }
    : {
        channel: 'WEB',
        identifier: `${body.customer?.name || 'guest'}|${body.customer?.contact || 'guest'}`,
        name: body.customer?.name || 'Tamu',
        contact: body.customer?.contact || null
      }
  try {
    const { order, replayed } = await createOrderFromSummary(db, {
      conversationId: id, channel: conv.channel, customerIdentity: identity,
      items: summary.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      idempotencyKey: body.idempotency_key || randomUUID(),
      fulfillment: body.fulfillment || null
    })
    await db.update(conversations).set({ outcome: 'ORDERED' }).where(eq(conversations.id, id as never))
    return {
      order_id: String(order.id), status: order.status, total: Number(order.totalAmount),
      items: summary.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      replayed
    }
  }
  catch (e) {
    if (e instanceof OrderError) {
      throw createError({ statusCode: toOrderHttpCode(e.code), message: e.message, data: { detail: { code: e.code, message: e.message, ...e.details } } })
    }
    throw e
  }
})
