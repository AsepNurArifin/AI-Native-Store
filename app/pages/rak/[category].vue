<script setup lang="ts">
import type { ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'default' })
const { settings } = useStoreSettings()

const route = useRoute()
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || '/api/v1'
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

const category = computed(() => String(route.params.category || ''))
const categoryPath = computed(() => `/rak/${encodeURIComponent(category.value)}`)
const toast = useToast()
const q = ref('')
const qDebounced = ref('')
const sort = ref('')
const promoOnly = ref(false)

const { getCachedData } = useCache()
// Ukuran batch "Muat lebih banyak" di rak (sama dengan beranda).
const PAGE_SIZE = 16

const rakKey = computed(() => `rak:${category.value}:${qDebounced.value}:${sort.value}:${promoOnly.value}`)

// Tanpa try/catch: error diteruskan ke `fetchError` (bukan "rak kosong" palsu).
// Key reaktif per kategori+filter: ganti kategori/filter = key baru = refetch
// otomatis; balik ke rak yang sama = tampil instan dari cache. Batch pertama
// berisi 16 produk; halaman berikutnya dimuat oleh owner yang sama.
const { data: firstPage, status, error: fetchError, refresh } = useAsyncData(
  rakKey,
  () => $fetch<ProductOut[]>(`${base}/catalog/search`, {
    query: { category: category.value, q: qDebounced.value || undefined, sort: sort.value || undefined, promo_only: promoOnly.value ? 'true' : undefined, limit: PAGE_SIZE, offset: 0 }
  }),
  { server: false, lazy: true, default: () => [] as ProductOut[], getCachedData }
)
const pending = computed(() => status.value === 'idle' || status.value === 'pending')

// Akumulasi produk yang sudah dimuat (batch pertama + "Muat lebih banyak").
const products = ref<ProductOut[]>([])
const loadingMore = ref(false)
const hasMore = ref(false)
const loadMoreError = ref('')
let loadGeneration = 0
watch(rakKey, () => { loadGeneration++; loadMoreError.value = '' })

watch(firstPage, (v) => {
  loadGeneration++
  products.value = v ?? []
  hasMore.value = (v?.length ?? 0) === PAGE_SIZE
}, { immediate: true })

async function loadMore() {
  if (loadingMore.value || !hasMore.value || pending.value) return
  const keyAtStart = rakKey.value
  const generation = loadGeneration
  loadMoreError.value = ''
  loadingMore.value = true
  try {
    const next = await $fetch<ProductOut[]>(`${base}/catalog/search`, {
      query: { category: category.value, q: qDebounced.value || undefined, sort: sort.value || undefined, promo_only: promoOnly.value ? 'true' : undefined, limit: PAGE_SIZE, offset: products.value.length }
    })
    if (keyAtStart !== rakKey.value || generation !== loadGeneration) return
    products.value = [...products.value, ...(next ?? [])]
    hasMore.value = (next?.length ?? 0) === PAGE_SIZE
  } catch {
    if (keyAtStart === rakKey.value && generation === loadGeneration) loadMoreError.value = 'Gagal memuat produk berikutnya. Coba lagi.'
  } finally {
    loadingMore.value = false
  }
}

// Debounce ketikan -> key baru -> refetch otomatis.
let debounce: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { qDebounced.value = q.value }, 350)
})
onUnmounted(() => { clearTimeout(debounce) })
const { now, refreshError, refreshExpired } = useStorefrontClock(products, async () => {
  await refresh()
  if (fetchError.value) throw new Error('Harga terbaru belum bisa dimuat.')
})

