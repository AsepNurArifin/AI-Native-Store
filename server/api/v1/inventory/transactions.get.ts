import { desc, eq, sql } from 'drizzle-orm'
import { inventoryTransactions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const limit = Math.min(Number(q.limit || 100), 500)
  let rows = await db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.timestamp)).limit(limit)
  if (q.product_id) rows = rows.filter(r => String(r.productId) === String(q.product_id))
  if (q.type) rows = rows.filter(r => r.type === String(q.type))
  if (q.movement) rows = rows.filter(r => r.movement === String(q.movement))
  return rows.map(r => ({
    id: String(r.id), product_id: String(r.productId), type: r.type, movement: r.movement,
    reference_type: r.referenceType, quantity: r.quantity,
    reference_id: r.referenceId ? String(r.referenceId) : null,
    actor_id: r.actorId ? String(r.actorId) : null,
    timestamp: (r.timestamp as Date).toISOString()
  }))
})
