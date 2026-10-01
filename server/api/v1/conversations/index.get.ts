import { desc, eq } from 'drizzle-orm'
import { conversations } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 50))
  let all = await db.select().from(conversations).orderBy(desc(conversations.lastActivityAt))
  if (q.channel) all = all.filter(c => c.channel === String(q.channel))
  const total = all.length
  const slice = all.slice((page - 1) * pageSize, page * pageSize)
  return slice.map(c => ({
    id: String(c.id), customer_id: String(c.customerId), channel: c.channel,
    started_at: (c.startedAt as Date).toISOString(), last_activity_at: (c.lastActivityAt as Date).toISOString(),
    ended_at: c.endedAt ? (c.endedAt as Date).toISOString() : null, outcome: c.outcome
  }))
})
