<script setup lang="ts">
import {
  Gamepad2, Headphones, Laptop, MessageCircle, Smartphone, Tablet, Watch, Package,
  Truck, ShieldCheck, Flame, Clock, Zap, CheckCircle2, QrCode, ArrowRight
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
  title: 'PARAGONKOM: Toko Elektronik HP, Laptop & Aksesoris',
  description: 'Katalog HP, laptop, tablet & aksesoris dengan harga jelas. Chat untuk cek stok; checkout langsung tanpa daftar akun.',
  ogTitle: 'PARAGONKOM: Toko Elektronik HP, Laptop & Aksesoris',
  ogDescription: 'Katalog gadget dengan harga jelas; checkout langsung tanpa daftar akun.',
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage,
  ogLocale: 'id_ID',
  twitterCard: 'summary_large_image',
  twitterTitle: 'PARAGONKOM: Toko Elektronik HP, Laptop & Aksesoris',
  twitterImage: ogImage
})
useHead({ link: [{ rel: 'canonical', href: siteUrl }] })

const searchQuery = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const activeCategory = ref('')
const selectedBrand = ref('')
const sort = ref('')

const popularBrands = ['Apple', 'Samsung', 'ASUS', 'Lenovo', 'MSI', 'Xiaomi', 'Sony', 'Logitech']

// Kategori dipakai bareng layout (key 'layout-categories') — tanpa request kedua.
const { data: layoutCategories } = useNuxtData<string[]>('layout-categories')
const categories = computed(() => layoutCategories.value ?? [])

const { getCachedData } = useCache()
// promos + catalog PARALEL + cache lintas navigasi. Key reaktif per kombinasi
// filter: ganti filter = key baru = refetch otomatis (tanpa watch manual),
// balik ke filter yang sama = tampil instan dari cache.
const [{ data: promos }, { data: catalog, pending: catalogPending }] = await Promise.all([
  useAsyncData('mkt-promos', async () => {
    try { return await $fetch<ProductOut[]>(`${base}/catalog/search`, { query: { promo_only: 'true', limit: 10 } }) }
    catch { return [] as ProductOut[] }
  }, { default: () => [] as ProductOut[], getCachedData }),
  useAsyncData(
    computed(() => `mkt-catalog:${searchQuery.value}:${activeCategory.value}:${selectedBrand.value}:${sort.value}`),
    async () => {
      try {
        const combinedQ = [searchQuery.value, selectedBrand.value].filter(Boolean).join(' ')
        return await $fetch<ProductOut[]>(`${base}/catalog/search`, {
          query: {
            q: combinedQ || undefined,
            category: activeCategory.value || undefined,
            sort: sort.value || undefined,
            limit: 24
          }
        })
      }
      catch { return [] as ProductOut[] }
    },
    { default: () => [] as ProductOut[], getCachedData }
  )
])

const categoryIcons: Record<string, object> = {
  HP: Smartphone, Smartphone: Smartphone, Laptop: Laptop, Tablet: Tablet,
  Wearable: Watch, Audio: Headphones, Aksesori: Headphones, Komputer: Laptop, Gaming: Gamepad2
}
function catIcon(name: string) {
  for (const [k, v] of Object.entries(categoryIcons)) if (name.toLowerCase().includes(k.toLowerCase())) return v
  return Package
}

