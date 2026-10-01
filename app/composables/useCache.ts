/**
 * Cache lintas navigasi untuk useAsyncData (bagian C).
 * getCachedData: kalau key ini pernah di-fetch di sesi ini, pakai datanya —
 * navigasi pulang-pergi jadi instan, tanpa nunggu API lagi.
 */
export function useCache() {
  const nuxtApp = useNuxtApp()
  return {
    getCachedData: (key: string) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  }
}
