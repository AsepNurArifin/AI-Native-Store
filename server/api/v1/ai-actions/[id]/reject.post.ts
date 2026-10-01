import { eq } from 'drizzle-orm'
import { aiActions, approvals } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded, logAudit } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })
  const rows = await db.select().from(aiActions).where(eq(aiActions.id, id as never)).limit(1)
  const a = rows[0]
  if (!a) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })
  if (a.status !== 'DRAFT') {
    throw createError({ statusCode: 409, message: `Aksi berstatus ${a.status}`, data: { detail: { code: 'INVALID_STATE', message: `Aksi berstatus ${a.status}` } } })
  }
  const body = await readBody<{ note?: string }>(event).catch(() => ({}) as { note?: string })
  await db.update(aiActions).set({ status: 'REJECTED', decidedAt: new Date() as never }).where(eq(aiActions.id, id as never))
  await db.insert(approvals).values({ aiActionId: id as never, actorId: owner.id as never, decision: 'REJECTED', note: body?.note || null })
  await logAudit(db, 'REJECTED', 'USER', { actorId: owner.id, aiActionId: id, detail: { note: body?.note || null } })
  const fresh = (await db.select().from(aiActions).where(eq(aiActions.id, id as never)).limit(1))[0]
  return {
    id: String(fresh.id), action_type: fresh.actionType, payload: fresh.payload, status: fresh.status,
    requested_by: String(fresh.requestedBy), created_at: (fresh.createdAt as Date).toISOString(),
    decided_at: fresh.decidedAt ? (fresh.decidedAt as Date).toISOString() : null,
    executed_at: fresh.executedAt ? (fresh.executedAt as Date).toISOString() : null,
    result_target_id: fresh.resultTargetId || null, validation_failures: fresh.validationFailures || null
  }
})
