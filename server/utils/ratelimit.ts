/**
 * Rate limiter in-memory per-IP (untuk auth & webhook).
 *
 * PERBAIKAN: limiter sebelumnya hanya dipakai webhook Telegram dengan
 * `lastHits` module-level yang tidak pernah di-evict -> unbounded memory di
 * instance jangka panjang. Sekarang punya sweep berkala.
 *
 * Catatan: in-memory berarti limiter ini per-instance. Di Vercel (serverless,
 * multi-instance) ini deterrent, bukan jaminan. Untuk limit ketat, pindahkan ke
 * tabel DB/Redis.
 */
type Bucket = { hits: number[], lastSeen: number }

const buckets = new Map<string, Bucket>()
let lastSweep = 0
const SWEEP_MS = 5 * 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_MS) return
  lastSweep = now
  for (const [k, b] of buckets) {
    if (now - b.lastSeen > 15 * 60_000) buckets.delete(k)
    else b.hits = b.hits.filter(t => now - t < 15 * 60_000)
  }
}

/** Sliding window. True = BOLEH lanjut; false = sudah melewati batas. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key) ?? { hits: [], lastSeen: now }
  b.hits = b.hits.filter(t => now - t < windowMs)
  b.lastSeen = now
  if (b.hits.length >= max) {
    buckets.set(key, b)
    return false
  }
  b.hits.push(now)
  buckets.set(key, b)
  return true
}

/** Bersihkan counter (dipanggil setelah login berhasil). */
export function rateLimitReset(key: string) {
  buckets.delete(key)
}

export function clientIp(event: import('h3').H3Event): string {
  return getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || 'local'
}