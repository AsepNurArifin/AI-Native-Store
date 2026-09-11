<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Inventori</h1>
    <Card>
      <CardHeader>
        <CardTitle>Penyesuaian stok manual</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="onAdjust">
          <div class="min-w-52 flex-1"><label class="mb-1 block text-sm">Produk</label>
            <select v-model="adj.product_id" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option value="">— pilih —</option>
              <option v-for="s in summary" :key="s.product_id" :value="s.product_id">{{ s.name }} ({{ s.current_stock }})</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm">Arah</label>
            <select v-model="adj.movement" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option value="IN">IN (tambah)</option><option value="OUT">OUT (kurang)</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm">Qty</label><Input v-model.number="adj.quantity" type="number" class="w-24" /></div>
          <Button type="submit" size="sm" :loading="adjLoading">Catat</Button>
        </form>
        <p v-if="adjMsg" class="mt-2 text-sm" :class="adjOk ? 'text-emerald-600' : 'text-red-600'">{{ adjMsg }}</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan stok</CardTitle>
      </CardHeader>
      <CardContent>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Produk</th><th class="pr-2">Kategori</th><th class="pr-2">Harga</th><th class="pr-2">Stok</th><th>Status</th>
            </tr></thead>
            <tbody>
              <tr v-for="s in summary" :key="s.product_id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">{{ s.name }}</td>
                <td class="pr-2">{{ s.category }}</td>
                <td class="pr-2">{{ formatIDR(s.price) }}</td>
                <td class="pr-2">{{ s.current_stock }}</td>
                <td><Badge :variant="s.is_low_stock ? 'warning' : 'success'">{{ s.is_low_stock ? 'LOW' : 'OK' }}</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Riwayat transaksi</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="mb-2 flex gap-2">
          <select v-model="fType" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua type</option><option>IN</option><option>OUT</option><option>ADJUSTMENT</option>
          </select>
          <Button size="sm" variant="secondary" @click="loadTx()">Muat</Button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Waktu</th><th class="pr-2">Type</th><th class="pr-2">Arah</th><th class="pr-2">Qty</th><th>Ref</th>
            </tr></thead>
            <tbody>
              <tr v-for="t in tx" :key="t.id" class="border-b border-stone-100">
                <td class="py-1 pr-2">{{ formatWIB(t.timestamp) }}</td>
                <td class="pr-2">{{ t.type }}</td><td class="pr-2">{{ t.movement }}</td>
                <td class="pr-2">{{ t.quantity }}</td><td class="text-xs text-stone-500">{{ t.reference_type }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB } from '~/utils/format'
import type { InventoryTx, StockSummaryItem } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const summary = ref<StockSummaryItem[]>([])
const tx = ref<InventoryTx[]>([])
const error = ref('')
const fType = ref('')
const adj = reactive({ product_id: '', movement: 'IN', quantity: 1 })
const adjLoading = ref(false)
const adjMsg = ref('')
const adjOk = ref(false)

onMounted(async () => {
  try { summary.value = await request<StockSummaryItem[]>('/inventory/summary') }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
  await loadTx()
})
async function loadTx() {
  try {
    tx.value = await request<InventoryTx[]>('/inventory/transactions', {
      query: { type: fType.value || undefined, limit: 100 }
    })
  }
  catch { /* abaikan, tabel boleh kosong */ }
}
async function onAdjust() {
  adjLoading.value = true; adjMsg.value = ''
  try {
    await request('/inventory/adjustments', { method: 'POST', body: { ...adj } })
    adjOk.value = true; adjMsg.value = 'Penyesuaian tercatat.'
    summary.value = await request<StockSummaryItem[]>('/inventory/summary')
    await loadTx()
  }
  catch (e: unknown) { adjOk.value = false; adjMsg.value = e instanceof Error ? e.message : 'Gagal' }
  finally { adjLoading.value = false }
}
</script>
