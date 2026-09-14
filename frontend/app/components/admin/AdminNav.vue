<template>
  <!-- Navigasi admin, dipakai sidebar desktop dan drawer mobile (satu sumber). -->
  <div class="space-y-6">
    <div>
      <p class="px-3 mb-2 text-[11px] font-semibold text-stone-500">
        Operasional toko
      </p>
      <nav class="space-y-1">
        <NuxtLink
          to="/admin"
          exact-active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <LayoutDashboard class="h-4 w-4 shrink-0" />
          <span>Dashboard</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/products"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <Package class="h-4 w-4 shrink-0" />
          <span>Katalog Produk</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/inventory"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <ArrowLeftRight class="h-4 w-4 shrink-0" />
          <span>Inventori &amp; Stok</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/orders"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <ShoppingCart class="h-4 w-4 shrink-0" />
          <span>Pesanan</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/promotions"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <Ticket class="h-4 w-4 shrink-0" />
          <span>Promosi &amp; Kupon</span>
        </NuxtLink>
      </nav>
    </div>

    <div>
      <p class="px-3 mb-2 text-[11px] font-semibold text-stone-500">
        Pelanggan &amp; AI
      </p>
      <nav class="space-y-1">
        <NuxtLink
          to="/admin/conversations"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <MessagesSquare class="h-4 w-4 shrink-0" />
          <span>Percakapan Chat</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/customers"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <Users class="h-4 w-4 shrink-0" />
          <span>Pelanggan</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/analytics"
          active-class="bg-clay-50/80 text-clay-700 font-semibold"
          class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        >
          <ChartColumn class="h-4 w-4 shrink-0" />
          <span>Analitik &amp; Metrik</span>
        </NuxtLink>

        <template v-if="auth.isOwner">
          <NuxtLink
            to="/admin/actions"
            active-class="bg-clay-50/80 text-clay-700 font-semibold"
            class="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            <span class="flex items-center gap-3">
              <ListChecks class="h-4 w-4 shrink-0" />
              <span>Aksi AI</span>
            </span>
            <span class="rounded-full bg-clay-100 px-1.5 py-0.2 text-xs font-bold text-clay-700">HITL</span>
          </NuxtLink>

          <NuxtLink
            to="/admin/audit"
            active-class="bg-clay-50/80 text-clay-700 font-semibold"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            <Shield class="h-4 w-4 shrink-0" />
            <span>Audit Trail</span>
          </NuxtLink>
        </template>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Package,
  Shield,
  ShoppingCart,
  Ticket,
  Users
} from '@lucide/vue'

const auth = useAuthStore()
</script>
