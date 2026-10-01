import { ensureSeeded } from '../../../utils/business'
import { handleTelegramWebhook, verifyTelegramSecret } from '../../../utils/telegram'

let lastHits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (lastHits.get(ip) || []).filter(t => now - t < 60_000)
  arr.push(now)
  lastHits.set(ip, arr)
  return arr.length > 60
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const ip = getRequestHeader(event, 'x-forwarded-for') || getRequestHeader(event, 'x-real-ip') || 'local'
  if (rateLimited(ip)) {
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
