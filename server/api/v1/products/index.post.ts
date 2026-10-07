import { inventoryTransactions, products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { currentStock, ensureSeeded, logAudit, num } from '../../../utils/business'

const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE']

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ name?: string, category?: string, specification?: Record<string, unknown>, price?: number, status?: string, low_stock_threshold?: number | null, initial_stock?: number, image_url?: string | null }>(event)
  if (!body?.name || !body?.category || body?.price == null) {
    throw createError({ statusCode: 422, message: 'name, category, price wajib', data: { detail: { code: 'VALIDATION', message: 'name, category, price wajib' } } })
  }
  // Number('abc') = NaN yang lolos cek < 0 — tolak non-numerik & negatif.
  if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) {
    throw createError({ statusCode: 422, message: 'Harga tidak valid', data: { detail: { code: 'VALIDATION', message: 'Harga tidak valid' } } })
  }
  if (String(body.name).trim().length > 200 || String(body.category).trim().length > 50) {
    const msg = 'name maks 200 / category maks 50 karakter'
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'VALIDATION', message: msg } } })
  }
  if (body.low_stock_threshold != null && (!Number.isInteger(Number(body.low_stock_threshold)) || Number(body.low_stock_threshold) < 0)) {
    const msg = 'low_stock_threshold harus bilangan bulat >= 0'
    throw createError({ statusCode: 422, message: msg, data: { detail: { code: 'VALIDATION', message: msg } } })
  }
  const status = body.status ? String(body.status) : 'ACTIVE'
  if (!PRODUCT_STATUSES.includes(status)) {
    throw createError({ statusCode: 422, message: `Status harus ${PRODUCT_STATUSES.join('/')}`, data: { detail: { code: 'VALIDATION', message: `Status harus ${PRODUCT_STATUSES.join('/')}` } } })
  }
  const initStock = body.initial_stock != null ? Number(body.initial_stock) : 0
  if (!Number.isInteger(initStock) || initStock < 0) {
    throw createError({ statusCode: 422, message: 'initial_stock harus bilangan bulat >= 0', data: { detail: { code: 'VALIDATION', message: 'initial_stock harus bilangan bulat >= 0' } } })
  }
  const imageUrl = typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim().slice(0, 500) : null
  const ins = await db.insert(products).values({
    name: body.name,
    category: body.category,
    specification: (body.specification || {}) as never,
    price: String(body.price) as never,
    status,
    lowStockThreshold: (body.low_stock_threshold ?? null) as never,
    imageUrl: imageUrl as never
  }).returning()
  const p = ins[0]
  if (initStock > 0) {
    await db.insert(inventoryTransactions).values({
      productId: p.id, type: 'IN', movement: 'IN', referenceType: 'MANUAL', quantity: initStock, actorId: owner.id as never
    })
  }
  await logAudit(db, 'PRODUCT_CREATED', 'USER', {
    actorId: owner.id, detail: { product_id: String(p.id), name: p.name, price: num(p.price), status, initial_stock: initStock }
  })
  const stock = await currentStock(db, String(p.id))
  setResponseStatus(event, 201)
  return {
    id: String(p.id), name: p.name, category: p.category, specification: p.specification || {},
    price: num(p.price), status: p.status, low_stock_threshold: p.lowStockThreshold ?? null,
    current_stock: stock, is_low_stock: stock <= Number(useRuntimeConfig().lowStockDefault ?? 5),
    image_url: (p.imageUrl as string | null) ?? null
  }
})
