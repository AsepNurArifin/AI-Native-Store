<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/actions" class="text-sm text-brand-700 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail AI Action</h1>
    <Card v-if="action">
      <CardHeader>
        <div class="flex items-center justify-between">
          <span>{{ actionTitle }}</span>
          <Badge :variant="statusVariant(action.status)">{{ action.status }}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <!-- Ringkasan payload: dibaca manusia, bukan JSON mentah -->
        <div v-if="isPromotion" class="mb-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-stone-200 p-3">
            <p class="text-xs font-semibold text-stone-500">Produk</p>
            <p class="mt-1 font-medium">{{ productName || '…' }}</p>
            <p class="mt-0.5 font-mono text-xs text-stone-500">{{ promoPayload.product_id }}</p>
          </div>
          <div class="rounded-lg border border-stone-200 p-3">
            <p class="text-xs font-semibold text-stone-500">Diskon</p>
            <p class="mt-1 text-2xl font-bold text-emerald-600">{{ promoPayload.discount_percentage }}%</p>
            <p v-if="productPrice" class="mt-0.5 text-sm text-stone-500">
              {{ formatIDR(productPrice) }} → <span class="font-medium text-emerald-600">{{ formatIDR(promoPreviewPrice ?? 0) }}</span>
            </p>
          </div>
          <div class="rounded-lg border border-stone-200 p-3 sm:col-span-2">
            <p class="text-xs font-semibold text-stone-500">Periode</p>
            <p class="mt-1 text-sm">{{ formatWIB(String(promoPayload.start_date || '')) }} s.d. {{ formatWIB(String(promoPayload.end_date || '')) }}</p>
          </div>
        </div>
        <div v-else-if="isAdjustStock" class="mb-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-stone-200 p-3">
            <p class="text-xs font-semibold text-stone-500">Produk</p>
            <p class="mt-1 font-medium">{{ productName || '…' }}</p>
            <p class="mt-0.5 font-mono text-xs text-stone-500">{{ stockPayload.product_id }}</p>
            <p v-if="productStock !== null" class="mt-1 text-sm text-stone-500">Stok saat ini: {{ productStock }}</p>
          </div>
          <div class="rounded-lg border border-stone-200 p-3">
            <p class="text-xs font-semibold text-stone-500">Perubahan stok</p>
            <p class="mt-1 text-2xl font-bold" :class="stockPayload.movement === 'IN' ? 'text-emerald-600 ' : 'text-red-600 '">
              {{ stockPayload.movement === 'IN' ? '+' : '−' }}{{ stockPayload.quantity }}
            </p>
            <p v-if="productStock !== null" class="mt-0.5 text-sm text-stone-500">
              {{ productStock }} → <span class="font-medium">{{ productStock + (stockPayload.movement === 'IN' ? Number(stockPayload.quantity || 0) : -Number(stockPayload.quantity || 0)) }}</span>
            </p>
            <p v-if="isExecuted" class="mt-1 text-xs text-emerald-600">Stok sudah diperbarui.</p>
          </div>
        </div>
        <!-- action_type lain (belum ada): fallback field per field -->
        <ul v-else class="mb-4 space-y-1 text-sm">
          <li v-for="(value, key) in action.payload" :key="String(key)">
            <span class="font-medium">{{ key }}:</span> {{ value }}
          </li>
        </ul>

        <div v-if="validationFailuresList.length" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          <p class="mb-1 font-semibold">Validasi gagal:</p>
          <ul class="list-inside list-disc">
            <li v-for="(failure, i) in validationFailuresList" :key="i">{{ failure }}</li>
          </ul>
        </div>
        <p v-if="action.result_target_id" class="mb-3 text-sm">
          Hasil eksekusi: <code class="font-mono text-xs">{{ action.result_target_id }}</code>
        </p>

        <details class="mb-3 text-xs text-stone-500">
          <summary class="cursor-pointer">Payload mentah (JSON)</summary>
          <pre class="mt-1 overflow-x-auto rounded bg-stone-950 p-3 font-mono text-emerald-200">{{ JSON.stringify(action.payload, null, 2) }}</pre>
        </details>
      </CardContent>
      <CardFooter>
        <div v-if="action.status === 'DRAFT'" class="flex gap-2">
          <Button size="sm" :loading="busy" @click="approve()">Approve & Eksekusi</Button>
          <Button size="sm" variant="destructive" :loading="busy" @click="reject()">Reject</Button>
        </div>
        <p v-else class="text-sm text-stone-500">Sudah diputuskan; halaman ini hanya-baca.</p>
      </CardFooter>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { statusVariant, formatIDR, formatWIB } from '~/utils/format'
