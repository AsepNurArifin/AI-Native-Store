<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Inventori</h1>
    <Card>
      <CardHeader>
        <CardTitle>Penyesuaian stok manual</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="onAdjust">
          <div class="min-w-52 flex-1"><label class="mb-1 block text-sm" for="adj-product">Produk</label>
            <!-- Produk nonaktif disaring: endpoint adjustment menolaknya (409). -->
            <select id="adj-product" v-model="adj.product_id" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option value="">pilih produk…</option>
              <option v-for="s in activeSummary" :key="s.product_id" :value="s.product_id">{{ s.name }} ({{ s.current_stock }})</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm" for="adj-movement">Arah</label>
            <select id="adj-movement" v-model="adj.movement" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option value="IN">IN (tambah)</option><option value="OUT">OUT (kurang)</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm" for="adj-qty">Qty</label><Input id="adj-qty" v-model.number="adj.quantity" type="number" min="1" class="w-24" /></div>
          <Button type="submit" size="sm" :loading="adjLoading">Catat</Button>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan stok</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Produk</th><th class="pr-2">Kategori</th><th class="pr-2">Harga</th><th class="pr-2">Stok</th><th>Status</th>
            </tr></thead>
            <tbody>
              <tr v-if="summaryLoading">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Memuat ringkasan stok…</td>
              </tr>
              <tr v-else-if="!summary.length">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Belum ada data stok.</td>
              </tr>
              <tr v-for="s in summary" :key="s.product_id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">
                  {{ s.name }}
                  <Badge v-if="s.status === 'INACTIVE'" variant="secondary" class="ml-1">Nonaktif</Badge>
                </td>
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
          <select v-model="fType" aria-label="Filter type transaksi" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua type</option><option>IN</option><option>OUT</option><option>ADJUSTMENT</option>
          </select>
          <select v-model="fMovement" aria-label="Filter arah pergerakan" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua arah</option><option value="IN">Masuk</option><option value="OUT">Keluar</option>
          </select>
          <Button size="sm" variant="secondary" @click="txPage = 1; loadTx()">Muat</Button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Waktu</th><th class="pr-2">Type</th><th class="pr-2">Arah</th><th class="pr-2">Qty</th><th>Ref</th>
            </tr></thead>
            <tbody>
              <tr v-if="txLoading">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Memuat riwayat transaksi…</td>
              </tr>
              <tr v-else-if="txFailed">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Riwayat transaksi gagal dimuat — cek notifikasi, lalu tekan "Muat".</td>
              </tr>
              <tr v-else-if="!tx.length">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Belum ada transaksi stok.</td>
              </tr>
              <tr v-for="t in tx" :key="t.id" class="border-b border-stone-100">
                <td class="py-1 pr-2">{{ formatWIB(t.timestamp) }}</td>
                <td class="pr-2">{{ t.type }}</td><td class="pr-2">{{ t.movement }}</td>
                <td class="pr-2">{{ t.quantity }}</td><td class="text-xs text-stone-500">{{ t.reference_type }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminPager :page="txPage" :count="tx.length" :page-size="txPageSize" :loading="txLoading" @prev="txPage--; loadTx()" @next="txPage++; loadTx()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB } from '~/utils/format'
import type { InventoryTx, StockSummaryItem } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const summary = ref<StockSummaryItem[]>([])
const summaryLoading = ref(true)
const tx = ref<InventoryTx[]>([])
const txLoading = ref(true)
// Beda "kosong" dan "gagal": error jaringan jangan tampil seolah belum ada transaksi.
const txFailed = ref(false)
const fType = ref('')
const fMovement = ref('')
const txPage = ref(1)
const txPageSize = 10
const adj = reactive({ product_id: '', movement: 'IN', quantity: 1 })
const adjLoading = ref(false)
// Dropdown penyesuaian hanya menerima produk aktif — server menolak
// penyesuaian untuk produk INACTIVE (409).
const activeSummary = computed(() => summary.value.filter(s => s.status !== 'INACTIVE'))

async function loadSummary() {
  summaryLoading.value = true
  try { summary.value = await request<StockSummaryItem[]>('/inventory/summary') }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat ringkasan stok') }
  finally { summaryLoading.value = false }
}
// Ringkasan + riwayat di-fetch paralel (bukan berurutan).
onMounted(() => Promise.all([loadSummary(), loadTx()]))
async function loadTx() {
  txLoading.value = true
  txFailed.value = false
  try {
    tx.value = await request<InventoryTx[]>('/inventory/transactions', {
      query: {
        type: fType.value || undefined,
        movement: fMovement.value || undefined,
        page: txPage.value,
        page_size: txPageSize
      }
    })
  }
  catch (e: unknown) {
    txFailed.value = true
    toast.fromError(e, 'Gagal memuat riwayat transaksi')
  }
  finally { txLoading.value = false }
}
async function onAdjust() {
  if (adjLoading.value) return
  if (!adj.product_id) { toast.warning('Pilih produk dulu sebelum mencatat penyesuaian.'); return }
  // Validasi klien: server menolak qty bukan integer positif (422).
  if (!Number.isInteger(adj.quantity) || adj.quantity <= 0) {
    toast.error('Qty harus bilangan bulat lebih dari 0.')
    return
  }
  adjLoading.value = true
  try {
    await request('/inventory/adjustments', { method: 'POST', body: { ...adj } })
    toast.success('Penyesuaian stok tercatat. Form dikosongkan agar tidak tersubmit dobel.')
    adj.product_id = ''
    adj.movement = 'IN'
    adj.quantity = 1
    await Promise.all([loadSummary(), loadTx()])
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal mencatat penyesuaian stok') }
  finally { adjLoading.value = false }
}
</script>
