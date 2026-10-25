import { eq } from 'drizzle-orm'
import { conversations } from '../../../../database/schema'
import { ensureSeeded } from '../../../../utils/business'
import { salesHandleMessage } from '../../../../utils/agents'
import { isUuid, OrderError, toOrderHttpCode } from '../../../../utils/errors'
import { rateLimit } from '../../../../utils/ratelimit'

/** Batas percakapan: 20 pesan per 5 menit per percakapan. */
const MAX_CHAT_PER_5MIN = 20
const CHAT_WINDOW_MS = 5 * 60_000

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  // Rate limit dulu (sebelum query DB mahal + panggilan LLM): satu pengunjung
  // tidak boleh menguras kuota LLM tak berbates.
  if (!rateLimit(`chat:${id}`, MAX_CHAT_PER_5MIN, CHAT_WINDOW_MS)) {
    setResponseHeader(event, 'Retry-After', Math.ceil(CHAT_WINDOW_MS / 1000))
    throw createError({ statusCode: 429, message: 'Terlalu banyak pesan. Coba lagi beberapa menit lagi.', data: { detail: { code: 'RATE_LIMITED', message: 'Terlalu banyak pesan. Coba lagi beberapa menit lagi.' } } })
  }
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
    // OrderError (stok/harga/saldo) = respons bisnis, BUKAN kegagalan sistem:
    // dikembalikan dengan kode & statusnya; percakapan tidak ditandai ERROR.
    if (e instanceof OrderError) {
      throw createError({ statusCode: toOrderHttpCode(e.code), message: e.message, data: { detail: { code: e.code, message: e.message, ...e.details } } })
    }
    // Kejutan lain (infrastruktur) tetap 500 utuh.
    await db.update(conversations).set({ outcome: 'ERROR' }).where(eq(conversations.id, id as never))
    throw createError({ statusCode: 500, message: 'Gagal memproses pesan', data: { detail: 'Gagal memproses pesan' } })
  }
})
