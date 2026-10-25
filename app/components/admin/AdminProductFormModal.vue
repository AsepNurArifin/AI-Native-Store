<template>
  <Transition name="product-form-modal">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center"
      @keydown="trapFocus"
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
            class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label="Tutup form produk"
            @click="close"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <!-- Body: form lama yang sama, kini hidup di dalam popup (bisa di-scroll di layar pendek) -->
        <div class="overflow-y-auto p-5">
          <form id="product-form" class="grid gap-3 md:grid-cols-2" novalidate @submit.prevent="onSave">
            <div><label class="mb-1 block text-sm">Nama</label><Input v-model="form.name" placeholder="iPhone 15 Pro 128GB" /></div>
            <div><label class="mb-1 block text-sm">Kategori</label><Input v-model="form.category" placeholder="Smartphone" /></div>
            <div><label class="mb-1 block text-sm" for="product-price">Harga (Rp)</label><Input id="product-price" v-model.number="form.price" type="number" min="1" placeholder="9500000" /></div>
            <div><label class="mb-1 block text-sm" for="product-status">Status</label>
              <select id="product-status" v-model="form.status" class="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
                <option>ACTIVE</option><option>INACTIVE</option>
              </select>
            </div>
            <div><label class="mb-1 block text-sm" for="product-threshold">Ambang stok kritis</label><Input id="product-threshold" v-model.number="form.low_stock_threshold" type="number" min="0" placeholder="default 5" /></div>
            <div v-if="!editing"><label class="mb-1 block text-sm" for="product-initial-stock">Stok awal</label><Input id="product-initial-stock" v-model.number="form.initial_stock" type="number" min="0" placeholder="0" /></div>
            <div class="md:col-span-2">
              <label class="mb-1 block text-sm" for="product-image">Gambar produk (JPG/PNG/WebP/GIF, maks 2 MB)</label>
              <div class="flex flex-wrap items-start gap-3">
                <img v-if="form.image_url" :src="form.image_url" alt="Pratinjau gambar produk" class="h-20 w-20 rounded-xl border object-cover" >
                <div class="space-y-1">
                  <input
                    id="product-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    class="block w-full text-xs text-stone-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-stone-200"
                    @change="onFileChange"
                  >
                  <Button v-if="form.image_url" type="button" size="sm" variant="ghost" @click="form.image_url = ''">Hapus gambar</Button>
                  <p v-if="uploading" class="text-xs text-stone-500">Mengunggah…</p>
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
          </form>
        </div>

        <!-- Footer: aksi menempel di bawah, tidak ikut ter-scroll -->
        <div class="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button size="sm" variant="outline" @click="close">Batal</Button>
          <Button size="sm" type="submit" form="product-form" :loading="saving">
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

const props = defineProps<{ open: boolean, editing: ProductOut | null }>()
const emit = defineEmits<{ close: [], saved: [product: ProductOut, previous: ProductOut | null] }>()

const { request } = useApi()
const toast = useToast()

// Input kosong memakai tanda `''` (v-model.number) — dinormalisasi ke null
// supaya "kosong" tidak berarti 5 atau 0 palsu saat dikirim ke server.
function toIntOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
const form = reactive({
  name: '', category: '', price: 0, status: 'ACTIVE',
  low_stock_threshold: '' as number | '', initial_stock: '' as number | '',
  image_url: '' as string
})
const uploading = ref(false)
const saving = ref(false)

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
  await nextTick()
  panelRef.value?.focus()
})

/* --- Manajemen fokus (pattern ConfirmHost) --- */
const panelRef = ref<HTMLElement | null>(null)

/** Focus trap modal: Tab dikurung di dalam dialog (a11y), Escape menutup. */
function trapFocus(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key !== 'Tab' || !panelRef.value) return
  const focusables = panelRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusables.length) return
  const first = focusables[0] as HTMLElement
  const last = focusables[focusables.length - 1] as HTMLElement
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

function close() { emit('close') }

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await request<{ image_url: string }>('/uploads/images', { method: 'POST', body: fd })
    form.image_url = res.image_url
    toast.success('Gambar produk diunggah.')
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal mengunggah gambar') }
  finally { uploading.value = false }
}

async function onSave() {
  // Validasi klien dulu — harga kosong/0 tidak boleh menunggu 422 dari server.
  const price = Number(form.price)
  if (!form.name.trim() || !form.category.trim()) {
    toast.error('Nama dan kategori wajib diisi.')
    return
  }
  if (!Number.isFinite(price) || price <= 0) {
    toast.error('Harga harus angka lebih dari 0.')
    return
  }
  const threshold = toIntOrNull(form.low_stock_threshold)
  if (threshold != null && threshold < 0) {
    toast.error('Ambang stok kritis tidak boleh negatif.')
    return
  }
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
        initial_stock: toIntOrNull(form.initial_stock) ?? 0,
        image_url: form.image_url.trim() || null, specification: spec
      }
      const res = await request<ProductOut>('/products', { method: 'POST', body: payload })
      emit('saved', res, null)
      toast.success(`Produk "${form.name}" ditambahkan ke katalog.`)
    }
    emit('close')
  }
  catch (e: unknown) {
    if (e instanceof Error && e.message.includes('harus angka bulat positif')) toast.error(e.message)
    else toast.fromError(e, 'Gagal menyimpan produk')
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
