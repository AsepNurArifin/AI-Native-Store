import { ensureSeeded } from '../../../utils/business'
import { handleTelegramWebhook } from '../../../utils/telegram'

export default defineEventHandler(async (event) => {
  const debug = String(useRuntimeConfig().debug ?? process.env.DEBUG ?? 'true') === 'true'
  if (!debug) {
    throw createError({ statusCode: 404, message: 'Not found', data: { detail: 'Not found' } })
  }
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ from?: string, text?: string }>(event)
  const payload = {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      chat: { id: body?.from || 'dev-chat', type: 'private' },
      from: { id: body?.from || 'dev-chat', first_name: 'Dev' },
      text: body?.text || 'halo',
      date: Math.floor(Date.now() / 1000)
    }
  }
  return await handleTelegramWebhook(db, payload as unknown as Record<string, unknown>)
})
