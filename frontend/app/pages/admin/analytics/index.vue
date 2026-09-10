<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Analitik</h1>
    <div class="grid gap-4 lg:grid-cols-2">
      <ScCard>
        <template #header><span class="font-semibold">Tanya analis (bahasa natural)</span></template>
        <form class="space-y-2" @submit.prevent="ask()">
          <textarea v-model="question" rows="2" placeholder="Produk apa yang paling laris bulan ini?" class="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <ScButton type="submit" size="sm" :loading="asking">Tanya</ScButton>
        </form>
        <p v-if="askError" class="mt-2 text-sm text-red-600">{{ askError }}</p>
        <div v-if="answer" class="mt-3 rounded bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p class="whitespace-pre-wrap">{{ answer.answer }}</p>
          <details class="mt-2 text-xs text-slate-500">
            <summary class="cursor-pointer">Traceability (query + data mentah)</summary>
            <pre class="mt-1 overflow-x-auto">{{ JSON.stringify({ query_used: answer.query_used, data: answer.data }, null, 2) }}</pre>
          </details>
          <p v-if="answer.disclaimer" class="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{{ answer.disclaimer }}</p>
        </div>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Penjualan per produk</span></template>
        <form class="mb-2 flex flex-wrap gap-2" @submit.prevent="loadSales()">
          <ScInput v-model="from" type="date" class="w-40" />
          <ScInput v-model="to" type="date" class="w-40" />
          <ScButton type="submit" size="sm" variant="secondary">Muat</ScButton>
        </form>
        <p v-if="salesError" class="text-sm text-red-600">{{ salesError }}</p>
        <p v-if="salesLoading" class="text-sm text-slate-500">Memuat…</p>
        <template v-else-if="sales">
          <p class="mb-2 text-sm text-slate-500">
            {{ formatWIB(sales.period.from) }} – {{ formatWIB(sales.period.to) }}
          </p>
          <div v-if="sales.data.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b text-left text-slate-500">
                <th class="py-2 pr-2">#</th><th class="pr-2">Produk</th><th class="pr-2 text-right">Unit terjual</th><th class="pr-2 text-right">Pendapatan</th><th class="w-24"></th>
              </tr></thead>
              <tbody>
                <tr v-for="(row, i) in sales.data" :key="row.key" class="border-b border-slate-100 dark:border-slate-800">
                  <td class="py-2 pr-2 text-slate-400">{{ i + 1 }}</td>
                  <td class="pr-2">{{ salesLabel(row.key) }}</td>
                  <td class="pr-2 text-right">{{ row.units }}</td>
                  <td class="pr-2 text-right font-medium">{{ formatIDR(row.revenue) }}</td>
                  <td class="pr-2">
                    <div class="h-2 rounded bg-blue-600/80" :style="{ width: revenueBar(row.revenue) }" />
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="font-semibold">
                  <td class="py-2"></td><td>Total</td>
                  <td class="text-right">{{ salesTotal.units }}</td>
                  <td class="text-right">{{ formatIDR(salesTotal.revenue) }}</td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else class="text-sm text-slate-500">Tidak ada penjualan pada rentang ini.</p>
        </template>
        <p v-else class="text-sm text-slate-500">Pilih rentang tanggal lalu muat.</p>
      </ScCard>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <ScCard>
        <template #header><span class="font-semibold">Risiko stockout</span></template>
        <div class="mb-2 flex gap-2">
          <ScInput v-model.number="threshold" type="number" class="w-28" placeholder="7 hari" />
          <ScButton size="sm" variant="secondary" :loading="invLoading" @click="loadInv()">Muat</ScButton>
        </div>
        <p v-if="invLoading" class="text-sm text-slate-500">Memuat…</p>
        <template v-else-if="inv">
          <p class="mb-2 text-sm text-slate-500">
            Ambang batas: &le;{{ inv.threshold_days }} hari stok tersisa
            <ScBadge v-if="riskCount" class="ml-2 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">{{ riskCount }} produk berisiko</ScBadge>
          </p>
          <div v-if="inv.data.length" class="max-h-72 overflow-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b text-left text-slate-500">
                <th class="py-2 pr-2">Produk</th><th class="pr-2 text-right">Stok</th><th class="pr-2 text-right">Rata²/hari</th><th class="pr-2 text-right">Sisa hari</th><th></th>
              </tr></thead>
              <tbody>
                <tr
                  v-for="row in inv.data" :key="row.product_id"
                  class="border-b border-slate-100 dark:border-slate-800"
                  :class="row.stockout_risk ? 'bg-red-50 dark:bg-red-900/20' : ''"
                >
                  <td class="py-2 pr-2">
                    {{ row.name }}
                    <span class="block text-xs text-slate-400">{{ row.category }}</span>
                  </td>
                  <td class="pr-2 text-right">{{ row.current_stock }}</td>
                  <td class="pr-2 text-right text-slate-500">{{ row.avg_daily_sales_30d }}</td>
                  <td class="pr-2 text-right font-medium">{{ row.estimated_days_left }}</td>
                  <td><ScBadge :class="row.stockout_risk ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : ''">{{ row.stockout_risk ? 'Berisiko' : 'Aman' }}</ScBadge></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-slate-500">Belum ada produk aktif.</p>
        </template>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Distribusi channel</span></template>
        <ScButton size="sm" variant="secondary" :loading="channelsLoading" @click="loadChannels()">Muat (pakai rentang di atas)</ScButton>
        <p v-if="channelsLoading" class="mt-2 text-sm text-slate-500">Memuat…</p>
        <template v-else-if="channels">
          <p class="mt-2 mb-3 text-sm text-slate-500">
            Total {{ channels.total_orders }} pesanan
            ({{ formatWIB(channels.period.from) }} – {{ formatWIB(channels.period.to) }})
          </p>
          <div v-if="channels.by_channel.length" class="space-y-3">
            <div v-for="row in channels.by_channel" :key="row.channel">
              <div class="mb-1 flex items-center justify-between text-sm">
                <span class="font-medium">{{ channelLabel(row.channel) }}</span>
                <span class="text-slate-500">{{ row.orders }} pesanan · {{ row.percent }}%</span>
              </div>
              <div class="h-3 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div class="h-full rounded bg-blue-600" :style="{ width: row.percent + '%' }" />
              </div>
            </div>
          </div>
          <p v-else class="mt-2 text-sm text-slate-500">Tidak ada pesanan pada rentang ini.</p>
        </template>
        <p v-else class="mt-2 text-xs text-slate-400">Isi rentang tanggal di kartu &ldquo;Penjualan per produk&rdquo; dulu.</p>
      </ScCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnalystResponse, SalesAnalytics, InventoryAnalytics, ChannelAnalytics } from '~/utils/api-types'
