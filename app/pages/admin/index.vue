<template>
  <div class="space-y-6 max-[320px]:[overflow-wrap:anywhere]">
    <!-- Welcome Header -->
    <div class="admin-dashboard-welcome flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Dashboard Operasional
        </h1>
        <p v-if="auth.user" class="mt-1 text-sm text-stone-500">
          Selamat datang kembali, <span class="font-semibold text-stone-700">{{ auth.user.name }}</span> · {{ auth.role }}.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" aria-label="Muat ulang data dashboard" :loading="kpiLoading" @click="loadDashboard">
          <RefreshCw class="h-4 w-4" />
        </Button>
        <Button v-if="ownerOnly" to="/admin/products" size="sm" variant="ai">+ Tambah Produk</Button>
        <Button v-if="ownerOnly" to="/admin/analytics" size="sm" variant="outline">Lihat Analitik</Button>
        <Button v-if="ownerOnly" to="/admin/settings" size="sm" variant="outline">Pengaturan toko &amp; akun</Button>
      </div>
    </div>

    <!-- 4 KPI Stat Metric Cards -->
    <div class="admin-dashboard-metrics grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Card 1: API & Server Health -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Koneksi backend</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Activity class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-baseline gap-2">
            <span class="font-display text-2xl font-bold text-stone-900">
              {{ kpiLoading || healthChecking ? 'Memuat…' : healthFailed ? 'Tidak tersedia' : health?.status === 'ok' ? 'Online' : 'Tidak tersedia' }}
            </span>
            <Badge v-if="!kpiLoading && !healthChecking" :variant="!healthFailed && health?.status === 'ok' ? 'success' : 'danger'" :dot="true">
              {{ healthFailed ? 'Gagal' : health?.status || 'Tidak tersedia' }}
            </Badge>
          </div>
          <p class="mt-1 truncate text-[11px] text-stone-500">API: {{ apiBase }}</p>
          <button
            v-if="healthFailed && !kpiLoading && !healthChecking"
            type="button"
            class="mt-1 text-[11px] font-medium text-amber-700 underline hover:text-amber-800"
            @click="checkBackend"
          >
            Coba lagi
          </button>
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
          <div class="mt-2 flex flex-wrap items-baseline gap-2">
            <span v-if="!ownerOnly" class="font-display font-semibold text-stone-600">Khusus Owner</span>
            <Skeleton v-else-if="kpiLoading" class="h-8 w-14" />
            <span v-else-if="lowFailed" class="font-display font-semibold text-stone-600">Tidak tersedia</span>
            <template v-else>
              <span class="font-display text-2xl font-bold text-stone-900">{{ low.length }}</span>
              <span class="text-xs font-medium text-stone-500">item butuh restok</span>
            </template>
          </div>
          <Button v-if="ownerOnly && lowFailed && !kpiLoading" type="button" variant="outline" size="sm" class="mt-2" @click="loadDashboard()">Coba lagi</Button>
          <NuxtLink v-if="ownerOnly" to="/admin/inventory" class="mt-1 inline-block text-[11px] font-medium text-amber-700 hover:underline">
            Buka inventori stok
          </NuxtLink>
        </CardContent>
      </Card>

      <!-- Card 3: Recent Orders -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Pesanan masuk</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ShoppingCart class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-baseline gap-2">
            <span v-if="!ownerOnly" class="font-display font-semibold text-stone-600">Khusus Owner</span>
            <Skeleton v-else-if="kpiLoading" class="h-8 w-14" />
            <span v-else-if="ordersFailed" class="font-display font-semibold text-stone-600">Tidak tersedia</span>
            <template v-else>
              <span class="font-display text-2xl font-bold text-stone-900">{{ orders.length }}</span>
              <span class="text-xs font-medium text-stone-500">5 order terakhir</span>
            </template>
          </div>
          <Button v-if="ownerOnly && ordersFailed && !kpiLoading" type="button" variant="outline" size="sm" class="mt-2" @click="loadDashboard()">Coba lagi</Button>
          <NuxtLink v-if="ownerOnly" to="/admin/orders" class="mt-1 inline-block text-[11px] font-medium text-brand-700 hover:underline">
            Lihat semua transaksi
          </NuxtLink>
        </CardContent>
      </Card>

      <!-- Card 4: AI Governance / HITL -->
      <Card class="relative overflow-hidden">
        <CardContent>
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-stone-500">Antrean persetujuan AI</p>
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ListChecks class="h-4 w-4" />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-baseline gap-2">
            <span v-if="!ownerOnly" class="font-display font-semibold text-stone-600">Khusus Owner</span>
            <Skeleton v-else-if="kpiLoading" class="h-8 w-14" />
            <span v-else-if="actionsFailed" class="font-display font-semibold text-stone-600">Tidak tersedia</span>
            <template v-else>
              <span class="font-display text-2xl font-bold text-stone-900">{{ pendingActionsLabel }}</span>
              <span class="text-xs font-medium text-stone-500">draft menunggu keputusan</span>
            </template>
          </div>
          <Button v-if="ownerOnly && actionsFailed && !kpiLoading" type="button" variant="outline" size="sm" class="mt-2" @click="loadDashboard()">Coba lagi</Button>
          <NuxtLink v-if="ownerOnly" to="/admin/actions" class="mt-1 inline-block text-[11px] font-medium text-brand-700 hover:underline">
            {{ !kpiLoading && !actionsFailed && !pendingActions ? 'Antrean kosong — buat draft dari Analitik' : 'Buka antrean persetujuan' }}
          </NuxtLink>
        </CardContent>
      </Card>
    </div>

    <!-- Architectural Principle Callout Banner -->
    <div class="rounded-2xl border border-brand-200/80 bg-brand-50/50 p-5">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-700 text-white text-xs font-bold">i</span>
            <h3 class="font-display font-bold text-stone-900 text-sm">Prinsip Arsitektur: Dua Jalur Data Terisolasi</h3>
          </div>
          <p class="text-xs text-stone-600 max-w-2xl leading-relaxed">
            • <b>Jalur 1 (Pesanan pelanggan)</b>: Pesanan dan reservasi stok atomik. Bukti QRIS diverifikasi manual oleh pengelola sebelum pembayaran ditandai lunas.<br>
            • <b>Jalur 2 (Aksi Agen AI)</b>: Rekomendasi promosi & diskon dari AI wajib disetujui (Approved) oleh Owner sebelum aktif.
          </p>
        </div>
        <div v-if="ownerOnly" class="flex gap-2 shrink-0">
          <Button to="/admin/actions" size="sm" variant="ai" class="max-[320px]:h-auto max-[320px]:min-h-11 max-[320px]:whitespace-normal">Periksa Antrean AI</Button>
        </div>
      </div>
    </div>

    <!-- 2 Column Data Widgets -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Widget 1: Low Stock Alert -->
      <Card>
        <CardHeader>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-display font-bold text-sm text-stone-900">Peringatan Stok Menipis</span>
            </div>
            <NuxtLink v-if="ownerOnly" to="/admin/inventory" class="text-xs font-semibold text-brand-700 hover:underline">
              Lihat semua
            </NuxtLink>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="!ownerOnly" class="py-6 text-center text-xs text-stone-500">
            Ringkasan stok membutuhkan peran Owner.
          </div>
          <p v-else-if="kpiLoading" class="py-6 text-center text-sm text-stone-500">Memuat…</p>
          <div v-else-if="lowFailed" class="py-6 text-center text-sm text-stone-600">
            <p>Tidak tersedia</p>
            <Button type="button" variant="outline" class="mt-3" @click="loadDashboard()">Coba lagi</Button>
          </div>
          <div v-else-if="low.length" class="space-y-3">
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
          <div v-else class="py-6 text-center text-xs text-stone-500">
            Semua stok berada dalam batas aman.
          </div>
        </CardContent>
      </Card>

      <!-- Widget 2: Recent Orders -->
      <Card>
        <CardHeader>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-display font-bold text-sm text-stone-900">Pesanan Terkini</span>
            </div>
            <NuxtLink v-if="ownerOnly" to="/admin/orders" class="text-xs font-semibold text-brand-700 hover:underline">
              Lihat semua
            </NuxtLink>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="!ownerOnly" class="py-6 text-center text-xs text-stone-500">
            Daftar pesanan membutuhkan peran Owner.
          </div>
          <p v-else-if="kpiLoading" class="py-6 text-center text-sm text-stone-500">Memuat…</p>
          <div v-else-if="ordersFailed" class="py-6 text-center text-sm text-stone-600">
            <p>Tidak tersedia</p>
            <Button type="button" variant="outline" class="mt-3" @click="loadDashboard()">Coba lagi</Button>
          </div>
          <div v-else-if="orders.length" class="space-y-3">
            <div
              v-for="o in orders.slice(0, 5)"
              :key="o.id"
              class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50/50 p-3"
            >
              <div class="space-y-0.5 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-xs font-bold text-stone-800">#{{ o.id.slice(0, 8) }}</span>
                  <span
                    class="rounded-md px-1.5 py-0.5 text-xs font-bold uppercase"
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
          <div v-else class="py-6 text-center text-xs text-stone-500">
            Belum ada pesanan yang tercatat.
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, ListChecks, RefreshCw, ShoppingCart, TriangleAlert } from '@lucide/vue'
import { formatIDR, statusVariant } from '~/utils/format'
import type { AIActionOut, OrderOut, StockSummaryItem } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const auth = useAuthStore()
const { request } = useApi()
const toast = useToast()
const apiBase = useRuntimeConfig().public.apiBase as string
const health = ref<{ status: string } | null>(null)
const healthFailed = ref(false)
const healthChecking = ref(false)
const low = ref<StockSummaryItem[]>([])
const lowFailed = ref(false)
const orders = ref<OrderOut[]>([])
const ordersFailed = ref(false)
const pendingActions = ref(0)
const actionsFailed = ref(false)
// Non-Owner: endpoint dashboard membutuhkan Owner, jadi jangan membuang request 403.
const ownerOnly = computed(() => auth.isOwner)
// Antrean HITL dihitung dari halaman berukuran 100 — bila penuh, tampilkan "100+".
const kpiLoading = ref(true)
const pendingActionsLabel = computed(() => (pendingActions.value < 100 ? String(pendingActions.value) : '100+'))

