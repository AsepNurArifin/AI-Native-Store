import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { ensureSeeded } from '../../../utils/business'
import { signAccessToken, verifyPassword } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ email?: string, password?: string }>(event)
  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 422, message: 'Email dan password wajib', data: { detail: 'Email dan password wajib' } })
  }
  const rows = await db.select().from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1)
  const u = rows[0]
  if (!u || u.status !== 'ACTIVE' || !(await verifyPassword(body.password, String(u.passwordHash)))) {
    throw createError({ statusCode: 401, message: 'Email atau password salah', data: { detail: 'Email atau password salah' } })
  }
  const token = await signAccessToken(String(u.id), String(u.role))
  return {
    access_token: token,
    token_type: 'bearer',
    user: { id: String(u.id), name: u.name, email: u.email, role: u.role, status: u.status, created_at: (u.createdAt as Date).toISOString() }
  }
})
