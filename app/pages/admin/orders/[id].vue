<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/orders" class="text-sm text-brand-700 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail Order</h1>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <Card v-if="order">
      <CardHeader>
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm">{{ order.id }}</span>
          <Badge :variant="statusVariant(order.status)">{{ order.status }}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl class="grid gap-2 text-sm md:grid-cols-2">
          <div><dt class="text-stone-500">Channel</dt><dd>{{ order.channel_origin }}</dd></div>
          <div><dt class="text-stone-500">Total</dt><dd class="font-bold">{{ formatIDR(order.total_amount) }}</dd></div>
          <div><dt class="text-stone-500">Dibuat</dt><dd>{{ formatWIB(order.created_at) }}</dd></div>
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
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-stone-500"><th class="py-1">Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>
            <tr v-for="it in order.items" :key="it.id" class="border-b border-stone-100">
              <td class="py-1">
                {{ productName(it.product_id) }}
                <span class="block font-mono text-[10px] text-stone-400">{{ it.product_id.slice(0, 8) }}…</span>
              </td>
              <td>{{ it.quantity }}</td><td>{{ formatIDR(it.price_at_order) }}</td><td>{{ formatIDR(it.line_total) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="promoEntries.length" class="mt-3 rounded-lg border border-stone-200 p-3 text-xs text-stone-600">
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
      <CardFooter>
        <div class="flex gap-2">
          <Button v-if="order.status === 'CONFIRMED'" size="sm" variant="secondary" @click="complete()">Complete</Button>
          <Button v-if="order.status === 'CONFIRMED'" size="sm" variant="destructive" @click="cancel()">Cancel</Button>
        </div>
      </CardFooter>
    </Card>
    <p v-else-if="!error" class="text-sm text-stone-500">Memuat…</p>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut, ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const route = useRoute()
const { request } = useApi()
const order = ref<OrderOut | null>(null)
const error = ref('')
const productNames = ref<Record<string, string>>({})

function productName(id: string) {
  return productNames.value[id] || 'Produk'
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

async function load() {
  try {
    // Order + daftar produk (untuk nama item) di-fetch paralel.
    const [o, prods] = await Promise.all([
      request<OrderOut>(`/orders/${route.params.id}`),
      request<ProductOut[]>('/products', { query: { page_size: 500 } }).catch(() => [] as ProductOut[])
    ])
    order.value = o
    productNames.value = Object.fromEntries(prods.map(p => [p.id, p.name]))
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
async function complete() {
  try { order.value = await request<OrderOut>(`/orders/${route.params.id}/complete`, { method: 'POST' }) }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal' }
}
async function cancel() {
  if (!confirm('Batalkan order ini?')) return
  try { order.value = await request<OrderOut>(`/orders/${route.params.id}/cancel`, { method: 'POST' }) }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal' }
}
</script>
