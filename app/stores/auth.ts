import { defineStore } from 'pinia'
import type { LoginResponse, UserOut } from '~/utils/api-types'

const TOKEN_KEY = 'ai_store_token'

interface AccountInput {
  name?: string
  email?: string
  current_password?: string
  new_password?: string
}

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
    replaceSession(response: LoginResponse) {
      this.token = response.access_token
      this.user = response.user
      this._hydrated = true
      if (import.meta.client) {
        try { localStorage.setItem(TOKEN_KEY, response.access_token) }
        catch { /* Sesi tetap tersedia di memori bila penyimpanan diblokir. */ }
      }
    },
    async login(email: string, password: string) {
      const config = useRuntimeConfig()
      const base = (config.public.apiBase as string) || '/api/v1'
      const res = await $fetch<LoginResponse>(`${base}/auth/login`, {
        method: 'POST',
        body: { email, password }
      })
      this.replaceSession(res)
      return res.user
    },
    async updateAccount(input: AccountInput) {
      const config = useRuntimeConfig()
      const base = (config.public.apiBase as string) || '/api/v1'
      const response = await $fetch<LoginResponse>(`${base}/auth/account`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${this.token}` },
        body: input
      })
      this.replaceSession(response)
      return response.user
    },
    async fetchMe() {
      if (!this.token) return null
      const config = useRuntimeConfig()
      const base = (config.public.apiBase as string) || '/api/v1'
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
