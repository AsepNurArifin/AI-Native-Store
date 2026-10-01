import { eq } from 'drizzle-orm'
import { promotions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { checkOverlap, effectiveStatus, ensureSeeded, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
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
  if (body.start_date !== undefined) patch.startDate = new Date(String(body.start_date))
  if (body.end_date !== undefined) patch.endDate = new Date(String(body.end_date))
  const nextStatus = body.status !== undefined ? String(body.status) : p.status
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
  const fresh = (await db.select().from(promotions).where(eq(promotions.id, id as never)).limit(1))[0]
  return {
    id: String(fresh.id), product_id: String(fresh.productId), discount_percentage: num(fresh.discountPercentage),
    start_date: (fresh.startDate as Date).toISOString(), end_date: (fresh.endDate as Date).toISOString(),
    status: effectiveStatus({ status: fresh.status, startDate: fresh.startDate as unknown as Date, endDate: fresh.endDate as unknown as Date }),
    created_at: (fresh.createdAt as Date).toISOString()
  }
})
