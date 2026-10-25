import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { conversations, customers } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 50))
  // Filter + paginasi di SQL (bukan full-table scan lalu filter di JS).
  const conds = []
  if (q.channel) conds.push(eq(conversations.channel, String(q.channel)))
  if (q.q) {
    // `q` = potongan ID percakapan ATAU identitas pelanggannya.
    const like = `%${String(q.q).trim().replace(/[\\%_]/g, '\\$&')}%`
    const searchable = or(
      sql`cast(${conversations.id} as text) ilike ${like}`,
      inArray(conversations.customerId, db.select({ id: customers.id }).from(customers)
        .where(or(ilike(customers.name, like), ilike(customers.contact, like), ilike(customers.identifier, like))))
    )
    if (searchable) conds.push(searchable)
  }
  const rows = await db.select().from(conversations)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(conversations.lastActivityAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return rows.map(c => ({
    id: String(c.id), customer_id: String(c.customerId), channel: c.channel,
    started_at: (c.startedAt as Date).toISOString(), last_activity_at: (c.lastActivityAt as Date).toISOString(),
    ended_at: c.endedAt ? (c.endedAt as Date).toISOString() : null, outcome: c.outcome
  }))
})
