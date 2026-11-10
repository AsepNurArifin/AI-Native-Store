<script setup lang="ts">
import type { StorefrontProduct } from '~/utils/storefront'
import { formatIDR, formatWIB } from '~/utils/format'
import { ArrowUpRight, ArrowRight, MessageCircle } from '@lucide/vue'
const { settings } = await useStoreSettings()
defineProps<{ products: StorefrontProduct[], pending?: boolean, error?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="store-hero" :class="{ 'store-hero-with-aside': products.length > 1 }" :aria-label="`Pilihan promo ${settings.store_name}`">
    <article class="store-hero-main storefront-dark">
      <div class="store-hero-copy">
        <p class="store-eyebrow">{{ settings.store_name }} · Gadget pilihan</p>
        <h1>{{ products[0] ? 'Pilihan tepat.\nHarga lebih hemat.' : 'Gadget pilihan.\nHarga transparan.' }}</h1>
        <template v-if="products[0]">
          <p class="store-hero-product">{{ products[0].name }}</p>
          <p class="store-hero-compare">{{ formatIDR(products[0].compareAt) }}</p>
          <p class="store-hero-price">{{ products[0].priceLabel }}</p>
          <p class="store-hero-deadline">Hemat {{ products[0].discount }}% · sampai {{ formatWIB(products[0].endDate) }}</p>
          <NuxtLink :to="products[0].href" class="store-gold-link">Lihat produk <ArrowUpRight aria-hidden="true" class="size-4" /></NuxtLink>
        </template>
        <template v-else>
          <p class="store-hero-intro">Temukan iPhone, iPad, Apple Watch, AirPods dan Samsung Galaxy. Cek spesifikasi, masuk, lalu tinjau pesananmu.</p>
          <div class="store-actions">
            <NuxtLink to="/#katalog" class="store-gold-link">Lihat katalog <ArrowRight aria-hidden="true" class="size-4" /></NuxtLink>
            <NuxtLink to="/chat" class="store-hero-chat"><MessageCircle aria-hidden="true" class="size-4" /> Tanya via chat</NuxtLink>
          </div>
        </template>
        <p v-if="pending" role="status" class="store-hero-state">Memuat promo toko…</p>
        <button v-else-if="error" type="button" class="store-hero-state store-hero-retry" @click="$emit('retry')">Promo belum bisa dimuat. Coba lagi</button>
      </div>
      <NuxtLink v-if="products[0]" :to="products[0].href" class="store-hero-image" :aria-label="`Lihat ${products[0].name}`">
        <ProductImage :image-url="products[0].image" :name="products[0].name" :category="products[0].category" eager />
        <span class="store-hero-discount">−{{ products[0].discount }}%</span>
      </NuxtLink>
      <div v-else class="store-hero-brand" aria-hidden="true"><img src="/logo.jpeg" alt="" width="200" height="200" ></div>
    </article>
    <div v-if="products.length > 1" class="store-hero-aside">
      <NuxtLink v-for="product in products.slice(1, 3)" :key="product.id" :to="product.href" class="store-hero-companion">
        <div class="store-companion-copy"><span class="store-promo-label">Hemat {{ product.discount }}%</span><h2>{{ product.name }}</h2><p class="store-companion-compare">{{ formatIDR(product.compareAt) }}</p><p class="store-companion-price">{{ product.priceLabel }}</p><p class="store-companion-end">Sampai {{ formatWIB(product.endDate) }}</p></div>
        <ProductImage :image-url="product.image" :name="product.name" :category="product.category" class="store-companion-image" />
        <ArrowUpRight aria-hidden="true" class="store-companion-arrow size-4" />
      </NuxtLink>
    </div>
  </section>
</template>
