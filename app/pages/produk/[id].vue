<script setup lang="ts">
import { MessageCircle, ShieldCheck, ShoppingCart, Truck } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { formatIDR } from '~/utils/format'
import { effectivePrice, hasPromo, keySpecs } from '~/utils/product'

definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || '/api/v1'
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const id = computed(() => String(route.params.id || ''))

const { data: product, error } = await useAsyncData(`produk-${id.value}`, async () => {
  return await $fetch<ProductOut>(`${base}/catalog/${id.value}`)
}, { default: () => null as ProductOut | null })

const { data: related } = await useAsyncData(`produk-related-${id.value}`, async () => {
  if (!product.value) return [] as ProductOut[]
  try {
    const list = await $fetch<ProductOut[]>(`${base}/catalog/search`, { query: { category: product.value.category, limit: 9 } })
    return list.filter(p => p.id !== id.value).slice(0, 4)
  }
  catch { return [] as ProductOut[] }
}, { default: () => [] as ProductOut[] })

const promo = computed(() => product.value ? hasPromo(product.value) : false)
const finalPrice = computed(() => product.value ? effectivePrice(product.value) : 0)
const soldOut = computed(() => (product.value?.current_stock ?? 0) <= 0)
const chatLink = computed(() => `/chat?tanya=${encodeURIComponent(product.value ? `Apakah ${product.value.name} masih ada stok?` : '')}`)
const topSpecs = computed(() => product.value ? keySpecs(product.value.specification) : [])

const pageTitle = computed(() => product.value ? `${product.value.name}: Harga & Spesifikasi` : 'Produk: SHAF STORE')
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
    : 'Produk di katalog SHAF STORE.',
  ogTitle: () => product.value ? `${product.value.name} — ${formatIDR(finalPrice.value)}` : 'SHAF STORE',
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
        image: product.value.image_url || undefined,
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
  <div class="space-y-10">
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
        <li class="line-clamp-1 text-stone-800">{{ product?.name || 'Produk' }}</li>
      </ol>
    </nav>

    <div v-if="error || !product" class="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <h1 class="font-display text-xl font-bold text-stone-900">Produk tidak ditemukan</h1>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Mungkin sudah nonaktif atau tautannya keliru. Coba cari di katalog atau tanya lewat chat.</p>
      <div class="mt-5 flex justify-center gap-2">
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
        <Button to="/chat" variant="ai">Chat toko</Button>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-2">
      <div class="relative">
        <ProductImage :image-url="product.image_url" :name="product.name" :category="product.category" size="detail" />
        <span v-if="promo" class="absolute left-3 top-3 rounded-md bg-promo-700 px-2.5 py-1 text-xs font-bold text-white">
          -{{ Math.round(product.discount_percentage || 0) }}%
        </span>
      </div>

      <div class="space-y-4">
        <div>
          <p class="text-xs font-semibold text-stone-500">{{ product.category }}</p>
          <h1 class="mt-1 font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{{ product.name }}</h1>
        </div>

        <!-- Blok harga: hierarki marketplace -->
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p v-if="promo" class="text-sm text-stone-400 line-through">{{ formatIDR(product.price) }}</p>
          <p class="font-display text-3xl font-extrabold tabular-nums" :class="promo ? 'text-promo-700' : 'text-stone-900'">{{ formatIDR(finalPrice) }}</p>
          <p v-if="promo && product.promotion" class="mt-1 text-xs text-stone-500">
            Promo s.d. {{ new Date(product.promotion.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
          </p>
          <p class="mt-2 text-sm font-medium" :class="soldOut ? 'text-rose-600' : product.is_low_stock ? 'text-amber-700' : 'text-emerald-600'">
            <template v-if="soldOut">Stok habis — tanya restock lewat chat</template>
            <template v-else-if="product.is_low_stock">Sisa {{ product.current_stock }} unit — siapa cepat</template>
            <template v-else>Stok tersedia: {{ product.current_stock }} unit</template>
          </p>
        </div>

        <!-- Spek unggulan ala marketplace (otomatis dari key prioritas, maks. 4) -->
        <div v-if="topSpecs.length" class="flex flex-wrap gap-2">
          <div v-for="spec in topSpecs" :key="spec.key" class="rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1.5">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-brand-600">{{ spec.label }}</p>
            <p class="text-xs font-bold text-brand-900">{{ spec.value }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row">
          <Button v-if="!soldOut" :to="`/checkout?item=${product.id}`" variant="ai" size="lg" class="flex-1 justify-center">
            <ShoppingCart class="h-4 w-4" />
            Beli sekarang
          </Button>
          <Button :to="chatLink" :variant="soldOut ? 'ai' : 'outline'" size="lg" :class="soldOut ? 'flex-1 justify-center' : ''">
            <MessageCircle class="h-4 w-4" />
            {{ soldOut ? 'Tanya restock' : 'Tanya via chat' }}
          </Button>
        </div>

        <ul class="space-y-1.5 rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
          <li class="inline-flex items-center gap-1.5"><ShieldCheck class="h-3.5 w-3.5 text-emerald-600" /> Stok dicek ulang atomik saat konfirmasi</li>
          <li class="flex items-center gap-1.5"><Truck class="h-3.5 w-3.5 text-stone-500" /> Ambil di toko atau diantar · bayar via QRIS</li>
        </ul>

        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <h2 class="font-display text-sm font-bold text-stone-900">Spesifikasi Produk</h2>
          <ProductSpecifications class="mt-3" :specification="product.specification" />
        </div>
      </div>
    </div>

    <section v-if="related?.length">
      <h2 class="font-display text-lg font-bold text-stone-900">Mungkin kamu juga suka</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProductCard v-for="p in related" :key="p.id" :product="p" />
      </div>
    </section>
  </div>
</template>
