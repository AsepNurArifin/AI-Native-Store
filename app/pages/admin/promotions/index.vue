<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Promosi</h1>
      <Button size="sm" @click="showForm = !showForm">{{ showForm ? 'Tutup' : '+ Promosi' }}</Button>
    </div>
    <Card v-if="showForm">
      <CardContent>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="onSave">
          <div class="md:col-span-2"><label class="mb-1 block text-sm">Produk</label>
            <select v-model="form.product_id" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option value="">pilih produk…</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} · {{ formatIDR(p.price) }}</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm">Diskon % (maks 50)</label><Input v-model.number="form.discount_percentage" type="number" /></div>
          <div><label class="mb-1 block text-sm">Status</label>
            <select v-model="form.status" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option>DRAFT</option><option>ACTIVE</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm">Mulai</label><Input v-model="form.start_date" type="datetime-local" /></div>
          <div><label class="mb-1 block text-sm">Selesai</label><Input v-model="form.end_date" type="datetime-local" /></div>
          <div class="md:col-span-2"><Button type="submit" size="sm" :loading="saving">Simpan</Button></div>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardContent>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Produk</th><th class="pr-2">Diskon</th><th class="pr-2">Periode</th><th class="pr-2">Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              <tr v-for="pr in items" :key="pr.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ productName(pr.product_id) }}</td>
                <td class="pr-2">{{ pr.discount_percentage }}%</td>
                <td class="pr-2 text-xs">{{ formatWIB(pr.start_date) }} → {{ formatWIB(pr.end_date) }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(pr.status)">{{ pr.status }}</Badge></td>
                <td>
                  <Button v-if="pr.status === 'DRAFT'" size="sm" variant="outline" @click="activate(pr)">Aktifkan</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminPager :page="page" :count="items.length" :page-size="pageSize" :loading="loading" @prev="page--; load()" @next="page++; load()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { ProductOut, PromotionOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const toast = useToast()
const items = ref<PromotionOut[]>([])
const products = ref<ProductOut[]>([])
const loading = ref(false)
const showForm = ref(false)
const saving = ref(false)
const form = reactive({ product_id: '', discount_percentage: 10, status: 'DRAFT', start_date: '', end_date: '' })
const page = ref(1)
const pageSize = 10

function productName(id: string) {
  return products.value.find(p => p.id === id)?.name || id.slice(0, 8) + '…'
}
async function load() {
  loading.value = true
  try {
    // Promosi + daftar produk di-fetch paralel (bukan berurutan).
    const [iRes, pRes] = await Promise.allSettled([
      request<PromotionOut[]>('/promotions', { query: { page: page.value, page_size: pageSize } }),
      request<ProductOut[]>('/products', { query: { status: 'ACTIVE', page_size: 500 } })
    ])
    if (iRes.status === 'fulfilled') items.value = iRes.value
    else throw iRes.reason
    if (pRes.status === 'fulfilled') products.value = pRes.value
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat promosi') }
  finally { loading.value = false }
}
onMounted(load)

/**
 * Sisipkan/ganti baris promosi dari balasan mutasi — TANPA `load()` ulang.
 * Tidak ada filter status di halaman ini, jadi objek balasan sudah otoritatif.
 */
function applyPromo(res: PromotionOut) {
  const idx = items.value.findIndex(p => p.id === res.id)
  if (idx >= 0) items.value[idx] = res
  else {
    items.value.push(res)
    items.value.sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (items.value.length > pageSize) items.value.pop()
  }
}
async function onSave() {
  if (saving.value) return
  if (!form.product_id) { toast.warning('Pilih produk dulu.'); return }
  if (!form.start_date || !form.end_date) { toast.warning('Isi tanggal mulai dan selesai.'); return }
  saving.value = true
  try {
    const created = await request<PromotionOut>('/promotions', {
      method: 'POST',
      body: {
        product_id: form.product_id,
        discount_percentage: Number(form.discount_percentage),
        status: form.status,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString()
      }
    })
    applyPromo(created)
    toast.success('Promosi disimpan.')
    showForm.value = false
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menyimpan (cek overlap / maks diskon 50%)') }
  finally { saving.value = false }
}
async function activate(pr: PromotionOut) {
  try {
    applyPromo(await request<PromotionOut>(`/promotions/${pr.id}`, { method: 'PATCH', body: { status: 'ACTIVE' } }))
    toast.success(`Promosi ${productName(pr.product_id)} diaktifkan.`)
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal aktivasi (kemungkinan overlap)') }
}
</script>
