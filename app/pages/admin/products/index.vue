<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-bold">Produk</h1>
      <!-- Tambah katalog kini sebagai popup (bukan form inline yang mendorong daftar turun). -->
      <Button size="sm" @click="openCreate">+ Produk</Button>
    </div>

    <Card>
      <CardContent>
        <!-- Form supaya menekan Enter di kolom pencarian langsung menyaring. -->
        <form class="mb-3 flex flex-wrap gap-2" @submit.prevent="page = 1; load()">
          <Input v-model="q" placeholder="Nama / spesifikasi…" class="max-w-56" />
          <Input v-model="category" placeholder="Kategori…" class="max-w-44" />
          <select v-model="status" aria-label="Filter status" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua status</option>
            <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option>
          </select>
          <Button type="submit" size="sm" variant="secondary">Cari</Button>
          <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600">
            <input type="checkbox" class="size-4 accent-brand-700" :checked="allSelected" @change="toggleSelectAll">
            Pilih semua di halaman ini
          </label>
        </form>
        <!-- Baris aksi massal: Muncul hanya ada yang dicentang. -->
        <div
          v-if="selected.size"
          class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
        >
          <span class="text-sm font-medium text-stone-700">{{ selected.size }} produk dipilih</span>
          <Badge v-if="selectedOrderCount > 0" variant="warning">{{ selectedOrderCount }}+ baris order terdampak (perkiraan)</Badge>
          <Button size="sm" variant="outline" class="ml-auto" @click="clearSelection">Batalkan pilihan</Button>
          <Button size="sm" variant="ghostDanger" :loading="bulkLoading" @click="bulkRemove()">Hapus terpilih</Button>
        </div>
        <p v-if="loading" class="text-sm text-stone-500">Memuat…</p>
        <div v-else>
          <!-- Mobile: kartu per produk -->
          <p v-if="!items.length" class="py-4 text-center text-sm text-stone-500 sm:hidden">Belum ada produk.</p>
          <div class="space-y-3 sm:hidden">
            <template v-for="(p, i) in items" :key="p.id">
            <p v-if="isNewCategory(i)" class="pt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{{ p.category }}</p>
            <div class="rounded-xl border bg-white p-3" :class="selected.has(p.id) ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-stone-200'">
              <div class="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  class="mt-1 size-4 shrink-0 accent-brand-700"
                  :checked="selected.has(p.id)"
                  :aria-label="`Pilih ${p.name}`"
                  @change="toggleSelect(p)"
                >
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name" loading="lazy" class="h-12 w-12 shrink-0 rounded-lg border object-cover" >
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="min-w-0 flex-1 text-sm font-medium text-stone-900 [overflow-wrap:anywhere]">{{ p.name }}</p>
                    <Badge :variant="statusVariant(p.status)">{{ p.status }}</Badge>
                  </div>
              <p class="mt-1 text-xs text-stone-500">{{ p.category }} · <span class="font-semibold text-stone-800">{{ formatIDR(p.price) }}</span> · Stok
                <span :class="p.is_low_stock ? 'font-semibold text-amber-700' : ''">{{ p.current_stock }}</span>
                <span v-if="p.order_count" class="ml-1 font-medium text-rose-600">· dipakai {{ p.order_count }} order</span>
              </p>
              <!-- Chip spek unggulan + label jelas: klik apapun → popup spec sheet.
                   Bukan sekadar chip tanpa label (itu yang bikin fitur terkesan hilang). -->
              <button
                v-if="hasSpecData(p.specification)"
                type="button"
                class="mt-1.5 flex max-w-full flex-wrap items-center gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-brand-600"
                :aria-label="`Lihat spesifikasi lengkap ${p.name}`"
                @click="specProduct = p"
              >
                <span
                  v-for="s in keySpecs(p.specification, 3)"
                  :key="s.key"
                  class="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 transition-colors hover:border-brand-300 hover:text-brand-800 text-[10px] font-medium text-stone-600"
                >
                  <span class="sr-only">{{ s.label }}: </span>{{ s.value }}
                </span>
                <span class="ml-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 underline-offset-2 hover:underline">
                  <Eye class="h-3 w-3" aria-hidden="true" />
                  Lihat spesifikasi
                </span>
              </button>
              <button
                v-else
                type="button"
                class="mt-1.5 flex items-center gap-1 rounded text-xs text-stone-400 underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
                @click="startEdit(p)"
              >
                <Plus class="h-3 w-3" aria-hidden="true" />
                Tambah spek
              </button>
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
              <th class="w-8 py-2 pr-2"><span class="sr-only">Pilih</span></th>
              <th class="py-2 pr-2">Nama</th><th class="pr-2">Kategori</th><th class="pr-2">Harga</th>
              <th class="pr-2">Stok</th><th class="pr-2">Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              <template v-for="(p, i) in items" :key="p.id">
              <tr v-if="isNewCategory(i)" class="border-b border-stone-200 bg-stone-50">
                <td colspan="7" class="py-1.5 pr-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{{ p.category }}</td>
              </tr>
              <tr class="border-b border-stone-100" :class="selected.has(p.id) ? 'bg-brand-50/60' : ''">
                <td class="py-2 pr-2 align-top">
                  <input
                    type="checkbox"
                    class="mt-1 size-4 accent-brand-700"
                    :checked="selected.has(p.id)"
                    :aria-label="`Pilih ${p.name}`"
                    @change="toggleSelect(p)"
                  >
                </td>
                <td class="py-2 pr-2 font-medium">
                  <div class="flex items-start gap-2">
                    <img v-if="p.image_url" :src="p.image_url" :alt="p.name" loading="lazy" class="h-10 w-10 shrink-0 rounded-lg border object-cover" >
                    <div class="min-w-0">
                      {{ p.name }}
                      <span v-if="p.order_count" class="ml-1 text-xs font-medium text-rose-600">{{ p.order_count }} order</span>
                      <!-- Chip spek unggulan + label jelas: klik apapun → popup spec sheet -->
                      <button
                        v-if="hasSpecData(p.specification)"
                        type="button"
                        class="mt-2 flex max-w-sm flex-wrap items-center gap-1.5 font-normal focus-visible:outline-2 focus-visible:outline-brand-600"
                        :aria-label="`Lihat spesifikasi lengkap ${p.name}`"
                        @click="specProduct = p"
                      >
                        <span
                          v-for="s in keySpecs(p.specification, 3)"
                          :key="s.key"
                          class="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 transition-colors hover:border-brand-300 hover:text-brand-800 text-[10px] font-medium text-stone-600"
                        >
                          <span class="sr-only">{{ s.label }}: </span>{{ s.value }}
                        </span>
                        <span class="ml-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 underline-offset-2 hover:underline">
                          <Eye class="h-3 w-3" aria-hidden="true" />
                          Lihat spesifikasi
                        </span>
                      </button>
                      <button
                        v-else
                        type="button"
                        class="mt-2 flex items-center gap-1 rounded-full text-xs text-stone-400 underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
                        @click="startEdit(p)"
                      >
                        <Plus class="h-3 w-3" aria-hidden="true" />
                        Tambah spek
                      </button>
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

    <AdminProductSpecModal :product="specProduct" @close="specProduct = null" @edit="editFromSpec" />
    <AdminProductFormModal :open="formOpen" :editing="editing" @close="formOpen = false" @saved="onProductSaved" />
  </div>
