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
          <p v-if="formError" class="text-sm text-red-600 md:col-span-2">{{ formError }}</p>
          <div class="md:col-span-2"><Button type="submit" size="sm" :loading="saving">Simpan</Button></div>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardContent>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
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
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { ProductOut, PromotionOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const items = ref<PromotionOut[]>([])
const products = ref<ProductOut[]>([])
const error = ref('')
const loading = ref(false)
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ product_id: '', discount_percentage: 10, status: 'DRAFT', start_date: '', end_date: '' })

function productName(id: string) {
  return products.value.find(p => p.id === id)?.name || id.slice(0, 8) + '…'
}
async function load() {
  error.value = ''
  loading.value = true
  try {
    items.value = await request<PromotionOut[]>('/promotions')
    products.value = await request<ProductOut[]>('/products', { query: { status: 'ACTIVE' } })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
  finally { loading.value = false }
}
onMounted(load)
async function onSave() {
  saving.value = true; formError.value = ''
  try {
    await request('/promotions', {
      method: 'POST',
      body: {
        product_id: form.product_id,
        discount_percentage: Number(form.discount_percentage),
        status: form.status,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString()
      }
    })
    showForm.value = false; await load()
  }
  catch (e: unknown) { formError.value = e instanceof Error ? e.message : 'Gagal menyimpan (cek overlap / maks diskon 50%)' }
  finally { saving.value = false }
}
async function activate(pr: PromotionOut) {
  try { await request(`/promotions/${pr.id}`, { method: 'PATCH', body: { status: 'ACTIVE' } }); await load() }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal aktivasi (kemungkinan overlap)' }
}
</script>
