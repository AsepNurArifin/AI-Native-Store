import { eq, sql } from 'drizzle-orm'
import { orders } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, logAudit, orderOut } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

/**
 * POST /orders/:id/pay — konfirmasi pembayaran manual oleh kasir.
 *
 * QRIS di app/utils/qris.ts adalah SIMULASI (merchant ID contoh, tidak bisa
 * dibayar di app sungguhan), jadi tidak ada webhook payment gateway. unpaid ->
 * paid adalah keputusan manusia, dan itu disengaja (prinsip README: "Mutasi data
 * hanya lewat jalur manusia/konfirmasi").
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
    // Sudah dibayar -> early return, paid_at tidak ditimpa.
    if (o.paymentStatus === 'PAID') return
    // Jangan izinkan bayar order yang sudah lewat TTL tapi belum di-expire.
    const exp = o.expiresAt ? new Date(o.expiresAt as unknown as string) : null
    if (exp && exp < new Date()) {
      throw createError({
        statusCode: 409,
        message: 'Order sudah kedaluwarsa (lewat batas pembayaran). Batalkan lalu buat pesanan baru.',
        data: { detail: { code: 'ORDER_EXPIRED', message: 'Order sudah kedaluwarsa (lewat batas pembayaran). Batalkan lalu buat pesanan baru.' } }
      })
    }
    await tx.update(orders).set({ paymentStatus: 'PAID', paidAt: new Date() as never }).where(eq(orders.id, o.id))
    await logAudit(tx, 'ORDER_PAID', 'USER', { actorId: owner.id, detail: { order_id: id, amount: String(o.totalAmount) } })
  })
  return await orderOut(db, id)
})