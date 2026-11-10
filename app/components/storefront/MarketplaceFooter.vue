<script setup lang="ts">
import { MessageCircle, Truck, QrCode } from '@lucide/vue'
const { settings } = useStoreSettings()
defineProps<{ categories: string[] }>()
</script>

<template>
  <footer class="store-footer storefront-dark">
    <div class="store-container">
      <div class="store-footer-grid">
        <div class="store-footer-brand"><NuxtLink to="/" class="store-logo"><img src="/logo.jpeg" alt="" width="44" height="44" ><span>{{ settings.store_name }}</span></NuxtLink><p>Gadget pilihan dengan harga dan stok yang jelas. Temukan perangkat yang tepat, lalu pesan langsung tanpa daftar akun.</p><p>Pemilik: {{ settings.owner_name }}</p><NuxtLink to="/chat" class="store-footer-chat"><MessageCircle aria-hidden="true" class="size-4" /> Tanya stok &amp; spesifikasi</NuxtLink></div>
        <div><h2>Kategori</h2><ul><li v-for="category in categories.slice(0, 6)" :key="category"><NuxtLink :to="`/rak/${encodeURIComponent(category)}`">{{ category }}</NuxtLink></li><li><NuxtLink to="/#katalog">Semua produk</NuxtLink></li></ul></div>
        <div><h2>Belanja di {{ settings.store_name }}</h2><ul><li><NuxtLink to="/#promo">Promo aktif</NuxtLink></li><li><NuxtLink to="/#cara-belanja">Panduan belanja</NuxtLink></li><li><NuxtLink to="/#katalog">Pesan dari katalog</NuxtLink></li><li><NuxtLink to="/chat">Bantuan melalui chat</NuxtLink></li></ul></div>
        <div class="store-footer-info"><h2>Informasi belanja</h2><p><Truck aria-hidden="true" class="size-4" /> Ambil di toko atau diantar. Ongkir dibayar pembeli secara terpisah.</p><p><QrCode aria-hidden="true" class="size-4" /> Ambil di toko: Cash atau QRIS. Pengiriman wajib QRIS dengan screenshot bukti; pembayaran diperiksa pengelola.</p><div class="store-admin-access">Khusus pengelola<NuxtLink to="/login">Akses admin toko</NuxtLink></div></div>
      </div>
      <div class="store-footer-bottom"><p>© 2026 {{ settings.store_name }}</p><p>Apple &amp; Samsung Galaxy · Harga transparan, pilihan lebih tenang.</p></div>
    </div>
  </footer>
</template>
