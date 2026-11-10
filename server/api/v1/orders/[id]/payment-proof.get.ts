import { eq } from 'drizzle-orm'
import { orderPaymentProofs } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { apiError, isUuid } from '../../../../utils/errors'

/** Sensitive screenshot: never public storage, query-token auth, or cacheable URL. */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  setResponseHeader(event, 'Vary', 'Authorization')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  await requireOwner(event)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) apiError(404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan.')
  const proof = (await getDb().select().from(orderPaymentProofs).where(eq(orderPaymentProofs.orderId, id)).limit(1))[0]
  if (!proof) apiError(404, 'PAYMENT_PROOF_NOT_FOUND', 'Bukti pembayaran tidak ditemukan.')
  setResponseHeader(event, 'Content-Type', proof.mime)
  setResponseHeader(event, 'Content-Length', proof.size)
  setResponseHeader(event, 'Content-Disposition', 'inline; filename="payment-proof"')
  return proof.data
})
