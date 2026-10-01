import { randomUUID } from 'node:crypto'
import { createOrderFromSummary, ensureSeeded } from '../../../utils/business'
import { OrderError, toOrderHttpCode, isUuid } from '../../../utils/errors'

/**
 * Checkout langsung (tanpa chat/AI): items -> order -> QRIS.
 * Harga & stok diverifikasi atomik di createOrderFromSummary.
 */
export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)

  const body = await readBody<{
    items?: Array<{ product_id?: string, quantity?: number }>
    customer?: { name?: string, contact?: string }
    fulfillment?: Record<string, unknown> | null
    idempotency_key?: string | null
  }>(event)

  const items = (body?.items || []).map(it => ({ product_id: String(it?.product_id || ''), quantity: Number(it?.quantity) }))
  const invalid = (msg: string) => {
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'VALIDATION', message: msg } } })
  }
  if (!items.length || items.length > 50) invalid('items wajib 1-50')
  for (const it of items) {
    if (!isUuid(it.product_id)) invalid(`Produk ${it.product_id} tidak ditemukan.`)
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) invalid('Quantity harus bilangan bulat positif.')
  }

  const name = body?.customer?.name?.trim() || 'Tamu'
  const contact = body?.customer?.contact?.trim() || 'guest'
  try {
    const { order, replayed } = await createOrderFromSummary(db, {
      conversationId: null,
      channel: 'WEB',
      customerIdentity: { channel: 'WEB', identifier: `${name}|${contact}`, name, contact },
      items,
      idempotencyKey: body?.idempotency_key || randomUUID(),
      fulfillment: body?.fulfillment || null
    })
    return {
      order_id: String(order.id), status: order.status, total: Number(order.totalAmount),
      items: items.map(it => ({ product_id: it.product_id, quantity: it.quantity })),
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
