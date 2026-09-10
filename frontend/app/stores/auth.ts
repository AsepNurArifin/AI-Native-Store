import { defineStore } from 'pinia'
import type { UserOut } from '~/utils/api-types'

const TOKEN_KEY = 'ai_store_token'

/** Store auth: token di localStorage, user + role di memori. */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as UserOut | null,
    _hydrated: false
  }),
  getters: {
    isLoggedIn: s => !!s.token,
    role: s => s.user?.role || null,
    isOwner: s => s.user?.role === 'OWNER'
  },
  actions: {
    /** Baca token dari localStorage (client-only). Dipanggil middleware & layout. */
    hydrate() {
      if (this._hydrated || !import.meta.client) return
      this._hydrated = true
      try {
        this.token = localStorage.getItem(TOKEN_KEY)
      }
      catch { this.token = null }
    },
    async login(email: string, password: string) {
      const config = useRuntimeConfig()
      const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'
      const res = await $fetch<{ access_token: string, user: UserOut }>(`${base}/auth/login`, {
        method: 'POST',
        body: { email, password }
      })
      this.token = res.access_token
      this.user = res.user
      if (import.meta.client) {
        try { localStorage.setItem(TOKEN_KEY, res.access_token) }
        catch { /* abaikan */ }
      }
      return res.user
    },
    async fetchMe() {
      if (!this.token) return null
      const config = useRuntimeConfig()
      const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'
      try {
        const me = await $fetch<UserOut>(`${base}/auth/me`, {
          headers: { Authorization: `Bearer ${this.token}` }
        })
        this.user = me
        return me
      }
      catch {
        this.clear()
        return null
      }
    },
    clear() {
      this.token = null
      this.user = null
      if (import.meta.client) {
        try { localStorage.removeItem(TOKEN_KEY) }
        catch { /* abaikan */ }
      }
    },
    async logout() {
      this.clear()
      await navigateTo('/login')
    }
  }
})
