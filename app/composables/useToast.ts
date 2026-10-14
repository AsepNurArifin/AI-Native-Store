/**
 * Notifikasi pop-up (toast) global.
 *
 * SEBELUMNYA setiap notifikasi ditulis sebagai baris teks di dalam halaman
 * (`<p class="text-red-600">{{ error }}</p>`). Masalahnya: pesan menempel di
 * tempat yang sedang diklik pengguna, hilang saat pindah halaman, dan kalau
 * pesan backend panjang (mis. `[DELETE] "/api/v1/products/…": 409 Conflict`)
 * merusak layout. Sekarang semua notifikasi lewat satu antrean yang dirender
 * `<ToastHost>` di app.vue.
 *
 * State pakai `useState` supaya sama di semua halaman (Nuxt memakai satu
 * store per key di sisi klien) dan aman di SSR.
 */
import { toApiError } from '~/composables/useApi'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastRecord {
  id: number
  message: string
  variant: ToastVariant
  /** Lama tampil (ms). */
  duration: number
}

/** Error butuh waktu baca lebih lama daripada pesan sukses. */
const DURATIONS: Record<ToastVariant, number> = {
  success: 3500,
  info: 4500,
  warning: 6500,
  error: 8000
}

/** Batas tumpukan: sisanya dibuang supaya layar tidak penuh. */
const MAX_VISIBLE = 4

/**
 * Pesan dari error yang tertangkap (`catch`): `NormalizedApiError` dari
 * useApi, `FetchError` mentah dari `$fetch` (chat, login), atau `Error` biasa
 * dari validasi lokal. Semua dinormalisasi di sini supaya salam mentah
 * ofetch (`[DELETE] "/api/v1/…": 409 Conflict`) tidak pernah masuk UI.
 */
export function toastText(e: unknown, fallback: string): string {
  if (typeof e === 'string' && e.trim()) return e
  const api = toApiError(e)
  if (api.status > 0 || api.code === 'NETWORK') return api.message
  if (e instanceof Error && e.message.trim()) return e.message
  return fallback
}

export function useToast() {
  const toasts = useState<ToastRecord[]>('ui:toasts', () => [])
  // Penomoran id harus monoton per sesi; `useState` supaya tidak bentrok
  // antar instance saat SSR dan hydration.
  const seq = useState<number>('ui:toast-seq', () => 0)

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function push(message: string, variant: ToastVariant, duration?: number) {
    const text = message.trim()
    if (!text) return
    // Notif yang sama beruntun (mis. reload gagal 2x) diperpanjang, bukan
    // ditumpuk duplikat.
    toasts.value = toasts.value.filter(t => !(t.message === text && t.variant === variant))
    seq.value += 1
    toasts.value = [
      ...toasts.value,
      { id: seq.value, message: text, variant, duration: duration ?? DURATIONS[variant] }
    ].slice(-MAX_VISIBLE)
  }

  return {
    toasts,
    dismiss,
    success: (message: string, duration?: number) => push(message, 'success', duration),
    info: (message: string, duration?: number) => push(message, 'info', duration),
    warning: (message: string, duration?: number) => push(message, 'warning', duration),
    error: (message: string, duration?: number) => push(message, 'error', duration),
    /** Shorthand untuk `catch`: `toast.fromError(e, 'Gagal memuat')`. */
    fromError: (e: unknown, fallback: string) => push(toastText(e, fallback), 'error')
  }
}
