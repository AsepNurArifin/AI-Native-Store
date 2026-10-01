import { eq } from 'drizzle-orm'
import { aiActions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })
  const rows = await db.select().from(aiActions).where(eq(aiActions.id, id as never)).limit(1)
  const a = rows[0]
  if (!a) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })
  return {
    id: String(a.id), action_type: a.actionType, payload: a.payload, status: a.status,
    requested_by: String(a.requestedBy), created_at: (a.createdAt as Date).toISOString(),
    decided_at: a.decidedAt ? (a.decidedAt as Date).toISOString() : null,
    executed_at: a.executedAt ? (a.executedAt as Date).toISOString() : null,
    result_target_id: a.resultTargetId || null, validation_failures: a.validationFailures || null
  }
})
