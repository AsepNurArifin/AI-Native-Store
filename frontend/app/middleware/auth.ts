/** Guard halaman admin: wajib token; ambil /me bila user belum ada. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  const auth = useAuthStore()
  auth.hydrate()
  if (!auth.token) return navigateTo('/login')
  if (!auth.user) {
    const me = await auth.fetchMe()
    if (!me) return navigateTo('/login')
  }
})
