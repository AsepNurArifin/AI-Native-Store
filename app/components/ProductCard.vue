<script setup lang="ts">
import { MessageCircle, ShoppingBag, CheckCircle2 } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { formatIDR } from '~/utils/format'
import { productView } from '~/utils/storefront'
const props = defineProps<{ product: ProductOut, now: number }>()
const view = computed(() => productView(props.product, props.now))
</script>

<template>
  <article class="store-product-card">
    <NuxtLink :to="view.href" class="store-product-image" :aria-label="`Lihat ${view.name}`">
      <ProductImage :image-url="view.image" :name="view.name" :category="view.category" />
      <span v-if="view.discount" class="store-promo-label store-card-discount">−{{ view.discount }}%</span>
      <span v-if="!view.available" class="store-card-unavailable">{{ view.inactive ? 'Tidak tersedia' : 'Stok habis' }}</span>
    </NuxtLink>
    <div class="store-card-content">
      <p class="store-card-category">{{ view.category }}</p>
      <NuxtLink :to="view.href" class="store-card-name">{{ view.name }}</NuxtLink>
      <div v-if="view.specs.length" class="store-card-specs"><span v-for="spec in view.specs" :key="spec.key">{{ spec.label }} {{ spec.value }}</span></div>
      <div class="store-card-bottom">
        <p v-if="view.compareAt !== null" class="store-card-compare">{{ formatIDR(view.compareAt) }}</p>
        <p class="store-card-price">{{ view.priceLabel }}</p>
        <p class="store-card-stock" :class="{ 'store-card-stock-empty': !view.available }"><CheckCircle2 aria-hidden="true" class="size-3.5" /><span>{{ view.inactive ? 'Produk tidak aktif' : view.stock <= 0 ? 'Stok habis' : `Stok ${view.stock} unit` }}</span></p>
        <div class="store-card-actions">
          <Button :to="view.href" variant="outline" :aria-label="`Lihat detail ${view.name}`">Detail</Button>
          <Button v-if="view.available" :to="`/checkout?item=${product.id}`" variant="ai" :aria-label="`Pesan ${view.name}`"><ShoppingBag aria-hidden="true" class="size-4" /><span>Pesan</span></Button>
          <Button v-else :to="`/chat?tanya=${encodeURIComponent(`Kapan ${view.name} tersedia?`)}`" variant="ai"><MessageCircle aria-hidden="true" class="size-4" /> Tanya stok</Button>
        </div>
      </div>
    </div>
  </article>
</template>
