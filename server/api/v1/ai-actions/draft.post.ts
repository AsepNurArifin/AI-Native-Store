import { aiActions } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { actionCreateDraft } from '../../../utils/agents'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ instruction?: string }>(event)
  if (!body?.instruction?.trim()) {
    throw createError({ statusCode: 422, message: 'instruction wajib', data: { detail: { code: 'VALIDATION', message: 'instruction wajib' } } })
  }
  try {
    const created = await actionCreateDraft(db, body.instruction.trim(), owner.id) as typeof aiActions.$inferSelect
    setResponseStatus(event, 201)
    return {
      id: String(created.id), action_type: created.actionType, payload: created.payload, status: created.status,
      requested_by: String(created.requestedBy), created_at: (created.createdAt as Date).toISOString(),
      decided_at: null, executed_at: null, result_target_id: null, validation_failures: null
    }
  }
  catch (e) {
    throw createError({ statusCode: 422, message: (e as Error).message, data: { detail: { code: 'INVALID_INSTRUCTION', message: (e as Error).message } } })
  }
})
