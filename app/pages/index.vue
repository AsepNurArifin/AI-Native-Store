<script setup lang="ts">
import { QrCode } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { activeStorefrontPromotion, categoryViews, productView } from '~/utils/storefront'

definePageMeta({ layout: 'default' })
const { settings } = useStoreSettings()
const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const base = (config.public.apiBase as string) || '/api/v1'
const route = useRoute()
const ogImage = `${siteUrl}/og-image.png`
useSeoMeta({
  title: () => `${settings.value.store_name}: Spesialis iPhone, iPad & Samsung Galaxy Flagship`,
  description: 'Pilihan iPhone, iPad, Apple Watch, AirPods & Samsung Galaxy dengan harga dan stok jelas. Pilih produk dan pesan langsung tanpa daftar akun.',
  ogTitle: () => `${settings.value.store_name}: Gadget pilihan. Harga transparan.`,
  ogDescription: 'Katalog Apple & Samsung Galaxy dengan checkout langsung tanpa akun. Tanya spesifikasi lewat chat, lalu pesan perangkat pilihanmu.',
  ogType: 'website', ogUrl: siteUrl, ogImage, ogLocale: 'id_ID',
  twitterCard: 'summary_large_image', twitterTitle: () => `${settings.value.store_name}: Gadget pilihan. Harga transparan.`, twitterImage: ogImage
})
useHead(() => ({
  link: [{ rel: 'canonical', href: siteUrl }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Store', name: settings.value.store_name,
    description: 'Toko spesialis Apple & Samsung Galaxy flagship.', url: siteUrl, image: ogImage, inLanguage: 'id',
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' }
  }) }]
}))
const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')
const activeCategory = ref('')
const selectedBrand = ref('')
const sort = ref('')
const brands = ['Apple', 'Samsung']
const PAGE_SIZE = 16
const catalogKey = computed(() => `mkt-catalog:${searchQuery.value}:${activeCategory.value}:${selectedBrand.value}:${sort.value}`)
const { getCachedData } = useCache()
const { data: categories, pending: categoriesPending, error: categoriesError, refresh: refreshCategories } = useStoreCategories()
const { data: promos, status: promosStatus, error: promosError, refresh: refreshPromos } = useAsyncData(
  'mkt-promos',
  () => $fetch<ProductOut[]>(`${base}/catalog/search`, { query: { promo_only: 'true', limit: 10 } }),
  { server: false, lazy: true, default: () => [] as ProductOut[], getCachedData }
)
const { data: firstPage, status: catalogStatus, error: catalogError, refresh: refreshCatalog } = useAsyncData(
  catalogKey,
  () => $fetch<ProductOut[]>(`${base}/catalog/search`, { query: {
    q: [searchQuery.value, selectedBrand.value].filter(Boolean).join(' ') || undefined,
    category: activeCategory.value || undefined, sort: sort.value || undefined, limit: PAGE_SIZE, offset: 0
  } }),
  { server: false, lazy: true, default: () => [] as ProductOut[], getCachedData }
)
const promosPending = computed(() => promosStatus.value === 'idle' || promosStatus.value === 'pending')
const catalogPending = computed(() => catalogStatus.value === 'idle' || catalogStatus.value === 'pending')
const catalog = ref<ProductOut[]>([])
const loadingMore = ref(false)
const loadMoreError = ref('')
const hasMore = ref(false)
let catalogGeneration = 0
watch(catalogKey, () => { catalogGeneration++; loadMoreError.value = '' })
watch(firstPage, value => {
  catalogGeneration++
  catalog.value = value ?? []
  hasMore.value = (value?.length ?? 0) === PAGE_SIZE
}, { immediate: true })
async function loadMore() {
  if (loadingMore.value || !hasMore.value || catalogPending.value) return
  const key = catalogKey.value
  const generation = catalogGeneration
  loadingMore.value = true
  loadMoreError.value = ''
  try {
    const next = await $fetch<ProductOut[]>(`${base}/catalog/search`, { query: {
      q: [searchQuery.value, selectedBrand.value].filter(Boolean).join(' ') || undefined,
      category: activeCategory.value || undefined, sort: sort.value || undefined, limit: PAGE_SIZE, offset: catalog.value.length
    } })
    if (key !== catalogKey.value || generation !== catalogGeneration) return
    const ids = new Set(catalog.value.map(product => product.id))
    catalog.value = [...catalog.value, ...next.filter(product => !ids.has(product.id))]
    hasMore.value = next.length === PAGE_SIZE
  }
  catch {
    if (key === catalogKey.value && generation === catalogGeneration) loadMoreError.value = 'Produk berikutnya belum bisa dimuat. Coba lagi.'
  }
  finally { loadingMore.value = false }
}
const observedProducts = computed(() => [...(promos.value ?? []), ...catalog.value])
async function refreshPrices() {
  await Promise.all([refreshPromos(), refreshCatalog()])
  if (promosError.value || catalogError.value) throw new Error('Katalog terbaru belum tersedia.')
}
const { now, mounted, refreshError, refreshExpired } = useStorefrontClock(observedProducts, refreshPrices)
const activePromos = computed(() => (promos.value ?? []).filter(product => activeStorefrontPromotion(product, now.value)))
const heroProducts = computed(() => promosPending.value || promosError.value ? [] : activePromos.value.slice(0, 3).map(product => productView(product, now.value)))
const categoryTiles = computed(() => categoryViews(categories.value ?? [], [...(promos.value ?? []), ...(firstPage.value ?? [])]))
</script>

