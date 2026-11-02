<template>
  <Transition name="product-form-modal">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center"
    >
      <div class="absolute inset-0 bg-stone-950/45" aria-hidden="true" @click="close" />

      <!-- Panel: mengikuti boneka dialog ConfirmHost/AdminProductSpecModal — body scrollable, header/footer menempel -->
      <div
        ref="panelRef"
        class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/20 outline-none sm:max-w-2xl"
        role="dialog"
        aria-modal="true"
        :aria-label="editing ? `Ubah produk ${editing.name}` : 'Tambah produk ke katalog'"
        tabindex="-1"
      >
        <!-- Header: judul menempel di atas -->
        <div class="flex items-start justify-between gap-3 border-b border-stone-100 pr-2 pl-5">
          <div class="mt-4 min-w-0">
            <h2 class="font-display text-base font-bold text-stone-900 [overflow-wrap:anywhere]">
              {{ editing ? 'Ubah produk' : 'Tambah produk ke katalog' }}
            </h2>
            <p v-if="editing" class="mt-0.5 truncate text-xs text-stone-500">{{ editing.name }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            aria-label="Tutup form produk"
            @click="close"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <!-- Body: form lama yang sama, kini hidup di dalam popup (bisa di-scroll di layar pendek) -->
        <div class="overflow-y-auto p-5">
          <form id="product-form" class="grid gap-3 md:grid-cols-2" novalidate @submit.prevent="onSave">
            <div>
              <label class="mb-1 block text-sm" for="product-name">Nama</label>
              <Input
                id="product-name"
                v-model="form.name"
                class="min-h-11 text-base md:text-sm"
                maxlength="200"
                placeholder="iPhone 15 Pro 128GB"
                required
                aria-required="true"
                :aria-invalid="fieldErrors.name ? true : undefined"
                :aria-describedby="fieldErrors.name ? 'product-name-error' : undefined"
                @blur="touched.name = true"
              />
              <p v-if="fieldErrors.name" id="product-name-error" class="mt-1 text-xs font-medium text-destructive">{{ fieldErrors.name }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm" for="product-category">Kategori</label>
              <Input
                id="product-category"
                v-model="form.category"
                class="min-h-11 text-base md:text-sm"
                maxlength="50"
                placeholder="Smartphone"
                required
                aria-required="true"
                :aria-invalid="fieldErrors.category ? true : undefined"
                :aria-describedby="fieldErrors.category ? 'product-category-error' : undefined"
                @blur="touched.category = true"
              />
              <p v-if="fieldErrors.category" id="product-category-error" class="mt-1 text-xs font-medium text-destructive">{{ fieldErrors.category }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm" for="product-price">Harga (Rp)</label>
              <Input
                id="product-price"
                v-model.number="form.price"
                class="min-h-11 text-base md:text-sm"
                type="number"
                min="0"
                step="any"
                placeholder="9500000"
                required
                aria-required="true"
                :aria-invalid="fieldErrors.price ? true : undefined"
                :aria-describedby="fieldErrors.price ? 'product-price-error' : undefined"
                @blur="touched.price = true"
              />
              <p v-if="fieldErrors.price" id="product-price-error" class="mt-1 text-xs font-medium text-destructive">{{ fieldErrors.price }}</p>
            </div>
            <div><label class="mb-1 block text-sm" for="product-status">Status</label>
              <select id="product-status" v-model="form.status" class="h-11 w-full min-w-0 rounded-md border border-stone-300 bg-white px-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:text-sm">
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm" for="product-threshold">Ambang stok kritis</label>
              <Input
                id="product-threshold"
                v-model.number="form.low_stock_threshold"
                class="min-h-11 text-base md:text-sm"
                type="number"
                min="0"
                step="1"
                placeholder="default 5"
                :aria-invalid="fieldErrors.low_stock_threshold ? true : undefined"
                :aria-describedby="fieldErrors.low_stock_threshold ? 'product-threshold-error' : undefined"
                @blur="touched.low_stock_threshold = true"
              />
              <p v-if="fieldErrors.low_stock_threshold" id="product-threshold-error" class="mt-1 text-xs font-medium text-destructive">{{ fieldErrors.low_stock_threshold }}</p>
            </div>
            <div v-if="!editing">
              <label class="mb-1 block text-sm" for="product-initial-stock">Stok awal</label>
              <Input
                id="product-initial-stock"
                v-model.number="form.initial_stock"
                class="min-h-11 text-base md:text-sm"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                :aria-invalid="fieldErrors.initial_stock ? true : undefined"
                :aria-describedby="fieldErrors.initial_stock ? 'product-initial-stock-error' : undefined"
                @blur="touched.initial_stock = true"
              />
              <p v-if="fieldErrors.initial_stock" id="product-initial-stock-error" class="mt-1 text-xs font-medium text-destructive">{{ fieldErrors.initial_stock }}</p>
            </div>
            <div class="md:col-span-2">
              <label class="mb-1 block text-sm" for="product-image">Gambar produk (JPG/PNG/WebP/GIF, maks 2 MB)</label>
              <div class="flex flex-wrap items-start gap-3">
                <img v-if="form.image_url" :src="form.image_url" alt="Pratinjau gambar produk" class="h-20 w-20 rounded-xl border object-cover" >
                <div class="min-w-0 max-w-full flex-1 space-y-1">
                  <input
                    id="product-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    class="block min-h-11 w-full min-w-0 max-w-full text-sm text-stone-600 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-50"
                    :disabled="uploading"
                    :aria-describedby="uploadError ? 'product-image-error' : undefined"
                    @change="onFileChange"
                  >
                  <Button v-if="form.image_url" type="button" size="sm" variant="ghost" class="min-h-11" @click="form.image_url = ''">Hapus gambar</Button>
                  <p v-if="uploading" class="text-xs text-stone-500">Mengunggah…</p>
                  <p v-if="uploadError" id="product-image-error" role="alert" class="text-sm text-destructive [overflow-wrap:anywhere]">{{ uploadError }}</p>
                </div>
              </div>
            </div>
            <div class="md:col-span-2">
              <p class="mb-1 block text-sm">Spesifikasi</p>
              <div class="space-y-2">
                <div v-for="(row, i) in specRows" :key="i" class="flex flex-wrap items-center gap-2">
                  <Input v-model="row.key" :aria-label="`Kunci spesifikasi ${i + 1}`" list="spec-keys" placeholder="mis. ram_gb" class="min-h-11 w-44 max-w-full text-base md:text-sm" />
                  <Input v-model="row.value" :aria-label="`Nilai spesifikasi ${i + 1}`" placeholder="mis. 16" class="min-h-11 min-w-44 max-w-full flex-1 text-base md:text-sm" />
                  <Button type="button" size="sm" variant="ghostDanger" class="min-h-11" @click="specRows.splice(i, 1)">Hapus</Button>
                </div>
              </div>
              <datalist id="spec-keys">
                <option v-for="k in specSuggestions" :key="k" :value="k" />
              </datalist>
              <Button type="button" size="sm" variant="outline" class="mt-2 min-h-11" @click="specRows.push({ key: '', value: '' })">+ Baris spesifikasi</Button>
              <p class="mt-1 text-xs text-stone-500">Isi angka untuk ram_gb dan storage_gb (1 TB = 1000 GB). Jangan isi fitur yang belum diketahui; false berarti tidak didukung.</p>
            </div>
            <p v-if="saveError" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-destructive [overflow-wrap:anywhere] md:col-span-2">{{ saveError }}</p>
          </form>
        </div>

        <!-- Footer: aksi menempel di bawah, tidak ikut ter-scroll -->
        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button type="button" size="sm" variant="outline" class="min-h-11" @click="close">Batal</Button>
          <Button size="sm" type="submit" form="product-form" class="min-h-11" :loading="saving" :disabled="uploading">
            {{ editing ? 'Simpan perubahan' : 'Tambah ke katalog' }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/* Hallmark · component: product form modal · theme: Best Buy Marketplace (token stone/brand yang ada)
 * Popup "tambah/ubah katalog" — menggantikan form inline yang mendorong seluruh daftar produk turun:
 * klik "+ Produk" → popup (create), klik "Ubah" → popup terisi (edit), fokus tetap di konteks tabel.
 * states: open(create/edit) · saving/uploading · esc & backdrop close · motion: fade+scale 130ms
 */
import { X } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { handleDialogKeydown } from '~/utils/focus'

const props = defineProps<{ open: boolean, editing: ProductOut | null }>()
const emit = defineEmits<{ close: [], saved: [product: ProductOut, previous: ProductOut | null] }>()

const { request } = useApi()
const toast = useToast()

const form = reactive({
  name: '', category: '', price: 0 as number | '', status: 'ACTIVE',
  low_stock_threshold: '' as number | '', initial_stock: '' as number | '',
  image_url: '' as string
})
const uploading = ref(false)
const saving = ref(false)
const triedSave = ref(false)
const touched = reactive({ name: false, category: false, price: false, low_stock_threshold: false, initial_stock: false })
const saveError = ref('')
const uploadError = ref('')
const fieldErrors = computed(() => {
  const errors = { name: '', category: '', price: '', low_stock_threshold: '', initial_stock: '' }
  if (triedSave.value || touched.name) {
    const name = form.name.trim()
    if (!name) errors.name = 'Nama wajib diisi.'
    else if (name.length > 200) errors.name = 'Nama maksimal 200 karakter.'
  }
  if (triedSave.value || touched.category) {
    const category = form.category.trim()
    if (!category) errors.category = 'Kategori wajib diisi.'
    else if (category.length > 50) errors.category = 'Kategori maksimal 50 karakter.'
  }
  if (triedSave.value || touched.price) {
    const price = Number(form.price)
    if (!Number.isFinite(price) || price <= 0) errors.price = 'Harga harus lebih dari 0.'
  }
  if ((triedSave.value || touched.low_stock_threshold) && form.low_stock_threshold !== '') {
    const threshold = Number(form.low_stock_threshold)
    if (!Number.isInteger(threshold) || threshold < 0) errors.low_stock_threshold = 'Ambang stok harus bilangan bulat 0 atau lebih.'
  }
  if (!props.editing && (triedSave.value || touched.initial_stock) && form.initial_stock !== '') {
    const stock = Number(form.initial_stock)
    if (!Number.isInteger(stock) || stock < 0) errors.initial_stock = 'Stok awal harus bilangan bulat 0 atau lebih.'
  }
  return errors
})

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

/* Setiap kali popup dibuka (create maupun edit), form direset ke konteks terkini. */
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  const p = props.editing
  form.name = p?.name ?? ''
  form.category = p?.category ?? ''
  form.price = p?.price ?? 0
  form.status = p?.status ?? 'ACTIVE'
  form.low_stock_threshold = p?.low_stock_threshold ?? ''
  form.initial_stock = ''
  form.image_url = p?.image_url || ''
  rowsFromSpec(p?.specification ?? {})
  uploading.value = false
  saving.value = false
  triedSave.value = false
  Object.assign(touched, { name: false, category: false, price: false, low_stock_threshold: false, initial_stock: false })
  saveError.value = ''
  uploadError.value = ''
  await nextTick()
  if (props.open) panelRef.value?.focus()
})

/* --- Manajemen fokus (pattern ConfirmHost) --- */
const panelRef = ref<HTMLElement | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (props.open && panelRef.value) handleDialogKeydown(event, panelRef.value, close)
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

function close() { emit('close') }

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await request<{ image_url: string }>('/uploads/images', { method: 'POST', body: fd })
    form.image_url = res.image_url
    toast.success('Gambar produk diunggah.')
  }
  catch (e: unknown) {
    uploadError.value = e instanceof Error && e.message.trim() ? e.message : 'Gagal mengunggah gambar. Coba lagi.'
    toast.error(uploadError.value)
  }
  finally { uploading.value = false }
}

