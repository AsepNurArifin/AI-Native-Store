<template>
  <div class="py-2 sm:py-4">
    <!-- Fokus halaman: obrolan itu sendiri. Penjelasan "cara belanja"
         lengkap ada di /#cara-belanja; di sini cukup ringkasan mini. -->
    <section class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
      <!-- Kolom kiri: copy, contoh pertanyaan -->
      <div class="space-y-7 pt-4 lg:col-span-5">
        <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          Belanja lewat obrolan
        </h1>

        <p class="text-base leading-relaxed text-stone-600 sm:text-lg">
          Tanya produk, anggaran, atau spesifikasi. Asisten mencocokkannya
          dengan katalog toko, lalu menyiapkan ringkasan pesanan yang bisa
          kamu konfirmasi langsung di chat.
        </p>

        <!-- Contoh pertanyaan: chip mengirim langsung ke widget -->
        <div class="space-y-3">
          <p class="text-sm font-medium text-stone-500">Coba salah satu:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="prompt in suggestedPrompts"
              :key="prompt"
              class="rounded-xl border border-stone-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-stone-700 shadow-xs transition-colors hover:border-clay-400 hover:bg-clay-50/60 hover:text-clay-700"
              @click="triggerPrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <!-- Ringkasan cara pesan, bergaya baris nota -->
        <div class="space-y-2 border-t border-dashed border-stone-300 pt-5">
          <p class="text-sm leading-relaxed text-stone-600">
            <span class="font-semibold text-stone-800">Cara pesannya:</span>
            tanya produk, periksa ringkasan yang muncul, tekan satu tombol
            konfirmasi. Stok terkunci atomik saat pesanan tercatat.
          </p>
          <p class="text-xs text-stone-500">
            Demo toko: harga simulasi, chat memerlukan backend dan layanan AI yang aktif.
          </p>
        </div>
      </div>

      <!-- Kolom kanan: widget chat -->
      <div class="min-w-0 lg:col-span-7">
        <ChatWidget ref="chatWidgetRef" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

useSeoMeta({
  title: 'Chat Toko Bu Ratna: Tanya Stok, Spesifikasi & Pesan Langsung',
  description:
    'Tanya stok, spesifikasi, dan harga gadget lewat chat. Asisten mencocokkan pertanyaanmu dengan katalog toko; konfirmasi pesanan cukup satu tombol.',
  ogTitle: 'Chat Toko Bu Ratna: Tanya Stok, Spesifikasi & Pesan Langsung',
  ogDescription:
    'Tanya stok, spesifikasi, dan harga gadget lewat chat; konfirmasi pesanan cukup satu tombol.',
  ogType: 'website',
  ogUrl: `${siteUrl}/chat`,
  ogImage: `${siteUrl}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Papan nama Toko Bu Ratna: toko elektronik yang buka lewat chat',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Chat Toko Bu Ratna: Tanya Stok, Spesifikasi & Pesan Langsung',
  twitterDescription: 'Tanya stok, spesifikasi, dan harga gadget lewat chat.',
  twitterImage: `${siteUrl}/og-image.png`
})

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/chat` }]
})

const chatWidgetRef = ref<{ sendPrompt: (prompt: string) => void } | null>(null)

const suggestedPrompts = [
  'iPhone 15 Pro ada stok?',
  'Laptop RAM 16GB di bawah 12 juta',
  'Ada promo apa hari ini?',
  'Headset wireless di bawah 1 juta'
]

function triggerPrompt(prompt: string) {
  chatWidgetRef.value?.sendPrompt(prompt)
}
</script>
