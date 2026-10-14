import { and, asc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { orderItems, products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, num, stocksFor } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const search = String(q.q || '')
  const category = String(q.category || '')
  const status = String(q.status || '')
  const budgetMax = q.budget_max ? Number(q.budget_max) : null
  // Paginasi di SQL: page_size (legacy: limit) maks 500.
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(Number(q.page_size || q.limit || 500), 500)

  // Filter + limit di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (search) {
    const s = `%${search.replace(/[%_\\]/g, '\\$&')}%`
    conds.push(or(ilike(products.name, s), ilike(sql`${products.specification}::text`, s))!)
  }
  if (category) conds.push(eq(products.category, category))
  if (status) conds.push(eq(products.status, status))
  if (budgetMax) conds.push(lte(products.price, String(budgetMax)))
  const rows = await db.select().from(products)
    .where(conds.length ? and(...conds) : undefined)
    // Urut per kategori lalu nama (bukan terbaru) agar katalog terbagi rapi per kategori.
    .orderBy(asc(products.category), asc(products.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  // Berapa order yang memakai produk ini. Satu agregat untuk seluruh baris
  // halaman ini (BUKAN satu query per produk) supaya UI bisa membedakan
  // "Hapus" vs "Hapus Paksa" sebelum pengguna menekan apa pun.
  // Stok dan jumlah order tidak saling bergantung -> jalan paralel, satu
  // round trip lebih sedikit.
  const ids = rows.map(p => String(p.id))
  const orderCountQuery = rows.length
    ? db.select({ productId: orderItems.productId, n: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(inArray(orderItems.productId, ids as never))
        .groupBy(orderItems.productId)
    : Promise.resolve([] as Array<{ productId: string, n: number }>)
  const [stocks, used] = await Promise.all([stocksFor(db, ids), orderCountQuery])
  const orderCounts = new Map<string, number>()
  for (const u of used) orderCounts.set(String(u.productId), Number(u.n))
  return rows.map((p) => {
    const stock = stocks.get(String(p.id)) ?? 0
    const thr = (p.lowStockThreshold as number | null) ?? lowDefault
    return {
      id: String(p.id), name: p.name, category: p.category, specification: p.specification || {},
      price: num(p.price), status: p.status, low_stock_threshold: p.lowStockThreshold ?? null,
      current_stock: stock, is_low_stock: stock <= thr,
      order_count: orderCounts.get(String(p.id)) ?? 0,
      image_url: (p.imageUrl as string | null) ?? null
    }
  })
})
