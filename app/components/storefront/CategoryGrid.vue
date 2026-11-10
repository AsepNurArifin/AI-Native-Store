<script setup lang="ts">
import type { StorefrontCategory } from '~/utils/storefront'
defineProps<{ categories: StorefrontCategory[], pending: boolean, error: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section aria-labelledby="category-heading">
    <div class="store-section-heading"><div><p class="store-eyebrow">Temukan pilihanmu</p><h2 id="category-heading">Belanja per kategori</h2></div><NuxtLink to="/#katalog" class="store-link">Semua produk</NuxtLink></div>
    <p v-if="pending" class="store-panel store-state" role="status">Memuat kategori…</p>
    <div v-else-if="error" class="store-error" role="alert"><p>Kategori belum bisa dimuat, bukan berarti tidak tersedia.</p><Button variant="outline" class="mt-3" @click="$emit('retry')">Muat ulang kategori</Button></div>
    <div v-else-if="categories.length" class="store-category-grid">
      <NuxtLink v-for="category in categories" :key="category.name" :to="category.href" class="store-category-tile">
        <ProductImage :image-url="category.image" :name="category.name" :category="category.name" class="store-category-image" />
        <span>{{ category.name }}</span>
      </NuxtLink>
    </div>
    <p v-else class="store-panel store-state">Kategori belum tersedia.</p>
  </section>
</template>
