<template>
  <div class="min-w-0 space-y-6">
    <NuxtLink to="/admin/orders" class="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">← Semua pesanan</NuxtLink>
    <Card v-if="loading" role="status">
      <CardContent class="py-8 text-center text-sm text-muted-foreground">Memuat detail pesanan…</CardContent>
    </Card>
    <Card v-else-if="loadError" role="alert">
      <CardContent class="space-y-3 py-6">
        <h1 class="font-semibold">Gagal memuat detail pesanan</h1>
        <p class="text-sm [overflow-wrap:anywhere]">{{ loadError }}</p>
        <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
      </CardContent>
    </Card>
    <Card v-else-if="notFound">
      <CardContent class="space-y-3 py-6">
        <h1 class="font-semibold">Pesanan tidak ditemukan.</h1>
        <Button to="/admin/orders" variant="outline">Kembali ke daftar</Button>
      </CardContent>
    </Card>
    <template v-else-if="order">
      <header class="rounded-2xl bg-brand-900 p-5 text-white sm:p-7">
        <p class="text-xs font-semibold uppercase tracking-widest text-promo-300">Pengelolaan pesanan · {{ order.channel_origin }}</p>
        <div class="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-3xl font-bold [font-family:var(--font-display)]">Pesanan #{{ order.id.slice(0, 8) }}</h1>
            <p class="mt-2 text-xs text-brand-200">Dibuat {{ formatWIB(order.created_at) }}</p>
            <p v-if="order.completed_at" class="mt-1 text-xs text-brand-200">Selesai {{ formatWIB(order.completed_at) }}</p>
            <p v-if="order.cancelled_at" class="mt-1 text-xs text-brand-200">Dibatalkan {{ formatWIB(order.cancelled_at) }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Badge :variant="statusVariant(order.status)">{{ orderStatusLabel(order.status) }}</Badge>
            <Badge :variant="statusVariant(order.payment_status)">{{ order.payment_status === 'PAID' ? 'Lunas' : 'Belum lunas' }}</Badge>
            <Badge v-if="order.payment_review" variant="outline" class="border-promo-300 text-promo-200">{{ reviewLabel(order.payment_review) }}</Badge>
          </div>
        </div>
        <details class="mt-4 text-xs text-brand-200">
          <summary class="cursor-pointer">Identitas lengkap</summary>
          <p class="mt-2 font-mono [overflow-wrap:anywhere]">{{ order.id }}</p>
          <p v-if="order.conversation_id" class="mt-1 [overflow-wrap:anywhere]">Percakapan: {{ order.conversation_id }}</p>
        </details>
      </header>

      <div v-if="mutationError" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 [overflow-wrap:anywhere]">{{ mutationError }}</div>

      <div class="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div class="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <p class="text-xs font-semibold uppercase tracking-widest text-promo-700">Ringkasan belanja</p>
              <h2 class="text-xl font-bold">Produk & total</h2>
            </CardHeader>
            <CardContent>
              <ul class="divide-y divide-border">
                <li v-for="item in order.items" :key="item.id" class="flex min-w-0 flex-wrap justify-between gap-3 py-4 first:pt-0">
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold [overflow-wrap:anywhere]">{{ productName(item.product_id) }}</h3>
                    <p class="mt-1 text-sm text-muted-foreground">{{ item.quantity }} × {{ formatIDR(item.price_at_order) }}</p>
                    <p v-if="itemPromotion(item.product_id)?.discount" class="mt-1 text-xs text-promo-700">
                      Diskon {{ itemPromotion(item.product_id)?.discount }}%
                      <span v-if="itemPromotion(item.product_id)?.priceBefore !== null" class="ml-1 text-muted-foreground line-through">{{ formatIDR(itemPromotion(item.product_id)?.priceBefore ?? 0) }}</span>
                    </p>
                  </div>
                  <p class="font-semibold tabular-nums">{{ formatIDR(item.line_total) }}</p>
                </li>
              </ul>
              <dl class="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Subtotal sebelum diskon</dt><dd class="tabular-nums">{{ formatIDR(order.total_amount + totalDiscount) }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Diskon promo</dt><dd class="font-semibold text-promo-700">−{{ formatIDR(totalDiscount) }}</dd></div>
                <div class="flex justify-between gap-3 rounded-xl bg-brand-50 p-4"><dt class="font-semibold">Total pesanan</dt><dd class="text-xl font-bold text-brand-900 tabular-nums">{{ formatIDR(order.total_amount) }}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><p class="text-xs font-semibold uppercase tracking-widest text-promo-700">Kontak pesanan</p><h2 class="text-xl font-bold">Pembeli & penerimaan</h2></CardHeader>
            <CardContent class="space-y-6">
              <dl class="grid gap-4 text-sm sm:grid-cols-2 [&>div]:min-w-0 [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere]">
                <div><dt class="text-muted-foreground">Nama pembeli</dt><dd class="font-semibold">{{ order.buyer?.name || 'Nama tidak tersedia' }}</dd></div>
                <div><dt class="text-muted-foreground">Kontak</dt><dd>{{ order.buyer?.contact || 'Tidak dicantumkan' }}</dd></div>
                <div><dt class="text-muted-foreground">Telepon pembeli</dt><dd><a v-if="order.buyer?.phone" :href="phoneLink(order.buyer.phone)" class="font-semibold text-brand-700 underline underline-offset-4">{{ order.buyer.phone }}</a><span v-else>Tidak dicantumkan</span></dd></div>
                <div><dt class="text-muted-foreground">Metode penerimaan</dt><dd class="font-semibold">{{ isDelivery ? 'Diantar ke alamat' : order.fulfillment?.method === 'PICKUP' ? 'Ambil di toko' : 'Tidak dicantumkan (pesanan lama)' }}</dd></div>
              </dl>
              <dl v-if="order.fulfillment" class="space-y-4 rounded-xl border border-border bg-muted/40 p-4 text-sm [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere]">
                <div><dt class="text-muted-foreground">Penerima</dt><dd class="font-semibold">{{ order.fulfillment.recipient || order.buyer?.name || 'Tidak dicantumkan' }}</dd></div>
                <div><dt class="text-muted-foreground">Telepon penerima</dt><dd><a v-if="order.fulfillment.phone" :href="phoneLink(order.fulfillment.phone)" class="font-semibold text-brand-700 underline underline-offset-4">{{ order.fulfillment.phone }}</a><span v-else>Tidak dicantumkan</span></dd></div>
                <div v-if="isDelivery"><dt class="text-muted-foreground">Alamat pengiriman</dt><dd class="whitespace-pre-wrap">{{ order.fulfillment.address || 'Tidak dicantumkan' }}</dd></div>
                <div><dt class="text-muted-foreground">Catatan pembeli</dt><dd class="whitespace-pre-wrap">{{ order.fulfillment.notes || 'Tidak ada catatan' }}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><p class="text-xs font-semibold uppercase tracking-widest text-promo-700">Pemenuhan pesanan</p><h2 class="text-xl font-bold">{{ isDelivery ? 'Status pengiriman' : 'Serah terima di toko' }}</h2></CardHeader>
            <CardContent class="space-y-5">
              <template v-if="isDelivery">
                <ol class="space-y-4" aria-label="Tahapan pengiriman">
                  <li v-for="step in deliverySteps" :key="step.status" class="flex gap-3">
                    <span class="mt-1 size-3 shrink-0 rounded-full" :class="step.reached ? 'bg-promo-400 ring-4 ring-promo-100' : 'bg-muted ring-4 ring-muted'" aria-hidden="true" />
                    <div><p :class="step.reached ? 'font-semibold text-brand-900' : 'text-muted-foreground'">{{ step.label }}</p><p class="mt-1 text-xs text-muted-foreground">{{ step.timestamp ? formatWIB(step.timestamp) : step.reached ? 'Waktu tidak tersedia' : 'Belum dikonfirmasi' }}</p></div>
                  </li>
                </ol>
                <p class="rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-700">Ubah status hanya setelah konfirmasi nyata dari kurir atau pelanggan. Status tidak berubah otomatis dan tidak dapat dimundurkan.</p>
                <p v-if="order.status === 'CONFIRMED' && order.payment_status !== 'PAID'" class="text-sm text-muted-foreground">Pengiriman belum dapat dimulai sebelum pembayaran diverifikasi dan lunas.</p>
                <div class="flex flex-wrap gap-2">
                  <Button v-if="canShip" type="button" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === 'ship'" @click="updateDelivery('SHIPPING')">Konfirmasi diserahkan ke kurir</Button>
                  <Button v-if="canDeliver" type="button" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === 'deliver'" @click="updateDelivery('DELIVERED')">Konfirmasi diterima pelanggan</Button>
                </div>
              </template>
              <p v-else class="text-sm leading-relaxed text-muted-foreground">Pastikan pembeli telah menerima seluruh produk. Untuk pembayaran tunai, terima uang dan tandai lunas sebelum menyelesaikan pesanan.</p>
              <Button v-if="canComplete" type="button" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === 'complete'" @click="complete()">{{ isDelivery ? 'Selesaikan pesanan terkirim' : 'Konfirmasi serah terima & selesaikan' }}</Button>
              <p v-if="order.status === 'COMPLETED'" class="text-sm font-semibold text-brand-700">Pesanan selesai{{ order.completed_at ? ` · ${formatWIB(order.completed_at)}` : '' }}.</p>
              <template v-if="canCancel && !pendingReview">
                <div class="border-t border-border pt-4"><Button type="button" variant="ghostDanger" class="min-h-11" :disabled="!!mutation" :loading="mutation === 'cancel'" @click="cancel()">Batalkan pesanan</Button><p class="mt-2 text-xs text-muted-foreground">Pembatalan mengembalikan stok. Pesanan yang sudah dikirim tidak dapat dibatalkan.</p></div>
              </template>
            </CardContent>
          </Card>
        </div>

        <Card class="min-w-0">
          <CardHeader><p class="text-xs font-semibold uppercase tracking-widest text-promo-700">Pemeriksaan manual</p><h2 class="text-xl font-bold">Pembayaran</h2></CardHeader>
          <CardContent class="space-y-5">
            <dl class="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1 [&_dd]:mt-1">
              <div><dt class="text-muted-foreground">Metode pembayaran</dt><dd class="font-semibold">{{ order.payment_method === 'CASH' ? 'Tunai · bayar saat ambil' : order.payment_method === 'QRIS' ? 'QRIS' : 'Tidak dicantumkan (pesanan lama)' }}</dd></div>
              <div><dt class="text-muted-foreground">Jumlah yang harus diterima</dt><dd class="text-2xl font-bold text-brand-900">{{ formatIDR(order.total_amount) }}</dd></div>
              <div><dt class="text-muted-foreground">Status pembayaran</dt><dd>{{ order.payment_status === 'PAID' ? 'Lunas' : 'Belum lunas' }}<span v-if="order.payment_review"> · {{ reviewLabel(order.payment_review) }}</span></dd></div>
              <div v-if="order.paid_at"><dt class="text-muted-foreground">Pembayaran dikonfirmasi</dt><dd>{{ formatWIB(order.paid_at) }}</dd></div>
              <div v-if="order.payment_proof"><dt class="text-muted-foreground">Bukti diunggah</dt><dd>{{ formatWIB(order.payment_proof.submitted_at) }}</dd><p class="mt-1 text-xs text-muted-foreground">{{ order.payment_proof.mime }} · {{ Math.ceil(order.payment_proof.size / 1024) }} KB</p></div>
              <div v-if="order.payment_review_note"><dt class="text-muted-foreground">Alasan penolakan</dt><dd class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ order.payment_review_note }}</dd></div>
            </dl>
            <p v-if="pendingReview && order.status === 'CONFIRMED'" class="rounded-xl border border-promo-200 bg-promo-50 p-4 text-sm leading-relaxed text-promo-800">Menunggu verifikasi admin. Bukti unggahan bukan persetujuan otomatis; pesanan tetap belum lunas dan tidak kedaluwarsa selama pemeriksaan.</p>
            <template v-if="order.payment_proof">
              <div class="space-y-3 rounded-xl border border-border p-3">
                <p class="text-sm font-semibold">Bukti pembayaran privat</p>
                <p v-if="proofLoading" role="status" class="py-5 text-center text-sm text-muted-foreground">Memuat bukti pembayaran…</p>
                <div v-else-if="proofError" role="alert" class="space-y-3 py-3">
                  <p class="text-sm text-rose-700 [overflow-wrap:anywhere]">{{ proofError }}</p>
                  <Button type="button" variant="outline" class="min-h-11" :disabled="!!mutation" @click="loadProof()">Coba muat bukti lagi</Button>
                </div>
                <template v-if="proofUrl">
                  <p v-if="!proofLoaded" role="status" class="text-sm text-muted-foreground">Menyiapkan pratinjau gambar…</p>
                  <a :href="proofUrl" target="_blank" rel="noopener noreferrer" class="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label="Buka bukti pembayaran ukuran penuh">
                    <img :key="proofUrl" :src="proofUrl" alt="Screenshot bukti pembayaran yang diunggah pembeli" class="mx-auto max-h-[36rem] w-full rounded-lg bg-muted object-contain" @load="proofImageLoaded" @error="proofImageFailed">
                  </a>
                  <p class="text-xs text-muted-foreground">Klik gambar untuk ukuran penuh. Hanya pemilik toko yang dapat memuat bukti ini.</p>
                </template>
              </div>
            </template>
            <p v-else-if="order.payment_method === 'QRIS'" class="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Bukti pembayaran tidak tersedia. Pembayaran QRIS tidak dapat diverifikasi tanpa pratinjau bukti.</p>
            <template v-if="canReview">
              <p class="text-sm leading-relaxed text-muted-foreground">Cocokkan penerima, nominal {{ formatIDR(order.total_amount) }}, waktu, serta transaksi yang benar-benar masuk. Screenshot saja tidak menjamin dana diterima.</p>
              <Button type="button" class="min-h-11 w-full whitespace-normal" :disabled="!!mutation || !proofLoaded" :loading="mutation === 'pay'" @click="markPaid()">Verifikasi bukti & tandai lunas</Button>
              <p v-if="!proofLoaded" class="text-xs text-muted-foreground">Pratinjau harus berhasil dimuat sebelum verifikasi diaktifkan.</p>
            </template>
            <template v-if="canCollectCash">
              <p class="rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-700">{{ order.payment_method === 'CASH' ? 'Tagih pembayaran tunai saat pembeli mengambil pesanan di toko. Tandai lunas hanya setelah uang diterima.' : 'Pesanan lama: tandai lunas hanya setelah pembayaran benar-benar diterima.' }}</p>
              <Button type="button" class="min-h-11 w-full whitespace-normal" :disabled="!!mutation" :loading="mutation === 'pay'" @click="markPaid()">{{ order.payment_method === 'CASH' ? 'Konfirmasi uang tunai diterima' : 'Konfirmasi pembayaran diterima' }}</Button>
            </template>
            <div v-if="canCancel && pendingReview" class="space-y-3 border-t border-border pt-5">
              <Label for="rejection-reason">Alasan penolakan bukti</Label>
              <Textarea id="rejection-reason" v-model="rejectionReason" rows="3" maxlength="1000" placeholder="Jelaskan ketidaksesuaian nominal, penerima, atau transaksi…" :disabled="!!mutation" />
              <p class="text-xs leading-relaxed text-muted-foreground">Alasan wajib dicatat. Menolak bukti juga membatalkan pesanan dan mengembalikan stok.</p>
              <Button type="button" variant="destructive" class="min-h-11 w-full whitespace-normal" :disabled="!!mutation || !rejectionReason.trim()" :loading="mutation === 'cancel'" @click="cancel()">Tolak bukti & batalkan pesanan</Button>
            </div>
            <p v-if="showDeadline" class="text-xs leading-relaxed text-muted-foreground">Stok ditahan sampai <span class="font-semibold">{{ formatWIB(order.expires_at) }}</span>. Jika belum dibayar, pesanan otomatis dibatalkan dan stok dikembalikan.</p>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut, ProductOut } from '~/utils/api-types'
