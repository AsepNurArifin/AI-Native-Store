import { desc } from 'drizzle-orm'
import { aiActions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 50))
  let all = await db.select().from(aiActions).orderBy(desc(aiActions.createdAt))
  const statusFilter = q.status || q.status_
  if (statusFilter) all = all.filter(a => a.status === String(statusFilter))
  const total = all.length
  return all.slice((page - 1) * pageSize, page * pageSize).map(a => ({
    id: String(a.id), action_type: a.actionType, payload: a.payload, status: a.status,
    requested_by: String(a.requestedBy), created_at: (a.createdAt as Date).toISOString(),
    decided_at: a.decidedAt ? (a.decidedAt as Date).toISOString() : null,
    executed_at: a.executedAt ? (a.executedAt as Date).toISOString() : null,
    result_target_id: a.resultTargetId || null, validation_failures: a.validationFailures || null
  }))
})
