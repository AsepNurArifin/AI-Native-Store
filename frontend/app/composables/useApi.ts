import type { ApiError } from '~/utils/api-types'

/** Error API yang sudah dinormalisasi dari format backend. */
export class NormalizedApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'UNKNOWN', status = 0) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Ambil pesan error backend: detail bisa string | {code,message} | object. */
export function toApiError(e: unknown): ApiError & { status: number } {
  const err = e as { data?: { detail?: unknown }, status?: number, statusCode?: number, message?: string }
  const status = err?.status ?? err?.statusCode ?? 0
  const detail = err?.data?.detail
  if (typeof detail === 'string') return { code: status === 401 ? 'UNAUTHORIZED' : 'ERROR', message: detail, status }
  if (detail && typeof detail === 'object') {
    const d = detail as { code?: string, message?: string }
    if (d.message) return { code: d.code || 'ERROR', message: d.message, status }
    return { code: 'ERROR', message: JSON.stringify(detail), status }
  }
  return { code: 'ERROR', message: err?.message || 'Terjadi kesalahan jaringan', status }
}

/**
 * Wrapper $fetch ke backend.
 * - Basis: runtimeConfig.public.apiBase (default http://localhost:8000/api/v1)
 * - Otomatis Bearer bila ada token (kecuali opts.auth === false untuk guest chat/login)
 * - 401 (kecuali di /login) -> bersihkan sesi + redirect /login (sesuai keputusan)
 */
export function useApi() {
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'
  const auth = useAuthStore()
  const route = useRoute()

  async function request<T>(path: string, opts: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, unknown>
    auth?: boolean
  } = {}): Promise<T> {
    const headers: Record<string, string> = {}
    const needAuth = opts.auth !== false
    if (needAuth && auth.token) headers.Authorization = `Bearer ${auth.token}`
    try {
      return await $fetch<T>(`${base}${path}`, {
        method: opts.method || 'GET',
        body: opts.body as never,
        query: opts.query as never,
        headers
      })
    }
    catch (e: unknown) {
      const parsed = toApiError(e)
      if (parsed.status === 401 && needAuth && route.path !== '/login' && import.meta.client) {
        auth.clear()
        await navigateTo('/login')
      }
      throw new NormalizedApiError(parsed.message, parsed.code, parsed.status)
    }
  }

  return { request }
}
