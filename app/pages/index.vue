<script setup lang="ts">
import {
  Headphones, MessageCircle, Smartphone, Tablet, Watch, Package,
  Truck, ShieldCheck, Flame, Clock, Zap, CheckCircle2, QrCode, ArrowRight, AlertTriangle
} from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { formatIDR } from '~/utils/format'
import { effectivePrice } from '~/utils/product'

definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const base = (config.public.apiBase as string) || '/api/v1'
const ogImage = `${siteUrl}/og-image.png`
const route = useRoute()

useSeoMeta({
  title: 'SHAF STORE: Spesialis iPhone, iPad & Samsung Galaxy Flagship',
  description: 'Katalog iPhone, iPad, Apple Watch, AirPods & Samsung Galaxy seri flagship dengan harga jelas. Chat untuk cek stok; checkout langsung tanpa daftar akun.',
  ogTitle: 'SHAF STORE: Spesialis iPhone, iPad & Samsung Galaxy Flagship',
  ogDescription: 'Katalog Apple & Samsung Galaxy flagship dengan harga jelas; checkout langsung tanpa daftar akun.',
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage,
  ogLocale: 'id_ID',
  twitterCard: 'summary_large_image',
  twitterTitle: 'SHAF STORE: Spesialis iPhone, iPad & Samsung Galaxy Flagship',
  twitterImage: ogImage
})
useHead({ link: [{ rel: 'canonical', href: siteUrl }] })

const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const activeCategory = ref('')
const selectedBrand = ref('')
const sort = ref('')

const popularBrands = ['Apple', 'Samsung']

// Kategori dipakai bareng layout (key 'layout-categories') — tanpa request kedua.
const { data: layoutCategories } = useNuxtData<string[]>('layout-categories')
const categories = computed(() => layoutCategories.value ?? [])

const { getCachedData } = useCache()
// Ukuran batch "Muat lebih banyak" di beranda.
const PAGE_SIZE = 16

// Key reaktif katalog (dipakai untuk guard stale saat loadMore).
const catalogKey = computed(() => `mkt-catalog:${searchQuery.value}:${activeCategory.value}:${selectedBrand.value}:${sort.value}`)

// promos + batch pertama katalog PARALEL + cache lintas navigasi. Key reaktif
// per kombinasi filter: ganti filter = key baru = refetch otomatis (tanpa
// watch manual), balik ke filter yang sama = tampil instan dari cache.
// TIDAK ada try/catch yang menelan error jadi `[]`. Kalau API/DB sedang gangguan,
// `useAsyncData` menyimpan errornya di `catalogError` dan kita tampilkan sebagai
// "katalog tidak bisa dimuat" — bukan sebagai "Produk Tidak Ditemukan".
// Bug sebelumnya: 500 dari /catalog/search diubah jadi array kosong, sehingga
// outage DB (EMAXCONNSESSION) terlihat seperti toko yang produknya kosong.
const [{ data: promos, pending: promosPending, error: promosError, refresh: refreshPromos }, {
  data: firstPage, pending: catalogPending, error: catalogError, refresh: refreshCatalog
}] = await Promise.all([
  useAsyncData('mkt-promos', async () => {
    return await $fetch<ProductOut[]>(`${base}/catalog/search`, { query: { promo_only: 'true', limit: 10 } })
  }, { default: () => [] as ProductOut[], getCachedData }),
  useAsyncData(
    catalogKey,
    async () => {
      const combinedQ = [searchQuery.value, selectedBrand.value].filter(Boolean).join(' ')
      return await $fetch<ProductOut[]>(`${base}/catalog/search`, {
        query: {
          q: combinedQ || undefined,
          category: activeCategory.value || undefined,
          sort: sort.value || undefined,
          limit: PAGE_SIZE,
          offset: 0
        }
      })
    },
    { default: () => [] as ProductOut[], getCachedData }
  )
])

// Akumulasi produk yang sudah dimuat (batch pertama + "Muat lebih banyak").
const catalog = ref<ProductOut[]>([])
const loadingMore = ref(false)
const hasMore = ref(false)

// Batch pertama (SSR/cached) -> reset akumulasi + hasMore.
watch(firstPage, (v) => {
  catalog.value = v ?? []
  hasMore.value = (v?.length ?? 0) === PAGE_SIZE
}, { immediate: true })