import { NormalizedApiError, toApiError } from '~/composables/useApi'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const config = useRuntimeConfig()
const auth = useAuthStore()
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
const order = ref<OrderOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const productNames = ref<Record<string, string>>({})
const mutation = ref<'' | 'pay' | 'complete' | 'cancel' | 'ship' | 'deliver'>('')
const mutationError = ref('')
const rejectionReason = ref('')
const proofUrl = ref('')
const proofLoaded = ref(false)
const proofLoading = ref(false)
const proofError = ref('')
let proofController: AbortController | null = null
let loadSequence = 0

const isDelivery = computed(() => order.value?.fulfillment?.method === 'DELIVERY')
const pendingReview = computed(() => order.value?.payment_method === 'QRIS' && order.value.payment_review === 'PENDING')
const canReview = computed(() => order.value?.status === 'CONFIRMED' && order.value.payment_status !== 'PAID' && pendingReview.value && !!order.value.payment_proof)
const canCollectCash = computed(() => order.value?.status === 'CONFIRMED' && order.value.payment_status !== 'PAID' && order.value.payment_method !== 'QRIS' && (!isDelivery.value || !order.value.payment_method))
const canComplete = computed(() => order.value?.status === 'CONFIRMED' && order.value.payment_status === 'PAID' && (!isDelivery.value || !order.value.payment_method || order.value.delivery_status === 'DELIVERED'))
const canCancel = computed(() => order.value?.status === 'CONFIRMED' && order.value.delivery_status !== 'SHIPPING' && order.value.delivery_status !== 'DELIVERED')
const canShip = computed(() => isDelivery.value && order.value?.status === 'CONFIRMED' && order.value.payment_status === 'PAID' && (!order.value.delivery_status || order.value.delivery_status === 'NOT_SHIPPED'))
const canDeliver = computed(() => isDelivery.value && order.value?.status === 'CONFIRMED' && order.value.payment_status === 'PAID' && order.value.delivery_status === 'SHIPPING')
const showDeadline = computed(() => order.value?.status === 'CONFIRMED' && order.value.payment_status !== 'PAID' && !pendingReview.value && !!order.value.expires_at)
const deliverySteps = computed(() => {
  const current = order.value?.delivery_status || 'NOT_SHIPPED'
  return [
    { status: 'NOT_SHIPPED', label: 'Belum dikirim', reached: true, timestamp: order.value?.created_at },
    { status: 'SHIPPING', label: 'Dalam pengiriman', reached: current === 'SHIPPING' || current === 'DELIVERED', timestamp: order.value?.shipped_at },
    { status: 'DELIVERED', label: 'Diterima pelanggan', reached: current === 'DELIVERED', timestamp: order.value?.delivered_at }
  ]
})
const promotions = computed(() => {
  const snapshot = order.value?.promotion_snapshot as Record<string, { discount_percentage?: number, price_before?: number, discount_per_unit?: number }> | null
  return Object.fromEntries(Object.entries(snapshot || {}).map(([id, promo]) => [id, {
    discount: Number(promo?.discount_percentage ?? 0),
    priceBefore: typeof promo?.price_before === 'number' ? promo.price_before : null,
    discountPerUnit: typeof promo?.discount_per_unit === 'number' ? promo.discount_per_unit : null
  }]))
})
const totalDiscount = computed(() => (order.value?.items || []).reduce((sum, item) => {
  const promo = promotions.value[item.product_id]
  const discount = promo?.discountPerUnit ?? (promo?.priceBefore != null ? promo.priceBefore - item.price_at_order : 0)
  return sum + Math.max(0, discount) * item.quantity
}, 0))