import { discountedPrice } from '#shared/utils/pricing'
import type { AIActionOut, ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
const action = ref<AIActionOut | null>(null)
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
// Server menyimpan `validation_failures` sebagai `{ failures: [...] }`.
// Diambil ke daftar string biasa agar template tidak tunduk pada bentuk JSON.
const validationFailuresList = computed<string[]>(() => {
  const vf = action.value?.validation_failures as Record<string, unknown> | null | undefined
  if (!vf) return []
  if (Array.isArray(vf.failures)) return vf.failures.map(String)
  return Object.entries(vf).flatMap(([k, v]) => (Array.isArray(v) ? v.map(String) : [`${k}: ${String(v)}`]))
})
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
// Preview harga promo = rumus kanonik shared/utils/pricing (sama dengan yang ditagih).
const promoPreviewPrice = computed(() => {
  if (productPrice.value === null) return null
  return discountedPrice(productPrice.value, Number(promoPayload.value.discount_percentage || 0))
})

async function load() {
  try {
    action.value = await request<AIActionOut>(`/ai-actions/${route.params.id}`)
    await loadProduct()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat detail aksi') }
}
/** Tampilkan nama produk (payload hanya menyimpan id). Dipisah supaya bisa
 *  dimuat ulang sendiri tanpa mengambil ulang seluruh detail aksi. */
async function loadProduct() {
  const pid = isPromotion.value
    ? promoPayload.value.product_id
    : isAdjustStock.value ? stockPayload.value.product_id : null
  if (!pid) return
  try { product.value = await request<ProductOut>(`/products/${pid}`) }
  catch { /* produk mungkin sudah dihapus; id saja cukup */ }
}
onMounted(load)
async function approve() {
  if (busy.value) return
  busy.value = true
  try {
    // Balasan approve membawa status final + hasil validasi/eksekusi — semua
    // dimerge ke state agar owner langsung melihatnya TANPA reload manual.
    const res = await request<{ status: string, result_target_id?: string | null, validation_failures?: { failures: string[] } | null }>(
      `/ai-actions/${route.params.id}/approve`, { method: 'POST' }
    )
    if (action.value) {
      action.value = {
        ...action.value,
        status: res.status,
        result_target_id: res.result_target_id ?? action.value.result_target_id,
        validation_failures: res.validation_failures ?? action.value.validation_failures
      }
    }
    // Validasi gagal BUKAN keberhasilan — bukan toast sukses.
    if (res.status === 'APPROVED_VALIDATION_FAILED') {
      toast.warning(`Aksi disetujui tapi validasi gagal (${validationFailuresList.value.join(', ')}). Perbaiki di halaman terkait, lalu buat draft baru.`)
    }
    else {
      toast.success(`Aksi disetujui dan dieksekusi.`)
    }
    // Hanya stock adjustment yang mengubah data produk (stok) — muat ulang
    // produk saja, bukan seluruh detail aksi.
    if (isAdjustStock.value) await loadProduct()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menyetujui aksi') }
  finally { busy.value = false }
}
async function reject() {
  if (busy.value) return
  // Input alasan lewat dialog yang sama (pengganti window.prompt): satu pola
  // pop-up untuk konfirmasi dan isian.
  const note = await confirmAction.askText({
    title: 'Tolak draft ini?',
    message: 'Alasan bersifat opsional tapi tersimpan di audit trail sebagai jejak keputusan.',
    confirmLabel: 'Tolak',
    tone: 'danger',
    input: { label: 'Alasan reject (opsional)', placeholder: 'mis. harga stale, festival sudah lewat' }
  })
  if (note === null) return
  busy.value = true
  try {
    action.value = await request<AIActionOut>(`/ai-actions/${route.params.id}/reject`, { method: 'POST', body: { note: note || undefined } })
    toast.success('Draft ditolak.')
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menolak aksi') }
  finally { busy.value = false }
}
</script>
