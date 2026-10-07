<script setup lang="ts">
import type { ProductOut } from '~/utils/api-types'

definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || '/api/v1'
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

const category = computed(() => decodeURIComponent(String(route.params.category || '')))
const categoryPath = computed(() => `/rak/${encodeURIComponent(category.value)}`)
const q = ref('')
const qDebounced = ref('')
const sort = ref('')
const promoOnly = ref(false)

const { getCachedData } = useCache()
// Tanpa try/catch: error diteruskan ke `fetchError` (bukan "rak kosong" palsu).
// Key reaktif per kategori+filter: ganti kategori/filter = key baru = refetch
// otomatis; balik ke rak yang sama = tampil instan dari cache.
const { data: products, pending, error: fetchError, refresh } = await useAsyncData(
  computed(() => `rak:${category.value}:${qDebounced.value}:${sort.value}:${promoOnly.value}`),
  () => $fetch<ProductOut[]>(`${base}/catalog/search`, {
    query: { category: category.value, q: qDebounced.value || undefined, sort: sort.value || undefined, promo_only: promoOnly.value ? 'true' : undefined, limit: 60 }
  }),
  { default: () => [] as ProductOut[], getCachedData }
)

// Debounce ketikan -> key baru -> refetch otomatis.
let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => { qDebounced.value = q.value }, 350)
})

const pageTitle = computed(() => `${category.value}: Harga & Stok`)
useSeoMeta({
  title: pageTitle,
  description: () => `Daftar ${category.value} di SHAF STORE: harga, promo, dan stok terbaru. Pesan lewat chat tanpa daftar akun.`,
  ogTitle: pageTitle,
  ogDescription: () => `${category.value} di SHAF STORE — harga jelas, pesan lewat chat.`,
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

const loadError = computed(() => fetchError.value ? 'Rak tidak bisa dimuat sekarang (backend sedang tidak aktif?).' : '')
</script>

<template>
  <div class="space-y-6">
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
        {{ products?.length || 0 }} produk aktif di rak ini. Klik kartu untuk detail, atau tanya lewat chat bila butuh bantuan memilih.
      </p>
    </div>

    <div class="flex flex-col gap-2.5 rounded-xl border border-stone-200 bg-white p-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <input
          v-model="q"
          type="search"
          placeholder="Cari di rak ini…"
          aria-label="Cari di rak ini"
          class="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm placeholder:text-stone-500 focus:border-brand-500 focus:outline-2 focus:outline-brand-600"
        />
      </div>
      <div class="flex items-center gap-2">
        <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600">
          <input v-model="promoOnly" type="checkbox" class="h-4 w-4 accent-brand-700" />
          Promo saja
        </label>
        <select v-model="sort" aria-label="Urutkan" class="h-10 rounded-lg border border-stone-300 bg-white px-2 text-xs font-medium text-stone-700">
          <option value="">Paling relevan</option>
          <option value="termurah">Termurah</option>
          <option value="termahal">Termahal</option>
          <option value="terbaru">Terbaru</option>
        </select>
      </div>
    </div>

    <p v-if="loadError" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {{ loadError }}
      <button class="ml-2 font-semibold underline" @click="() => refresh()">Coba lagi</button>
    </p>

    <div v-else-if="pending" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="i in 8" :key="i" class="h-64 animate-pulse rounded-xl bg-stone-100" aria-label="Memuat produk" />
    </div>

    <div v-else-if="!products?.length" class="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-8 text-center">
      <h2 class="font-display font-bold text-stone-800">Rak ini sedang kosong</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
        Tidak ada produk yang cocok dengan filter. Coba ubah kata kunci, atau tanya langsung di chat.
      </p>
      <Button to="/chat" variant="ai" class="mt-5">Tanya lewat chat</Button>
    </div>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <ProductCard v-for="p in products" :key="p.id" :product="p" />
    </div>
  </div>
</template>
