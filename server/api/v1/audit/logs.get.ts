import { and, desc, eq, inArray } from 'drizzle-orm'
import { auditLogs, aiActions, customers, products, promotions, users } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

/**
 * Pengayaan nama untuk halaman "Riwayat Toko" (audit).
 *
 * Log menyimpan UUID murni (product_id, customer_id, dsb) supaya jejak tetap
 * valid meski dataproduk dihapus (append-only, tanpa mutasi). Bagian klien yang
 * mengubah UUID -> bahasa toko; endpoint di sini HANYA menyediakan peta nama
 * ringan untuk ID yang muncul di halaman ini — tidak mengubah/mentransformasi
 * isi log sama sekali. Tabel tetap tidak pernah bisa disunting/dihapus.
 */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 50))
  // Filter + paginasi di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (q.ai_action_id) conds.push(eq(auditLogs.aiActionId, String(q.ai_action_id) as never))
  if (q.event) conds.push(eq(auditLogs.event, String(q.event)))
  if (q.actor_type) conds.push(eq(auditLogs.actorType, String(q.actor_type)))
  const rows = await db.select().from(auditLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  // --- Kumpulkan semua UUID yang dirujuk halaman ini untuk pemetaan nama ---
  const productIds = new Set<string>()
  const userIds = new Set<string>()
  const customerIds = new Set<string>()
  const promotionIds = new Set<string>()
  const aiActionIds = new Set<string>()
  for (const a of rows) {
    if (a.actorId) userIds.add(String(a.actorId))
    if (a.aiActionId) aiActionIds.add(String(a.aiActionId))
    const d = (a.detail || {}) as Record<string, unknown>
    // detail.product_id bisa string UNGK (referensi produk yang sudah dihapus) —
    // tetap dicari; tidak ketemu artinya produk lama, klien yang memberi label.
    if (typeof d.product_id === 'string' && /[0-9a-f-]{32,64}/i.test(d.product_id)) productIds.add(d.product_id)
    if (Array.isArray(d.product_ids)) for (const id of d.product_ids) productIds.add(String(id))
    if (typeof d.customer_id === 'string') customerIds.add(d.customer_id)
    if (typeof d.promotion_id === 'string') promotionIds.add(d.promotion_id)
  }

  const names = {
    products: {} as Record<string, string>,
    users: {} as Record<string, { name: string, role: string }>,
    customers: {} as Record<string, { name: string | null, identifier: string }>,
    promotions: {} as Record<string, { discount_percentage: string, product_id: string, product_name: string | null }>,
    ai_actions: {} as Record<string, { action_type: string }>,
  }
  const inBatches = async <T>(ids: string[], run: (chunk: string[]) => Promise<T>): Promise<void> => {
    for (let i = 0; i < ids.length; i += 100) await run(ids.slice(i, i + 100))
  }

  await Promise.all([
    inBatches([...productIds], async (chunk) => {
      const r = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, chunk as never))
      for (const row of r) names.products[String(row.id)] = row.name
    }),
    inBatches([...userIds], async (chunk) => {
      const r = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, chunk as never))
      for (const row of r) names.users[String(row.id)] = { name: row.name, role: row.role }
    }),
    inBatches([...customerIds], async (chunk) => {
      const r = await db.select({ id: customers.id, name: customers.name, identifier: customers.identifier }).from(customers).where(inArray(customers.id, chunk as never))
      for (const row of r) names.customers[String(row.id)] = { name: row.name, identifier: row.identifier }
    }),
    inBatches([...promotionIds], async (chunk) => {
      const r = await db.select({ id: promotions.id, discount: promotions.discountPercentage, product_id: promotions.productId, product: products.name })
        .from(promotions).leftJoin(products, eq(promotions.productId, products.id))
        .where(inArray(promotions.id, chunk as never))
      for (const row of r) names.promotions[String(row.id)] = { discount_percentage: row.discount, product_id: String(row.product_id), product_name: row.product }
    }),
    inBatches([...aiActionIds], async (chunk) => {
      const r = await db.select({ id: aiActions.id, action_type: aiActions.actionType }).from(aiActions).where(inArray(aiActions.id, chunk as never))
      for (const row of r) names.ai_actions[String(row.id)] = { action_type: row.action_type }
    })
  ])

  return {
    names,
    items: rows.map(a => ({
      id: String(a.id), ai_action_id: a.aiActionId ? String(a.aiActionId) : null,
      event: a.event, actor_type: a.actorType, actor_id: a.actorId ? String(a.actorId) : null,
      detail: a.detail || {}, timestamp: (a.timestamp as Date).toISOString()
    }))
  }
})
