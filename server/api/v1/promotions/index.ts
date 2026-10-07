import { desc, eq } from 'drizzle-orm'
import { promotions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { checkOverlap, effectiveStatus, ensureSeeded, logAudit, num, refreshPromotionExpiry } from '../../../utils/business'

/** Status yang boleh di-set manual user. EXPIRED/SCHEDULED diturunkan effectiveStatus;
 *  REJECTED hanya via reject AI-action; sisanya via refreshPromotionExpiry. */
export const PROMO_STATUSES = ['DRAFT', 'ACTIVE']

function out(p: typeof promotions.$inferSelect) {
  return {
    id: String(p.id), product_id: String(p.productId), discount_percentage: num(p.discountPercentage),
    start_date: (p.startDate as Date).toISOString(), end_date: (p.endDate as Date).toISOString(),
    status: effectiveStatus({ status: p.status, startDate: p.startDate as unknown as Date, endDate: p.endDate as unknown as Date }),
    created_at: (p.createdAt as Date).toISOString()
  }
}

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  if (event.method === 'GET') {
    await refreshPromotionExpiry(db)
    const q = getQuery(event)
    const page = Math.max(1, Number(q.page || 1))
    const pageSize = Math.min(100, Number(q.page_size || 50))
    // Paginasi + filter di SQL.
    const rows = await db.select().from(promotions)
      .where(q.product_id ? eq(promotions.productId, String(q.product_id) as never) : undefined)
      .orderBy(desc(promotions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    return rows.map(out)
  }
  // POST
  const body = await readBody<{ product_id?: string, discount_percentage?: number, start_date?: string, end_date?: string, status?: string }>(event)
  if (!body?.product_id || body?.discount_percentage == null || !body?.start_date || !body?.end_date) {
    throw createError({ statusCode: 422, message: 'product_id, discount_percentage, start_date, end_date wajib', data: { detail: { code: 'VALIDATION', message: 'product_id, discount_percentage, start_date, end_date wajib' } } })
  }
  const start = new Date(body.start_date)
  const end = new Date(body.end_date)
  if (isNaN(+start) || isNaN(+end)) throw createError({ statusCode: 422, message: 'Tanggal tidak valid', data: { detail: { code: 'VALIDATION', message: 'Tanggal tidak valid' } } })
  if (!(end > start)) throw createError({ statusCode: 422, message: 'end_date harus setelah start_date', data: { detail: { code: 'VALIDATION', message: 'end_date harus setelah start_date' } } })
  const maxD = Number(useRuntimeConfig().maxDiscountPercent ?? 50)
  if (!(body.discount_percentage > 0 && body.discount_percentage <= maxD)) {
    throw createError({ statusCode: 422, message: `Diskon 0-${maxD}%`, data: { detail: { code: 'VALIDATION', message: `Diskon 0-${maxD}%` } } })
  }
  const status = body.status ? String(body.status) : 'DRAFT'
  if (!PROMO_STATUSES.includes(status)) {
    throw createError({ statusCode: 422, message: `Status harus ${PROMO_STATUSES.join('/')}`, data: { detail: { code: 'VALIDATION', message: `Status harus ${PROMO_STATUSES.join('/')}` } } })
  }
  if (status === 'ACTIVE' && await checkOverlap(db, body.product_id, start, end)) {
    throw createError({ statusCode: 409, message: 'Promo aktif overlap untuk produk ini', data: { detail: { code: 'PROMO_OVERLAP', message: 'Promo aktif overlap untuk produk ini' } } })
  }
  const ins = await db.insert(promotions).values({
    productId: body.product_id as never, discountPercentage: String(body.discount_percentage) as never,
    startDate: start as never, endDate: end as never, status
  }).returning()
  await logAudit(db, 'PROMO_CREATED', 'USER', {
    actorId: owner.id,
    detail: { promotion_id: String(ins[0].id), product_id: body.product_id, discount_percentage: body.discount_percentage, status }
  })
  setResponseStatus(event, 201)
  return out(ins[0])
})
