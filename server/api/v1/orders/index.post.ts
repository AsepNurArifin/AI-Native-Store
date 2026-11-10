import { createOrderFromSummary, ensureSeeded } from '../../../utils/business'
import { apiError, OrderError, toOrderHttpCode, isUuid } from '../../../utils/errors'
import { webIdentity } from '../../../utils/identity'
import { clientIp, rateLimit } from '../../../utils/ratelimit'
import { readCheckoutInput } from '../../../utils/payment-proof'

const MAX_KEY_LEN = 64
const MAX_ORDERS = 10
const ORDER_WINDOW_MS = 15 * 60_000

/** Guest checkout: CASH JSON, or QRIS input JSON + proof multipart. */
export default defineEventHandler(async (event) => {
  if (!rateLimit(`orders:${clientIp(event)}`, MAX_ORDERS, ORDER_WINDOW_MS)) {
    setResponseHeader(event, 'Retry-After', Math.ceil(ORDER_WINDOW_MS / 1000))
    apiError(429, 'RATE_LIMITED', 'Terlalu banyak pesanan dari koneksi ini. Coba lagi beberapa menit lagi.')
  }
  const { input: body, proof } = await readCheckoutInput(event)
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const text = (value: unknown, field: string, max: number, required = false): string => {
    if (value !== undefined && value !== null && typeof value !== 'string') apiError(422, 'VALIDATION', `${field} harus berupa teks.`)
    const result = typeof value === 'string' ? value.trim() : ''
    if ((required && !result) || result.length > max) apiError(422, 'VALIDATION', `${field} wajib diisi dan maksimal ${max} karakter.`)
    return result
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) apiError(422, 'VALIDATION', 'items wajib 1-50.')
  const items = (body.items as unknown[]).map(value => {
    const item = record(value)
    if (!isUuid(item.product_id)) apiError(422, 'VALIDATION', 'product_id harus UUID produk yang valid.')
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) apiError(422, 'VALIDATION', 'Quantity harus bilangan bulat positif.')
    return { product_id: item.product_id as string, quantity: item.quantity as number }
  })
  if (new Set(items.map(item => item.product_id)).size !== items.length) apiError(422, 'VALIDATION', 'Produk yang sama harus digabung dalam satu item.')
  const idempotencyKey = text(body.idempotency_key, 'idempotency_key', MAX_KEY_LEN)
  if (!idempotencyKey) apiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'idempotency_key wajib — kirim ulang key yang sama bila retry.')
  const customer = record(body.customer)
  const name = text(customer.name, 'Nama pembeli', 100, true)
  const contact = text(customer.contact, 'Kontak pembeli', 100) || null
  const phone = text(customer.phone, 'No. HP pembeli', 30, true)
  const validPhone = (value: string) => /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 8 && value.replace(/\D/g, '').length <= 15
  if (!validPhone(phone)) apiError(422, 'VALIDATION', 'No. HP pembeli wajib berupa nomor telepon 8-15 angka.')
  const method = record(body.payment).method
  if (method !== 'CASH' && method !== 'QRIS') apiError(422, 'INVALID_PAYMENT_METHOD', 'payment.method wajib CASH atau QRIS.')
  const fulfillmentInput = record(body.fulfillment)
  if (fulfillmentInput.method !== 'PICKUP' && fulfillmentInput.method !== 'DELIVERY') apiError(422, 'VALIDATION', 'fulfillment.method wajib PICKUP atau DELIVERY.')
  let fulfillment: Record<string, unknown> = { method: 'PICKUP' }
  if (fulfillmentInput.method === 'DELIVERY') {
    if (method !== 'QRIS') apiError(422, 'INVALID_PAYMENT_METHOD', 'Pesanan antar hanya menerima pembayaran QRIS.')
    const deliveryPhone = text(fulfillmentInput.phone, 'No. HP penerima', 30, true)
    if (!validPhone(deliveryPhone)) apiError(422, 'VALIDATION', 'No. HP penerima wajib berupa nomor telepon 8-15 angka.')
    fulfillment = {
      method: 'DELIVERY', recipient: text(fulfillmentInput.recipient, 'Nama penerima', 100, true),
      phone: deliveryPhone, address: text(fulfillmentInput.address, 'Alamat penerima', 2000, true),
      notes: text(fulfillmentInput.notes, 'Catatan pengiriman', 1000) || undefined
    }
  }
  const db = getDb()
  await ensureSeeded(db)
  const web = webIdentity(event)
  try {
    const { order, replayed } = await createOrderFromSummary(db, {
      conversationId: null, channel: 'WEB',
      customerIdentity: { channel: 'WEB', identifier: web.identifier, name, contact },
      buyerPhone: phone, items, idempotencyKey, fulfillment,
      payment: { method },
      expectedTotal: typeof body.expected_total === 'number' ? body.expected_total : undefined,
      paymentProof: proof ? { data: proof.data, mime: proof.type || '' } : undefined
    })
    return {
      order_id: String(order.id), status: order.status, total: Number(order.totalAmount),
      expires_at: order.expiresAt ? new Date(order.expiresAt).toISOString() : null,
      payment_method: order.paymentMethod, payment_review: order.paymentReview,
      delivery_status: order.deliveryStatus,
      items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity })), replayed
    }
  }
  catch (error) {
    if (error instanceof OrderError) apiError(toOrderHttpCode(error.code), error.code, error.message, error.details)
    throw error
  }
})
