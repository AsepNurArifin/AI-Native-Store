<template>
  <div class="min-h-screen bg-slate-50/70 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
    <div class="flex min-h-screen">
      <!-- Sidebar Desktop -->
      <aside class="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-900/90 md:flex backdrop-blur-md">
        <!-- Brand Header -->
        <div class="flex h-16 items-center gap-3 border-b border-slate-100/90 px-5 dark:border-slate-800/80">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" /><path d="M11.5 11.5v.01" /><path d="M15.5 8.5v.01" />
            </svg>
          </div>
          <div>
            <span class="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white">AI-Native <span class="ai-gradient-text">Store</span></span>
            <div class="flex items-center gap-1.5 -mt-0.5">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Admin Hub</span>
            </div>
          </div>
        </div>

        <!-- Navigation Menus -->
        <div class="modern-scrollbar flex-1 space-y-6 overflow-y-auto px-3.5 py-4">
          <!-- Group 1: Operasional Toko -->
          <div>
            <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Operasional Toko
            </p>
            <nav class="space-y-1">
              <NuxtLink
                to="/admin"
                exact-active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <LayoutDashboard class="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/products"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <Package class="h-4 w-4 shrink-0" />
                <span>Katalog Produk</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/inventory"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ArrowLeftRight class="h-4 w-4 shrink-0" />
                <span>Inventori & Stok</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/orders"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ShoppingCart class="h-4 w-4 shrink-0" />
                <span>Pesanan (Orders)</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/promotions"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <Ticket class="h-4 w-4 shrink-0" />
                <span>Promosi & Kupon</span>
              </NuxtLink>
            </nav>
          </div>

          <!-- Group 2: Pelanggan & Multi-Agent AI -->
          <div>
            <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Pelanggan & AI
            </p>
            <nav class="space-y-1">
              <NuxtLink
                to="/admin/conversations"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <MessagesSquare class="h-4 w-4 shrink-0" />
                <span>Percakapan Chat</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/customers"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <Users class="h-4 w-4 shrink-0" />
                <span>Database Customer</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/analytics"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <ChartColumn class="h-4 w-4 shrink-0" />
                <span>Analitik & Metrik</span>
              </NuxtLink>

              <template v-if="auth.isOwner">
                <NuxtLink
                  to="/admin/actions"
                  active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                  class="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <Sparkles class="h-4 w-4 shrink-0 text-purple-500" />
                    <span>AI Actions</span>
                  </div>
                  <span class="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">HITL</span>
                </NuxtLink>

                <NuxtLink
                  to="/admin/audit"
                  active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                  class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  <Shield class="h-4 w-4 shrink-0" />
                  <span>Audit Trail</span>
                </NuxtLink>
              </template>
            </nav>
          </div>
        </div>

        <!-- User Profile Pill Footer -->
        <div class="border-t border-slate-100/90 p-3.5 dark:border-slate-800/80">
          <div class="flex items-center justify-between rounded-2xl bg-slate-50/80 p-2.5 dark:bg-slate-800/50">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs">
                {{ auth.user?.name?.slice(0, 1) || 'A' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-semibold text-slate-900 dark:text-white">{{ auth.user?.name || 'Admin User' }}</p>
                <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{{ auth.role }}</p>
              </div>
            </div>
            <button
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Keluar"
              @click="auth.logout()"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-2 text-center">
            <NuxtLink to="/" class="text-[11px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              ← Lihat Halaman Toko
            </NuxtLink>
          </div>
        </div>
      </aside>

      <!-- Main Layout Body -->
      <div class="min-w-0 flex-1 flex flex-col">
        <!-- Top Bar -->
        <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
          <div class="flex items-center gap-3">
            <NuxtLink to="/" class="md:hidden flex items-center gap-2 font-display font-bold text-sm">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs">AI</div>
              <span>AI-Store</span>
            </NuxtLink>
            <div class="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span>Admin Portal</span>
              <span>/</span>
              <span class="font-semibold text-slate-700 dark:text-slate-300 capitalize">{{ route.path.split('/')[2] || 'Dashboard' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <ThemeToggle />
            <ScBadge tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" :dot="true">
              Sistem Aktif
            </ScBadge>
            <NuxtLink to="/" class="hidden sm:inline-flex text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              Lihat Toko ↗
            </NuxtLink>
          </div>
        </header>

        <!-- Forbidden Alert -->
        <div v-if="route.query.forbidden" class="mx-4 sm:mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300">
          ⚠️ Halaman ini khusus untuk Owner. Anda saat ini masuk sebagai {{ auth.role }}.
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
import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Package,
  Shield,
  ShoppingCart,
  Sparkles,
  Ticket,
  Users
} from '@lucide/vue'

const auth = useAuthStore()
const route = useRoute()
auth.hydrate()
if (auth.token && !auth.user) await auth.fetchMe()
</script>

