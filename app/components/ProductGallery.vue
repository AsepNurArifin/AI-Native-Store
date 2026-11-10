<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{ imageUrls: string[], name: string, category: string }>()
const track = ref<HTMLElement | null>(null)
const active = ref(0)
const slides = computed(() => props.imageUrls.length ? props.imageUrls : [null])
const multiple = computed(() => props.imageUrls.length > 1)
let resizeObserver: ResizeObserver | undefined
let trackWidth = 0

function goTo(index: number, animate = true) {
  const element = track.value
  if (!element) return
  const target = Math.max(0, Math.min(index, slides.value.length - 1))
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollTo({ left: target * element.clientWidth, behavior: animate && !reducedMotion ? 'smooth' : 'auto' })
  active.value = target
}

function onScroll() {
  const element = track.value
  if (!element?.clientWidth) return
  active.value = Math.max(0, Math.min(Math.round(element.scrollLeft / element.clientWidth), slides.value.length - 1))
}

function onKeydown(event: KeyboardEvent) {
  if (!multiple.value || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.key === 'ArrowRight' ? active.value + 1
    : event.key === 'ArrowLeft' ? active.value - 1
      : event.key === 'Home' ? 0
        : event.key === 'End' ? slides.value.length - 1 : null
  if (target === null) return
  event.preventDefault()
  goTo(target)
}

watch(() => JSON.stringify(props.imageUrls), async () => {
  active.value = 0
  await nextTick()
  goTo(0, false)
})

onMounted(() => {
  if (!track.value) return
  trackWidth = track.value.clientWidth
  resizeObserver = new ResizeObserver(() => {
    const width = track.value?.clientWidth ?? 0
    if (width !== trackWidth) {
      trackWidth = width
      goTo(active.value, false)
    }
  })
  resizeObserver.observe(track.value)
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <section
    class="min-w-0 space-y-3"
    role="region"
    aria-roledescription="galeri"
    :aria-label="`Galeri gambar ${name}`"
    @keydown="onKeydown"
  >
    <div class="relative min-w-0">
      <div
        ref="track"
        class="product-gallery-track flex w-full overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        :tabindex="multiple ? 0 : undefined"
        :aria-label="multiple ? 'Geser gambar atau gunakan tombol panah kiri dan kanan, Home, atau End' : undefined"
        @scroll.passive="onScroll"
        @dragstart.prevent
      >
        <div
          v-for="(image, index) in slides"
          :key="`${index}:${image ?? 'empty'}`"
          class="product-gallery-slide w-full min-w-0 shrink-0"
          role="group"
          :aria-label="image ? `Gambar ${index + 1} dari ${imageUrls.length}` : 'Belum ada gambar produk'"
          :aria-hidden="multiple && index !== active ? true : undefined"
        >
          <ProductImage
            :image-url="image"
            :name="image ? `${name}, gambar ${index + 1}` : name"
            :category="category"
            size="detail"
            :eager="index === 0"
          />
        </div>
      </div>
      <slot />
      <template v-if="multiple">
        <button
          type="button"
          class="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-800 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Gambar sebelumnya"
          :disabled="active === 0"
          @click="goTo(active - 1)"
        ><ChevronLeft class="size-5" aria-hidden="true" /></button>
        <button
          type="button"
          class="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-800 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Gambar berikutnya"
          :disabled="active === imageUrls.length - 1"
          @click="goTo(active + 1)"
        ><ChevronRight class="size-5" aria-hidden="true" /></button>
      </template>
    </div>
    <p class="text-center text-xs text-stone-600" aria-live="polite" aria-atomic="true">
      {{ imageUrls.length ? `Gambar ${active + 1} dari ${imageUrls.length}` : 'Belum ada gambar produk' }}
    </p>
    <div v-if="multiple" class="flex flex-wrap justify-center gap-2" aria-label="Pilih gambar produk">
      <button
        v-for="(image, index) in imageUrls"
        :key="`${index}:${image}`"
        type="button"
        class="min-h-11 min-w-11 overflow-hidden rounded-xl border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        :class="active === index ? 'border-brand-700' : 'border-transparent hover:border-stone-300'"
        :aria-label="`Tampilkan gambar ${index + 1} dari ${imageUrls.length}`"
        :aria-pressed="active === index"
        @click="goTo(index)"
      >
        <ProductImage :image-url="image" :name="`${name}, gambar ${index + 1}`" :category="category" size="thumb" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.product-gallery-track {
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.product-gallery-track::-webkit-scrollbar { display: none; }
.product-gallery-slide { scroll-snap-align: start; scroll-snap-stop: always; }
</style>
