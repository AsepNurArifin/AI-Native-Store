import { and, eq, ne, sql } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { hashPassword, isValidEmail, isValidNewPassword, normalizeEmail, requireOwner, signAccessToken, verifyPassword } from '../../../utils/auth'

interface AccountInput {
  name?: string
  email?: string
  current_password?: string
  new_password?: string
}

function invalid(message: string, code = 'VALIDATION') {
  return createError({ statusCode: 422, message, data: { detail: { code, message } } })
}

export default defineEventHandler(async (event) => {
  const actor = await requireOwner(event)
  const body = await readBody<AccountInput>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Data akun tidak valid.')
  if (body.name === undefined && body.email === undefined && body.new_password === undefined) throw invalid('Tidak ada perubahan akun.')
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) throw invalid('Nama admin wajib diisi, maksimal 100 karakter.')
  if (body.email !== undefined && (typeof body.email !== 'string' || !isValidEmail(normalizeEmail(body.email)))) throw invalid('Alamat email tidak valid, maksimal 255 karakter.')
  if (body.new_password !== undefined && (typeof body.new_password !== 'string' || !isValidNewPassword(body.new_password))) throw invalid('Kata sandi baru minimal 12 karakter dan maksimal 72 byte UTF-8.')

  const db = getDb()
  const updated = await db.transaction(async (tx) => {
    // Lock yang sama dengan CLI: email dinormalisasi tanpa mengubah akun lama.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72702)`)
    const rows = await tx.select().from(users).where(eq(users.id, actor.id)).for('update').limit(1)
    const user = rows[0]
    if (!user || user.status !== 'ACTIVE' || user.role !== 'OWNER' || user.authVersion !== actor.authVersion) {
      throw createError({ statusCode: 401, message: 'Sesi tidak berlaku. Silakan masuk kembali.', data: { detail: 'Sesi tidak berlaku. Silakan masuk kembali.' } })
    }
    const email = body.email === undefined ? user.email : normalizeEmail(body.email)
    const changingCredentials = email !== user.email || body.new_password !== undefined
    if (changingCredentials) {
      if (typeof body.current_password !== 'string' || !body.current_password) throw invalid('Kata sandi saat ini wajib diisi.', 'CURRENT_PASSWORD_REQUIRED')
      if (!(await verifyPassword(body.current_password, user.passwordHash))) throw invalid('Kata sandi saat ini tidak sesuai.', 'CURRENT_PASSWORD_INVALID')
    }
    if (body.email !== undefined) {
      const duplicate = await tx.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, user.id))).limit(1)
      if (duplicate.length) throw createError({ statusCode: 409, message: 'Email sudah digunakan akun lain.', data: { detail: { code: 'EMAIL_EXISTS', message: 'Email sudah digunakan akun lain.' } } })
    }
    const passwordHash = body.new_password === undefined ? user.passwordHash : await hashPassword(body.new_password)
    const result = await tx.update(users).set({
      name: body.name === undefined ? user.name : body.name.trim(),
      email,
      passwordHash,
      authVersion: user.authVersion + 1
    }).where(eq(users.id, user.id)).returning()
    return result[0]!
  }).catch((cause: unknown) => {
    const failure = cause as { code?: string, cause?: { code?: string } }
    if (failure.code === '23505' || failure.cause?.code === '23505') {
      throw createError({ statusCode: 409, message: 'Email sudah digunakan akun lain.', data: { detail: { code: 'EMAIL_EXISTS', message: 'Email sudah digunakan akun lain.' } } })
    }
    throw cause
  })
  return {
    access_token: await signAccessToken(String(updated.id), updated.role, updated.authVersion),
    token_type: 'bearer',
    user: { id: String(updated.id), name: updated.name, email: updated.email, role: updated.role, status: updated.status, created_at: updated.createdAt.toISOString() }
  }
})