const pageTitle = computed(() => `${category.value}: Harga & Stok`)
useSeoMeta({
  title: pageTitle,
  description: () => `Daftar ${category.value} di ${settings.value.store_name}: harga, promo, dan stok terbaru. Pilih produk dan checkout langsung tanpa daftar akun.`,
  ogTitle: pageTitle,
  ogDescription: () => `${category.value} di ${settings.value.store_name} — harga jelas dan checkout langsung tanpa akun.`,
  ogType: 'website',
  ogUrl: () => `${siteUrl}${categoryPath.value}`,
  ogLocale: 'id_ID',
  twitterCard: 'summary_large_image'
})
useHead(() => ({
  link: [{ rel: 'canonical', href: `${siteUrl}${categoryPath.value}` }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Beranda', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: category.value, item: `${siteUrl}${categoryPath.value}` }
      ]
    })
  }]
}))

// Gagal memuat = notifikasi pop-up (satu pesan, tidak berulang tiap re-render).
// Yang tersisa di halaman cuma tombol coba lagi supaya rak bisa dipulihkan.
watch(fetchError, (err) => {
  if (err) toast.error('Rak tidak bisa dimuat sekarang. Koneksi ke database toko sedang terganggu.')
})
</script>

<template>
  <div class="space-y-6 max-[320px]:min-w-0 max-[320px]:[overflow-wrap:anywhere]">
    <nav aria-label="Breadcrumb" class="text-xs font-medium text-stone-500">
      <ol class="flex flex-wrap items-center gap-1.5">
        <li><NuxtLink to="/" class="hover:text-brand-700">Beranda</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li><NuxtLink to="/#katalog" class="hover:text-brand-700">Katalog</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li class="text-stone-800">{{ category }}</li>
      </ol>
    </nav>

    <div class="space-y-2">
      <h1 class="font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
        {{ category }}
      </h1>
      <p class="max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
        <template v-if="pending">Memuat produk…</template>
        <template v-else-if="!fetchError">Menampilkan {{ products.length }} produk. Buka detail atau pesan langsung dari katalog.</template>
      </p>
    </div>

    <div class="flex flex-col gap-2.5 rounded-xl border border-stone-200 bg-white p-3 sm:flex-row sm:items-center">
      <div class="relative flex-1 max-[320px]:min-w-0">
        <input
          v-model="q"
          type="search"
          placeholder="Cari di rak ini…"
          aria-label="Cari di rak ini"
          class="h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 text-base placeholder:text-stone-500 sm:text-sm"
        >
      </div>
      <div class="flex items-center gap-2 max-[320px]:flex-wrap">
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600">
          <input v-model="promoOnly" type="checkbox" class="h-4 w-4 accent-brand-700" >
          Promo saja
        </label>
        <select v-model="sort" aria-label="Urutkan" class="store-sort">
          <option value="">Paling relevan</option>
          <option value="termurah">Termurah</option>
          <option value="termahal">Termahal</option>
          <option value="terbaru">Terbaru</option>
        </select>
      </div>
    </div>

    <div v-if="refreshError" class="store-error" role="alert"><p>{{ refreshError }}</p><Button variant="outline" class="mt-3" @click="refreshExpired">Muat ulang harga</Button></div>
    <ProductGrid
      :products="products"
      :now="now"
      :pending="pending"
      :error="!!fetchError"
      :empty-title="q || promoOnly ? 'Tidak ada yang cocok dengan filter' : 'Rak ini sedang kosong'"
      :empty-message="q || promoOnly ? 'Coba ubah kata kunci atau filter promo, atau tanyakan lewat chat.' : 'Belum ada produk di rak ini. Jelajahi katalog lainnya atau tanya stok melalui chat.'"
      @retry="refresh()"
    >
      <template #load-more>
        <div v-if="products.length && hasMore" class="store-load-more">
          <p v-if="loadMoreError" role="alert" class="store-field-error">{{ loadMoreError }}</p>
          <Button variant="outline" :loading="loadingMore" @click="loadMore">{{ loadMoreError ? 'Coba lagi muat produk' : 'Muat lebih banyak' }}</Button>
        </div>
      </template>
    </ProductGrid>
  </div>
</template>
