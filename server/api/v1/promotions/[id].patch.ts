import { eq } from 'drizzle-orm'
import { promotions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { checkOverlap, effectiveStatus, ensureSeeded, logAudit, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'
import { PROMO_STATUSES } from './index'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Promo tidak ditemukan', data: { detail: 'Promo tidak ditemukan' } })
  const rows = await db.select().from(promotions).where(eq(promotions.id, id as never)).limit(1)
  const p = rows[0]
  if (!p) throw createError({ statusCode: 404, message: 'Promo tidak ditemukan', data: { detail: 'Promo tidak ditemukan' } })
  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}
  if (body.discount_percentage !== undefined) {
    const maxD = Number(useRuntimeConfig().maxDiscountPercent ?? 50)
    const d = Number(body.discount_percentage)
    if (!(d > 0 && d <= maxD)) throw createError({ statusCode: 422, message: `Diskon 0-${maxD}%`, data: { detail: { code: 'VALIDATION', message: `Diskon 0-${maxD}%` } } })
    patch.discountPercentage = String(d)
  }
  if (body.start_date !== undefined) {
    const d = new Date(String(body.start_date))
    if (isNaN(+d)) throw createError({ statusCode: 422, message: 'Tanggal tidak valid', data: { detail: { code: 'VALIDATION', message: 'Tanggal tidak valid' } } })
    patch.startDate = d
  }
  if (body.end_date !== undefined) {
    const d = new Date(String(body.end_date))
    if (isNaN(+d)) throw createError({ statusCode: 422, message: 'Tanggal tidak valid', data: { detail: { code: 'VALIDATION', message: 'Tanggal tidak valid' } } })
    patch.endDate = d
  }
  const nextStatus = body.status !== undefined ? String(body.status) : p.status
  if (body.status !== undefined && !PROMO_STATUSES.includes(nextStatus)) {
    throw createError({ statusCode: 422, message: `Status harus ${PROMO_STATUSES.join('/')}`, data: { detail: { code: 'VALIDATION', message: `Status harus ${PROMO_STATUSES.join('/')}` } } })
  }
  const start = (patch.startDate as Date) || new Date(p.startDate as unknown as string)
  const end = (patch.endDate as Date) || new Date(p.endDate as unknown as string)
  if (!(end > start)) throw createError({ statusCode: 422, message: 'end_date harus setelah start_date', data: { detail: { code: 'VALIDATION', message: 'end_date harus setelah start_date' } } })
  if (nextStatus === 'ACTIVE') {
    // Validasi aktivasi: produk aktif + overlap
    const { products } = await import('../../../database/schema')
    const pr = (await db.select().from(products).where(eq(products.id, p.productId)).limit(1))[0]
    if (!pr || pr.status !== 'ACTIVE') throw createError({ statusCode: 422, message: 'Produk tidak aktif', data: { detail: { code: 'VALIDATION', message: 'Produk tidak aktif' } } })
    if (await checkOverlap(db, String(p.productId), start, end, id)) {
      throw createError({ statusCode: 409, message: 'Promo aktif overlap untuk produk ini', data: { detail: { code: 'PROMO_OVERLAP', message: 'Promo aktif overlap untuk produk ini' } } })
    }
  }
  if (body.status !== undefined) patch.status = nextStatus
  await db.update(promotions).set(patch as never).where(eq(promotions.id, id as never))
  await logAudit(db, 'PROMO_UPDATED', 'USER', {
    actorId: owner.id, detail: { promotion_id: id, changed: Object.keys(patch), status: nextStatus }
  })
  const fresh = (await db.select().from(promotions).where(eq(promotions.id, id as never)).limit(1))[0]
  return {
    id: String(fresh.id), product_id: String(fresh.productId), discount_percentage: num(fresh.discountPercentage),
    start_date: (fresh.startDate as Date).toISOString(), end_date: (fresh.endDate as Date).toISOString(),
    status: effectiveStatus({ status: fresh.status, startDate: fresh.startDate as unknown as Date, endDate: fresh.endDate as unknown as Date }),
    created_at: (fresh.createdAt as Date).toISOString()
  }
})
