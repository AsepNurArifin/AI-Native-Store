<template>
  <div class="admin-shell">
    <div class="admin-frame">
      <aside class="admin-sidebar" aria-label="Panel admin">
        <NuxtLink to="/admin" class="admin-brand">
          <span class="admin-brand-mark"><img src="/logo.jpeg" alt="" ></span>
          <span class="admin-brand-copy">{{ settings.store_name }}<small>Workspace · Operasional toko</small></span>
        </NuxtLink>

        <div class="admin-nav-scroll modern-scrollbar">
          <AdminNav />
        </div>

        <div class="admin-sidebar-footer">
          <div class="admin-profile">
            <span class="admin-avatar" aria-hidden="true">{{ auth.user?.name?.slice(0, 1) || 'A' }}</span>
            <div class="admin-profile-copy">
              <p>{{ auth.user?.name || 'Admin User' }}</p>
              <small>{{ auth.role }}</small>
            </div>
            <button type="button" class="admin-icon-button" title="Keluar" aria-label="Keluar dari akun admin" @click="auth.logout()">
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <NuxtLink to="/" class="admin-store-link">← Kembali ke etalase toko</NuxtLink>
        </div>
      </aside>

      <!-- Backdrop, Escape, and trapped focus keep the mobile drawer self-contained. -->
      <div v-if="menuOpen" class="admin-drawer-backdrop" aria-hidden="true" @click="closeMenu" />
      <div
        v-if="menuOpen"
        id="admin-menu"
        ref="drawerRef"
        role="dialog"
        aria-modal="true"
        aria-label="Menu admin"
        tabindex="-1"
        class="admin-drawer"
      >
        <div class="admin-drawer-header">
          <NuxtLink to="/admin" class="admin-brand">
            <span class="admin-brand-mark"><img src="/logo.jpeg" alt="" ></span>
            <span class="admin-brand-copy">{{ settings.store_name }}<small>Operasional toko</small></span>
          </NuxtLink>
          <button type="button" class="admin-icon-button" aria-label="Tutup menu" @click="closeMenu">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="admin-nav-scroll modern-scrollbar">
          <AdminNav />
        </div>

        <div class="admin-sidebar-footer">
          <div class="admin-profile">
            <span class="admin-avatar" aria-hidden="true">{{ auth.user?.name?.slice(0, 1) || 'A' }}</span>
            <div class="admin-profile-copy">
              <p>{{ auth.user?.name || 'Admin User' }}</p>
              <small>{{ auth.role }}</small>
            </div>
            <button type="button" class="admin-icon-button" title="Keluar" aria-label="Keluar dari akun admin" @click="auth.logout()">
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <NuxtLink to="/" class="admin-store-link">← Kembali ke etalase toko</NuxtLink>
        </div>
      </div>

      <div class="admin-workspace" :inert="menuOpen">
        <a href="#admin-main" class="admin-skip-link">Lewati navigasi</a>
        <header class="admin-topbar">
          <div class="admin-topbar-heading">
            <NuxtLink to="/" class="admin-mobile-brand" :aria-label="`${settings.store_name}, kembali ke toko`">
              <img src="/logo.jpeg" alt="" >
              <span>{{ settings.store_name }}</span>
            </NuxtLink>
            <div class="admin-breadcrumb" aria-label="Lokasi halaman">
              <span>Workspace</span><span aria-hidden="true">/</span><strong>{{ pageTitle }}</strong>
            </div>
          </div>

          <div class="admin-topbar-actions">
            <span class="admin-access-label">{{ auth.role || 'Admin' }}</span>
            <NuxtLink to="/" class="admin-topbar-store">Lihat toko <span aria-hidden="true">↗</span></NuxtLink>
            <button
              ref="menuButtonRef"
              type="button"
              class="admin-menu-button"
              :aria-expanded="menuOpen"
              aria-label="Buka menu admin"
              aria-controls="admin-menu"
              @click="menuOpen = true"
            >
              <Menu class="h-4 w-4" />
              <span>Menu</span>
            </button>
          </div>
        </header>

        <div v-if="route.query.forbidden" role="alert" class="admin-access-error">
          Akses ditolak: halaman ini khusus untuk Owner. Anda saat ini masuk sebagai {{ auth.role }}.
        </div>

        <main id="admin-main" tabindex="-1" class="admin-main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogOut, Menu, X } from '@lucide/vue'
import { handleDialogKeydown } from '~/utils/focus'

// Panel internal: jangan diindeks mesin pencari (halaman toko publik hanya / dan /chat).
const { settings } = useStoreSettings()
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const auth = useAuthStore()
const route = useRoute()

const menuOpen = ref(false)
const drawerRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLButtonElement | null>(null)
let mounted = false
let desktopMedia: MediaQueryList | null = null
let previousBodyOverflow: string | null = null

// Nama halaman breadcrumb: satu istilah per konsep, ikut judul h1.
const pageTitles: Record<string, string> = {
  products: 'Katalog',
  inventory: 'Inventori',
  orders: 'Pesanan',
  promotions: 'Promosi',
  conversations: 'Percakapan',
  customers: 'Pelanggan',
  analytics: 'Analitik',
  actions: 'Aksi AI',
  audit: 'Audit Log',
  settings: 'Pengaturan toko'
}
const pageTitle = computed(() => pageTitles[route.path.split('/')[2] || ''] || 'Dashboard')

function closeMenu() { menuOpen.value = false }

function onKeydown(event: KeyboardEvent) {
  if (menuOpen.value && drawerRef.value) handleDialogKeydown(event, drawerRef.value, closeMenu)
}

function onDesktopChange(event: MediaQueryListEvent) {
  if (event.matches) closeMenu()
}

function restoreBodyOverflow() {
  if (previousBodyOverflow === null) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
}

onMounted(() => {
  mounted = true
  document.addEventListener('keydown', onKeydown)
  desktopMedia = window.matchMedia('(min-width: 768px)')
  desktopMedia.addEventListener('change', onDesktopChange)
  if (desktopMedia.matches) closeMenu()
})
onUnmounted(() => {
  mounted = false
  document.removeEventListener('keydown', onKeydown)
  desktopMedia?.removeEventListener('change', onDesktopChange)
  restoreBodyOverflow()
})
watch(() => route.fullPath, closeMenu)

watch(menuOpen, async (open) => {
  if (open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    if (mounted && menuOpen.value) drawerRef.value?.focus()
    return
  }

  restoreBodyOverflow()
  await nextTick()
  if (!mounted || menuOpen.value) return
  const opener = menuButtonRef.value
  if (opener?.isConnected && opener.getClientRects().length && getComputedStyle(opener).visibility !== 'hidden') opener.focus()
  else document.getElementById('admin-main')?.focus()
})

auth.hydrate()
if (auth.token && !auth.user) await auth.fetchMe()
</script>
