<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Promosi</h1>
      <Button size="sm" @click="toggleForm">{{ showForm ? (editing ? 'Batal' : 'Tutup') : '+ Promosi' }}</Button>
    </div>
    <Card v-if="showForm">
      <CardHeader>
        <CardTitle>{{ editing ? `Ubah promosi — ${productName(editing.product_id)}` : 'Promosi baru' }}</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="onSave">
          <div class="md:col-span-2"><label class="mb-1 block text-sm" for="promo-product">Produk</label>
            <select id="promo-product" v-model="form.product_id" :disabled="!!editing" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm disabled:bg-stone-100">
              <option value="">pilih produk…</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} · {{ formatIDR(p.price) }}</option>
            </select>
            <p v-if="editing" class="mt-1 text-[11px] text-stone-500">Produk tidak bisa diganti pada promosi yang sudah dibuat — nonaktifkan saja dan buat baru.</p>
          </div>
          <div><label class="mb-1 block text-sm" for="promo-discount">Diskon % (maks 50)</label><Input id="promo-discount" v-model.number="form.discount_percentage" type="number" min="1" max="50" /></div>
          <div><label class="mb-1 block text-sm" for="promo-status">Status</label>
            <select id="promo-status" v-model="form.status" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
              <option>DRAFT</option><option>ACTIVE</option>
            </select>
          </div>
          <div><label class="mb-1 block text-sm" for="promo-start">Mulai</label><Input id="promo-start" v-model="form.start_date" type="datetime-local" /></div>
          <div><label class="mb-1 block text-sm" for="promo-end">Selesai</label><Input id="promo-end" v-model="form.end_date" type="datetime-local" /></div>
          <!-- Pratinjau harga diskon: owner tahu persis angka yang dipotong. -->
          <p v-if="pricePreview" class="md:col-span-2 rounded-lg bg-stone-50 p-2 text-sm text-stone-700">
            Harga {{ formatIDR(pricePreview.base) }} →
            <span class="font-semibold text-emerald-600">{{ formatIDR(pricePreview.effective) }}</span>
            <span class="text-stone-500"> (potongan {{ form.discount_percentage }}%)</span>
          </p>
          <div class="md:col-span-2"><Button type="submit" size="sm" :loading="saving">{{ editing ? 'Simpan perubahan' : 'Simpan' }}</Button></div>
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
                  <div class="flex gap-1">
                    <Button size="sm" variant="outline" @click="startEdit(pr)">Ubah</Button>
                    <Button v-if="pr.status === 'DRAFT'" size="sm" variant="secondary" @click="activate(pr)">Aktifkan</Button>
                  </div>
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

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const items = ref<PromotionOut[]>([])
const products = ref<ProductOut[]>([])
const loading = ref(false)
const showForm = ref(false)
const saving = ref(false)
const form = reactive({ product_id: '', discount_percentage: 10, status: 'DRAFT', start_date: '', end_date: '' })
// Edit inline: ubah diskon/periode/status via PATCH (produk dikunci, karena
// mengganti produk pada promo aktif bisa merusak hitungan order).
const editing = ref<PromotionOut | null>(null)
const page = ref(1)
const pageSize = 10

function productName(id: string) {
  return products.value.find(p => p.id === id)?.name || id.slice(0, 8) + '…'
}

/** Pratinjau harga terpotong berdasar harga produk + diskon yang sedang diisi. */
const pricePreview = computed(() => {
  if (!form.product_id) return null
  const p = products.value.find(x => x.id === form.product_id)
  if (!p) return null
  const d = Math.min(Math.max(Number(form.discount_percentage) || 0, 0), 100)
  return { base: p.price, effective: Math.max(0, Math.round(p.price * (1 - d / 100))) }
})

/** ISO server → nilai `datetime-local` (waktu lokal browser). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function resetForm() {
  editing.value = null
  form.product_id = ''; form.discount_percentage = 10; form.status = 'DRAFT'
  form.start_date = ''; form.end_date = ''
}

function toggleForm() {
  showForm.value = !showForm.value
  if (showForm.value) resetForm() // mulai blank: jangan mewarisi data edit sebelumnya
}

function startEdit(pr: PromotionOut) {
  editing.value = pr
  form.product_id = pr.product_id
  form.discount_percentage = pr.discount_percentage
  // Server hanya menerima DRAFT/ACTIVE; SCHEDULED/EXPIRED adalah status
  // turunan effectiveStatus yang tidak bisa di-set manual.
  form.status = pr.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE'
  form.start_date = toLocalInput(pr.start_date)
  form.end_date = toLocalInput(pr.end_date)
  showForm.value = true
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
  const discount = Number(form.discount_percentage)
  if (!(discount > 0 && discount <= 50)) { toast.warning('Diskon harus 1-50%.'); return }
  if (new Date(form.end_date) <= new Date(form.start_date)) { toast.warning('Tanggal selesai harus setelah tanggal mulai.'); return }
  saving.value = true
  try {
    if (editing.value) {
      // PATCH: diskon + periode + status. Produk TIDAK ikut (tidak didukung server).
      applyPromo(await request<PromotionOut>(`/promotions/${editing.value.id}`, {
        method: 'PATCH',
        body: {
          discount_percentage: discount,
          status: form.status,
          start_date: new Date(form.start_date).toISOString(),
          end_date: new Date(form.end_date).toISOString()
        }
      }))
      toast.success('Promosi diperbarui.')
      showForm.value = false
      resetForm()
    }
    else {
      const created = await request<PromotionOut>('/promotions', {
        method: 'POST',
        body: {
          product_id: form.product_id,
          discount_percentage: discount,
          status: form.status,
          start_date: new Date(form.start_date).toISOString(),
          end_date: new Date(form.end_date).toISOString()
        }
      })
      applyPromo(created)
      toast.success('Promosi disimpan.')
      showForm.value = false
      resetForm()
    }
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
