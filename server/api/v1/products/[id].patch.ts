import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, num } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  const p = rows[0]
  if (!p) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name)
  if (body.category !== undefined) patch.category = String(body.category)
  if (body.specification !== undefined) patch.specification = body.specification
  if (body.image_url !== undefined) patch.imageUrl = (typeof body.image_url === 'string' && (body.image_url as string).trim() ? (body.image_url as string).trim().slice(0, 500) : null) as never
  if (body.price !== undefined) {
    if (Number(body.price) < 0) throw createError({ statusCode: 422, message: 'Harga tidak valid', data: { detail: { code: 'VALIDATION', message: 'Harga tidak valid' } } })
    patch.price = String(body.price)
  }
  if (body.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(String(body.status))) throw createError({ statusCode: 422, message: 'Status tidak valid', data: { detail: { code: 'VALIDATION', message: 'Status tidak valid' } } })
    patch.status = String(body.status)
  }
  if (body.low_stock_threshold !== undefined) patch.lowStockThreshold = body.low_stock_threshold as never
  patch.updatedAt = new Date() as never
  await db.update(products).set(patch as never).where(eq(products.id, id as never))
  const fresh = (await db.select().from(products).where(eq(products.id, id as never)).limit(1))[0]
  const stock = await currentStock(db, id)
  return {
    id: String(fresh.id), name: fresh.name, category: fresh.category, specification: fresh.specification || {},
    price: num(fresh.price), status: fresh.status, low_stock_threshold: fresh.lowStockThreshold ?? null,
    current_stock: stock, is_low_stock: stock <= Number(useRuntimeConfig().lowStockDefault ?? 5),
    image_url: (fresh.imageUrl as string | null) ?? null
  }
})