</template>

<script setup lang="ts">
import { formatIDR, statusVariant } from '~/utils/format'
import { keySpecs, hasSpecData } from '~/utils/product'
import { Eye, Plus } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
/* Dua popup: (1) spec sheet "Lihat spesifikasi" — baris memuat chip preview + label,
 * (2) form tambah/ubah katalog — menggantikan form inline yang mendorong daftar turun. */
const specProduct = ref<ProductOut | null>(null)
const formOpen = ref(false)
const editing = ref<ProductOut | null>(null)
const items = ref<ProductOut[]>([])
const loading = ref(true)
const q = ref('')
const category = ref('')
// Default "Semua status" — OWNER menandai INACTIVE lewat tabel ini juga, jadi
// tidak boleh "ACTIVE" yang menyembunyikan katalognya sendiri.
const status = ref('')
const page = ref(1)
// Muat sedikit demi sedikit per halaman (bukan setengah katalog sekaligus).
const pageSize = 10
// Header kategori muncul saat kategori baris berubah (list sudah diurut per kategori di SQL).
function isNewCategory(i: number) {
  return i === 0 || items.value[i - 1]!.category !== items.value[i]!.category
}

// --- Hapus massal ---
// Pilihan bertahan lintas halaman (Set id, bukan index baris) supaya owner
// bisa centang di halaman 1, pindah halaman, lalu centang lagi.
const selected = ref(new Set<string>())
const bulkLoading = ref(false)
const allSelected = computed(() => items.value.length > 0 && items.value.every(p => selected.value.has(p.id)))
const selectedOrderCount = computed(
  () => items.value.reduce((s, p) => s + (selected.value.has(p.id) ? (p.order_count ?? 0) : 0), 0)
)
function toggleSelect(p: ProductOut) {
  const next = new Set(selected.value)
  if (next.has(p.id)) next.delete(p.id)
  else next.add(p.id)
  selected.value = next
}
function toggleSelectAll() {
  // Pilih semua = gabungkan yang sudah tercentang di halaman lain.
  const next = new Set(selected.value)
  for (const p of items.value) {
    if (allSelected.value) next.delete(p.id)
    else next.add(p.id)
  }
  selected.value = next
}
function clearSelection() { selected.value = new Set() }

