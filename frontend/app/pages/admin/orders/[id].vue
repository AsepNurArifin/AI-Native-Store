<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/orders" class="text-sm text-blue-600 hover:underline">← Kembali</NuxtLink>
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
          <div><dt class="text-slate-500">Channel</dt><dd>{{ order.channel_origin }}</dd></div>
          <div><dt class="text-slate-500">Total</dt><dd class="font-bold">{{ formatIDR(order.total_amount) }}</dd></div>
          <div><dt class="text-slate-500">Dibuat</dt><dd>{{ formatWIB(order.created_at) }}</dd></div>
          <div><dt class="text-slate-500">Percakapan</dt><dd class="font-mono text-xs">{{ order.conversation_id || '-' }}</dd></div>
        </dl>
        <h2 class="mb-2 mt-4 font-semibold">Item</h2>
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-slate-500"><th class="py-1">Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>
            <tr v-for="it in order.items" :key="it.id" class="border-b border-slate-100">
              <td class="py-1 font-mono text-xs">{{ it.product_id.slice(0, 8) }}…</td>
              <td>{{ it.quantity }}</td><td>{{ formatIDR(it.price_at_order) }}</td><td>{{ formatIDR(it.line_total) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="order.promotion_snapshot" class="mt-3 text-xs text-slate-500">
          Promo snapshot: <code>{{ JSON.stringify(order.promotion_snapshot) }}</code>
        </div>
      </CardContent>
      <CardFooter>
        <div class="flex gap-2">
          <Button v-if="order.status === 'CONFIRMED'" size="sm" variant="secondary" @click="complete()">Complete</Button>
          <Button v-if="order.status === 'CONFIRMED'" size="sm" variant="destructive" @click="cancel()">Cancel</Button>
        </div>
      </CardFooter>
    </Card>
    <p v-else-if="!error" class="text-sm text-slate-500">Memuat…</p>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const route = useRoute()
const { request } = useApi()
const order = ref<OrderOut | null>(null)
const error = ref('')

async function load() {
  try { order.value = await request<OrderOut>(`/orders/${route.params.id}`) }
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
