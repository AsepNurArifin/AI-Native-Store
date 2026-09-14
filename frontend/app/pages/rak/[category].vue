<script setup lang="ts">
/*
 * Halaman rak: daftar produk satu kategori, langsung dari katalog publik.
 * Pembeli mendarat di sini saat memilih rak di storefront — bukan di chat.
 * Motif: kartu produk ala etalase toko (badge kategori + stok + harga +
 * spesifikasi collapsible), konsisten dengan kartu rekomendasi ChatWidget.
 */
import type { ProductOut } from '~/utils/api-types'

/* SSR ala storefront: nama + harga ikut ter-render di HTML, bukan
   hanya setelah hydration. */
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'

const category = computed(() => decodeURIComponent(String(route.params.category || '')))

const { data: products, error: fetchError, pending } = await useAsyncData(
  () => `rak-${category.value}`,
  () => $fetch<ProductOut[]>(`${base}/catalog/products`, { query: { category: category.value } }),
  { watch: [category], default: () => [] as ProductOut[] }
)

const error = computed(() => fetchError.value ? 'Rak tidak bisa dimuat sekarang (backend sedang tidak aktif?).' : '')
const loading = computed(() => pending.value)

useHead(() => ({ title: `Rak ${category.value}: Toko Bu Ratna` }))
function retry() {
  void refreshNuxtData(`rak-${category.value}`)
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <NuxtLink to="/#rak" class="text-sm text-clay-700 hover:underline">Kembali ke daftar rak</NuxtLink>
      <h1 class="font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
        Rak {{ category }}
      </h1>
      <p class="max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
        Isi rak ini diambil langsung dari katalog toko. Cek spesifikasi dan stoknya
        di sini, atau sebut saja di chat kalau butuh bantuan memilih.
      </p>
    </div>

    <p v-if="error" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {{ error }}
      <button class="ml-2 font-semibold underline" @click="retry">Coba lagi</button>
    </p>

    <div v-else-if="loading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-36 animate-pulse rounded-2xl bg-stone-100" aria-label="Memuat produk" />
    </div>

    <div v-else-if="!products.length" class="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-8 text-center">
      <h2 class="font-display font-bold text-stone-800">Rak ini sedang kosong</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
        Belum ada produk aktif di kategori {{ category }}. Coba rak lain,
        atau tanya langsung di chat: asisten mencari dari seluruh katalog.
      </p>
      <Button to="/chat" class="mt-5 bg-clay-700 hover:bg-clay-800">Tanya lewat chat</Button>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="p in products"
        :key="p.id"
        class="flex flex-col rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs transition-colors hover:border-clay-300"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
            {{ p.category }}
          </span>
          <span class="text-[11px] font-medium" :class="p.current_stock > 5 ? 'text-emerald-600 ' : 'text-amber-700 '">
            Stok: {{ p.current_stock }}
          </span>
        </div>
        <h2 class="mt-2 font-medium text-stone-900 text-sm [overflow-wrap:anywhere]">{{ p.name }}</h2>
        <p class="mt-1 font-display font-bold text-clay-700 text-base">
          {{ formatIDR(p.price) }}
        </p>
        <details class="mt-3 min-w-0">
          <summary class="cursor-pointer rounded text-xs font-semibold text-clay-700 hover:text-clay-600 focus-visible:outline-2 focus-visible:outline-clay-600 focus-visible:outline-offset-2 active:text-clay-800">Lihat spesifikasi</summary>
          <ProductSpecifications class="mt-3" :specification="p.specification" />
        </details>
      </div>
    </div>

    <div class="rounded-2xl border border-clay-200/70 bg-clay-50/60 px-6 py-8 text-center sm:px-10">
      <h2 class="font-display text-lg font-bold text-stone-900">Tidak ketemu yang cocok?</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
        Sebut anggaran atau spesifikasi yang kamu butuhkan di chat,
        asisten memeriksa seluruh katalog termasuk rak yang lain.
      </p>
      <Button to="/chat" class="mt-4 bg-clay-700 hover:bg-clay-800">Chat Toko Bu Ratna</Button>
    </div>
  </div>
</template>