/**
 * Sinkronkan `items` dari hasil mutasi — TANPA `load()` ulang.
 *
 * Mutasi produk sudah mengembalikan objek lengkap, jadi refetch list hanya
 * membuang 5-8 query lagi (50-100ms per round trip ke DB). Filter aktif
 * dihormati: hasil yang tidak cocok filter justru dikeluarkan dari list.
 */
function matchesFilter(p: ProductOut) {
  if (category.value && p.category !== category.value) return false
  if (status.value && p.status !== status.value) return false
  if (q.value) {
    const needle = q.value.toLowerCase()
    const hay = `${p.name} ${JSON.stringify(p.specification || {})}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}
function applyProduct(res: ProductOut, previous?: ProductOut | null) {
  const idx = items.value.findIndex(p => p.id === res.id)
  const merged: ProductOut = { ...previous, ...res, order_count: res.order_count ?? previous?.order_count ?? 0 }
  if (!matchesFilter(merged)) {
    if (idx >= 0) items.value.splice(idx, 1)
    return
  }
  if (idx >= 0) items.value[idx] = merged
  else {
    // Sisipkan sesuai urutan list (category, name) lalu buang yang kelebihan
    // halaman supaya pager tetap masuk akal.
    items.value.push(merged)
    items.value.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    if (items.value.length > pageSize) items.value.pop()
  }
}
function dropProducts(ids: string[]) {
  const gone = new Set(ids)
  items.value = items.value.filter(p => !gone.has(p.id))
}

async function load() {
  loading.value = true
  try {
    items.value = await request<ProductOut[]>('/products', {
      query: { q: q.value || undefined, category: category.value || undefined, status: status.value || undefined, page: page.value, page_size: pageSize }
    })
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat produk') }
  finally { loading.value = false }
}
onMounted(load)

/**
 * Setelah hapus massal, halaman yang sedang dibuka bisa jadi kosong (data
 * tersusut) sementara pager masih menunjuk halaman tinggi — mundur satu
 * halaman supaya owner tidak menghadapi daftar kosong palsu.
 */
async function collapseIfEmpty() {
  if (page.value > 1 && items.value.length === 0) {
    page.value -= 1
    await load()
  }
}

/* --- Popup tambah/ubah katalog --- */
function openCreate() {
  specProduct.value = null
  editing.value = null
  formOpen.value = true
}
function startEdit(p: ProductOut) {
  specProduct.value = null
  editing.value = p
  formOpen.value = true
}
/** Dari footer popup "Ubah spesifikasi" → tutup popup spec sheet, buka form edit terisi. */
function editFromSpec(p: ProductOut) {
  startEdit(p)
}
/** Popup form tersimpan → sinkronkan daftar TANPA `load()` ulang (lihat applyProduct). */
function onProductSaved(res: ProductOut, previous: ProductOut | null) {
  applyProduct(res, previous)
}
async function toggleStatus(p: ProductOut) {
  try {
    const res = await request<ProductOut>(`/products/${p.id}`, { method: 'PATCH', body: { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } })
    applyProduct(res, p)
    toast.success(`"${p.name}" ${p.status === 'ACTIVE' ? 'dinonaktifkan' : 'diaktifkan'}.`)
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal ubah status') }
}
async function remove(p: ProductOut) {  const used = p.order_count ?? 0
  if (used > 0) {
    // Dua jalur: nonaktifkan (aman,_history utuh) atau hapus paksa untuk
    // data seed yang memang tidak lagi dipakai.
    const choice = await confirmAction.choose({
      title: `"${p.name}" sudah dipakai ${used} order.`,
      message: 'Nonaktifkan saja supaya produk hilang dari etalase tapi riwayat order tetap utuh. Hapus paksa akan menghapus produk beserta baris ordernya, lalu total order yang tersisa dihitung ulang.',
      confirmLabel: 'Nonaktifkan',
      alt: { label: 'Hapus paksa', tone: 'danger' }
    })
    if (choice === 'alt') {
      await forceDelete([p.id], `"${p.name}"`)
      return
    }
    if (choice === 'primary') {
      await setInactive(p)
      return
    }
    return
  }
  const ok = await confirmAction.ask({
    title: `Hapus "${p.name}"?`,
    message: 'Tindakan ini tidak bisa dibatalkan. Rekomendasi chat yang menunjuk produk ini ikut terhapus.',
    confirmLabel: 'Hapus',
    tone: 'danger'
  })
  if (!ok) return
  try {
    await request(`/products/${p.id}`, { method: 'DELETE' })
    toast.success(`"${p.name}" dihapus.`)
    dropProducts([p.id])
    await collapseIfEmpty()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal hapus produk') }
}

async function setInactive(p: ProductOut) {
  try {
    const res = await request<ProductOut>(`/products/${p.id}`, { method: 'PATCH', body: { status: 'INACTIVE' } })
    applyProduct(res, p)
    toast.success(`"${p.name}" dinonaktifkan — hilang dari etalase, riwayat order tetap utuh.`)
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menonaktifkan produk') }
}

/**
 * Hapus paksa (untuk data seed): produk + baris order + rekomendasi chat.
 * Angka dampak diambil dari BALASAN endpoint, bukan dari tebakan sebelum
 * request — jadi yang ditampilkan adalah yang benar-benar terjadi.
 */
async function forceDelete(ids: string[], label: string) {
  try {
    const res = await request<{ deleted: number, orders_touched: number, orders_cancelled: number }>(
      '/products/bulk', { method: 'DELETE', body: { ids, force: true } }
    )
    const parts = [`${label} dihapus.`]
    if (res.orders_touched) parts.push(`${res.orders_touched} order disesuaikan totalnya.`)
    if (res.orders_cancelled) parts.push(`${res.orders_cancelled} order jadi kosong → CANCELLED.`)
    toast.success(parts.join(' '))
    dropProducts(ids)
    clearSelection()
    await collapseIfEmpty()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menghapus produk') }
}

async function bulkRemove() {
  if (bulkLoading.value || !selected.value.size) return
  const n = selected.value.size
  // Angka order di badge hanya perkiraan dari produk yang sedang tampil
  // (pilihan lintas halaman mungkin membawa produk terpakai lain) — supaya
  // teks konfirmasi tetap jujur, dampak persisnya dilaporkan toast balasan.
  const ok = await confirmAction.ask({
    title: `Hapus ${n} produk?`,
    message: 'Hapus paksa: produk dihapus permanen beserta riwayat stok dan promosinya. Bila ada produk terpilih yang pernah dipakai order, baris ordernya ikut terhapus dan total order tersisa dihitung ulang; order yang jadi tanpa item ditandai CANCELLED. Jumlah persisnya dilaporkan setelah aksi.',
    confirmLabel: `Hapus ${n} produk`,
    tone: 'danger'
  })
  if (!ok) return
  bulkLoading.value = true
  try {
    await forceDelete([...selected.value], `${n} produk`)
  }
  finally { bulkLoading.value = false }
}
</script>
