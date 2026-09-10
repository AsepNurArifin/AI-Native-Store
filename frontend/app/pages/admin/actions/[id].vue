<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/actions" class="text-sm text-blue-600 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail AI Action</h1>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <ScCard v-if="action">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ actionTitle }}</span>
          <ScBadge :class="statusClass(action.status)">{{ action.status }}</ScBadge>
        </div>
      </template>

      <!-- Ringkasan payload — dibaca manusia, bukan JSON mentah -->
      <div v-if="isPromotion" class="mb-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs uppercase tracking-wide text-slate-500">Produk</p>
          <p class="mt-1 font-medium">{{ productName || '…' }}</p>
          <p class="mt-0.5 font-mono text-xs text-slate-400">{{ promoPayload.product_id }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs uppercase tracking-wide text-slate-500">Diskon</p>
          <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ promoPayload.discount_percentage }}%</p>
          <p v-if="productPrice" class="mt-0.5 text-sm text-slate-500">
            {{ formatIDR(productPrice) }} → <span class="font-medium text-emerald-600 dark:text-emerald-400">{{ formatIDR(productPrice * (1 - Number(promoPayload.discount_percentage || 0) / 100)) }}</span>
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:col-span-2">
          <p class="text-xs uppercase tracking-wide text-slate-500">Periode</p>
          <p class="mt-1 text-sm">{{ formatWIB(String(promoPayload.start_date || '')) }} — {{ formatWIB(String(promoPayload.end_date || '')) }}</p>
        </div>
      </div>
      <div v-else-if="isAdjustStock" class="mb-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs uppercase tracking-wide text-slate-500">Produk</p>
          <p class="mt-1 font-medium">{{ productName || '…' }}</p>
          <p class="mt-0.5 font-mono text-xs text-slate-400">{{ stockPayload.product_id }}</p>
          <p v-if="productStock !== null" class="mt-1 text-sm text-slate-500">Stok saat ini: {{ productStock }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p class="text-xs uppercase tracking-wide text-slate-500">Perubahan stok</p>
          <p class="mt-1 text-2xl font-bold" :class="stockPayload.movement === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
            {{ stockPayload.movement === 'IN' ? '+' : '−' }}{{ stockPayload.quantity }}
          </p>
          <p v-if="productStock !== null" class="mt-0.5 text-sm text-slate-500">
            {{ productStock }} → <span class="font-medium">{{ productStock + (stockPayload.movement === 'IN' ? Number(stockPayload.quantity || 0) : -Number(stockPayload.quantity || 0)) }}</span>
          </p>
          <p v-if="isExecuted" class="mt-1 text-xs text-emerald-600">Stok sudah diperbarui.</p>
        </div>
      </div>
      <!-- action_type lain (belum ada) — fallback field per field -->
      <ul v-else class="mb-4 space-y-1 text-sm">
        <li v-for="(value, key) in action.payload" :key="String(key)">
          <span class="font-medium">{{ key }}:</span> {{ value }}
        </li>
      </ul>

      <div v-if="action.validation_failures" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
        <p class="mb-1 font-semibold">Validasi gagal:</p>
        <ul class="list-inside list-disc">
          <li v-for="(msg, field) in action.validation_failures" :key="String(field)">
            <span class="font-mono text-xs">{{ field }}</span>: {{ msg }}
          </li>
        </ul>
      </div>
      <p v-if="action.result_target_id" class="mb-3 text-sm">
        Hasil eksekusi: <code class="font-mono text-xs">{{ action.result_target_id }}</code>
      </p>

      <details class="mb-3 text-xs text-slate-500">
        <summary class="cursor-pointer">Payload mentah (JSON)</summary>
        <pre class="mt-1 overflow-x-auto rounded bg-slate-950 p-3 font-mono text-emerald-200">{{ JSON.stringify(action.payload, null, 2) }}</pre>
      </details>

      <p v-if="msg" class="mb-2 text-sm" :class="ok ? 'text-emerald-600' : 'text-red-600'">{{ msg }}</p>
      <template #footer>
        <div v-if="action.status === 'DRAFT'" class="flex gap-2">
          <ScButton size="sm" :loading="busy" @click="approve()">Approve & Eksekusi</ScButton>
          <ScButton size="sm" variant="destructive" :loading="busy" @click="reject()">Reject</ScButton>
        </div>
        <p v-else class="text-sm text-slate-500">Sudah diputuskan — read-only.</p>
      </template>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
import { statusClass, formatIDR, formatWIB } from '~/utils/format'
import type { AIActionOut, ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const action = ref<AIActionOut | null>(null)
const error = ref('')
const msg = ref('')
const ok = ref(false)
const busy = ref(false)
const product = ref<ProductOut | null>(null)

const actionTitle = computed(() => {
  if (isPromotion.value) return 'Draft Promosi Baru'
  if (isAdjustStock.value) return 'Draft Penyesuaian Stok'
  return action.value?.action_type || 'AI Action'
})
const isPromotion = computed(() => action.value?.action_type === 'CREATE_PROMOTION')
const isAdjustStock = computed(() => action.value?.action_type === 'ADJUST_STOCK')
const isExecuted = computed(() => action.value?.status === 'EXECUTED')
// helper akses payload dengan aman (payload: Record<string, unknown>)
const promoPayload = computed(() => (action.value?.payload ?? {}) as {
  product_id?: string; discount_percentage?: number; start_date?: string; end_date?: string
})
const stockPayload = computed(() => (action.value?.payload ?? {}) as {
  product_id?: string; movement?: string; quantity?: number
})
const productName = computed(() => product.value?.name || null)
const productPrice = computed(() => (typeof product.value?.price === 'number' ? product.value.price : null))
const productStock = computed(() => (typeof product.value?.current_stock === 'number' ? product.value.current_stock : null))

async function load() {
  try {
    action.value = await request<AIActionOut>(`/ai-actions/${route.params.id}`)
    // tampilkan nama produk (payload hanya menyimpan id)
    const pid = isPromotion.value
      ? promoPayload.value.product_id
      : isAdjustStock.value ? stockPayload.value.product_id : null
    if (pid) {
      try { product.value = await request<ProductOut>(`/products/${pid}`) }
      catch { /* produk mungkin sudah dihapus — id saja cukup */ }
    }
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
async function approve() {
  busy.value = true; msg.value = ''
  try {
    const res = await request<{ status: string }>(`/ai-actions/${route.params.id}/approve`, { method: 'POST' })
    ok.value = true; msg.value = `Hasil: ${res.status}`
    await load()
  }
  catch (e: unknown) { ok.value = false; msg.value = e instanceof Error ? e.message : 'Gagal' }
  finally { busy.value = false }
}
async function reject() {
  const note = prompt('Alasan reject (opsional):') || undefined
  busy.value = true; msg.value = ''
  try {
    await request(`/ai-actions/${route.params.id}/reject`, { method: 'POST', body: { note } })
    ok.value = true; msg.value = 'Draft ditolak.'
    await load()
  }
  catch (e: unknown) { ok.value = false; msg.value = e instanceof Error ? e.message : 'Gagal' }
  finally { busy.value = false }
}
</script>
