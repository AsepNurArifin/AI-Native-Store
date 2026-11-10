<script setup lang="ts">
import type { ProductOut } from '~/utils/api-types'
withDefaults(defineProps<{
  products: ProductOut[]
  now: number
  pending?: boolean
  error?: boolean
  emptyTitle?: string
  emptyMessage?: string
}>(), { pending: false, error: false, emptyTitle: 'Produk tidak ditemukan', emptyMessage: 'Coba kata kunci atau kategori lain, atau tanyakan lewat chat.' })
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="store-product-section">
    <slot name="controls" />
    <div v-if="pending" class="store-product-grid" role="status" aria-label="Memuat produk">
      <div v-for="index in 5" :key="index" class="store-product-skeleton" aria-hidden="true" />
    </div>
    <div v-else-if="error" class="store-error store-state" role="alert"><h3>Katalog belum bisa dimuat</h3><p>Server sedang tidak tersedia. Ini bukan berarti produknya kosong.</p><Button variant="outline" class="mt-3" @click="$emit('retry')">Muat ulang produk</Button></div>
    <div v-else-if="!products.length" class="store-panel store-state"><h3>{{ emptyTitle }}</h3><p>{{ emptyMessage }}</p><NuxtLink to="/chat" class="store-link">Tanya lewat chat</NuxtLink></div>
    <div v-else class="store-product-grid"><ProductCard v-for="product in products" :key="product.id" :product="product" :now="now" /></div>
    <slot v-if="!pending && !error" name="load-more" />
  </div>
</template>
