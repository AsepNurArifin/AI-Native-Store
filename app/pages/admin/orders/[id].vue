<template>
  <div class="min-w-0 space-y-4">
    <NuxtLink to="/admin/orders" class="text-sm text-brand-700 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail pesanan</h1>
    <Card v-if="loading">
      <CardContent><p class="text-sm text-stone-500">Memuat detail…</p></CardContent>
    </Card>
    <Card v-else-if="loadError" role="alert">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Gagal memuat detail pesanan</h2>
        <p v-if="loadError !== 'Gagal memuat detail pesanan'" class="text-sm [overflow-wrap:anywhere]">{{ loadError }}</p>
        <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
      </CardContent>
    </Card>
    <Card v-else-if="notFound">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Pesanan tidak ditemukan.</h2>
        <Button to="/admin/orders" variant="outline">Kembali ke daftar</Button>
      </CardContent>
    </Card>
    <Card v-else-if="order">
      <CardHeader>
        <div class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 font-mono text-sm [overflow-wrap:anywhere]">{{ order.id }}</span>
          <Badge :variant="statusVariant(order.status)">{{ order.status }}</Badge>
          <Badge v-if="order.status === 'CONFIRMED'" :variant="statusVariant(order.payment_status)">
            {{ order.payment_status === 'PAID' ? 'Lunas' : 'Belum bayar' }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl class="grid min-w-0 gap-2 text-sm [overflow-wrap:anywhere] md:grid-cols-2 [&>div]:min-w-0">
          <div><dt class="text-stone-500">Channel</dt><dd>{{ order.channel_origin }}</dd></div>
          <div><dt class="text-stone-500">Total</dt><dd class="font-bold">{{ formatIDR(order.total_amount) }}</dd></div>
          <div><dt class="text-stone-500">Dibuat</dt><dd>{{ formatWIB(order.created_at) }}</dd></div>
          <div v-if="order.payment_status === 'PAID'"><dt class="text-stone-500">Dibayar</dt><dd>{{ formatWIB(order.paid_at) }}</dd></div>
          <div v-else-if="order.expires_at && order.status === 'CONFIRMED'">
            <dt class="text-stone-500">Batas bayar</dt>
            <dd :class="expiringSoon ? 'font-semibold text-amber-700' : ''">{{ formatWIB(order.expires_at) }}</dd>
          </div>
          <div><dt class="text-stone-500">Percakapan</dt><dd class="font-mono text-xs">{{ order.conversation_id || '-' }}</dd></div>
          <div v-if="order.fulfillment" class="md:col-span-2">
            <dt class="text-stone-500">Pengambilan</dt>
            <dd v-if="order.fulfillment.method === 'PICKUP'">Ambil di toko</dd>
            <dd v-else>
              Diantar ke {{ order.fulfillment.recipient || '-' }}
              <span v-if="order.fulfillment.phone">({{ order.fulfillment.phone }})</span>:
              <span class="block text-stone-600">{{ order.fulfillment.address || '-' }}</span>
              <span v-if="order.fulfillment.notes" class="block text-xs text-stone-500">Catatan: {{ order.fulfillment.notes }}</span>
            </dd>
          </div>
        </dl>
        <h2 class="mb-2 mt-4 font-semibold">Item</h2>
        <div class="max-w-full overflow-x-auto" tabindex="0" role="region" aria-label="Item pesanan">
        <table class="w-full min-w-[32rem] text-sm">
          <thead><tr class="border-b text-left text-stone-500"><th class="py-1">Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>
            <tr v-for="it in order.items" :key="it.id" class="border-b border-stone-100">
              <td class="py-1 [overflow-wrap:anywhere]">
                {{ productName(it.product_id) }}
                <span class="block font-mono text-[10px] text-stone-400">{{ it.product_id.slice(0, 8) }}…</span>
              </td>
              <td>{{ it.quantity }}</td><td>{{ formatIDR(it.price_at_order) }}</td><td>{{ formatIDR(it.line_total) }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <div v-if="promoEntries.length" class="mt-3 min-w-0 rounded-lg border border-stone-200 p-3 text-xs text-stone-600 [overflow-wrap:anywhere]">
          <p class="mb-1 font-semibold text-stone-700">Promo yang dipakai:</p>
          <ul class="space-y-0.5">
            <li v-for="e in promoEntries" :key="e.productId">
              {{ e.productName }} — diskon <span class="font-semibold text-emerald-700">{{ e.discount }}%</span>
              <span v-if="e.priceBefore !== null" class="text-stone-400 line-through">{{ formatIDR(e.priceBefore) }}</span>
              <span v-if="e.promotionId" class="text-stone-400">(promo {{ e.promotionId.slice(0, 8) }}…)</span>
            </li>
          </ul>
        </div>
      </CardContent>
      <CardFooter class="flex-col items-start">
        <div class="flex flex-wrap gap-2">
          <Button v-if="order.status === 'CONFIRMED' && order.payment_status !== 'PAID'" size="sm" variant="secondary" class="min-h-11" @click="markPaid()">Tandai Lunas</Button>
          <Button v-if="order.status === 'CONFIRMED' && order.payment_status === 'PAID'" size="sm" variant="secondary" class="min-h-11" @click="complete()">Selesaikan</Button>
          <Button v-if="order.status === 'CONFIRMED'" size="sm" variant="destructive" class="min-h-11" @click="cancel()">Batalkan</Button>
        </div>
        <p v-if="order.status === 'CONFIRMED' && order.payment_status !== 'PAID'" class="mt-2 text-xs text-stone-500">
          Order belum dibayar — stok ditahan sampai {{ formatWIB(order.expires_at) }}, lalu otomatis dibatalkan dan stok dikembalikan.
        </p>
      </CardFooter>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut, ProductOut } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
const order = ref<OrderOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const productNames = ref<Record<string, string>>({})

function productName(id: string) {
  return productNames.value[id] || 'Produk tidak tersedia'
}
const promoEntries = computed(() => {
  const snap = (order.value?.promotion_snapshot || null) as Record<string, { promotion_id?: string, discount_percentage?: number, price_before?: number, discount_per_unit?: number }> | null
  if (!snap) return []
  return Object.entries(snap).map(([pid, v]) => ({
    productId: pid,
    productName: productName(pid),
    discount: Number(v?.discount_percentage ?? 0),
    promotionId: String(v?.promotion_id ?? ''),
    priceBefore: typeof v?.price_before === 'number' ? v.price_before : null
  }))
})

/** Order UNPAID yang deadline-nya < 30 menit lagi — perluditindak kasir. */
const expiringSoon = computed(() => {
  if (!order.value?.expires_at || order.value.payment_status === 'PAID') return false
  return new Date(order.value.expires_at).getTime() - Date.now() < 30 * 60_000
})

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    // Order + daftar produk (untuk nama item) di-fetch paralel.
    const [o, prods] = await Promise.all([
      request<OrderOut | null>(`/orders/${route.params.id}`),
      request<ProductOut[]>('/products', { query: { page_size: 500 } }).catch(() => [] as ProductOut[])
    ])
    order.value = o
    notFound.value = o === null
    productNames.value = Object.fromEntries(prods.map(p => [p.id, p.name]))
  }
  catch (e: unknown) {
    if (e instanceof NormalizedApiError && e.status === 404) notFound.value = true
    else {
      loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat detail pesanan'
      toast.fromError(e, 'Gagal memuat detail pesanan')
    }
  }
  finally { loading.value = false }
}
onMounted(load)
async function markPaid() {
  const ok = await confirmAction.ask({
    title: 'Konfirmasi pembayaran diterima?',
    message: 'Status order jadi LUNAS dan stok keluar dari reserve.',
    confirmLabel: 'Ya, sudah dibayar'
  })
  if (!ok) return
  try {
    order.value = await request<OrderOut>(`/orders/${route.params.id}/pay`, { method: 'POST' })
    toast.success('Pembayaran dikonfirmasi.')
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal mengonfirmasi pembayaran') }
}
async function complete() {
  try {
    order.value = await request<OrderOut>(`/orders/${route.params.id}/complete`, { method: 'POST' })
    toast.success('Order ditandai selesai.')
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menyelesaikan order') }
}
async function cancel() {
  const ok = await confirmAction.ask({
    title: 'Batalkan order ini?',
    message: 'Stok produk akan dikembalikan ke katalog.',
    confirmLabel: 'Batalkan order',
    tone: 'danger'
  })
  if (!ok) return
  try {
    order.value = await request<OrderOut>(`/orders/${route.params.id}/cancel`, { method: 'POST' })
    toast.success('Order dibatalkan, stok dikembalikan.')
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal membatalkan order') }
}
</script>
