<script setup lang="ts">
import { normalizeCategory, storefrontCategories } from '~/utils/storefront'
const props = defineProps<{ categories: string[], pending?: boolean, error?: boolean }>()
defineEmits<{ retry: [] }>()
const route = useRoute()
const names = computed(() => storefrontCategories(props.categories))
const active = computed(() => normalizeCategory(typeof route.params.category === 'string' ? route.params.category : ''))
function reveal(event: FocusEvent) { (event.target as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
</script>

<template>
  <div class="store-category-nav">
    <nav class="store-container store-category-scroll modern-scrollbar" aria-label="Kategori produk" data-local-scroll>
      <NuxtLink to="/#katalog" :aria-current="route.path === '/' && route.hash === '#katalog' ? 'page' : undefined" @focus="reveal">Semua produk</NuxtLink>
      <span v-if="pending" class="store-nav-status flex items-center gap-3" role="status" aria-label="Memuat kategori" aria-busy="true"><span class="sr-only">Memuat kategori…</span><span v-for="index in 3" :key="index" class="store-skeleton inline-block h-5 w-20 rounded" aria-hidden="true" /></span>
      <button v-else-if="error" type="button" @click="$emit('retry')">Kategori gagal dimuat · Coba lagi</button>
      <template v-else>
        <NuxtLink v-for="name in names" :key="name" :to="`/rak/${encodeURIComponent(name)}`" :aria-current="active === normalizeCategory(name) ? 'page' : undefined" @focus="reveal">{{ name }}</NuxtLink>
      </template>
      <NuxtLink to="/#promo" @focus="reveal">Promo aktif</NuxtLink>
    </nav>
  </div>
</template>
