/** Guard Owner-only (seluruh panel admin): role non-Owner -> 403 page sederhana. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  const auth = useAuthStore()
  auth.hydrate()
  if (!auth.token) return navigateTo('/login')
  if (!auth.user) {
    const me = await auth.fetchMe()
    if (!me) return navigateTo('/login')
  }
  if (auth.user?.role !== 'OWNER') {
    return navigateTo('/admin?forbidden=1')
  }
})
