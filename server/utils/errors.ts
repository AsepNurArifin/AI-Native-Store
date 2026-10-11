export function apiError(statusCode: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  throw createError({ statusCode, message, data: { detail: { code, message, ...extra } } })
}

export function toOrderHttpCode(code: string): number {
  if (code === 'NOT_FOUND' || code === 'PRODUCT_NOT_FOUND' || code === 'ORDER_NOT_FOUND') return 404
  if (code === 'INSUFFICIENT_STOCK' || code === 'PRODUCT_INACTIVE' || code === 'EMPTY_ORDER' || code === 'INVALID_STATE' || code === 'PRICE_CHANGED' || code === 'IN_PROGRESS' || code === 'NOT_PAID' || code === 'ORDER_EXPIRED') return 409
  return 422
}

export class OrderError extends Error {
  code: string
  details: Record<string, unknown>
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function isUuid(v: unknown): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/**
 * Ambil baris pertama atau lempar error.
 *
 * Drizzle memakai `noUncheckedIndexedAccess: true` (default Nuxt), jadi
 * `rows[0]` bertipe `T | undefined`. Sebelum helper ini, ~40 call site menulis
 * `const x = rows[0]` lalu langsung `x.id` — crash `Cannot read properties of
 * undefined` bila query ternyata kosong. Helper ini making it eksplisit.
 */
export function firstRow<T>(rows: T[] | undefined, context = 'query'): T {
  const row = rows?.[0]
  if (row === undefined) {
    throw new OrderError('NOT_FOUND', `Internal: ${context} tidak mengembalikan baris.`)
  }
  return row
}
