<template>
  <div class="space-y-6">
    <!-- Welcome Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Dashboard Operasional
        </h1>
        <p v-if="auth.user" class="mt-1 text-sm text-stone-500">
          Selamat datang kembali, <span class="font-semibold text-stone-700">{{ auth.user.name }}</span> ({{ auth.user.role }}).
        </p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/admin/products">
          <Button size="sm" variant="ai">
            + Tambah Produk
          </Button>
        </NuxtLink>
        <NuxtLink to="/admin/analytics">
          <Button size="sm" variant="outline">
            Lihat Analitik
          </Button>
        </NuxtLink>
      </div>
    </div>

    <!-- 4 KPI Stat Metric Cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Card 1: API & Server Health -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Koneksi backend</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Activity class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-display text-2xl font-bold text-stone-900">
              {{ health?.status === 'ok' ? 'Online' : 'Memeriksa' }}
            </span>
            <Badge :variant="health?.status === 'ok' ? 'success' : 'danger'" :dot="true">
              {{ health?.status || '...' }}
            </Badge>
          </div>
          <p class="mt-1 truncate text-[11px] text-stone-500">API: {{ apiBase }}</p>
        </CardContent>
      </Card>

      <!-- Card 2: Low Stock Warning -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Stok kritis</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <TriangleAlert class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-display text-2xl font-bold text-stone-900">
              {{ low.length }}
            </span>
            <span class="text-xs font-medium text-stone-500">item butuh restok</span>
          </div>
          <NuxtLink to="/admin/inventory" class="mt-1 inline-block text-[11px] font-medium text-amber-700 hover:underline">
            Buka inventori stok
          </NuxtLink>
        </CardContent>
      </Card>

      <!-- Card 3: Recent Orders -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Pesanan masuk</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-clay-50 text-clay-600">
              <ShoppingCart class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-display text-2xl font-bold text-stone-900">
              {{ orders.length }}
            </span>
            <span class="text-xs font-medium text-stone-500">order tercatat</span>
          </div>
          <NuxtLink to="/admin/orders" class="mt-1 inline-block text-[11px] font-medium text-clay-700 hover:underline">
            Lihat semua transaksi
          </NuxtLink>
        </CardContent>
      </Card>

      <!-- Card 4: AI Governance / HITL -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Antrean persetujuan AI</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-clay-50 text-clay-600">
              <ListChecks class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-display text-2xl font-bold text-clay-600">HITL</span>
            <span class="text-xs font-medium text-stone-500">Human-In-The-Loop</span>
          </div>
          <NuxtLink to="/admin/actions" class="mt-1 inline-block text-[11px] font-medium text-clay-700 hover:underline">
            Persetujuan aksi AI
          </NuxtLink>
        </CardContent>
      </Card>
    </div>

    <!-- Architectural Principle Callout Banner -->
    <div class="rounded-2xl border border-clay-200/80 bg-clay-50/50 p-5">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-clay-700 text-white text-xs font-bold">i</span>
            <h3 class="font-display font-bold text-stone-900 text-sm">Prinsip Arsitektur: Dua Jalur Data Terisolasi</h3>
          </div>
          <p class="text-xs text-stone-600 max-w-2xl leading-relaxed">
            • <b>Jalur 1 (Customer Order)</b>: Transaksi customer berjalan atomik tanpa membutuhkan persetujuan manual.<br>
            • <b>Jalur 2 (Aksi Agen AI)</b>: Rekomendasi promosi & diskon dari AI wajib disetujui (Approved) oleh Owner sebelum aktif.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <NuxtLink to="/admin/actions">
            <Button size="sm" variant="ai">Periksa Antrean AI</Button>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 2 Column Data Widgets -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Widget 1: Low Stock Alert -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-display font-bold text-sm text-stone-900">Peringatan Stok Menipis</span>
            </div>
            <NuxtLink to="/admin/inventory" class="text-xs font-semibold text-clay-600 hover:underline">
              Lihat semua
            </NuxtLink>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="low.length" class="space-y-3">
            <div
              v-for="p in low.slice(0, 5)"
              :key="p.product_id"
              class="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-3"
            >
              <div>
                <p class="font-medium text-stone-900 text-sm line-clamp-1">{{ p.name }}</p>
                <p class="text-xs text-stone-500">ID: {{ p.product_id.slice(0, 8) }}…</p>
              </div>
              <div class="text-right">
                <span class="font-display font-bold text-amber-700 text-sm">
                  Sisa {{ p.current_stock }} unit
                </span>
                <p class="text-[10px] text-stone-500">Ambang: {{ p.low_stock_threshold }} unit</p>
              </div>
            </div>
          </div>
          <div v-else-if="lowError" class="py-6 text-center text-xs text-rose-600">
            {{ lowError }}
          </div>
          <div v-else class="py-6 text-center text-xs text-stone-500">
            Semua stok berada dalam batas aman.
          </div>
        </CardContent>
      </Card>

      <!-- Widget 2: Recent Orders -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-display font-bold text-sm text-stone-900">Pesanan Terkini</span>
            </div>
            <NuxtLink to="/admin/orders" class="text-xs font-semibold text-clay-600 hover:underline">
              Lihat semua
            </NuxtLink>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="orders.length" class="space-y-3">
            <div
              v-for="o in orders.slice(0, 5)"
              :key="o.id"
              class="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/50 p-3"
            >
              <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-bold text-stone-800">#{{ o.id.slice(0, 8) }}</span>
                  <span
                    class="rounded-md px-1.5 py-0.2 text-xs font-bold uppercase"
                    :class="o.channel_origin === 'TELEGRAM' ? 'bg-emerald-100 text-emerald-800 ' : 'bg-stone-200 text-stone-700 '"
                  >
                    {{ o.channel_origin }}
                  </span>
                </div>
                <p class="text-xs font-semibold text-stone-700">{{ formatIDR(o.total_amount) }}</p>
              </div>
              <div>
                <Badge :variant="statusVariant(o.status)">
                  {{ o.status }}
                </Badge>
              </div>
            </div>
          </div>
          <div v-else-if="ordersError" class="py-6 text-center text-xs text-rose-600">
            {{ ordersError }}
          </div>
          <div v-else class="py-6 text-center text-xs text-stone-500">
            Belum ada pesanan yang tercatat.
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, ListChecks, ShoppingCart, TriangleAlert } from '@lucide/vue'
import { formatIDR, statusVariant } from '~/utils/format'
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

