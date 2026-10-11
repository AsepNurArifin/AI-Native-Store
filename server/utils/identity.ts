import { randomUUID } from 'node:crypto'

const COOKIE = 'shaf_sid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Identitas customer web berbasis session id yang DITERBITKAN SERVER.
 *
 * MASALAH YANG DIPERBAIKI: sebelumnya identifier web dibangun dari
 * `${name}|${contact}` dengan default 'Tamu' / 'guest' (orders/index.post.ts).
 * Karena customers punya UNIQUE(channel, identifier) dan createOrderFromSummary
 * mencari dulu sebelum insert, SEMUA pembeli anonim menyatu ke satu baris
 * 'Tamu|guest' — halaman Pelanggan jadi satu customer berisi semua order guest,
 * dan analitik repeat-purchase / LTV jadi tidak berarti.
 *
 * Cookie dipilih (bukan param client) supaya session id tidak bisa dipalsukan
 * untuk sengaja menyatu order dengan session orang lain.
 */
export function webIdentity(event: import('h3').H3Event): { identifier: string, sessionId: string, isNew: boolean } {
  const existing = getCookie(event, COOKIE)
  if (existing && UUID_RE.test(existing)) return { identifier: `web:${existing}`, sessionId: existing, isNew: false }
  const sid = randomUUID()
  setCookie(event, COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  })
  return { identifier: `web:${sid}`, sessionId: sid, isNew: true }
}