function productName(id: string) {
  return order.value?.items.find(item => item.product_id === id)?.name || productNames.value[id] || 'Produk tidak tersedia'
}
function itemPromotion(id: string) { return promotions.value[id] }
function phoneLink(phone: string) { return `tel:${phone.replace(/[^\d+]/g, '')}` }
function orderStatusLabel(status: string) { return ({ CONFIRMED: 'Aktif', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' } as Record<string, string>)[status] || status }
function reviewLabel(status: string) { return ({ PENDING: 'Menunggu verifikasi', VERIFIED: 'Terverifikasi', REJECTED: 'Bukti ditolak' } as Record<string, string>)[status] || status }

function clearProof() {
  proofController?.abort()
  proofController = null
  if (proofUrl.value) URL.revokeObjectURL(proofUrl.value)
  proofUrl.value = ''
  proofLoaded.value = false
  proofLoading.value = false
  proofError.value = ''
}
async function loadProof() {
  clearProof()
  const current = order.value
  if (!current?.payment_proof || !import.meta.client) return
  if (!auth.token) {
    proofError.value = 'Sesi pemilik toko tidak tersedia. Masuk kembali untuk melihat bukti.'
    return
  }
  const controller = new AbortController()
  proofController = controller
  proofLoading.value = true
  try {
    const base = (config.public.apiBase as string) || '/api/v1'
    const blob = await $fetch<Blob>(`${base}/orders/${encodeURIComponent(current.id)}/payment-proof`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
      signal: controller.signal,
      retry: 0
    })
    if (controller.signal.aborted || order.value?.id !== current.id) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size) throw new Error('Bukti pembayaran bukan gambar yang dapat ditampilkan.')
    proofUrl.value = URL.createObjectURL(blob)
  }
  catch (e: unknown) {
    if (controller.signal.aborted || order.value?.id !== current.id) return
    const error = e as { data?: unknown, status?: number, statusCode?: number, message?: string }
    let parsed = toApiError(e)
    if (error.data instanceof Blob) {
      try { parsed = toApiError({ status: parsed.status, message: error.message, data: JSON.parse(await error.data.text()) }) }
      catch { /* Pertahankan pesan HTTP bila body bukan JSON. */ }
    }
    if (controller.signal.aborted || order.value?.id !== current.id) return
    proofError.value = e instanceof Error && !('statusCode' in e) && parsed.status === 0 ? e.message : parsed.message
    if (parsed.status === 401) {
      auth.clear()
      await navigateTo('/login')
    }
  }
  finally {
    if (proofController === controller) {
      proofLoading.value = false
      proofController = null
    }
  }
}
function proofImageLoaded(event: Event) {
  if ((event.target as HTMLImageElement).src === proofUrl.value) proofLoaded.value = true
}
function proofImageFailed(event: Event) {
  if ((event.target as HTMLImageElement).src !== proofUrl.value) return
  clearProof()
  proofError.value = 'Gambar bukti gagal ditampilkan. Muat ulang bukti sebelum melakukan verifikasi.'
}
watch(() => {
  const proof = order.value?.payment_proof
  return proof ? `${order.value?.id}:${proof.submitted_at}:${proof.mime}:${proof.size}` : ''
}, () => { void loadProof() })

async function load() {
  const sequence = ++loadSequence
  const id = String(route.params.id)
  clearProof()
  order.value = null
  rejectionReason.value = ''
  mutationError.value = ''
  productNames.value = {}
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const result = await request<OrderOut | null>(`/orders/${encodeURIComponent(id)}`)
    if (sequence !== loadSequence) return
    order.value = result
    notFound.value = result === null
    if (result?.items.some(item => !item.name)) {
      const products = await request<ProductOut[]>('/products', { query: { page_size: 500 } }).catch(() => [] as ProductOut[])
      if (sequence !== loadSequence) return
      productNames.value = Object.fromEntries(products.map(product => [product.id, product.name]))
    }
  }
  catch (e: unknown) {
    if (sequence !== loadSequence) return
    if (e instanceof NormalizedApiError && e.status === 404) notFound.value = true
    else {
      loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat detail pesanan'
      toast.fromError(e, 'Gagal memuat detail pesanan')
    }
  }
  finally { if (sequence === loadSequence) loading.value = false }
}
onMounted(load)
watch(() => route.params.id, () => { void load() })
onBeforeRouteLeave(() => { loadSequence++; clearProof() })
onBeforeUnmount(() => { loadSequence++; clearProof() })

