import { and, desc, eq } from 'drizzle-orm'
import { inventoryTransactions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  // Paginasi di SQL: page_size (legacy: limit) maks 500.
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(Number(q.page_size || q.limit || 100), 500)
  // Filter di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (q.product_id) conds.push(eq(inventoryTransactions.productId, String(q.product_id) as never))
  if (q.type) conds.push(eq(inventoryTransactions.type, String(q.type)))
  if (q.movement) conds.push(eq(inventoryTransactions.movement, String(q.movement)))
  const rows = await db.select().from(inventoryTransactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryTransactions.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return rows.map(r => ({
    id: String(r.id), product_id: String(r.productId), type: r.type, movement: r.movement,
    reference_type: r.referenceType, quantity: r.quantity,
    reference_id: r.referenceId ? String(r.referenceId) : null,
    actor_id: r.actorId ? String(r.actorId) : null,
    timestamp: (r.timestamp as Date).toISOString()
  }))
})
