<script setup lang="ts">
import { MessageCircle, ShieldCheck, Truck } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { formatIDR } from '~/utils/format'
import { keySpecs } from '~/utils/product'
import { productView } from '~/utils/storefront'

definePageMeta({
  layout: 'default',
  // Key per-URL penuh: klik produk lain di "Mungkin kamu juga suka" HARUS
  // meremount halaman — sebelumnya instance dipakai ulang sehingga konten
  // produk lama tetap tampil di URL baru.
  key: route => route.fullPath
})

const route = useRoute()
const config = useRuntimeConfig()
const { settings } = useStoreSettings()
const base = (config.public.apiBase as string) || '/api/v1'
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const id = computed(() => String(route.params.id || ''))

// `error` dipisah dari "tidak ditemukan": kalau API/DB sedang gangguan, kita
// tampilkan "tidak bisa dimuat" + tombol muat ulang, BUKAN "Produk tidak ditemukan".
const { data: product, status: productStatus, error, refresh: refreshProduct } = useAsyncData(`produk-${id.value}`, async (_nuxtApp, { signal }) => {
  return await $fetch<ProductOut>(`${base}/catalog/${id.value}`, { signal })
}, { server: false, lazy: true, default: () => null as ProductOut | null })
const productPending = computed(() => productStatus.value === 'idle' || productStatus.value === 'pending')

// "Mungkin kamu juga suka": batch 8 + tombol "Muat lebih banyak".
const RELATED_PAGE_SIZE = 8
const relatedKey = `produk-related-${id.value}`

const { data: firstRelated, status: relatedStatus, error: relatedError, refresh: refreshRelated } = useAsyncData(
  relatedKey,
  async (_nuxtApp, { signal }) => {
    if (!product.value) return [] as ProductOut[]
    return await $fetch<ProductOut[]>(`${base}/catalog/search`, {
      query: { category: product.value.category, limit: RELATED_PAGE_SIZE, offset: 0, exclude: id.value }, signal
    })
  },
  { server: false, lazy: true, immediate: false, default: () => [] as ProductOut[] }
)
const relatedPending = computed(() => relatedStatus.value === 'idle' || relatedStatus.value === 'pending')
watch(() => product.value?.category, (category, previous) => {
  if (import.meta.client && category && (relatedStatus.value === 'idle' || category !== previous)) void refreshRelated()
}, { immediate: true })

// Akumulasi related yang sudah dimuat.
const related = ref<ProductOut[]>([])
const loadingMoreRelated = ref(false)
const hasMoreRelated = ref(false)
const relatedLoadError = ref('')
let relatedGeneration = 0

watch(firstRelated, (v) => {
  relatedGeneration++
  related.value = v ?? []
  hasMoreRelated.value = (v?.length ?? 0) === RELATED_PAGE_SIZE
}, { immediate: true })

async function loadMoreRelated() {
  if (loadingMoreRelated.value || relatedPending.value || !hasMoreRelated.value || !product.value) return
  const generation = relatedGeneration
  relatedLoadError.value = ''
  loadingMoreRelated.value = true
  try {
    const next = await $fetch<ProductOut[]>(`${base}/catalog/search`, {
      query: { category: product.value.category, limit: RELATED_PAGE_SIZE, offset: related.value.length, exclude: id.value }
    })
    if (generation !== relatedGeneration) return
    related.value = [...related.value, ...(next ?? [])]
    hasMoreRelated.value = (next?.length ?? 0) === RELATED_PAGE_SIZE
  } catch {
    if (generation === relatedGeneration) relatedLoadError.value = 'Gagal memuat produk berikutnya. Coba lagi.'
  } finally {
    loadingMoreRelated.value = false
  }
}

// 404 = produk memang tidak ada/nonaktif; >= 500 = gangguan katalog.
const isNotFound = computed(() => (error.value?.statusCode ?? 0) === 404)

// Gagal memuat = notifikasi pop-up; kartu di bawah tetap ada karena memuat
// tombol muat ulang. 404 tidak di-toast — panelnya sudah menjelaskan.
const toast = useToast()
watch(error, (err) => {
  if (err && err.statusCode !== 404) toast.error('Produk tidak bisa dimuat. Koneksi ke database toko sedang terganggu.')
})

const observedProducts = computed(() => [...(product.value ? [product.value] : []), ...related.value])
const { now, refreshError, refreshExpired } = useStorefrontClock(observedProducts, async () => {
  await refreshProduct()
  if (error.value) throw new Error('Harga terbaru belum bisa dimuat.')
  if (product.value) await refreshRelated({ dedupe: 'defer' })
  if (relatedError.value) throw new Error('Harga produk terkait belum bisa dimuat.')
})
const view = computed(() => product.value ? productView(product.value, now.value) : null)
const promo = computed(() => view.value?.discount !== null && !!view.value)
const finalPrice = computed(() => view.value?.price ?? 0)
const soldOut = computed(() => !view.value?.available)
const chatLink = computed(() => `/chat?tanya=${encodeURIComponent(product.value ? `Apakah ${product.value.name} masih ada stok?` : '')}`)
const topSpecs = computed(() => product.value ? keySpecs(product.value.specification) : [])

