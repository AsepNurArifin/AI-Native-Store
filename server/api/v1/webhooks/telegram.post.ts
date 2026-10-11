import { ensureSeeded } from '../../../utils/business'
import { handleTelegramWebhook, verifyTelegramSecret } from '../../../utils/telegram'
import { clientIp, rateLimit } from '../../../utils/ratelimit'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  // PERBAIKAN: limiter lama memakai Map module-level `lastHits` yang tidak pernah
  // di-evict (unbounded memory) dan tidak bisa dipakai endpoint lain.
  if (!rateLimit(`tg:${clientIp(event)}`, 60, 60_000)) {
    throw createError({ statusCode: 429, message: 'Rate limit', data: { detail: 'Rate limit' } })
  }
  const secret = getRequestHeader(event, 'x-telegram-bot-api-secret-token')
  if (!verifyTelegramSecret(secret)) {
    throw createError({ statusCode: 401, message: 'Invalid webhook secret', data: { detail: 'Invalid webhook secret' } })
  }
  const payload = await readBody<Record<string, unknown>>(event).catch(() => null)
  if (!payload || typeof payload !== 'object') {
    throw createError({ statusCode: 400, message: 'Payload tidak valid', data: { detail: 'Payload tidak valid' } })
  }
  const result = await handleTelegramWebhook(db, payload)
  return result
})