// Muat batch berikutnya (client-side). Guard stale: kalau filter berubah saat
// request in-flight, hasil dibuang (tidak merusak daftar yang baru).
async function loadMore() {
  if (loadingMore.value || !hasMore.value || catalogPending.value) return
  const keyAtStart = catalogKey.value
  loadingMore.value = true
  try {
    const combinedQ = [searchQuery.value, selectedBrand.value].filter(Boolean).join(' ')
    const next = await $fetch<ProductOut[]>(`${base}/catalog/search`, {
      query: {
        q: combinedQ || undefined,
        category: activeCategory.value || undefined,
        sort: sort.value || undefined,
        limit: PAGE_SIZE,
        offset: catalog.value.length
      }
    })
    if (keyAtStart !== catalogKey.value) return // filter berubah -> buang
    catalog.value = [...catalog.value, ...(next ?? [])]
    hasMore.value = (next?.length ?? 0) === PAGE_SIZE
  } catch {
    toast.error('Gagal memuat produk berikutnya. Coba lagi.')
  } finally {
    loadingMore.value = false
  }
}

const toast = useToast()
// Katalog gagal dimuat = notifikasi pop-up. Kartu error di template tetap
// dipertahankan karena memuat tombol "Muat Ulang", bukan sekadar pesan.
watch(catalogError, (err) => {
  if (err) toast.error('Katalog tidak bisa dimuat. Koneksi ke database toko sedang terganggu.')
})

const categoryIcons: Record<string, object> = {
  HP: Smartphone, Smartphone: Smartphone, Tablet: Tablet,
  Wearable: Watch, Audio: Headphones, Aksesori: Headphones
}
function catIcon(name: string) {
  for (const [k, v] of Object.entries(categoryIcons)) if (name.toLowerCase().includes(k.toLowerCase())) return v
  return Package
}

const heroPromo = computed(() => !promosPending.value && !promosError.value ? promos.value?.[0] ?? null : null)
const heroPrice = computed(() => heroPromo.value ? effectivePrice(heroPromo.value) : 0)

// Countdown ke akhir promo hero (promotion.end_date) — menghitung turun asli,
// bukan timer hiasan. Habis masa promo = tampil 00:00:00.
const timer = ref({ hours: '00', minutes: '00', seconds: '00' })
let timerInterval: ReturnType<typeof setInterval> | null = null

function tickTimer() {
  const end = heroPromo.value?.promotion?.end_date ? +new Date(heroPromo.value.promotion.end_date).getTime() : 0
  const diff = Math.max(0, end - Date.now())
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  timer.value = {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0')
  }
}

