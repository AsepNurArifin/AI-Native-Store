import { createOrderFromSummary, ensureSeeded } from '../../../utils/business'
import { OrderError, toOrderHttpCode, isUuid } from '../../../utils/errors'
import { webIdentity } from '../../../utils/identity'
import { clientIp, rateLimit } from '../../../utils/ratelimit'

/** Batas kolom idempotency_keys.key = VARCHAR(64). */
const MAX_KEY_LEN = 64
/** Anti-spam: order UNPAID menahan stok sampai TTL — dibatasi 10/15 menit per IP. */
const MAX_ORDERS = 10
const ORDER_WINDOW_MS = 15 * 60_000

/**
 * Checkout langsung (tanpa chat/AI): items -> order -> QRIS.
 * Harga & stok diverifikasi atomik di createOrderFromSummary.
 */
export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  if (!rateLimit(`orders:${clientIp(event)}`, MAX_ORDERS, ORDER_WINDOW_MS)) {
    setResponseHeader(event, 'Retry-After', Math.ceil(ORDER_WINDOW_MS / 1000))
    throw createError({ statusCode: 429, message: 'Terlalu banyak pesanan dari koneksi ini. Coba lagi beberapa menit lagi.', data: { detail: { code: 'RATE_LIMITED', message: 'Terlalu banyak pesanan dari koneksi ini. Coba lagi beberapa menit lagi.' } } })
  }

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
  // Idempotency key wajib dari client (UC-02 E5): retry dengan key yang sama
  // tidak boleh membuat order ganda. Fallback random sengaja DIHAPUS.
  // PERBAIKAN: panjang juga dibatasi — kolom DB VARCHAR(64); key > 64 char
  // sebelumnya memicu error Postgres 22001 -> HTTP 500.
  const idempotencyKey = String(body?.idempotency_key || '').trim()
  if (!idempotencyKey) {
    const msg = 'idempotency_key wajib — kirim ulang key yang sama bila retry.'
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: msg } } })
  }
  if (idempotencyKey.length > MAX_KEY_LEN) {
    const msg = `idempotency_key maksimal ${MAX_KEY_LEN} karakter.`
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'VALIDATION', message: msg } } })
  }
  for (const it of items) {
    if (!isUuid(it.product_id)) invalid(`Produk ${it.product_id} tidak ditemukan.`)
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) invalid('Quantity harus bilangan bulat positif.')
  }

  // PERBAIKAN: identitas guest tidak lagi 'Tamu|guest' (semua pembeli anonim
  // menyatu ke satu customer). Session id diterbitkan server via cookie.
  const web = webIdentity(event)
  const name = body?.customer?.name?.trim() || 'Tamu'
  const contact = body?.customer?.contact?.trim() || null
  try {
    const { order, replayed } = await createOrderFromSummary(db, {
      conversationId: null,
      channel: 'WEB',
      customerIdentity: { channel: 'WEB', identifier: web.identifier, name, contact },
      items,
      idempotencyKey,
      fulfillment: body?.fulfillment || null
    })
    return {
      order_id: String(order.id), status: order.status, total: Number(order.totalAmount),
      // Sejak kini deadline bayar dihitung dari server, bukan duplikasi konstanta client.
      expires_at: order.expiresAt ? new Date(order.expiresAt as unknown as Date).toISOString() : null,
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
