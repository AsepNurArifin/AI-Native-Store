import { requireOwner } from '../../../../utils/auth'
import { ensureSeeded } from '../../../../utils/business'
import { analystAsk } from '../../../../utils/agents'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ question?: string }>(event)
  if (!body?.question?.trim()) {
    throw createError({ statusCode: 422, message: 'question wajib', data: { detail: { code: 'VALIDATION', message: 'question wajib' } } })
  }
  return await analystAsk(db, body.question.trim())
})
