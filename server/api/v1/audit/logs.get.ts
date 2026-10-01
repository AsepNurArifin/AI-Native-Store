import { and, desc, eq } from 'drizzle-orm'
import { auditLogs } from '../../../database/schema'
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
  if (q.ai_action_id) conds.push(eq(auditLogs.aiActionId, String(q.ai_action_id) as never))
  if (q.event) conds.push(eq(auditLogs.event, String(q.event)))
  if (q.actor_type) conds.push(eq(auditLogs.actorType, String(q.actor_type)))
  const rows = await db.select().from(auditLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return rows.map(a => ({
    id: String(a.id), ai_action_id: a.aiActionId ? String(a.aiActionId) : null,
    event: a.event, actor_type: a.actorType, actor_id: a.actorId ? String(a.actorId) : null,
    detail: a.detail || {}, timestamp: (a.timestamp as Date).toISOString()
  }))
})
