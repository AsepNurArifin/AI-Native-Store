<script setup lang="ts">
import { MessageCircle, ShoppingBag, Truck, QrCode } from '@lucide/vue'
const { settings, pending: settingsPending } = useStoreSettings()
const emit = defineEmits<{ height: [height: number] }>()
const route = useRoute()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const quickSearches = ['iPhone 15 Pro', 'Galaxy S24 Ultra', 'iPad Air', 'Apple Watch', 'AirPods Pro']
const header = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
watch(() => route.query.q, value => { query.value = typeof value === 'string' ? value : '' })
function search(value: string) {
  query.value = value.trim()
  void navigateTo({ path: '/', hash: '#katalog', query: query.value ? { q: query.value } : {} })
}
function measure() { if (header.value) emit('height', Math.ceil(header.value.getBoundingClientRect().height)) }
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (header.value) observer.observe(header.value)
  }
  else window.addEventListener('resize', measure)
})
onUnmounted(() => { observer?.disconnect(); window.removeEventListener('resize', measure) })
</script>

<template>
  <div class="store-utility storefront-dark">
    <div class="store-container store-utility-inner">
      <span><Truck aria-hidden="true" class="size-3.5" /> Ambil di toko atau diantar</span>
      <span><QrCode aria-hidden="true" class="size-3.5" /> Ambil: Cash / QRIS · Antar: QRIS</span>
      <NuxtLink to="/#cara-belanja">Panduan belanja</NuxtLink>
    </div>
  </div>
  <header ref="header" class="store-header storefront-dark">
    <div class="store-container store-masthead">
      <NuxtLink to="/" class="store-logo" :aria-label="`${settings.store_name}, beranda`">
        <img src="/logo.jpeg" alt="" width="44" height="44" >
        <span :aria-busy="settingsPending"><span v-if="settingsPending" class="store-skeleton inline-block h-5 w-28" aria-hidden="true" /><template v-else>{{ settings.store_name }}</template><small>Apple &amp; Samsung</small></span>
      </NuxtLink>
      <div class="store-header-search">
        <SearchBar v-model="query" placeholder="Cari iPhone, iPad, Samsung Galaxy…" @submit="search" />
      </div>
      <nav class="store-header-actions" aria-label="Katalog dan bantuan">
        <NuxtLink to="/#katalog" class="store-header-action" aria-label="Pilih produk untuk dipesan"><ShoppingBag aria-hidden="true" class="size-5" /><span class="store-account-label">Belanja</span></NuxtLink>
        <NuxtLink to="/chat" class="store-chat-action" aria-label="Chat, tanya stok dan spesifikasi"><MessageCircle aria-hidden="true" class="size-5" /><span>Chat</span></NuxtLink>
      </nav>
    </div>
  </header>
  <div class="store-quick-search">
    <div class="store-container store-quick-inner">
      <span>Cari cepat</span>
      <button v-for="term in quickSearches" :key="term" type="button" @click="search(term)">{{ term }}</button>
    </div>
  </div>
</template>
