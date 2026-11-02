<template>
  <div class="py-2 sm:py-4 max-[320px]:[overflow-wrap:anywhere]">
    <!-- Fokus halaman: obrolan itu sendiri. Penjelasan "cara belanja"
         lengkap ada di /#cara-belanja; di sini cukup ringkasan mini. -->
    <section class="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-10">
      <!-- Pengantar singkat sebelum widget di mobile -->
      <div class="space-y-3 lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:pt-4 max-[320px]:min-w-0">
        <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          Tanya produk lewat chat
        </h1>

        <p class="text-base leading-relaxed text-stone-600 sm:text-lg">
          Cek stok, spesifikasi, atau rekomendasi. Untuk membeli, gunakan tombol Pesan di katalog.
        </p>
      </div>

      <div class="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
        <ChatWidget ref="chatWidgetRef" />
      </div>

      <div class="min-w-0 space-y-7 lg:col-span-5 lg:col-start-1 lg:row-start-2">

        <!-- Contoh pertanyaan: chip mengirim langsung ke widget -->
        <div class="space-y-3">
          <p class="text-sm font-medium text-stone-600">Coba salah satu:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="prompt in suggestedPrompts"
              :key="prompt"
              class="rounded-xl border border-stone-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-stone-700 shadow-xs transition-colors hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 max-[320px]:min-w-0 max-[320px]:max-w-full"
              @click="triggerPrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <!-- Ringkasan cara pesan, bergaya baris nota -->
        <div class="space-y-2 border-t border-dashed border-stone-300 pt-5">
          <p class="text-sm leading-relaxed text-stone-600">
            <span class="font-semibold text-stone-800">Cara belinya:</span>
            Tekan Pesan di kartu produk atau Beli sekarang di halaman produk, lalu isi data pemesan. QRIS pada demo adalah simulasi; pembayaran dikonfirmasi kasir.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'

useSeoMeta({
  title: 'Chat SHAF STORE: Tanya Stok, Spesifikasi & Rekomendasi',
  description:
    'Tanya stok, spesifikasi, dan harga produk Apple & Samsung Galaxy flagship lewat chat. Asisten mencocokkan pertanyaanmu dengan katalog toko; beli langsung lewat checkout tanpa chat.',
  ogTitle: 'Chat SHAF STORE: Tanya Stok, Spesifikasi & Rekomendasi',
  ogDescription:
    'Tanya stok, spesifikasi, dan harga produk Apple & Samsung Galaxy flagship lewat chat; beli langsung lewat checkout.',
  ogType: 'website',
  ogUrl: `${siteUrl}/chat`,
  ogImage: `${siteUrl}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Papan nama SHAF STORE: spesialis iPhone & Samsung Galaxy flagship yang buka lewat chat',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Chat SHAF STORE: Tanya Stok, Spesifikasi & Rekomendasi',
  twitterDescription: 'Tanya stok, spesifikasi, dan harga produk Apple & Samsung Galaxy flagship lewat chat.',
  twitterImage: `${siteUrl}/og-image.png`
})

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/chat` }]
})

const chatWidgetRef = ref<{ sendPrompt: (prompt: string) => void } | null>(null)

const suggestedPrompts = [
  'iPhone 15 Pro ada stok?',
  'Galaxy S24 Ultra di bawah 20 juta',
  'Ada promo apa hari ini?',
  'AirPods Pro di bawah 3 juta'
]

function triggerPrompt(prompt: string) {
  chatWidgetRef.value?.sendPrompt(prompt)
}

// Prefill dari kartu produk (?tanya=...): kirim otomatis sekali saat dibuka.
const route = useRoute()
onMounted(() => {
  const q = typeof route.query.tanya === 'string' ? route.query.tanya.trim() : ''
  if (q) {
    setTimeout(() => { chatWidgetRef.value?.sendPrompt(q) }, 400)
  }
})
</script>