async function onSave() {
  if (saving.value || uploading.value) return
  triedSave.value = true
  saveError.value = ''
  const firstInvalidId = fieldErrors.value.name ? 'product-name'
    : fieldErrors.value.category ? 'product-category'
      : fieldErrors.value.price ? 'product-price'
        : fieldErrors.value.low_stock_threshold ? 'product-threshold'
          : fieldErrors.value.initial_stock ? 'product-initial-stock' : null
  if (firstInvalidId) {
    await nextTick()
    if (props.open) document.getElementById(firstInvalidId)?.focus()
    return
  }
  const price = Number(form.price)
  const threshold = form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold)
  saving.value = true
  const previous = props.editing
  try {
    const spec = specFromRows()
    if (previous) {
      const payload = {
        name: form.name, category: form.category, price, status: form.status,
        low_stock_threshold: threshold,
        image_url: form.image_url.trim() || null, specification: spec
      }
      const res = await request<ProductOut>(`/products/${previous.id}`, { method: 'PATCH', body: payload })
      emit('saved', res, previous)
      toast.success(`Produk "${form.name}" diperbarui.`)
    }
    else {
      // `initial_stock` hanya untuk jalur create; perubahan stok produk yang
      // sudah ada memakai halaman Inventori (adjustment).
      const payload = {
        name: form.name, category: form.category, price, status: form.status,
        low_stock_threshold: threshold,
        initial_stock: form.initial_stock === '' ? 0 : Number(form.initial_stock),
        image_url: form.image_url.trim() || null, specification: spec
      }
      const res = await request<ProductOut>('/products', { method: 'POST', body: payload })
      emit('saved', res, null)
      toast.success(`Produk "${form.name}" ditambahkan ke katalog.`)
    }
    emit('close')
  }
  catch (e: unknown) {
    saveError.value = e instanceof Error && e.message.trim() ? e.message : 'Gagal menyimpan produk. Coba lagi.'
    toast.error(saveError.value)
  }
  finally { saving.value = false }
}
</script>

<style scoped>
.product-form-modal-enter-active,
.product-form-modal-leave-active { transition: opacity 0.13s ease; }
.product-form-modal-enter-from,
.product-form-modal-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .product-form-modal-enter-active,
  .product-form-modal-leave-active { transition: none; }
}
</style>