<template>
  <div class="store-home">
    <PromoHero :products="heroProducts" :pending="promosPending" :error="!!promosError" @retry="refreshPromos()" />
    <CategoryGrid :categories="categoryTiles" :pending="categoriesPending" :error="!!categoriesError" @retry="refreshCategories()" />
    <FlashSaleRail :products="activePromos" :now="now" :mounted="mounted" :pending="promosPending" :error="!!promosError" @retry="refreshPromos()" />
    <div v-if="refreshError" role="alert" class="store-error"><p>{{ refreshError }}</p><Button variant="outline" class="mt-3" @click="refreshExpired">Muat ulang harga dan promo</Button></div>
    <section id="katalog" class="storefront-anchor" aria-labelledby="catalog-heading">
      <div class="store-section-heading"><div><p class="store-eyebrow">Pilihan dari katalog toko</p><h2 id="catalog-heading">{{ searchQuery ? `Hasil pencarian “${searchQuery}”` : 'Temukan gadget berikutnya' }}</h2><p v-if="!catalogPending && !catalogError" class="store-description">{{ catalog.length }} produk ditampilkan · harga dan stok dari katalog</p></div><div class="flex flex-wrap items-center gap-2"><label for="sort-select" class="store-muted">Urutkan</label><select id="sort-select" v-model="sort" class="store-sort"><option value="">Paling relevan</option><option value="termurah">Harga termurah</option><option value="termahal">Harga termahal</option><option value="terbaru">Produk terbaru</option></select></div></div>
      <ProductGrid :products="catalog" :now="now" :pending="catalogPending" :error="!!catalogError" @retry="refreshCatalog()">
        <template #controls>
          <div class="store-panel store-filter-bar">
            <div class="store-filter-row" role="group" aria-label="Filter merek"><span>Merek</span><button type="button" :aria-pressed="!selectedBrand" @click="selectedBrand = ''">Semua merek</button><button v-for="brand in brands" :key="brand" type="button" :aria-pressed="selectedBrand === brand" @click="selectedBrand = selectedBrand === brand ? '' : brand">{{ brand }}</button></div>
            <div v-if="categories?.length" class="store-filter-row" role="group" aria-label="Filter kategori"><span>Kategori</span><button type="button" :aria-pressed="!activeCategory" @click="activeCategory = ''">Semua kategori</button><button v-for="category in categories" :key="category" type="button" :aria-pressed="activeCategory === category" @click="activeCategory = activeCategory === category ? '' : category">{{ category }}</button></div>
          </div>
        </template>
        <template #load-more><div v-if="catalog.length && hasMore" class="store-load-more"><p v-if="loadMoreError" class="store-field-error" role="alert">{{ loadMoreError }}</p><Button variant="outline" :loading="loadingMore" @click="loadMore">{{ loadMoreError ? 'Coba lagi muat produk' : 'Muat lebih banyak' }}</Button></div></template>
      </ProductGrid>
    </section>
    <section id="cara-belanja" class="storefront-anchor store-panel store-guide" aria-labelledby="guide-heading">
      <div class="store-section-heading"><div><p class="store-eyebrow">Belanja dengan tenang</p><h2 id="guide-heading">Dari pilihan ke pesanan</h2></div><NuxtLink to="/chat" class="store-link">Butuh bantuan?</NuxtLink></div>
      <ol class="store-guide-steps"><li class="store-guide-step"><span>1</span><div><h3>Temukan produk</h3><p>Lihat harga, spesifikasi dan stok. Chat untuk bertanya tanpa akun.</p></div></li><li class="store-guide-step"><span>2</span><div><h3>Lengkapi rincian</h3><p>Pilih produk, isi nama dan telepon. Tentukan ambil di toko atau alamat pengiriman.</p></div></li><li class="store-guide-step"><span>3</span><div><h3>Bayar &amp; konfirmasi</h3><p>Ambil di toko bisa Cash atau QRIS. Pengiriman wajib QRIS; lampirkan screenshot transaksi berhasil.</p></div></li><li class="store-guide-step"><span>4</span><div><h3>Simpan ID pesanan</h3><p>Admin memverifikasi bukti QRIS dan memperbarui status penyerahan atau pengiriman.</p></div></li></ol>
      <p class="store-guide-note"><QrCode aria-hidden="true" class="size-4" /> Bayar hanya ke QRIS resmi merchant toko. Screenshot diperiksa admin, bukan otomatis lunas. Ongkir pengiriman terpisah.</p>
    </section>
  </div>
</template>