const pageTitle = computed(() => product.value ? `${product.value.name}: Harga & Spesifikasi` : `Produk: ${settings.value.store_name}`)
const canonicalUrl = computed(() => `${siteUrl}/produk/${id.value}`)
/** OG absolut: URL eksternal dibiarkan apa adanya, path lokal diprefiks siteUrl. */
const ogProductImage = computed(() => {
  const img = product.value?.image_url
  if (!img) return `${siteUrl}/og-image.png`
  if (/^https?:\/\//i.test(img)) return img
  return `${siteUrl}${img.startsWith('/') ? '' : '/'}${img}`
})

useSeoMeta({
  title: pageTitle,
  description: () => product.value
    ? `${product.value.name} (${product.value.category}) — ${formatIDR(finalPrice.value)}. Stok ${product.value.current_stock}; checkout langsung tanpa daftar akun.`
    : `Produk di katalog ${settings.value.store_name}.`,
  ogTitle: () => product.value ? `${product.value.name} — ${formatIDR(finalPrice.value)}` : settings.value.store_name,
  ogDescription: () => product.value ? `${product.value.name} (${product.value.category}). Stok ${product.value.current_stock}, checkout langsung.` : '',
  ogType: 'website',
  ogUrl: canonicalUrl,
  ogImage: ogProductImage,
  ogLocale: 'id_ID',
  twitterCard: 'summary_large_image'
})
useHead(() => ({
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  script: product.value ? [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: product.value.name, category: product.value.category,
        image: product.value.image_urls.length ? product.value.image_urls : undefined,
        offers: {
          '@type': 'Offer', url: canonicalUrl.value,
          priceCurrency: 'IDR', price: finalPrice.value,
          availability: soldOut.value ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'
        }
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: product.value.category, item: `${siteUrl}/rak/${encodeURIComponent(product.value.category)}` },
          { '@type': 'ListItem', position: 3, name: product.value.name, item: canonicalUrl.value }
        ]
      })
    }
  ] : []
}))
</script>

