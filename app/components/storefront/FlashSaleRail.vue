<script setup lang="ts">
import { ArrowLeft, ArrowRight, Flame } from '@lucide/vue'
import type { ProductOut } from '~/utils/api-types'
import { formatWIB } from '~/utils/format'
import { promotionCountdown } from '~/utils/storefront'
const props = defineProps<{ products: ProductOut[], now: number, mounted: boolean, pending: boolean, error: boolean }>()
defineEmits<{ retry: [] }>()
const rail = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(false)
let observer: ResizeObserver | undefined
function measure() {
  const element = rail.value
  if (!element) return
  atStart.value = element.scrollLeft <= 1
  atEnd.value = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
}
function scroll(direction: number) {
  rail.value?.scrollBy({ left: direction * rail.value.clientWidth * 0.85, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
function reveal(event: FocusEvent) { (event.target as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
watch(() => props.products, async () => { await nextTick(); measure() })
watch(rail, (element) => {
  observer?.disconnect()
  if (element) observer?.observe(element)
  measure()
})
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (rail.value) observer.observe(rail.value)
  }
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section id="promo" class="storefront-anchor store-promo-section" aria-labelledby="promo-heading">
    <div class="store-section-heading"><div><p class="store-eyebrow"><Flame aria-hidden="true" class="size-4" /> Harga spesial dari toko</p><h2 id="promo-heading">Promo aktif</h2></div>
      <div v-if="products.length" class="store-rail-controls" role="group" aria-label="Geser promo">
        <button type="button" aria-label="Promo sebelumnya" :disabled="atStart" @click="scroll(-1)" @keydown.left.prevent="scroll(-1)" @keydown.right.prevent="scroll(1)"><ArrowLeft aria-hidden="true" class="size-4" /></button>
        <button type="button" aria-label="Promo berikutnya" :disabled="atEnd" @click="scroll(1)" @keydown.left.prevent="scroll(-1)" @keydown.right.prevent="scroll(1)"><ArrowRight aria-hidden="true" class="size-4" /></button>
      </div>
    </div>
    <div v-if="pending" class="store-flash-rail" role="status" aria-label="Memuat promo" aria-busy="true"><span class="sr-only">Memuat promo…</span><div v-for="index in 3" :key="index" class="store-product-skeleton" aria-hidden="true" /></div>
    <div v-else-if="error" class="store-error" role="alert"><p>Promo tidak bisa dimuat. Coba periksa kembali.</p><Button variant="outline" class="mt-3" @click="$emit('retry')">Muat ulang promo</Button></div>
    <div v-else-if="products.length" ref="rail" class="store-flash-rail modern-scrollbar" data-local-scroll @scroll.passive="measure" @focusin="reveal">
      <div v-for="product in products" :key="product.id" class="store-flash-item">
        <p class="store-promo-countdown"><template v-if="mounted">Berakhir dalam {{ promotionCountdown(product.promotion!.end_date, now) }}</template><template v-else>Sampai {{ formatWIB(product.promotion!.end_date) }}</template></p>
        <ProductCard :product="product" :now="now" />
      </div>
    </div>
    <p v-else class="store-panel store-state">Belum ada promo aktif. <NuxtLink to="/#katalog" class="store-link">Lihat katalog</NuxtLink></p>
  </section>
</template>
