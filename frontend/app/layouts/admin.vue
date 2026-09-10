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
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
                <span>Dashboard</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/products"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                <span>Katalog Produk</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/inventory"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
                <span>Inventori & Stok</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/orders"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
                <span>Pesanan (Orders)</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/promotions"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>
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
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>
                <span>Percakapan Chat</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/customers"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <span>Database Customer</span>
              </NuxtLink>

              <NuxtLink
                to="/admin/analytics"
                active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                <span>Analitik & Metrik</span>
              </NuxtLink>

              <template v-if="auth.isOwner">
                <NuxtLink
                  to="/admin/actions"
                  active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                  class="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <svg class="h-4 w-4 shrink-0 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                    <span>AI Actions</span>
                  </div>
                  <span class="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">HITL</span>
                </NuxtLink>

                <NuxtLink
                  to="/admin/audit"
                  active-class="bg-indigo-50/80 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-semibold"
                  class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                >
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
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
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
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
const auth = useAuthStore()
const route = useRoute()
auth.hydrate()
if (auth.token && !auth.user) await auth.fetchMe()
</script>

