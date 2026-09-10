<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="flex min-h-screen">
      <aside class="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:block">
        <NuxtLink to="/admin" class="mb-4 block font-bold tracking-tight">AI-Native Store</NuxtLink>
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Operasional</p>
        <nav class="mb-4 space-y-1 text-sm">
          <NuxtLink to="/admin" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Dashboard</NuxtLink>
          <NuxtLink to="/admin/products" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Produk</NuxtLink>
          <NuxtLink to="/admin/inventory" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Inventori</NuxtLink>
          <NuxtLink to="/admin/orders" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Order</NuxtLink>
          <NuxtLink to="/admin/promotions" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Promosi</NuxtLink>
        </nav>
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pelanggan & AI</p>
        <nav class="space-y-1 text-sm">
          <NuxtLink to="/admin/conversations" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Percakapan</NuxtLink>
          <NuxtLink to="/admin/customers" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Customer</NuxtLink>
          <NuxtLink to="/admin/analytics" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Analitik</NuxtLink>
          <template v-if="auth.isOwner">
            <NuxtLink to="/admin/actions" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">AI Actions</NuxtLink>
            <NuxtLink to="/admin/audit" class="block rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">Audit Log</NuxtLink>
          </template>
        </nav>
        <div class="mt-6 border-t border-slate-200 pt-4 text-xs dark:border-slate-700">
          <NuxtLink to="/" class="text-slate-500 hover:underline">← Toko</NuxtLink>
        </div>
      </aside>
      <div class="min-w-0 flex-1">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div class="md:hidden font-bold">AI-Native Store</div>
          <div class="hidden text-sm text-slate-500 md:block">Panel Admin — Staff / Owner</div>
          <div class="flex items-center gap-3 text-sm">
            <span v-if="auth.user" class="text-slate-600 dark:text-slate-300">{{ auth.user.name }} · {{ auth.user.role }}</span>
            <button class="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" @click="auth.logout()">Keluar</button>
          </div>
        </header>
        <div v-if="route.query.forbidden" class="mx-4 mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Halaman khusus Owner. Kamu login sebagai {{ auth.role }}.
        </div>
        <main class="p-4 md:p-6">
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