<template>
  <div class="space-y-10 max-[320px]:min-w-0 max-[320px]:[overflow-wrap:anywhere]">
    <nav aria-label="Breadcrumb" class="text-xs font-medium text-stone-500">
      <ol class="flex flex-wrap items-center gap-1.5">
        <li><NuxtLink to="/" class="hover:text-brand-700">Beranda</NuxtLink></li>
        <li aria-hidden="true">/</li>
        <li>
          <NuxtLink :to="product?.category ? `/rak/${encodeURIComponent(product.category)}` : '/#katalog'" class="hover:text-brand-700">
            {{ product?.category || 'Katalog' }}
          </NuxtLink>
        </li>
        <li aria-hidden="true">/</li>
        <li class="line-clamp-1 text-stone-800 max-[320px]:line-clamp-none">{{ product?.name || 'Produk' }}</li>
      </ol>
    </nav>

    <div v-if="productPending" class="grid gap-6 lg:grid-cols-2" role="status" aria-label="Memuat detail produk" aria-busy="true">
      <span class="sr-only">Memuat detail produk…</span>
      <div class="store-skeleton aspect-square rounded-2xl sm:aspect-[4/3]" aria-hidden="true" />
      <div class="min-w-0 space-y-4" aria-hidden="true">
        <div class="store-skeleton h-4 w-24 rounded" />
        <div class="store-skeleton h-9 w-3/4 rounded" />
        <div class="store-skeleton h-32 rounded-xl" />
        <div class="store-skeleton h-12 rounded-xl" />
        <div class="store-skeleton h-40 rounded-xl" />
      </div>
    </div>

    <!-- Error katalog bukan berarti produk hilang. -->
    <div v-else-if="error && !isNotFound" class="rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 p-8 text-center max-[320px]:p-3" role="alert">
      <h1 class="font-display text-xl font-bold text-stone-900">Produk tidak bisa dimuat</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Koneksi ke database toko sedang terganggu — bukan berarti produknya sudah hilang. Coba muat ulang beberapa saat lagi.</p>
      <div class="mt-5 flex justify-center gap-2 max-[320px]:flex-col max-[320px]:[&>a]:h-auto max-[320px]:[&>a]:whitespace-normal max-[320px]:[&>button]:h-auto max-[320px]:[&>button]:whitespace-normal">
        <Button variant="ai" @click="refreshProduct()">Muat Ulang</Button>
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
      </div>
    </div>

    <div v-else-if="!product" class="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center max-[320px]:p-3">
      <h1 class="font-display text-xl font-bold text-stone-900">Produk tidak ditemukan</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Mungkin sudah nonaktif atau tautannya keliru. Coba cari di katalog atau tanya lewat chat.</p>
      <div class="mt-5 flex justify-center gap-2 max-[320px]:flex-col max-[320px]:[&>a]:h-auto max-[320px]:[&>a]:whitespace-normal">
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
        <Button to="/chat" variant="ai">Chat toko</Button>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-2 max-[320px]:grid-cols-1">
      <ProductGallery :image-urls="product.image_urls" :name="product.name" :category="product.category">
        <span v-if="promo" class="absolute left-3 top-3 rounded-md bg-promo-700 px-2.5 py-1 text-xs font-bold text-white">
          -{{ view?.discount }}%
        </span>
      </ProductGallery>

      <div class="space-y-4 max-[320px]:min-w-0">
        <div>
          <p class="text-xs font-semibold text-stone-500">{{ product.category }}</p>
          <h1 class="mt-1 font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{{ product.name }}</h1>
        </div>

        <!-- Blok harga: hierarki marketplace -->
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p v-if="promo" class="text-sm text-stone-500 line-through">{{ formatIDR(view?.compareAt) }}</p>
          <p class="font-display text-3xl font-extrabold tabular-nums [overflow-wrap:anywhere]" :class="promo ? 'text-promo-700' : 'text-stone-900'">{{ formatIDR(finalPrice) }}</p>
          <p v-if="promo && product.promotion" class="mt-1 text-xs text-stone-500">
            Promo s.d. {{ new Date(product.promotion.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
          </p>
          <p class="mt-2 text-sm font-medium" :class="soldOut ? 'text-rose-600' : product.is_low_stock ? 'text-amber-700' : 'text-emerald-600'">
            <template v-if="soldOut">Stok habis — tanya restock lewat chat</template>
            <template v-else-if="product.is_low_stock">Sisa {{ product.current_stock }} unit</template>
            <template v-else>Stok tersedia: {{ product.current_stock }} unit</template>
          </p>
        </div>

        <!-- Spek unggulan ala marketplace (otomatis dari key prioritas, maks. 4) -->
        <div v-if="topSpecs.length" class="flex flex-wrap gap-2">
          <div v-for="spec in topSpecs" :key="spec.key" class="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1.5 max-[320px]:min-w-0 max-[320px]:max-w-full">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-brand-600">{{ spec.label }}</p>
            <p class="text-xs font-bold text-brand-900">{{ spec.value }}</p>
          </div>
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <Button v-if="!soldOut" :to="`/checkout?item=${product.id}`" variant="ai" size="lg" class="min-h-11 h-auto whitespace-normal">
            Beli sekarang
          </Button>
          <Button :to="chatLink" :variant="soldOut ? 'ai' : 'outline'" size="lg" class="min-h-11 h-auto whitespace-normal">
            <MessageCircle aria-hidden="true" class="h-4 w-4" /> {{ soldOut ? 'Tanya stok' : 'Tanya via chat' }}
          </Button>
        </div>
        <div v-if="refreshError" role="alert" class="store-error"><p>{{ refreshError }}</p><Button variant="outline" class="mt-3" @click="refreshExpired">Muat ulang harga</Button></div>

        <ul class="space-y-1.5 rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
          <li class="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" class="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Checkout tanpa daftar akun. Isi data, lalu konfirmasi pesanan.</li>
          <li class="flex items-center gap-1.5"><Truck class="h-3.5 w-3.5 shrink-0 text-stone-500" /> Ambil: Cash / QRIS · Antar: QRIS dengan bukti pembayaran</li>
        </ul>

        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <h2 class="font-display text-sm font-bold text-stone-900">Spesifikasi Produk</h2>
          <ProductSpecifications class="mt-3 max-[320px]:[&_dl>div]:grid-cols-1" :specification="product.specification" />
        </div>
      </div>
    </div>

    <section v-if="product">
      <h2 class="mb-4 font-display text-xl font-bold text-stone-900">Produk di kategori yang sama</h2>
      <ProductGrid :products="related" :now="now" :pending="relatedPending" :error="!!relatedError" empty-title="Belum ada produk terkait" empty-message="Lihat kategori lainnya di katalog toko." @retry="refreshRelated()">
        <template #load-more>
          <div v-if="hasMoreRelated" class="store-load-more">
            <p v-if="relatedLoadError" role="alert" class="store-field-error">{{ relatedLoadError }}</p>
            <Button variant="outline" :loading="loadingMoreRelated" @click="loadMoreRelated">{{ relatedLoadError ? 'Coba lagi muat produk' : 'Muat lebih banyak' }}</Button>
          </div>
        </template>
      </ProductGrid>
    </section>
  </div>
</template>
