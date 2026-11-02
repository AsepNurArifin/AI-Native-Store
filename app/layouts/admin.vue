<template>
  <div class="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-brand-500 selection:text-white">
    <div class="flex min-h-screen">
      <!-- Sidebar Desktop -->
      <!-- Sidebar Desktop: sticky (statis) — tidak ikut ter-scroll saat body data di-scroll -->
      <aside class="hidden w-64 shrink-0 flex-col border-r border-stone-200/80 bg-sidebar md:sticky md:top-0 md:h-screen md:self-start md:flex">
        <div class="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-md">
            <img src="/logo.jpeg" alt="SHAF STORE Logo" class="h-full w-full object-contain rounded-lg" >
          </div>
          <div>
            <span class="font-display text-sm font-bold tracking-tight text-white">SHAF <span class="text-sidebar-primary">STORE</span></span>
            <p class="text-[11px] font-medium text-white/60">Panel pemilik toko</p>
          </div>
        </div>

        <div class="modern-scrollbar flex-1 overflow-y-auto px-3.5 py-4">
          <AdminNav />
        </div>

        <!-- Profil pengguna -->
        <div class="border-t border-white/10 p-3.5">
          <div class="flex items-center justify-between rounded-2xl bg-stone-50/80 p-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white font-bold text-xs">
                {{ auth.user?.name?.slice(0, 1) || 'A' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-stone-900">{{ auth.user?.name || 'Admin User' }}</p>
                <p class="text-[10px] font-medium text-stone-500">{{ auth.role }}</p>
              </div>
            </div>
            <button
              class="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              title="Keluar"
              aria-label="Keluar dari akun admin"
              @click="auth.logout()"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-2 text-center">
            <NuxtLink to="/" class="inline-flex min-h-11 items-center text-[11px] font-medium text-white/60 hover:text-sidebar-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-promo-400">
              ← Lihat Halaman Toko
            </NuxtLink>
          </div>
        </div>
      </aside>

      <!-- Drawer menu mobile: satu-satunya navigasi admin di bawah md.
           Backdrop + Escape menutup; nav & Keluar ikut di dalamnya. -->
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-40 bg-stone-950/30 md:hidden"
        aria-hidden="true"
        @click="closeMenu"
      />
      <div
        v-if="menuOpen"
        id="admin-menu"
        ref="drawerRef"
        role="dialog"
        aria-modal="true"
        aria-label="Menu admin"
        tabindex="-1"
        class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-stone-200 bg-sidebar outline-none md:hidden"
      >
        <div class="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-md">
              <img src="/logo.jpeg" alt="SHAF STORE Logo" class="h-full w-full object-contain rounded-lg" >
            </div>
            <div>
              <span class="font-display text-sm font-bold tracking-tight text-white">SHAF <span class="text-sidebar-primary">STORE</span></span>
              <p class="text-[11px] font-medium text-white/60">Panel pemilik toko</p>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-sidebar-accent hover:text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-promo-400"
            aria-label="Tutup menu"
            @click="closeMenu"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="modern-scrollbar flex-1 overflow-y-auto px-3.5 py-4">
          <AdminNav />
        </div>

        <div class="border-t border-white/10 p-3.5">
          <div class="flex items-center justify-between rounded-2xl bg-stone-50/80 p-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white font-bold text-xs">
                {{ auth.user?.name?.slice(0, 1) || 'A' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-stone-900">{{ auth.user?.name || 'Admin User' }}</p>
                <p class="text-[10px] font-medium text-stone-500">{{ auth.role }}</p>
              </div>
            </div>
            <button
              type="button"
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              title="Keluar"
              aria-label="Keluar dari akun admin"
              @click="auth.logout()"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-2 text-center">
            <NuxtLink to="/" class="inline-flex min-h-11 items-center text-[11px] font-medium text-white/60 hover:text-sidebar-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-promo-400">
              ← Lihat Halaman Toko
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Main Layout Body -->
      <div class="min-w-0 flex-1 flex flex-col">
        <!-- Top Bar -->
        <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md max-[320px]:h-auto max-[320px]:min-h-16 max-[320px]:flex-wrap max-[320px]:gap-2 max-[320px]:py-2">
          <div class="flex items-center gap-3">
            <NuxtLink to="/" class="md:hidden flex items-center gap-2 font-display font-bold text-sm">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-white p-0.5">
                <img src="/logo.jpeg" alt="SHAF STORE Logo" class="h-full w-full object-contain rounded" >
              </div>
              <span>SHAF STORE</span>
            </NuxtLink>
            <div class="hidden md:flex items-center gap-2 text-xs text-stone-500">
              <span>Admin Portal</span>
              <span>/</span>
              <span class="font-semibold text-stone-700">{{ pageTitle }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <NuxtLink to="/" class="hidden sm:inline-flex text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors">
              Lihat Toko
            </NuxtLink>
            <button
              ref="menuButtonRef"
              type="button"
              class="inline-flex h-11 min-w-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:hidden"
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

        <!-- Forbidden Alert -->
        <div v-if="route.query.forbidden" role="alert" class="mx-4 sm:mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800">
          Akses ditolak: halaman ini khusus untuk Owner. Anda saat ini masuk sebagai {{ auth.role }}.
        </div>

        <!-- Slot Content -->
        <main id="admin-main" tabindex="-1" class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
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
  audit: 'Audit Log'
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
