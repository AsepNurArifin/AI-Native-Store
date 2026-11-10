import { eq, sql } from 'drizzle-orm'
import { orderPaymentProofs, orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, logAudit, orderOut } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

/**
 * POST /orders/:id/pay — konfirmasi pembayaran manual oleh kasir.
 *
 * QRIS dibayar lewat gambar merchant yang dikonfigurasi (demo diberi label).
 * Bukti diunggah pembeli tidak otomatis membuat PAID: keputusan tetap admin.
 *
 * Idempoten: pays ulang order yang sudah PAID -> 200, tidak error, tidak
 * mengubah paid_at (timestamp asli pembayaran tetap jujur).
 */
export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`)
    const rows = await tx.select().from(orders).where(eq(orders.id, id as never)).limit(1)
    const o = rows[0]
    if (!o) throw createError({ statusCode: 404, message: 'Order tidak ditemukan', data: { detail: 'Order tidak ditemukan' } })
    if (o.status !== 'CONFIRMED') {
      throw createError({
        statusCode: 409,
        message: `Order berstatus ${o.status} tidak bisa dibayar`,
        data: { detail: { code: 'INVALID_STATE', message: `Order berstatus ${o.status} tidak bisa dibayar` } }
      })
    }
    if (o.paymentMethod === 'QRIS') {
      const proof = (await tx.select({ orderId: orderPaymentProofs.orderId }).from(orderPaymentProofs).where(eq(orderPaymentProofs.orderId, o.id)).limit(1))[0]
      if (!proof) throw createError({ statusCode: 422, message: 'Bukti pembayaran QRIS wajib tersedia.', data: { detail: { code: 'PAYMENT_PROOF_REQUIRED', message: 'Bukti pembayaran QRIS wajib tersedia.' } } })
      if (o.paymentReview !== 'PENDING' && !(o.paymentStatus === 'PAID' && o.paymentReview === 'VERIFIED')) throw createError({ statusCode: 409, message: 'Bukti pembayaran tidak menunggu verifikasi.', data: { detail: { code: 'INVALID_STATE', message: 'Bukti pembayaran tidak menunggu verifikasi.' } } })
    }
    // Sudah dibayar -> replay tidak menimpa paid_at atau review timestamp.
    if (o.paymentStatus === 'PAID') return
    // CASH/legacy memiliki deadline; bukti QRIS menunggu review tanpa expiry.
    const exp = o.expiresAt ? new Date(o.expiresAt as unknown as string) : null
    if (o.paymentMethod !== 'QRIS' && exp && exp < new Date()) {
      throw createError({
        statusCode: 409,
        message: 'Order sudah kedaluwarsa (lewat batas pembayaran). Batalkan lalu buat pesanan baru.',
        data: { detail: { code: 'ORDER_EXPIRED', message: 'Order sudah kedaluwarsa (lewat batas pembayaran). Batalkan lalu buat pesanan baru.' } }
      })
    }
    await tx.update(orders).set({ paymentStatus: 'PAID', paidAt: new Date(), ...(o.paymentMethod === 'QRIS' ? { paymentReview: 'VERIFIED', paymentReviewNote: null, expiresAt: null } : {}) }).where(eq(orders.id, o.id))
    await logAudit(tx, 'ORDER_PAID', 'USER', { actorId: owner.id, detail: { order_id: id, amount: String(o.totalAmount), payment_method: o.paymentMethod, payment_review: o.paymentMethod === 'QRIS' ? 'VERIFIED' : null } })
  })
  return await orderOut(db, id)
})