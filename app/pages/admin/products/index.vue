<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-bold">Produk</h1>
      <Button size="sm" @click="showForm = !showForm">{{ showForm ? 'Tutup' : '+ Produk' }}</Button>
    </div>

    <Card v-if="showForm">
      <CardHeader>
        <CardTitle>{{ editing ? 'Ubah produk' : 'Produk baru' }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="onSave">
          <div><label class="mb-1 block text-sm">Nama</label><Input v-model="form.name" placeholder="Laptop A" /></div>
          <div><label class="mb-1 block text-sm">Kategori</label><Input v-model="form.category" placeholder="laptop" /></div>
          <div><label class="mb-1 block text-sm">Harga (Rp)</label><Input v-model.number="form.price" type="number" placeholder="9500000" /></div>
          <div><label class="mb-1 block text-sm">Status</label>
            <select v-model="form.status" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option>ACTIVE</option><option>INACTIVE</option>
            </select>
          </div>
          <div class="md:col-span-2"><label class="mb-1 block text-sm">Gambar (URL https atau path /images/…)</label><Input v-model="form.image_url" placeholder="https://… atau /images/products/hp-01.jpg" />
            <img v-if="form.image_url" :src="form.image_url" alt="Pratinjau gambar produk" class="mt-2 h-20 w-20 rounded-xl border object-cover" />
          </div>
          <div class="md:col-span-2"><label for="product-specifications" class="mb-1 block text-sm">Spesifikasi (JSON)</label>
            <textarea id="product-specifications" v-model="specText" rows="8" aria-describedby="spec-help" class="w-full rounded-md border border-stone-300 p-2 font-mono text-xs" placeholder='{"brand":"Lenovo","ram_gb":16,"storage_gb":512,"prosesor":"Intel Core i5"}' />
            <p id="spec-help" class="mt-1 text-xs text-stone-500">Gunakan angka untuk ram_gb dan storage_gb (1 TB = 1000 GB). Jangan isi fitur yang belum diketahui; false berarti tidak didukung.</p>
          </div>
          <p v-if="formError" class="text-sm text-red-600 md:col-span-2">{{ formError }}</p>
          <div class="flex gap-2 md:col-span-2">
            <Button type="submit" size="sm" :loading="saving">Simpan</Button>
            <Button type="button" size="sm" variant="ghost" @click="resetForm()">Batal</Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardContent>
        <div class="mb-3 flex flex-wrap gap-2">
          <Input v-model="q" placeholder="Nama / spesifikasi…" class="max-w-56" />
          <Input v-model="category" placeholder="Kategori…" class="max-w-44" />
          <select v-model="status" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option>
          </select>
          <Button size="sm" variant="secondary" @click="load()">Cari</Button>
        </div>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
        <p v-if="loading" class="text-sm text-stone-500">Memuat…</p>
        <div v-else>
          <!-- Mobile: kartu per produk -->
          <p v-if="!items.length" class="py-4 text-center text-sm text-stone-500 sm:hidden">Belum ada produk.</p>
          <div class="space-y-3 sm:hidden">
            <div v-for="p in items" :key="p.id" class="rounded-xl border border-stone-200 bg-white p-3">
              <div class="flex items-start gap-2.5">
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name" loading="lazy" class="h-12 w-12 shrink-0 rounded-lg border object-cover" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="min-w-0 flex-1 text-sm font-medium text-stone-900 [overflow-wrap:anywhere]">{{ p.name }}</p>
                    <Badge :variant="statusVariant(p.status)">{{ p.status }}</Badge>
                  </div>
              <p class="mt-1 text-xs text-stone-500">{{ p.category }} · <span class="font-semibold text-stone-800">{{ formatIDR(p.price) }}</span> · Stok
                <span :class="p.is_low_stock ? 'font-semibold text-amber-700' : ''">{{ p.current_stock }}</span>
              </p>
              <details class="mt-1.5">
                <summary class="cursor-pointer rounded text-xs text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 active:text-brand-900">Lihat spesifikasi</summary>
                <ProductSpecifications class="mt-2" :specification="p.specification" />
              </details>
              <div class="mt-2.5 flex gap-2">
                <Button size="sm" variant="outline" class="flex-1" @click="startEdit(p)">Ubah</Button>
                <Button size="sm" variant="ghost" class="flex-1" @click="toggleStatus(p)">{{ p.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan' }}</Button>
                <Button size="sm" variant="ghostDanger" class="flex-1" @click="remove(p)">Hapus</Button>
              </div>
                </div>
              </div>
            </div>
          </div>
          <div class="hidden overflow-x-auto sm:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Nama</th><th class="pr-2">Kategori</th><th class="pr-2">Harga</th>
              <th class="pr-2">Stok</th><th class="pr-2">Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              <tr v-for="p in items" :key="p.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">
                  {{ p.name }}
                  <details class="mt-2 max-w-sm font-normal">
                    <summary class="cursor-pointer rounded text-xs text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 active:text-brand-900">Lihat spesifikasi</summary>
                    <ProductSpecifications class="mt-2" :specification="p.specification" />
                  </details>
                </td>
                <td class="pr-2">{{ p.category }}</td>
                <td class="pr-2">{{ formatIDR(p.price) }}</td>
                <td class="pr-2">
                  <span :class="p.is_low_stock ? 'font-semibold text-amber-700' : ''">{{ p.current_stock }}</span>
                  <span v-if="p.is_low_stock" class="ml-1 inline-block h-2 w-2 rounded-full bg-amber-600 align-middle" title="stok menipis" aria-label="stok menipis" />
                </td>
                <td class="pr-2"><Badge :variant="statusVariant(p.status)">{{ p.status }}</Badge></td>
                <td class="flex gap-1 py-1">
                  <Button size="sm" variant="outline" @click="startEdit(p)">Ubah</Button>
                  <Button size="sm" variant="ghost" @click="toggleStatus(p)">{{ p.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan' }}</Button>
                  <Button size="sm" variant="ghostDanger" @click="remove(p)">Hapus</Button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!items.length" class="py-4 text-center text-sm text-stone-500">Belum ada produk.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, statusVariant } from '~/utils/format'
import type { ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const items = ref<ProductOut[]>([])
const loading = ref(true)
const error = ref('')
const q = ref('')
const category = ref('')
const status = ref('ACTIVE')
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
const editing = ref<ProductOut | null>(null)
const form = reactive({ name: '', category: '', price: 0, status: 'ACTIVE', image_url: '' as string })
const specText = ref('{}')

async function load() {
  loading.value = true; error.value = ''
  try {
    items.value = await request<ProductOut[]>('/products', {
      query: { q: q.value || undefined, category: category.value || undefined, status: status.value }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
  finally { loading.value = false }
}
onMounted(load)

function resetForm() {
  editing.value = null; showForm.value = false; formError.value = ''
  form.name = ''; form.category = ''; form.price = 0; form.status = 'ACTIVE'; form.image_url = ''; specText.value = '{}'
}
function startEdit(p: ProductOut) {
  editing.value = p; showForm.value = true
  form.name = p.name; form.category = p.category; form.price = p.price; form.status = p.status
  form.image_url = p.image_url || ''
  specText.value = JSON.stringify(p.specification || {}, null, 2)
}
function parseSpec(): Record<string, unknown> {
  let parsed: unknown
  try { parsed = specText.value.trim() ? JSON.parse(specText.value) : {} }
  catch { throw new Error('Spesifikasi harus JSON valid') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Spesifikasi harus berupa objek JSON, bukan array atau teks')
  }
  const spec = parsed as Record<string, unknown>
  for (const key of ['ram_gb', 'storage_gb']) {
    if (key in spec && (typeof spec[key] !== 'number' || !Number.isInteger(spec[key]) || Number(spec[key]) <= 0)) {
      throw new Error(`${key} harus angka bulat positif dalam GB`)
    }
  }
  return spec
}
async function onSave() {
  saving.value = true; formError.value = ''
  try {
    const spec = parseSpec()
    const payload = { ...form, image_url: form.image_url.trim() || null, specification: spec }
    if (editing.value) {
      await request(`/products/${editing.value.id}`, { method: 'PATCH', body: payload })
    }
    else {
      await request('/products', { method: 'POST', body: payload })
    }
    resetForm(); await load()
  }
  catch (e: unknown) { formError.value = e instanceof Error ? e.message : 'Gagal menyimpan' }
  finally { saving.value = false }
}
async function toggleStatus(p: ProductOut) {
  try {
    await request(`/products/${p.id}`, { method: 'PATCH', body: { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } })
    await load()
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal ubah status' }
}
async function remove(p: ProductOut) {
  if (!confirm(`Hapus "${p.name}"? Bila sudah dipakai order/promosi, backend menolak (409); nonaktifkan saja.`)) return
  try {
    await request(`/products/${p.id}`, { method: 'DELETE' })
    await load()
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal hapus' }
}
</script>
