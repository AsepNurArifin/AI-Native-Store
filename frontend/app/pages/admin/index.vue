<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <p v-if="auth.user" class="text-sm text-slate-500">Halo, {{ auth.user.name }} ({{ auth.user.role }})</p>
    <div class="grid gap-4 md:grid-cols-3">
      <ScCard>
        <template #header><span class="font-semibold">Kesehatan Backend</span></template>
        <p v-if="health" class="text-sm">Status: <ScBadge :tone="health.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">{{ health.status }}</ScBadge></p>
        <p v-else-if="healthError" class="text-sm text-red-600">{{ healthError }}</p>
        <p v-else class="text-sm text-slate-500">Memuat…</p>
        <p class="mt-1 text-xs text-slate-500">API: {{ apiBase }}</p>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Jalan pintas</span></template>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/admin/products"><ScButton size="sm" variant="secondary">Produk</ScButton></NuxtLink>
          <NuxtLink to="/admin/orders"><ScButton size="sm" variant="secondary">Order</ScButton></NuxtLink>
          <NuxtLink to="/admin/analytics"><ScButton size="sm" variant="secondary">Analitik</ScButton></NuxtLink>
        </div>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Dua jalur data (pengingat)</span></template>
        <ul class="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li><b>Jalur 1</b>: order dari customer — tanpa approval Owner.</li>
          <li><b>Jalur 2</b>: aksi AI (promosi) — wajib approval Owner.</li>
          <li>Tidak ada Cart — order langsung dari Order Summary.</li>
        </ul>
      </ScCard>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <ScCard>
        <template #header><span class="font-semibold">Stok menipis</span></template>
        <div v-if="low.length" class="space-y-2 text-sm">
          <div v-for="p in low.slice(0, 5)" :key="p.product_id" class="flex justify-between border-b border-slate-100 pb-1">
            <span>{{ p.name }}</span><b>{{ p.current_stock }}</b>
          </div>
          <NuxtLink to="/admin/inventory" class="text-blue-600 hover:underline">Lihat semua →</NuxtLink>
        </div>
        <p v-else class="text-sm text-slate-500">{{ lowError || 'Memuat…' }}</p>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Order terbaru</span></template>
        <div v-if="orders.length" class="space-y-2 text-sm">
          <div v-for="o in orders.slice(0, 5)" :key="o.id" class="flex justify-between border-b border-slate-100 pb-1">
            <span class="truncate">{{ o.id.slice(0, 8) }}… · {{ o.channel_origin }}</span>
            <ScBadge :tone="statusClass(o.status)">{{ o.status }}</ScBadge>
          </div>
          <NuxtLink to="/admin/orders" class="text-blue-600 hover:underline">Lihat semua →</NuxtLink>
        </div>
        <p v-else class="text-sm text-slate-500">{{ ordersError || 'Memuat…' }}</p>
      </ScCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { statusClass } from '~/utils/format'
import type { OrderOut, StockSummaryItem } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const auth = useAuthStore()
const { request } = useApi()
const apiBase = useRuntimeConfig().public.apiBase as string
const health = ref<{ status: string } | null>(null)
const healthError = ref('')
const low = ref<StockSummaryItem[]>([])
const lowError = ref('')
const orders = ref<OrderOut[]>([])
const ordersError = ref('')

onMounted(async () => {
  try { health.value = await request('/health', { auth: false }) }
  catch (e: unknown) { healthError.value = e instanceof Error ? e.message : 'Backend tidak terjangkau' }
  try {
    const all = await request<StockSummaryItem[]>('/inventory/summary')
    low.value = all.filter(i => i.is_low_stock)
  }
  catch (e: unknown) { lowError.value = e instanceof Error ? e.message : 'Gagal memuat stok' }
  try { orders.value = await request<OrderOut[]>('/orders', { query: { page: 1, page_size: 5 } }) }
  catch (e: unknown) { ordersError.value = e instanceof Error ? e.message : 'Gagal memuat order' }
})
</script>
