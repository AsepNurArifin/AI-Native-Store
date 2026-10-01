export function apiError(statusCode: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  throw createError({ statusCode, message, data: { detail: { code, message, ...extra } } })
}

export function toOrderHttpCode(code: string): number {
  if (code === 'INSUFFICIENT_STOCK' || code === 'PRODUCT_INACTIVE' || code === 'EMPTY_ORDER' || code === 'INVALID_STATE') return 409
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
