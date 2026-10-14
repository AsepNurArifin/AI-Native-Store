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

/**
 * Ambil pesan error backend: `detail` bisa string | {code,message} | object.
 *
 * PERBAIKAN bentuk body. Backend selalu melempar
 * `createError({ data: { detail: ... } })`, dan error handler Nitro produzir
 * body `{ error, url, statusCode, statusMessage, message, data: error.data }`
 * (node_modules/nitropack/dist/runtime/internal/error/prod.mjs). Artinya
 * `detail` ada di `body.data.detail` — BUKAN `body.detail`.
 * Versi lama hanya membaca `body.detail`, selalu `undefined`, lalu jatuh ke
 * `err.message` milik ofetch yang mentah:
 *   `[DELETE] "/api/v1/products/<uuid>": 409 Conflict`
 * Gejalanya di UI: pesan backend (mis. "Produk sudah dipakai order,
 * nonaktifkan saja") tidak pernah muncul di mana pun.
 *
 * Urutan sumber pesan sekarang: `data.detail` (nested, bentuk Nitro) ->
 * `detail` (flat, bila suatu handler mengembalikannya langsung) -> `message`
 * dari body -> pesan ofetch yang dibersihkan / pesan generik per status.
 */
export function toApiError(e: unknown): ApiError & { status: number } {
  const err = e as {
    data?: { detail?: unknown, data?: { detail?: unknown }, message?: unknown }
    status?: number
    statusCode?: number
    message?: string
  }
  const status = err?.status ?? err?.statusCode ?? 0
  const body = err?.data
  const detail = (body?.data && typeof body.data === 'object' ? body.data.detail : undefined) ?? body?.detail
  if (typeof detail === 'string' && detail) {
    // Beberapa endpoint menaruh KODE di `detail` (mis. login 429 -> 'RATE_LIMITED').
    // Kode bukan pesan; pakai `message` server yang sudah bahasa manusia.
    if (!/^[A-Z][A-Z0-9_]*$/.test(detail)) {
      return { code: status === 401 ? 'UNAUTHORIZED' : 'ERROR', message: detail, status }
    }
  }
  else if (detail && typeof detail === 'object') {
    const d = detail as { code?: string, message?: string }
    if (d.message) return { code: d.code || 'ERROR', message: d.message, status }
    return { code: 'ERROR', message: JSON.stringify(detail), status }
  }
  // Tanpa `detail`: pakai pesan yang sudah ditulis backend, bukan salam ofetch.
  if (typeof body?.message === 'string' && body.message) {
    return { code: status === 409 ? 'CONFLICT' : 'ERROR', message: body.message, status }
  }
  // Terakhir: 500 dari backend disembunyikan Nitro jadi "Server Error" yang
  // tidak informatif, dan error jaringan tidak punya status sama sekali.
  if (status >= 500) return { code: 'SERVER_ERROR', message: `Permintaan gagal di server (${status}). Coba lagi sebentar.`, status }
  if (status === 0) return { code: 'NETWORK', message: 'Tidak bisa menghubungi server. Periksa koneksi internet.', status }
  const cleaned = cleanFetchMessage(err?.message)
  return { code: 'ERROR', message: cleaned || 'Permintaan ditolak server.', status }
}

/** Buang prefiks ofetch `[METHOD] "/url": 404 Not Found` dari pesan. */
function cleanFetchMessage(message: string | undefined): string {
  if (!message) return ''
  const stripped = message.replace(/^\[[A-Z]+\s+"[^"]+":\s*/, '').trim()
  return stripped && stripped !== 'Server Error' ? stripped : ''
}

/**
 * Wrapper $fetch ke API (satu origin /api/v1, tanpa backend Python).
 * - Basis: runtimeConfig.public.apiBase (default /api/v1)
 * - Otomatis Bearer bila ada token (kecuali opts.auth === false untuk guest chat/login)
 * - 401 (kecuali di /login) -> bersihkan sesi + redirect /login (sesuai keputusan)
 */
export function useApi() {
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string) || '/api/v1'
  const auth = useAuthStore()
  const route = useRoute()

  async function request<T>(path: string, opts: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, unknown>
    auth?: boolean
  } = {}): Promise<T> {
    // Fullstack Nuxt: default ke /api/v1 satu origin (tanpa backend Python).
    const headers: Record<string, string> = {}
    const needAuth = opts.auth !== false
    if (needAuth && auth.token) headers.Authorization = `Bearer ${auth.token}`
    try {
      // $fetch mengembalikan tipe response terinferens, bukan T langsung.
      // Cast lewat `as T` karena pemanggil sudah menyatakan T lewat generic.
      return await $fetch(`${base}${path}`, {
        method: opts.method || 'GET',
        body: opts.body as never,
        query: opts.query as never,
        headers
      }) as T
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
