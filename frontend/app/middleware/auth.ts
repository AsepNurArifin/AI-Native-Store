/** Guard halaman admin: wajib token; ambil /me bila user belum ada. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  const auth = useAuthStore()
  auth.hydrate()
  // Simpan tujuan agar login bisa mengembalikan user ke halaman asal.
  const loginUrl = () => `/login?redirect=${encodeURIComponent(to.fullPath)}`
  if (!auth.token) return navigateTo(loginUrl())
  if (!auth.user) {
    const me = await auth.fetchMe()
    if (!me) return navigateTo(loginUrl())
  }
})