import { formatIDR, formatWIB } from '~/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const question = ref('')
const answer = ref<AnalystResponse | null>(null)
const asking = ref(false)
const askError = ref('')
const from = ref('')
const to = ref('')
const sales = ref<SalesAnalytics | null>(null)
const salesError = ref('')
const salesLoading = ref(false)
const threshold = ref<number | undefined>(7)
const inv = ref<InventoryAnalytics | null>(null)
const invLoading = ref(false)
const channels = ref<ChannelAnalytics | null>(null)
const channelsLoading = ref(false)

// label baris: group_by=product -> nama produk, selain itu key apa adanya
function salesLabel(key: string): string {
  return sales.value?.product_names?.[key] || key
}
const salesTotal = computed(() => ({
  units: sales.value?.data.reduce((s, r) => s + r.units, 0) ?? 0,
  revenue: sales.value?.data.reduce((s, r) => s + r.revenue, 0) ?? 0,
}))
// lebar bar relatif terhadap pendapatan tertinggi (min 4% supaya tetap terlihat)
function revenueBar(revenue: number): string {
  const max = Math.max(...(sales.value?.data.map(r => r.revenue) ?? [0]), 1)
  return Math.max(4, Math.round(100 * revenue / max)) + '%'
}
const riskCount = computed(() => inv.value?.data.filter(r => r.stockout_risk).length ?? 0)
function channelLabel(channel: string): string {
  return channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'WEB' ? 'Web Chat' : channel
}

async function ask() {
  asking.value = true; askError.value = ''
  try {
    answer.value = await request<AnalystResponse>('/chat/analyst/ask', {
      method: 'POST', body: { question: question.value }
    })
  }
  catch (e: unknown) { askError.value = e instanceof Error ? e.message : 'Gagal' }
  finally { asking.value = false }
}
function rangeIso() {
  return {
    from_date: from.value ? new Date(from.value).toISOString() : undefined,
    to_date: to.value ? new Date(to.value).toISOString() : undefined
  }
}
async function loadSales() {
  salesError.value = ''
  try {
    const r = rangeIso()
    if (!r.from_date || !r.to_date) { salesError.value = 'Isi dari & sampai tanggal.'; return }
    salesLoading.value = true
    sales.value = await request<SalesAnalytics>('/analytics/sales', { query: { ...r, group_by: 'product', top: 10 } })
  }
  catch (e: unknown) { salesError.value = e instanceof Error ? e.message : 'Gagal' }
  finally { salesLoading.value = false }
}
async function loadInv() {
  invLoading.value = true
  try { inv.value = await request<InventoryAnalytics>('/analytics/inventory', { query: { threshold_days: threshold.value } }) }
  catch { /* abaikan */ }
  finally { invLoading.value = false }
}
async function loadChannels() {
  try {
    const r = rangeIso()
    if (!r.from_date || !r.to_date) return
    channelsLoading.value = true
    channels.value = await request<ChannelAnalytics>('/analytics/channels', { query: r })
  }
  catch { /* abaikan */ }
  finally { channelsLoading.value = false }
}
</script>
