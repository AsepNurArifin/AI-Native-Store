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
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm">Gambar produk (JPG/PNG/WebP/GIF, maks 2 MB)</label>
            <div class="flex flex-wrap items-start gap-3">
              <img v-if="form.image_url" :src="form.image_url" alt="Pratinjau gambar produk" class="h-20 w-20 rounded-xl border object-cover" >
              <div class="space-y-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="block w-full text-xs text-stone-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-stone-200"
                  @change="onFileChange"
                >
                <Button v-if="form.image_url" type="button" size="sm" variant="ghost" @click="form.image_url = ''">Hapus gambar</Button>
                <p v-if="uploading" class="text-xs text-stone-500">Mengunggah…</p>
                <p v-if="uploadError" class="text-xs text-red-600">{{ uploadError }}</p>
              </div>
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm">Spesifikasi</label>
            <div class="space-y-2">
              <div v-for="(row, i) in specRows" :key="i" class="flex flex-wrap items-center gap-2">
                <Input v-model="row.key" list="spec-keys" placeholder="mis. ram_gb" class="w-44" />
                <Input v-model="row.value" placeholder="mis. 16" class="min-w-44 flex-1" />
                <Button type="button" size="sm" variant="ghostDanger" @click="specRows.splice(i, 1)">Hapus</Button>
              </div>
            </div>
            <datalist id="spec-keys">
              <option v-for="k in specSuggestions" :key="k" :value="k" />
            </datalist>
            <Button type="button" size="sm" variant="outline" class="mt-2" @click="specRows.push({ key: '', value: '' })">+ Baris spesifikasi</Button>
            <p class="mt-1 text-xs text-stone-500">Isi angka untuk ram_gb dan storage_gb (1 TB = 1000 GB). Jangan isi fitur yang belum diketahui; false berarti tidak didukung.</p>
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
          <Button size="sm" variant="secondary" @click="page = 1; load()">Cari</Button>
        </div>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
        <p v-if="loading" class="text-sm text-stone-500">Memuat…</p>
        <div v-else>
          <!-- Mobile: kartu per produk -->
          <p v-if="!items.length" class="py-4 text-center text-sm text-stone-500 sm:hidden">Belum ada produk.</p>
          <div class="space-y-3 sm:hidden">
            <template v-for="(p, i) in items" :key="p.id">
            <p v-if="isNewCategory(i)" class="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{{ p.category }}</p>
            <div class="rounded-xl border border-stone-200 bg-white p-3">
              <div class="flex items-start gap-2.5">
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name" loading="lazy" class="h-12 w-12 shrink-0 rounded-lg border object-cover" >
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
            </template>
          </div>
          <div class="hidden overflow-x-auto sm:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Nama</th><th class="pr-2">Kategori</th><th class="pr-2">Harga</th>
              <th class="pr-2">Stok</th><th class="pr-2">Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              <template v-for="(p, i) in items" :key="p.id">
              <tr v-if="isNewCategory(i)" class="border-b border-stone-200 bg-stone-50">
                <td colspan="6" class="py-1.5 pr-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{{ p.category }}</td>
              </tr>
              <tr class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">
                  <div class="flex items-start gap-2">
                    <img v-if="p.image_url" :src="p.image_url" :alt="p.name" loading="lazy" class="h-10 w-10 shrink-0 rounded-lg border object-cover" >
                    <div class="min-w-0">
                      {{ p.name }}
                      <details class="mt-2 max-w-sm font-normal">
                        <summary class="cursor-pointer rounded text-xs text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 active:text-brand-900">Lihat spesifikasi</summary>
                        <ProductSpecifications class="mt-2" :specification="p.specification" />
                      </details>
                    </div>
                  </div>
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
              </template>
            </tbody>
          </table>
          <p v-if="!items.length" class="py-4 text-center text-sm text-stone-500">Belum ada produk.</p>
          </div>
        </div>
        <AdminPager :page="page" :count="items.length" :page-size="pageSize" :loading="loading" @prev="page--; load()" @next="page++; load()" />
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
const page = ref(1)
// Muat sedikit demi sedikit per halaman (bukan setengah katalog sekaligus).
const pageSize = 10
// Header kategori muncul saat kategori baris berubah (list sudah diurut per kategori di SQL).
function isNewCategory(i: number) {
  return i === 0 || items.value[i - 1]!.category !== items.value[i]!.category
}
const form = reactive({ name: '', category: '', price: 0, status: 'ACTIVE', image_url: '' as string })
const uploading = ref(false)
const uploadError = ref('')

// Spesifikasi diedit sebagai baris key-value (bukan JSON mentah).
const specRows = ref<Array<{ key: string, value: string }>>([])
const specSuggestions = ['brand', 'prosesor', 'chipset', 'gpu', 'ram_gb', 'storage_gb', 'layar', 'kamera', 'baterai_mah', 'os', 'berat_kg', 'koneksi', 'fitur']

function specFromRows(): Record<string, unknown> {
  const spec: Record<string, unknown> = {}
  for (const row of specRows.value) {
    const key = row.key.trim()
    const raw = row.value.trim()
    if (!key || !raw) continue
    const asNum = Number(raw)
    spec[key] = Number.isFinite(asNum) && String(asNum) === raw ? asNum : raw
  }
  for (const key of ['ram_gb', 'storage_gb']) {
    if (key in spec && (typeof spec[key] !== 'number' || !Number.isInteger(spec[key]) || Number(spec[key]) <= 0)) {
      throw new Error(`${key} harus angka bulat positif dalam GB`)
    }
  }
  return spec
}
function rowsFromSpec(spec: Record<string, unknown>) {
  specRows.value = Object.entries(spec || {}).map(([key, value]) => ({ key, value: value == null ? '' : String(value) }))
}

async function load() {
  loading.value = true; error.value = ''
  try {
    items.value = await request<ProductOut[]>('/products', {
      query: { q: q.value || undefined, category: category.value || undefined, status: status.value, page: page.value, page_size: pageSize }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
  finally { loading.value = false }
}
onMounted(load)

function resetForm() {
  editing.value = null; showForm.value = false; formError.value = ''
  form.name = ''; form.category = ''; form.price = 0; form.status = 'ACTIVE'; form.image_url = ''
  specRows.value = []; uploadError.value = ''
}
function startEdit(p: ProductOut) {
  editing.value = p; showForm.value = true
  form.name = p.name; form.category = p.category; form.price = p.price; form.status = p.status
  form.image_url = p.image_url || ''
  rowsFromSpec(p.specification)
}
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''; uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await request<{ image_url: string }>('/uploads/images', { method: 'POST', body: fd })
    form.image_url = res.image_url
  }
  catch (e: unknown) { uploadError.value = e instanceof Error ? e.message : 'Gagal mengunggah gambar' }
  finally { uploading.value = false }
}
async function onSave() {
  saving.value = true; formError.value = ''
  try {
    const spec = specFromRows()
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
