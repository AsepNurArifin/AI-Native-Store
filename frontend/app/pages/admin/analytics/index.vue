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
        <pre v-if="sales" class="max-h-72 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] text-emerald-200">{{ JSON.stringify(sales, null, 2) }}</pre>
        <p v-else class="text-sm text-slate-500">Pilih rentang tanggal lalu muat.</p>
      </ScCard>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <ScCard>
        <template #header><span class="font-semibold">Risiko stockout</span></template>
        <div class="mb-2 flex gap-2">
          <ScInput v-model.number="threshold" type="number" class="w-28" placeholder="7 hari" />
          <ScButton size="sm" variant="secondary" @click="loadInv()">Muat</ScButton>
        </div>
        <pre v-if="inv" class="max-h-72 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] text-emerald-200">{{ JSON.stringify(inv, null, 2) }}</pre>
      </ScCard>
      <ScCard>
        <template #header><span class="font-semibold">Distribusi channel</span></template>
        <ScButton size="sm" variant="secondary" @click="loadChannels()">Muat (pakai rentang di atas)</ScButton>
        <pre v-if="channels" class="mt-2 max-h-72 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] text-emerald-200">{{ JSON.stringify(channels, null, 2) }}</pre>
      </ScCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnalystResponse } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const question = ref('')
const answer = ref<AnalystResponse | null>(null)
const asking = ref(false)
const askError = ref('')
const from = ref('')
const to = ref('')
const sales = ref<unknown>(null)
const salesError = ref('')
const threshold = ref<number | undefined>(7)
const inv = ref<unknown>(null)
const channels = ref<unknown>(null)

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
    sales.value = await request('/analytics/sales', { query: { ...r, group_by: 'product', top: 10 } })
  }
  catch (e: unknown) { salesError.value = e instanceof Error ? e.message : 'Gagal' }
}
async function loadInv() {
  try { inv.value = await request('/analytics/inventory', { query: { threshold_days: threshold.value } }) }
  catch { /* abaikan */ }
}
async function loadChannels() {
  try {
    const r = rangeIso()
    if (!r.from_date || !r.to_date) return
    channels.value = await request('/analytics/channels', { query: r })
  }
  catch { /* abaikan */ }
}
</script>
