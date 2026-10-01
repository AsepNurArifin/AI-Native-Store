<script setup lang="ts">
import { ShieldCheck, Truck, QrCode, MessageCircle, Store, Flame, ChevronRight, Zap } from '@lucide/vue'

const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || '/api/v1'
const route = useRoute()

const searchText = ref(typeof route.query.q === 'string' ? route.query.q : '')
const quickSearches = ['MacBook M3', 'iPhone 15', 'Gaming Laptop', 'Monitor 180Hz', 'AirPods', 'SSD 1TB']

const { data: categories } = await useAsyncData('layout-categories', async () => {
  try {
    return await $fetch<string[]>(`${base}/catalog/categories`)
  }
  catch { return [] as string[] }
}, { default: () => [] as string[] })

function goSearch(q: string) {
  const keyword = q.trim()
  if (!keyword) return
  navigateTo({ path: '/', hash: '#katalog', query: { q: keyword } })
  searchText.value = keyword
}
</script>

<template>
  <div class="min-h-screen bg-stone-50 text-stone-900 antialiased selection:bg-brand-700 selection:text-white">
    <!-- Header Best Buy Style (Royal Blue #0046BE) -->
    <header class="sticky top-0 z-40 shadow-md">
      <!-- Tier 1: Top Utility Strip (Deep Navy #001E60) -->
      <div class="bg-brand-900 text-xs text-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 font-medium sm:px-6">
          <div class="flex items-center gap-6">
            <span class="inline-flex items-center gap-1.5 text-promo-400 font-bold">
              <Zap class="h-3.5 w-3.5 fill-promo-400" />
              Ready 1 Jam Ambil di Toko
            </span>
            <span class="hidden sm:inline-flex items-center gap-1.5 text-white/90">
              <Truck class="h-3.5 w-3.5 text-brand-300" />
              Bebas Biaya Antar Direct
            </span>
            <span class="hidden md:inline-flex items-center gap-1.5 text-emerald-300">
              <QrCode class="h-3.5 w-3.5" />
              Bayar Instan via QRIS
            </span>
          </div>
          <div class="flex items-center gap-4 text-white/80">
            <NuxtLink to="/chat" class="hover:text-promo-400 transition-colors">Tanya Stok Toko</NuxtLink>
            <span>•</span>
            <NuxtLink to="/#cara-belanja" class="hover:text-promo-400 transition-colors">Nota &amp; Panduan</NuxtLink>
          </div>
        </div>
      </div>

      <!-- Tier 2: Royal Blue Masthead (#0046BE) -->
      <div class="bg-brand-700 text-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-6 sm:px-6">
          <!-- Logo PARAGONKOM Best Buy Styled -->
          <NuxtLink to="/" class="group flex shrink-0 items-center gap-2">
            <div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-promo-400 text-stone-950 font-black shadow-md transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11">
              <Store class="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div class="min-w-0">
              <div class="whitespace-nowrap font-display text-lg font-black tracking-tight text-white sm:text-2xl">
                PARAGON<span class="text-promo-400">KOM</span>
              </div>
              <div class="hidden text-[10px] font-extrabold uppercase tracking-widest text-brand-200 sm:block">
                Electronics Marketplace
              </div>
            </div>
          </NuxtLink>

          <!-- Large Best Buy Integrated Search Input -->
          <div class="hidden min-w-0 flex-1 md:block">
            <SearchBar v-model="searchText" placeholder="Cari laptop, iPhone, SSD, spesifikasi…" @submit="goSearch" />
            <div class="mt-1 flex items-center gap-2 text-[11px] text-brand-100">
              <span class="font-bold text-promo-400">Pencarian Populer:</span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="q in quickSearches"
                  :key="q"
                  type="button"
                  class="hover:text-promo-400 hover:underline transition-colors"
                  @click="goSearch(q)"
                >
                  {{ q }}
                </button>
              </div>
            </div>
          </div>

          <!-- Action Nav (Yellow Tag CTA) -->
          <nav class="ml-auto flex shrink-0 items-center gap-2 text-sm font-bold">
            <NuxtLink
              to="/#katalog"
              class="hidden whitespace-nowrap rounded-lg px-3.5 py-2 text-white transition-colors hover:bg-brand-800 lg:inline-flex"
            >
              Katalog
            </NuxtLink>
            <NuxtLink
              to="/#promo"
              class="hidden whitespace-nowrap rounded-lg px-3.5 py-2 text-promo-400 bg-brand-800/80 transition-colors hover:bg-brand-800 lg:inline-flex"
            >
              🔥 Deals Hari Ini
            </NuxtLink>
            <!-- Best Buy Yellow Tag Button -->
            <NuxtLink
              to="/chat"
              class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-promo-400 px-3.5 py-2.5 text-xs font-black text-stone-950 shadow-md transition-all duration-150 hover:bg-promo-500 sm:px-4 sm:text-sm"
            >
              <MessageCircle class="h-4 w-4 fill-stone-950" />
              <span class="hidden sm:inline">Belanja via Chat</span>
              <span class="sm:hidden">Chat</span>
            </NuxtLink>
          </nav>
        </div>
      </div>

      <!-- Mobile Search Input Bar -->
      <div class="bg-brand-800 md:hidden px-4 py-2.5 border-t border-brand-600">
        <SearchBar v-model="searchText" placeholder="Cari HP, laptop, aksesoris…" @submit="goSearch" />
      </div>

      <!-- Tier 3: Sub-Navigation Category Bar (#003899) -->
      <div v-if="categories?.length" class="bg-brand-800 border-t border-brand-600">
        <nav aria-label="Kategori" class="modern-scrollbar mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6">
          <span class="hidden text-xs font-black tracking-wider uppercase text-promo-400 lg:inline-block pr-2">Kategori:</span>
          <NuxtLink
            v-for="c in categories"
            :key="c"
            :to="`/rak/${encodeURIComponent(c)}`"
            class="shrink-0 whitespace-nowrap rounded-lg bg-brand-900/60 px-3.5 py-1 text-xs font-bold text-white transition-colors hover:bg-promo-400 hover:text-stone-950"
          >
            {{ c }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>

    <!-- Footer Best Buy Multi-Column -->
    <footer class="border-t border-stone-200 bg-stone-900 text-xs text-stone-300 pt-12 pb-8">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-4 sm:px-6">
        <div class="space-y-3">
          <div class="flex items-center gap-2 font-display text-lg font-black text-white">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-promo-400 text-stone-950">
              <Store class="h-4 w-4" />
            </div>
            PARAGONKOM
          </div>
          <p class="leading-relaxed text-stone-400">
            Tech &amp; Electronics Marketplace terpercaya. Cek harga realtime, garansi resmi, &amp; konsultasi spesifikasi langsung via Chat.
          </p>
          <p class="font-bold text-promo-400">
            📍 Ready Store Pickup dalam 1 Jam · Pembayaran QRIS
          </p>
        </div>

        <div>
          <p class="font-bold uppercase tracking-wider text-white">Katalog Utama</p>
          <ul class="mt-3 space-y-2 font-medium text-stone-400">
            <li v-for="c in categories?.slice(0, 5)" :key="c">
              <NuxtLink :to="`/rak/${encodeURIComponent(c)}`" class="hover:text-promo-400 flex items-center gap-1 transition-colors">
                <ChevronRight class="h-3 w-3 text-stone-500" />
                {{ c }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <p class="font-bold uppercase tracking-wider text-white">Belanja &amp; Layanan</p>
          <ul class="mt-3 space-y-2 font-medium text-stone-400">
            <li><NuxtLink to="/#katalog" class="hover:text-promo-400 transition-colors">Katalog Produk</NuxtLink></li>
            <li><NuxtLink to="/#promo" class="hover:text-promo-400 transition-colors">🔥 Top Deals Hari Ini</NuxtLink></li>
            <li><NuxtLink to="/chat" class="hover:text-promo-400 transition-colors">Chat &amp; Tanya Stok</NuxtLink></li>
            <li><NuxtLink to="/#cara-belanja" class="hover:text-promo-400 transition-colors">Panduan Nota Belanja</NuxtLink></li>
          </ul>
        </div>

        <div>
          <p class="font-bold uppercase tracking-wider text-white">Akses Admin</p>
          <ul class="mt-3 space-y-2 font-medium text-stone-400">
            <li><NuxtLink to="/login" class="text-stone-400 hover:text-white transition-colors">Dashboard Admin Toko</NuxtLink></li>
            <li><span class="text-stone-500">Jam Operasional: 09.00 - 21.00 WIB</span></li>
          </ul>
        </div>
      </div>

      <div class="mx-auto mt-10 max-w-7xl border-t border-stone-800 pt-6 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-stone-500">
        <p>© 2026 PARAGONKOM Electronics. Inspired by Best Buy Storefront Standards.</p>
        <p class="text-[11px] text-stone-400">Official Best Buy Design System Integration</p>
      </div>
    </footer>
  </div>
</template>