onMounted(() => {
  tickTimer()
  timerInterval = setInterval(tickTimer, 1000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Store', name: 'SHAF STORE',
      description: 'Toko spesialis Apple & Samsung Galaxy flagship.',
      url: siteUrl, image: ogImage, inLanguage: 'id',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    })
  }]
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8">
    <!-- BEST BUY HERO SHOWCASE (Royal Blue Banner with Yellow Tag CTA) -->
    <section class="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div class="grid min-w-0 gap-6 p-5 max-[320px]:p-3 sm:p-10" :class="heroPromo ? 'lg:grid-cols-[1.3fr_1fr] lg:items-center' : ''">
        <!-- Text & Value Prop -->
        <div class="min-w-0 max-w-3xl space-y-4 [overflow-wrap:anywhere]">
          <div class="inline-flex max-w-full items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3.5 py-1 text-xs font-black text-brand-700">
            <Zap class="h-3.5 w-3.5 fill-brand-700" />
            SHAF STORE · Apple &amp; Samsung
          </div>
          <h1 class="font-display text-3xl font-black tracking-tight text-stone-900 sm:text-5xl sm:leading-[1.1]">
            Gadget pilihan. <span class="text-brand-700">Harga transparan.</span>
          </h1>
          <p class="max-w-3xl text-base leading-relaxed text-stone-600 font-medium">
            Temukan iPhone, iPad, Apple Watch, AirPods, dan Samsung Galaxy. Cek stok dan pesan langsung tanpa akun.
          </p>
          <div class="flex flex-col gap-3 pt-2 sm:flex-row">
            <!-- Best Buy Yellow Tag Button -->
            <NuxtLink
              to="/chat"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-promo-400 px-6 py-3 text-sm font-black text-stone-950 shadow-md transition-all duration-150 hover:bg-promo-500 max-[320px]:px-2"
            >
              <MessageCircle class="h-4 w-4 fill-stone-950" />
              Tanya lewat chat
            </NuxtLink>
            <Button size="lg" variant="outline" to="#katalog" class="font-bold border-stone-300 max-[320px]:h-auto max-[320px]:min-h-11 max-[320px]:whitespace-normal max-[320px]:px-2">
              Lihat katalog
            </Button>
          </div>
          <div class="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs font-bold text-stone-600">
            <span class="inline-flex items-center gap-1.5"><CheckCircle2 class="h-4 w-4 text-emerald-600" /> Ambil di toko atau diantar</span>
            <span class="inline-flex items-center gap-1.5"><Truck class="h-4 w-4 text-brand-700" /> Cek stok sebelum memesan</span>
          </div>
        </div>

        <!-- Best Buy Deal of the Day Card -->
        <div v-if="heroPromo" class="storefront-dark relative min-w-0 overflow-hidden rounded-2xl border-2 border-brand-700 bg-brand-700 p-5 text-white shadow-md max-[320px]:p-3">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-brand-500">
            <div class="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-widest text-promo-400">
              <Flame class="h-4 w-4 fill-promo-400 text-promo-400" />
              Promo pilihan
            </div>
            <!-- Timer Countdown -->
            <div class="flex flex-wrap items-center gap-1 text-[11px] font-bold text-white">
              <Clock class="h-3.5 w-3.5 text-promo-400" />
              <span>Sisa:</span>
              <span class="rounded bg-brand-950 px-2 py-0.5 font-mono text-promo-400 font-black">{{ timer.hours }}:{{ timer.minutes }}:{{ timer.seconds }}</span>
            </div>
          </div>

          <NuxtLink :to="`/produk/${heroPromo.id}`" class="group mt-4 flex flex-col items-start gap-4 min-[400px]:flex-row min-[400px]:items-center">
            <ProductImage :image-url="heroPromo.image_url" :name="heroPromo.name" :category="heroPromo.category" size="thumb" eager class="h-24 w-24 shrink-0 !rounded-2xl border border-brand-500 bg-white" />
            <div class="min-w-0 w-full flex-1">
              <span class="inline-block rounded bg-promo-400 px-2 py-0.5 text-[10px] font-black uppercase text-stone-950 shadow-xs">
                HEMAT {{ Math.round(heroPromo.discount_percentage || 0) }}%
              </span>
              <p class="mt-1 line-clamp-2 text-sm font-extrabold text-white group-hover:text-promo-400 transition-colors">
                {{ heroPromo.name }}
              </p>
              <p class="mt-1 text-xs text-brand-200 line-through">{{ formatIDR(heroPromo.price) }}</p>
              <p class="font-display text-2xl font-black tabular-nums text-promo-400 max-[320px]:text-base">{{ formatIDR(heroPrice) }}</p>
            </div>
          </NuxtLink>

          <!-- Stok promo (data asli) -->
          <div class="mt-4 pt-3 border-t border-brand-600">
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-brand-100">
              <span>Stok Promo Terbatas</span>
              <span class="text-promo-400 font-extrabold">Sisa {{ heroPromo.current_stock }} unit</span>
            </div>
          </div>
        </div>

      </div>
    </section>


    <!-- SHOP BY CATEGORY (Best Buy Category Icons) -->
    <section v-if="categories.length" aria-label="Kategori">
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-lg font-black tracking-tight text-stone-900">Belanja per kategori</h2>
        <span class="text-xs font-bold text-stone-500">Pilih kategori produk</span>
      </div>
      <div class="grid grid-cols-3 gap-2.5 max-[320px]:grid-cols-1 sm:grid-cols-6">
        <NuxtLink
          v-for="c in categories"
          :key="c"
          :to="`/rak/${encodeURIComponent(c)}`"
          class="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-700 hover:shadow-xs"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-transform duration-200 group-hover:scale-110">
            <component :is="catIcon(c)" class="h-5 w-5" />
          </div>
          <span class="text-xs font-bold text-stone-900 group-hover:text-brand-700">{{ c }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- TOP DEALS RAIL (Best Buy Sales Rail) -->
    <section id="promo" class="storefront-anchor">
      <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-display text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              <span class="text-promo-600">Promo hari ini</span>
            </h2>
          </div>
          <p class="mt-1 text-sm text-stone-600 font-medium">Penawaran terbatas dengan harga miring langsung dari katalog toko.</p>
        </div>
        <NuxtLink to="/#katalog" class="shrink-0 text-sm font-bold text-brand-700 hover:underline flex items-center gap-1">
          Lihat katalog <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>
      <p v-if="promosPending" class="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600" role="status">Memuat promo…</p>
      <div v-else-if="promosError" class="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
        <p class="font-semibold text-stone-900">Promo belum bisa dimuat.</p>
        <Button type="button" variant="outline" class="mt-3 min-h-11" @click="refreshPromos()">Coba lagi</Button>
      </div>
      <div v-else-if="promos?.length" class="grid grid-cols-2 gap-3.5 max-[320px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in promos" :key="p.id" :product="p" />
      </div>
      <div v-else class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
        <p>Belum ada promo aktif.</p>
        <NuxtLink to="#katalog" class="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">Lihat katalog</NuxtLink>
      </div>
    </section>

    <!-- KATALOG UTAMA -->
    <section id="katalog" class="storefront-anchor">
      <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 class="font-display text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
            {{ searchQuery ? `Hasil Pencarian “${searchQuery}”` : selectedBrand ? `Katalog merek ${selectedBrand}` : 'Semua Katalog Produk' }}
          </h2>
          <p class="mt-0.5 text-sm text-stone-600 font-medium">
            {{ searchQuery ? `${catalog?.length || 0} produk ditampilkan.` : 'Pilih merek atau kategori yang kamu cari.' }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
          <label for="sort-select" class="text-xs font-bold text-stone-600">Urutkan:</label>
          <select id="sort-select" v-model="sort" aria-label="Urutkan Katalog" class="h-9 min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 shadow-2xs focus:border-brand-700 focus:outline-hidden">
            <option value="">Paling Relevan</option>
            <option value="termurah">Harga Termurah</option>
            <option value="termahal">Harga Termahal</option>
            <option value="terbaru">Produk Terbaru</option>
          </select>
        </div>
      </div>

      <div class="mb-4 space-y-2" role="group" aria-label="Merek">
        <p class="text-xs font-bold text-stone-600">Merek</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="min-h-11 rounded-xl border px-4 py-2 text-xs font-bold" :class="!selectedBrand ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-800'" :aria-pressed="!selectedBrand" @click="selectedBrand = ''">Semua merek</button>
          <button v-for="b in popularBrands" :key="b" type="button" class="min-h-11 rounded-xl border px-4 py-2 text-xs font-bold transition-colors" :class="selectedBrand === b ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-800 hover:border-brand-700'" :aria-pressed="selectedBrand === b" @click="selectedBrand = selectedBrand === b ? '' : b">{{ b }}</button>
        </div>
      </div>

      <!-- Filter Category Pills -->
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <div class="modern-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            :aria-pressed="!activeCategory"
            :class="[
              'min-h-11 shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              !activeCategory ? 'bg-brand-700 text-white shadow-xs' : 'border border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:text-brand-700'
            ]"
            @click="activeCategory = ''"
          >
            Semua Kategori
          </button>
          <button
            v-for="c in categories"
            :key="c"
            type="button"
            :aria-pressed="activeCategory === c"
            :class="[
              'min-h-11 shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              activeCategory === c ? 'bg-brand-700 text-white shadow-xs' : 'border border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:text-brand-700'
            ]"
            @click="activeCategory = activeCategory === c ? '' : c"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- Catalog Loading State -->
      <div v-if="catalogPending" class="grid grid-cols-2 gap-3.5 max-[320px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="i in 8" :key="i" class="h-72 animate-pulse rounded-2xl bg-stone-200/70" aria-label="Memuat produk" />
      </div>

      <!-- Catalog Error State: outage DB/API tidak boleh disamarkan jadi "toko kosong" -->
      <div v-else-if="catalogError" class="rounded-3xl border border-dashed border-rose-300 bg-rose-50/70 p-10 text-center shadow-xs max-[320px]:p-3" role="alert">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <AlertTriangle class="h-6 w-6" />
        </div>
        <h3 class="mt-3 font-display font-bold text-stone-900">Katalog tidak bisa dimuat</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-stone-600">Koneksi ke database toko sedang terganggu — bukan berarti produknya kosong. Coba muat ulang beberapa saat lagi.</p>
        <Button class="mt-4 max-[320px]:h-auto max-[320px]:min-h-11 max-[320px]:whitespace-normal" variant="ai" @click="refreshCatalog()">Muat Ulang Katalog</Button>
      </div>

      <!-- Empty State -->
      <div v-else-if="!catalog?.length" class="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-xs max-[320px]:p-3">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Package class="h-6 w-6" />
        </div>
        <h3 class="mt-3 font-display font-bold text-stone-900">Produk Tidak Ditemukan</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-stone-600">Coba kata kunci lain atau konsultasikan unit yang kamu cari dengan Asisten Chat Toko.</p>
        <NuxtLink to="/chat" class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-promo-400 px-5 py-2.5 text-xs font-black text-stone-950 shadow-md">Tanya Lewat Chat</NuxtLink>
      </div>

      <!-- Product Grid -->
      <div v-else class="grid grid-cols-2 gap-3.5 max-[320px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in catalog" :key="p.id" :product="p" />
      </div>

      <!-- Muat lebih banyak (16 per batch) -->
      <div v-if="catalog?.length && !catalogPending" class="mt-6 flex justify-center">
        <Button
          v-if="hasMore"
          variant="outline"
          :disabled="loadingMore"
          class="px-6 max-[320px]:h-auto max-[320px]:min-h-11 max-[320px]:whitespace-normal max-[320px]:px-2"
          @click="loadMore()"
        >
          {{ loadingMore ? 'Memuat…' : 'Muat lebih banyak' }}
        </Button>
      </div>
    </section>

    <!-- SERVICE TRUST PILLARS (Best Buy Totaltech Style) -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs max-[320px]:flex-col max-[320px]:p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Informasi produk</h3>
          <p class="mt-0.5 text-xs text-stone-600">Lihat spesifikasi dan stok sebelum memesan.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs max-[320px]:flex-col max-[320px]:p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Truck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Pilihan penerimaan</h3>
          <p class="mt-0.5 text-xs text-stone-600">Pilih ambil di toko atau diantar saat membuat pesanan.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs max-[320px]:flex-col max-[320px]:p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <QrCode class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">QRIS simulasi</h3>
          <p class="mt-0.5 text-xs text-stone-600">QR pada demo tidak dapat dibayar. Pembayaran dikonfirmasi kasir.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs max-[320px]:flex-col max-[320px]:p-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-promo-100 text-promo-700">
          <MessageCircle class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Bantuan lewat chat</h3>
          <p class="mt-0.5 text-xs text-stone-600">Tanya stok dan spesifikasi tanpa daftar akun.</p>
        </div>
      </div>
    </section>

    <!-- CARA BELANJA: Receipt Note -->
    <section id="cara-belanja" class="storefront-anchor">
      <div class="mx-auto max-w-2xl rounded-3xl border-2 border-dashed border-stone-300 bg-white p-6 max-[320px]:p-3 sm:p-8 shadow-2xs">
        <div class="flex flex-col gap-1 border-b border-stone-200 pb-3 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 class="font-display text-lg font-black tracking-tight text-stone-900">Panduan belanja</h2>
          <span class="text-xs font-mono font-bold text-brand-700">SHAF STORE NOTA</span>
        </div>
        <ol class="mt-5 space-y-4 text-sm leading-relaxed">
          <li class="flex gap-4 max-[320px]:flex-col max-[320px]:gap-2">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">1</span>
            <p class="text-stone-700"><span class="font-bold text-stone-900">Pilih produk di katalog atau ceritakan budgetmu di Chat.</span> Contoh: “iPhone 15 Pro budget 15 juta”.</p>
          </li>
          <li class="flex gap-4 max-[320px]:flex-col max-[320px]:gap-2">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">2</span>
            <p class="text-stone-700"><span class="font-bold text-stone-900">Cek rincian spesifikasi &amp; ketersediaan stok.</span> Asisten toko akan mengecek database realtime.</p>
          </li>
          <li class="flex gap-4 max-[320px]:flex-col max-[320px]:gap-2">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">3</span>
            <p class="text-stone-700">Buat pesanan dan simpan ID-nya. QRIS pada demo adalah simulasi; pembayaran dikonfirmasi kasir.</p>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>