async function mutate(action: Exclude<typeof mutation.value, ''>, allowed: () => boolean, confirmation: Parameters<typeof confirmAction.ask>[0], endpoint: string, message: string, body?: Record<string, unknown>) {
  if (mutation.value || !order.value || !allowed()) return
  const id = order.value.id
  mutation.value = action
  mutationError.value = ''
  try {
    if (!await confirmAction.ask(confirmation)) return
    if (order.value?.id !== id || !allowed()) return
    const result = await request<OrderOut>(`/orders/${encodeURIComponent(id)}/${endpoint}`, { method: 'POST', body })
    if (order.value?.id !== id) return
    order.value = result
    if (action === 'cancel') rejectionReason.value = ''
    toast.success(message)
  }
  catch (e: unknown) {
    if (order.value?.id !== id) return
    mutationError.value = e instanceof Error && e.message ? e.message : 'Perubahan pesanan gagal. Coba lagi.'
    toast.fromError(e, 'Gagal memperbarui pesanan')
  }
  finally { mutation.value = '' }
}
async function markPaid() {
  const qris = order.value?.payment_method === 'QRIS'
  await mutate('pay', () => qris ? canReview.value && proofLoaded.value : canCollectCash.value, {
    title: qris ? 'Verifikasi pembayaran QRIS?' : 'Pembayaran sudah diterima?',
    message: qris ? `Pastikan bukti telah diperiksa dan transaksi sebesar ${formatIDR(order.value?.total_amount || 0)} benar-benar masuk ke rekening toko. Ini persetujuan manual, bukan pemeriksaan otomatis.` : 'Pastikan uang sudah diterima. Pesanan akan ditandai lunas dan dicatat sebagai pendapatan.',
    confirmLabel: qris ? 'Bukti benar & dana diterima' : 'Ya, pembayaran diterima'
  }, 'pay', 'Pembayaran dikonfirmasi dan ditandai lunas.')
}
async function updateDelivery(status: 'SHIPPING' | 'DELIVERED') {
  const shipping = status === 'SHIPPING'
  await mutate(shipping ? 'ship' : 'deliver', () => shipping ? canShip.value : canDeliver.value, {
    title: shipping ? 'Pesanan sudah diserahkan ke kurir?' : 'Pelanggan sudah menerima pesanan?',
    message: shipping ? 'Konfirmasikan hanya setelah kurir menerima seluruh produk untuk dikirim ke alamat pesanan. Setelah dikirim, pesanan tidak dapat dibatalkan.' : 'Konfirmasikan hanya berdasarkan pemberitahuan kurir atau pelanggan bahwa seluruh produk sudah diterima. Perubahan ini tidak dapat dimundurkan.',
    confirmLabel: shipping ? 'Ya, kurir sudah menerima' : 'Ya, penerimaan dikonfirmasi'
  }, 'delivery', shipping ? 'Pesanan ditandai dalam pengiriman.' : 'Penerimaan pesanan dikonfirmasi.', { status })
}
async function complete() {
  await mutate('complete', () => canComplete.value, {
    title: isDelivery.value ? 'Selesaikan pesanan yang sudah diterima?' : 'Produk sudah diserahkan ke pembeli?',
    message: isDelivery.value ? 'Pastikan status diterima pelanggan telah dikonfirmasi oleh kurir atau pelanggan, dan pembayaran sudah lunas.' : 'Pastikan seluruh produk telah diserahkan ke pembeli dan pembayaran sudah lunas. Pesanan tidak dapat diubah setelah selesai.',
    confirmLabel: isDelivery.value ? 'Ya, selesaikan pesanan' : 'Ya, serah terima selesai'
  }, 'complete', 'Pesanan ditandai selesai.')
}
async function cancel() {
  const reject = pendingReview.value
  const reason = rejectionReason.value.trim()
  if (reject && !reason) return
  await mutate('cancel', () => canCancel.value && (!reject || pendingReview.value), {
    title: reject ? 'Tolak bukti dan batalkan pesanan?' : 'Batalkan pesanan ini?',
    message: reject ? `Alasan: ${reason}\n\nBukti akan ditandai ditolak, pesanan dibatalkan, dan stok dikembalikan. Jangan menolak jika dana sebenarnya sudah diterima.` : 'Pesanan akan dibatalkan dan stok dikembalikan ke katalog. Pastikan pelanggan telah diberi tahu; jika sudah dibayar, koordinasikan pengembalian dana secara manual.',
    confirmLabel: reject ? 'Tolak & batalkan' : 'Batalkan pesanan',
    tone: 'danger'
  }, 'cancel', reject ? 'Bukti ditolak, alasan dicatat, dan pesanan dibatalkan.' : 'Pesanan dibatalkan dan stok dikembalikan.', reject ? { reason } : undefined)
}
</script>
