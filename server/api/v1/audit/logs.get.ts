import { desc, eq } from 'drizzle-orm'
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
  let all = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp))
  if (q.ai_action_id) all = all.filter(a => a.aiActionId && String(a.aiActionId) === String(q.ai_action_id))
  if (q.event) all = all.filter(a => a.event === String(q.event))
  if (q.actor_type) all = all.filter(a => a.actorType === String(q.actor_type))
  const total = all.length
  const slice = all.slice((page - 1) * pageSize, page * pageSize)
  return slice.map(a => ({
    id: String(a.id), ai_action_id: a.aiActionId ? String(a.aiActionId) : null,
    event: a.event, actor_type: a.actorType, actor_id: a.actorId ? String(a.actorId) : null,
    detail: a.detail || {}, timestamp: (a.timestamp as Date).toISOString()
  }))
})
