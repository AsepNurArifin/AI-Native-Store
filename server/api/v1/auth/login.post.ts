import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { ensureSeeded } from '../../../utils/business'
import { signAccessToken, verifyPassword } from '../../../utils/auth'
import { clientIp, rateLimit, rateLimitReset } from '../../../utils/ratelimit'

/** Batas percobaan login: 5x per 15 menit per (IP + email). */
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60_000

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ email?: string, password?: string }>(event)
  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 422, message: 'Email dan password wajib', data: { detail: 'Email dan password wajib' } })
  }
  const email = body.email.toLowerCase().trim()
  // PERBAIKAN: endpoint auth tadinya tanpa rate limit sama sekali (paling
  // rawan brute-force), sementara webhook Telegram sudah dilindungi.
  const rlKey = `login:${clientIp(event)}:${email}`
  if (!rateLimit(rlKey, MAX_ATTEMPTS, WINDOW_MS)) {
    setResponseHeader(event, 'Retry-After', Math.ceil(WINDOW_MS / 1000))
    throw createError({ statusCode: 429, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.', data: { detail: 'RATE_LIMITED' } })
  }
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const u = rows[0]
  if (!u || u.status !== 'ACTIVE' || !(await verifyPassword(body.password, String(u.passwordHash)))) {
    throw createError({ statusCode: 401, message: 'Email atau password salah', data: { detail: 'Email atau password salah' } })
  }
  rateLimitReset(rlKey)
  const token = await signAccessToken(String(u.id), String(u.role))
  return {
    access_token: token,
    token_type: 'bearer',
    user: { id: String(u.id), name: u.name, email: u.email, role: u.role, status: u.status, created_at: (u.createdAt as Date).toISOString() }
  }
})