async function checkBackend() {
  if (healthChecking.value) return
  healthChecking.value = true
  try {
    health.value = await request<{ status: string }>('/health', { auth: false })
    healthFailed.value = false
  }
  catch (e: unknown) {
    healthFailed.value = true
    toast.fromError(e, 'Backend tidak terjangkau')
  }
  finally { healthChecking.value = false }
}

async function loadDashboard() {
  kpiLoading.value = true
  // Semua kartu KPI di-fetch paralel (bukan berurutan/waterfall).
  // Request khusus Owner dilewatkan bila yang membuka bukan Owner.
  const [h, s, o, d] = await Promise.allSettled([
    request<{ status: string }>('/health', { auth: false }),
    ownerOnly.value ? request<StockSummaryItem[]>('/inventory/summary') : Promise.reject(new Error('khusus Owner')),
    ownerOnly.value ? request<OrderOut[]>('/orders', { query: { page: 1, page_size: 5 } }) : Promise.reject(new Error('khusus Owner')),
    ownerOnly.value ? request<AIActionOut[]>('/ai-actions', { query: { status: 'DRAFT', page: 1, page_size: 100 } }) : Promise.reject(new Error('khusus Owner'))
  ])
  if (h.status === 'fulfilled') { health.value = h.value; healthFailed.value = false }
  else { healthFailed.value = true; toast.fromError(h.reason, 'Backend tidak terjangkau') }
  if (s.status === 'fulfilled') { low.value = s.value.filter(i => i.is_low_stock); lowFailed.value = false }
  else if (ownerOnly.value) { lowFailed.value = true; toast.fromError(s.reason, 'Gagal memuat ringkasan stok') }
  if (o.status === 'fulfilled') { orders.value = o.value; ordersFailed.value = false }
  else if (ownerOnly.value) { ordersFailed.value = true; toast.fromError(o.reason, 'Gagal memuat pesanan') }
  if (d.status === 'fulfilled') { pendingActions.value = d.value.length; actionsFailed.value = false }
  else if (ownerOnly.value) { actionsFailed.value = true; toast.fromError(d.reason, 'Gagal memuat antrean draft') }
  kpiLoading.value = false
}

onMounted(loadDashboard)
</script>

