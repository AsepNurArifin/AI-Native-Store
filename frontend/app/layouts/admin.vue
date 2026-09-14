<template>
  <div class="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-clay-500 selection:text-white">
    <div class="flex min-h-screen">
      <!-- Sidebar Desktop -->
      <aside class="hidden w-64 shrink-0 flex-col border-r border-stone-200/80 bg-sidebar md:flex">
        <div class="flex h-16 items-center gap-3 border-b border-stone-100/90 px-5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-clay-600 text-white shadow-md">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" /><path d="M11.5 11.5v.01" /><path d="M15.5 8.5v.01" />
            </svg>
          </div>
          <div>
            <span class="font-display text-sm font-bold tracking-tight text-stone-900">AI-Native <span class="text-clay-700">Store</span></span>
            <p class="text-[11px] font-medium text-stone-500">Panel pemilik toko</p>
          </div>
        </div>

        <div class="modern-scrollbar flex-1 overflow-y-auto px-3.5 py-4">
          <AdminNav />
        </div>

        <!-- Profil pengguna -->
        <div class="border-t border-stone-100/90 p-3.5">
          <div class="flex items-center justify-between rounded-2xl bg-stone-50/80 p-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-clay-700 text-white font-bold text-xs">
                {{ auth.user?.name?.slice(0, 1) || 'A' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-stone-900">{{ auth.user?.name || 'Admin User' }}</p>
                <p class="text-[10px] font-medium text-stone-500">{{ auth.role }}</p>
              </div>
            </div>
            <button
              class="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer"
              title="Keluar"
              @click="auth.logout()"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-2 text-center">
            <NuxtLink to="/" class="text-[11px] font-medium text-stone-500 hover:text-clay-700 transition-colors">
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
        @click="menuOpen = false"
      />
      <div
        v-if="menuOpen"
        ref="drawerRef"
        role="dialog"
        aria-modal="true"
        aria-label="Menu admin"
        tabindex="-1"
        class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-stone-200 bg-sidebar outline-none md:hidden"
      >
        <div class="flex h-16 shrink-0 items-center justify-between border-b border-stone-100 px-5">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-clay-600 text-white shadow-md">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                <path d="M8.5 8.5v.01" /><path d="M11.5 11.5v.01" /><path d="M15.5 8.5v.01" />
              </svg>
            </div>
            <div>
              <span class="font-display text-sm font-bold tracking-tight text-stone-900">AI-Native <span class="text-clay-700">Store</span></span>
              <p class="text-[11px] font-medium text-stone-500">Panel pemilik toko</p>
            </div>
          </div>
          <button
            class="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer"
            aria-label="Tutup menu"
            @click="menuOpen = false"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="modern-scrollbar flex-1 overflow-y-auto px-3.5 py-4">
          <AdminNav />
        </div>

        <div class="border-t border-stone-100 p-3.5">
          <div class="flex items-center justify-between rounded-2xl bg-stone-50/80 p-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-clay-700 text-white font-bold text-xs">
                {{ auth.user?.name?.slice(0, 1) || 'A' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-stone-900">{{ auth.user?.name || 'Admin User' }}</p>
                <p class="text-[10px] font-medium text-stone-500">{{ auth.role }}</p>
              </div>
            </div>
            <button
              class="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer"
              title="Keluar"
              @click="auth.logout()"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-2 text-center">
            <NuxtLink to="/" class="text-[11px] font-medium text-stone-500 hover:text-clay-700 transition-colors">
              ← Lihat Halaman Toko
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Main Layout Body -->
      <div class="min-w-0 flex-1 flex flex-col">
        <!-- Top Bar -->
        <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md">
          <div class="flex items-center gap-3">
            <NuxtLink to="/" class="md:hidden flex items-center gap-2 font-display font-bold text-sm">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-clay-700 text-white text-xs">AI</div>
              <span>AI-Store</span>
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
              class="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 md:hidden"
              :aria-expanded="menuOpen"
              aria-label="Buka menu admin"
              @click="menuOpen = true"
            >
              <Menu class="h-4 w-4" />
              <span>Menu</span>
            </button>
          </div>
        </header>

        <!-- Forbidden Alert -->
        <div v-if="route.query.forbidden" class="mx-4 sm:mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800">
          Akses ditolak: halaman ini khusus untuk Owner. Anda saat ini masuk sebagai {{ auth.role }}.
        </div>

        <!-- Slot Content -->
        <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogOut, Menu, X } from '@lucide/vue'

// Panel internal: jangan diindeks mesin pencari (halaman toko publik hanya / dan /chat).
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const auth = useAuthStore()
const route = useRoute()

const menuOpen = ref(false)
const drawerRef = ref<HTMLElement | null>(null)

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

// Escape menutup drawer; pindah halaman lewat nav juga menutup.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
watch(() => route.fullPath, () => { menuOpen.value = false })

// Fokus masuk ke drawer saat dibuka; kunci scroll body agar tidak bocor ke belakang.
watch(menuOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    await nextTick()
    drawerRef.value?.focus()
  }
})
onUnmounted(() => { document.body.style.overflow = '' })

auth.hydrate()
if (auth.token && !auth.user) await auth.fetchMe()
</script>
