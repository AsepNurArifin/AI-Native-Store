import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, logAudit, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  const p = rows[0]
  if (!p) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!String(body.name).trim() || String(body.name).trim().length > 200) throw createError({ statusCode: 422, message: 'name wajib, maks 200 karakter', data: { detail: { code: 'VALIDATION', message: 'name wajib, maks 200 karakter' } } })
    patch.name = String(body.name)
  }
  if (body.category !== undefined) {
    if (!String(body.category).trim() || String(body.category).trim().length > 50) throw createError({ statusCode: 422, message: 'category wajib, maks 50 karakter', data: { detail: { code: 'VALIDATION', message: 'category wajib, maks 50 karakter' } } })
    patch.category = String(body.category)
  }
  if (body.specification !== undefined) patch.specification = body.specification
  if (body.image_url !== undefined) patch.imageUrl = (typeof body.image_url === 'string' && (body.image_url as string).trim() ? (body.image_url as string).trim().slice(0, 500) : null) as never
  if (body.price !== undefined) {
    if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) throw createError({ statusCode: 422, message: 'Harga tidak valid', data: { detail: { code: 'VALIDATION', message: 'Harga tidak valid' } } })
    patch.price = String(body.price)
  }
  if (body.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(String(body.status))) throw createError({ statusCode: 422, message: 'Status tidak valid', data: { detail: { code: 'VALIDATION', message: 'Status tidak valid' } } })
    patch.status = String(body.status)
  }
  if (body.low_stock_threshold !== undefined) {
    const v = body.low_stock_threshold
    if (v !== null && (!Number.isInteger(Number(v)) || Number(v) < 0)) throw createError({ statusCode: 422, message: 'low_stock_threshold harus bilangan bulat >= 0 atau null', data: { detail: { code: 'VALIDATION', message: 'low_stock_threshold harus bilangan bulat >= 0 atau null' } } })
    patch.lowStockThreshold = v as never
  }
  patch.updatedAt = new Date() as never
  await db.update(products).set(patch as never).where(eq(products.id, id as never))
  await logAudit(db, 'PRODUCT_UPDATED', 'USER', {
    actorId: owner.id, detail: { product_id: id, changed: Object.keys(patch).filter(k => k !== 'updatedAt') }
  })
  const fresh = (await db.select().from(products).where(eq(products.id, id as never)).limit(1))[0]
  const stock = await currentStock(db, id)
  return {
    id: String(fresh.id), name: fresh.name, category: fresh.category, specification: fresh.specification || {},
    price: num(fresh.price), status: fresh.status, low_stock_threshold: fresh.lowStockThreshold ?? null,
    current_stock: stock, is_low_stock: stock <= Number(useRuntimeConfig().lowStockDefault ?? 5),
    image_url: (fresh.imageUrl as string | null) ?? null
  }
})
