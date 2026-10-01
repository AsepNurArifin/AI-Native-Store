import { eq } from 'drizzle-orm'
import { conversations } from '../../../../database/schema'
import { ensureSeeded } from '../../../../utils/business'
import { salesHandleMessage } from '../../../../utils/agents'
import { isUuid } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  const rows = await db.select().from(conversations).where(eq(conversations.id, id as never)).limit(1)
  const conv = rows[0]
  if (!conv) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  if (conv.channel !== 'WEB') {
    throw createError({ statusCode: 409, message: 'Hanya channel WEB', data: { detail: { code: 'WRONG_CHANNEL', message: 'Hanya channel WEB' } } })
  }
  const body = await readBody<{ content?: string }>(event)
  if (!body?.content?.trim()) {
    throw createError({ statusCode: 422, message: 'content wajib', data: { detail: { code: 'VALIDATION', message: 'content wajib' } } })
  }
  try {
    return await salesHandleMessage(db, id, body.content.trim(), { allowOrder: false })
  }
  catch (e) {
    await db.update(conversations).set({ outcome: 'ERROR' }).where(eq(conversations.id, id as never))
    throw createError({ statusCode: 500, message: 'Gagal memproses pesan', data: { detail: 'Gagal memproses pesan' } })
  }
})
