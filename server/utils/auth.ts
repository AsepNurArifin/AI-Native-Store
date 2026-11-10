// Tipe bcryptjs dideklarasikan di server/utils/bcryptjs.d.ts (paketnya tanpa .d.ts).
// WAJIB default-import: bcryptjs@2 itu CommonJS, named import gagal saat runtime.
import bcryptPkg from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import type { H3Event } from 'h3'

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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidNewPassword(password: string): boolean {
  return Array.from(password).length >= 12 && new TextEncoder().encode(password).byteLength <= 72
}

function secretKey(): Uint8Array {
  const s = (useRuntimeConfig().jwtSecret as string) || process.env.JWT_SECRET_KEY || 'change-me-64-char-random-secret'
  return new TextEncoder().encode(s)
}

export interface AccessTokenClaims {
  sub: string
  role: string
  authVersion: number
}

export async function signAccessToken(sub: string, role: string, authVersion: number): Promise<string> {
  const minutes = Number(useRuntimeConfig().accessTokenExpireMinutes ?? process.env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 60)
  return new SignJWT({ sub, role, authVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
  if (typeof payload.sub !== 'string' || typeof payload.role !== 'string'
    || typeof payload.authVersion !== 'number' || !Number.isSafeInteger(payload.authVersion) || payload.authVersion < 0) {
    throw new Error('Klaim token tidak valid')
  }
  return { sub: payload.sub, role: payload.role, authVersion: payload.authVersion }
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  authVersion: number
}

export async function getCurrentUser(event: H3Event): Promise<AuthUser> {
  const header = getRequestHeader(event, 'authorization') || ''
  if (!header.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Token tidak ada', data: { detail: 'Token tidak ada' } })
  }
  const token = header.slice(7)
  let claims: AccessTokenClaims
  try {
    claims = await verifyAccessToken(token)
  }
  catch {
    throw createError({ statusCode: 401, message: 'Token invalid/expired', data: { detail: 'Token invalid/expired' } })
  }
  const db = getDb()
  const rows = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1)
  const u = rows[0]
  if (!u || u.status !== 'ACTIVE' || u.authVersion !== claims.authVersion || u.role !== claims.role) {
    throw createError({ statusCode: 401, message: 'Sesi tidak berlaku. Silakan masuk kembali.', data: { detail: 'Sesi tidak berlaku. Silakan masuk kembali.' } })
  }
  return {
    id: String(u.id),
    name: String(u.name),
    email: String(u.email),
    role: String(u.role),
    status: String(u.status),
    createdAt: (u.createdAt as Date)?.toISOString?.() || String(u.createdAt),
    authVersion: u.authVersion
  }
}


export async function requireOwner(event: H3Event): Promise<AuthUser> {
  const u = await getCurrentUser(event)
  if (u.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Hanya Owner', data: { detail: { code: 'FORBIDDEN', message: 'Hanya Owner yang boleh mengakses' } } })
  }
  return u
}