const heroPromo = computed(() => promos.value?.[0] ?? null)
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
      '@context': 'https://schema.org', '@type': 'Store', name: 'PARAGONKOM',
      description: 'Toko elektronik HP, laptop, tablet & aksesoris.',
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
  <div class="space-y-10 sm:space-y-12">
    <!-- BEST BUY HERO SHOWCASE (Royal Blue Banner with Yellow Tag CTA) -->
    <section class="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div class="grid gap-6 p-6 sm:grid-cols-[1.3fr_1fr] sm:items-center sm:p-10">
        <!-- Text & Value Prop -->
        <div class="space-y-4">
          <div class="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3.5 py-1 text-xs font-black text-brand-700">
            <Zap class="h-3.5 w-3.5 fill-brand-700" />
            Official Best Buy Storefront Integration
          </div>
          <h1 class="font-display text-3xl font-black tracking-tight text-stone-900 sm:text-5xl sm:leading-[1.1]">
            Gadget Resmi &amp; Elektronik, <span class="text-brand-700">Harga Jelas Transparan.</span>
          </h1>
          <p class="max-w-lg text-base leading-relaxed text-stone-600 font-medium">
            Temukan laptop, HP, &amp; aksesoris dari brand resmi. Cek ketersediaan stok live toko atau konsultasi spesifikasi langsung via Chat.
          </p>
          <div class="flex flex-col gap-3 pt-2 sm:flex-row">
            <!-- Best Buy Yellow Tag Button -->
            <NuxtLink
              to="/chat"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-promo-400 px-6 py-3 text-sm font-black text-stone-950 shadow-md transition-all duration-150 hover:bg-promo-500"
            >
              <MessageCircle class="h-4 w-4 fill-stone-950" />
              Chat &amp; Konsultasi Toko
            </NuxtLink>
            <Button size="lg" variant="outline" to="#katalog" class="font-bold border-stone-300">
              Lihat Katalog Produk
            </Button>
          </div>
          <div class="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs font-bold text-stone-600">
            <span class="inline-flex items-center gap-1.5"><CheckCircle2 class="h-4 w-4 text-emerald-600" /> Ready 1 Jam Ambil di Toko</span>
            <span class="inline-flex items-center gap-1.5"><Truck class="h-4 w-4 text-brand-700" /> Bebas Biaya Antar Direct</span>
          </div>
        </div>

        <!-- Best Buy Deal of the Day Card -->
        <div v-if="heroPromo" class="relative overflow-hidden rounded-2xl border-2 border-brand-700 bg-brand-700 p-5 text-white shadow-md">
          <div class="flex items-center justify-between pb-3 border-b border-brand-500">
            <div class="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-widest text-promo-400">
              <Flame class="h-4 w-4 fill-promo-400 text-promo-400" />
              Deal of the Day
            </div>
            <!-- Timer Countdown -->
            <div class="flex items-center gap-1 text-[11px] font-bold text-white">
              <Clock class="h-3.5 w-3.5 text-promo-400" />
              <span>Sisa:</span>
              <span class="rounded bg-brand-950 px-2 py-0.5 font-mono text-promo-400 font-black">{{ timer.hours }}:{{ timer.minutes }}:{{ timer.seconds }}</span>
            </div>
          </div>

          <NuxtLink :to="`/produk/${heroPromo.id}`" class="group mt-4 flex items-center gap-4">
            <ProductImage :image-url="heroPromo.image_url" :name="heroPromo.name" :category="heroPromo.category" size="thumb" class="h-24 w-24 shrink-0 !rounded-2xl border border-brand-500 bg-white" />
            <div class="min-w-0 flex-1">
              <span class="inline-block rounded bg-promo-400 px-2 py-0.5 text-[10px] font-black uppercase text-stone-950 shadow-xs">
                HEMAT {{ Math.round(heroPromo.discount_percentage || 0) }}%
              </span>
              <p class="mt-1 line-clamp-2 text-sm font-extrabold text-white group-hover:text-promo-400 transition-colors">
                {{ heroPromo.name }}
              </p>
              <p class="mt-1 text-xs text-brand-200 line-through">{{ formatIDR(heroPromo.price) }}</p>
              <p class="font-display text-2xl font-black tabular-nums text-promo-400">{{ formatIDR(heroPrice) }}</p>
            </div>
          </NuxtLink>

          <!-- Stok promo (data asli) -->
          <div class="mt-4 pt-3 border-t border-brand-600">
            <div class="flex items-center justify-between text-[11px] font-bold text-brand-100">
              <span>Stok Promo Terbatas</span>
              <span class="text-promo-400 font-extrabold">Sisa {{ heroPromo.current_stock }} unit</span>
            </div>
          </div>
        </div>

        <div v-else class="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm font-medium text-stone-600">
          Belum ada promo aktif saat ini. Katalog reguler tetap siap dipesan langsung.
        </div>
      </div>
    </section>

    <!-- SHOP BY BRAND (Best Buy Style Brand Filter) -->
    <section aria-label="Brand Resmi" class="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-2xs">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h2 class="font-display text-xs font-black uppercase tracking-wider text-brand-700">Shop by Official Brand</h2>
        <button v-if="selectedBrand" class="text-xs font-bold text-brand-700 hover:underline" @click="selectedBrand = ''">
          Reset Filter Brand
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="b in popularBrands"
          :key="b"
          :class="[
            'rounded-xl border px-4 py-2 text-xs font-black transition-all',
            selectedBrand === b
              ? 'border-brand-700 bg-brand-700 text-white shadow-xs'
              : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-brand-700 hover:bg-white'
          ]"
          @click="selectedBrand = selectedBrand === b ? '' : b"
        >
          {{ b }}
        </button>
      </div>
    </section>

    <!-- SHOP BY CATEGORY (Best Buy Category Icons) -->
    <section aria-label="Kategori">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="font-display text-lg font-black tracking-tight text-stone-900">Shop by Category</h2>
        <span class="text-xs font-bold text-stone-500">Pilih kategori elektronik</span>
      </div>
      <div class="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
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
    <section v-if="promos?.length" id="promo" class="scroll-mt-32">
      <div class="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
              <span class="text-promo-600">🔥 Top Deals Hari Ini</span>
            </h2>
            <span class="rounded-full bg-promo-600 px-2.5 py-0.5 text-xs font-black uppercase text-white shadow-2xs">
              BEST BUY DEALS
            </span>
          </div>
          <p class="mt-1 text-sm text-stone-600 font-medium">Penawaran terbatas dengan harga miring langsung dari katalog toko.</p>
        </div>
        <NuxtLink to="/#katalog" class="shrink-0 text-sm font-bold text-brand-700 hover:underline flex items-center gap-1">
          Lihat Semua Deals <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <ProductCard v-for="p in promos" :key="p.id" :product="p" />
      </div>
    </section>

    <!-- KATALOG UTAMA -->
    <section id="katalog" class="scroll-mt-32">
      <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 class="font-display text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
            {{ searchQuery ? `Hasil Pencarian “${searchQuery}”` : selectedBrand ? `Katalog Brand ${selectedBrand}` : 'Semua Katalog Produk' }}
          </h2>
          <p class="mt-0.5 text-sm text-stone-600 font-medium">
            {{ searchQuery ? `${catalog?.length || 0} produk ditemukan.` : 'Pilih kategori atau gunakan filter di atas.' }}
          </p>
        </div>

        <div class="flex items-center gap-2 mt-2 sm:mt-0">
          <label for="sort-select" class="text-xs font-bold text-stone-600">Urutkan:</label>
          <select id="sort-select" v-model="sort" aria-label="Urutkan Katalog" class="h-9 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 shadow-2xs focus:border-brand-700 focus:outline-hidden">
            <option value="">Paling Relevan</option>
            <option value="termurah">Harga Termurah</option>
            <option value="termahal">Harga Termahal</option>
            <option value="terbaru">Produk Terbaru</option>
          </select>
        </div>
      </div>

      <!-- Filter Category Pills -->
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <div class="modern-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
          <button
            :class="[
              'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              !activeCategory ? 'bg-brand-700 text-white shadow-xs' : 'border border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:text-brand-700'
            ]"
            @click="activeCategory = ''"
          >
            Semua Kategori
          </button>
          <button
            v-for="c in categories"
            :key="c"
            :class="[
              'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              activeCategory === c ? 'bg-brand-700 text-white shadow-xs' : 'border border-stone-300 bg-white text-stone-700 hover:border-brand-700 hover:text-brand-700'
            ]"
            @click="activeCategory = activeCategory === c ? '' : c"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- Catalog Loading State -->
      <div v-if="catalogPending" class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="i in 8" :key="i" class="h-72 animate-pulse rounded-2xl bg-stone-200/70" aria-label="Memuat produk" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!catalog?.length" class="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-xs">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Package class="h-6 w-6" />
        </div>
        <h3 class="mt-3 font-display font-bold text-stone-900">Produk Tidak Ditemukan</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-stone-600">Coba kata kunci lain atau konsultasikan unit yang kamu cari dengan Asisten Chat Toko.</p>
        <NuxtLink to="/chat" class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-promo-400 px-5 py-2.5 text-xs font-black text-stone-950 shadow-md">Tanya Lewat Chat</NuxtLink>
      </div>

      <!-- Product Grid -->
      <div v-else class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in catalog" :key="p.id" :product="p" />
      </div>
    </section>

    <!-- SERVICE TRUST PILLARS (Best Buy Totaltech Style) -->
    <section class="grid gap-4 sm:grid-cols-4">
      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Garansi Resmi 100%</h3>
          <p class="mt-0.5 text-xs text-stone-600">Semua produk tersegel original &amp; bergaransi resmi toko.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Truck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Store Pickup 1 Jam</h3>
          <p class="mt-0.5 text-xs text-stone-600">Siap ambil di toko dalam 1 jam atau pengiriman direct instan.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <QrCode class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Pembayaran QRIS</h3>
          <p class="mt-0.5 text-xs text-stone-600">Transaksi instan &amp; aman via scan QRIS tanpa biaya tambahan.</p>
        </div>
      </div>

      <div class="flex items-start gap-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-promo-100 text-promo-700">
          <MessageCircle class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-display text-sm font-bold text-stone-900">Asisten Chat Direct</h3>
          <p class="mt-0.5 text-xs text-stone-600">Konsultasi unit &amp; spesifikasi langsung tanpa daftar akun.</p>
        </div>
      </div>
    </section>

    <!-- CARA BELANJA: Receipt Note -->
    <section id="cara-belanja" class="scroll-mt-32">
      <div class="mx-auto max-w-2xl rounded-3xl border-2 border-dashed border-stone-300 bg-white p-6 sm:p-8 shadow-2xs">
        <div class="flex items-baseline justify-between border-b border-stone-200 pb-3">
          <h2 class="font-display text-lg font-black tracking-tight text-stone-900">PANDUAN LENGKAP BELANJA</h2>
          <span class="text-xs font-mono font-bold text-brand-700">PARAGONKOM NOTA</span>
        </div>
        <ol class="mt-5 space-y-4 text-sm leading-relaxed">
          <li class="flex gap-4">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">1</span>
            <p class="text-stone-700"><span class="font-bold text-stone-900">Pilih produk di katalog atau ceritakan budgetmu di Chat.</span> Contoh: “Laptop Asus budget 9 juta”.</p>
          </li>
          <li class="flex gap-4">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">2</span>
            <p class="text-stone-700"><span class="font-bold text-stone-900">Cek rincian spesifikasi &amp; ketersediaan stok.</span> Asisten toko akan mengecek database realtime.</p>
          </li>
          <li class="flex gap-4">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-white">3</span>
            <p class="text-stone-700"><span class="font-bold text-stone-900">Checkout langsung &amp; bayar via QRIS.</span> Pilih ambil di toko 1 jam atau pengiriman instan.</p>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>
