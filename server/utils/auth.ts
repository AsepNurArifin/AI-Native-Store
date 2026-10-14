// Tipe bcryptjs dideklarasikan di server/utils/bcryptjs.d.ts (paketnya tanpa .d.ts).
// WAJIB default-import: bcryptjs@2 itu CommonJS, named import gagal saat runtime.
import bcryptPkg from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

const { compare, genSalt, hash } = bcryptPkg

export async function hashPassword(plain: string): Promise<string> {
  const salt = await genSalt(10)
  return hash(plain, salt)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await compare(plain, hashed)
  }
  catch {
    return false
  }
}

function secretKey(): Uint8Array {
  const s = (useRuntimeConfig().jwtSecret as string) || process.env.JWT_SECRET_KEY || 'change-me-64-char-random-secret'
  return new TextEncoder().encode(s)
}

export async function signAccessToken(sub: string, role: string): Promise<string> {
  const minutes = Number(useRuntimeConfig().accessTokenExpireMinutes ?? process.env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 60)
  return new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey())
}

export async function verifyAccessToken(token: string): Promise<{ sub: string, role: string }> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
  return { sub: String(payload.sub), role: String((payload as Record<string, unknown>).role || '') }
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

export async function getCurrentUser(event: Parameters<typeof getRequestHeader>[0] extends never ? never : import('h3').H3Event): Promise<AuthUser> {
  const header = getRequestHeader(event, 'authorization') || ''
  if (!header.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Token tidak ada', data: { detail: 'Token tidak ada' } })
  }
  const token = header.slice(7)
  const cached = userCacheGet(token)
  if (cached) return cached

  let claims: { sub: string, role: string }
  try {
    claims = await verifyAccessToken(token)
  }
  catch {
    throw createError({ statusCode: 401, message: 'Token invalid/expired', data: { detail: 'Token invalid/expired' } })
  }
  const db = getDb()
  const rows = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1)
  const u = rows[0]
  if (!u || u.status !== 'ACTIVE') {
    throw createError({ statusCode: 401, message: 'User tidak aktif', data: { detail: 'User tidak aktif' } })
  }
  return userCacheSet(token, {
    id: String(u.id),
    name: String(u.name),
    email: String(u.email),
    role: String(u.role),
    status: String(u.status),
    createdAt: (u.createdAt as Date)?.toISOString?.() || String(u.createdAt)
  })
}

// ---------- Cache user per token ----------
// PERBAIKAN latensi: setiap request admin memanggil getCurrentUser -> 1 query
// ke DB, dan query itu bayar RTT penuh ke Supabase (50-200ms tergantung jarak).
// Cache per token memotong 1 round trip di SEMUA endpoint admin.
// Trade-off: perubahan status/role user baru terlihat setelah TTL habis.
const USER_CACHE_TTL_MS = 60_000
const USER_CACHE_MAX = 500
const userCache = new Map<string, { user: AuthUser, until: number }>()

function userCacheGet(token: string): AuthUser | null {
  const hit = userCache.get(token)
  if (!hit) return null
  if (hit.until < Date.now()) {
    userCache.delete(token)
    return null
  }
  return hit.user
}

function userCacheSet(token: string, user: AuthUser): AuthUser {
  if (userCache.size >= USER_CACHE_MAX) userCache.clear()
  userCache.set(token, { user, until: Date.now() + USER_CACHE_TTL_MS })
  return user
}

export async function requireOwner(event: import('h3').H3Event): Promise<AuthUser> {
  const u = await getCurrentUser(event)
  if (u.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Hanya Owner', data: { detail: { code: 'FORBIDDEN', message: 'Hanya Owner yang boleh mengakses' } } })
  }
  return u
}
