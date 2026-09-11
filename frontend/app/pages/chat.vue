<template>
  <div class="space-y-12 py-2 sm:py-4">
    <!-- Hero Section -->
    <section class="grid items-center gap-10 lg:grid-cols-12">
      <!-- Left Column: Copywriting & Actions -->
      <div class="space-y-6 lg:col-span-6">
        <!-- Feature Badge -->
        <div class="inline-flex items-center gap-2 rounded-full border border-clay-200/60 bg-clay-50/70 px-3 py-1 text-xs font-semibold text-clay-700">
          <span class="flex h-2 w-2 rounded-full bg-clay-500 animate-pulse" />
          <span>Generasi Baru Conversational Commerce</span>
        </div>

        <!-- Main Headline -->
        <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          Belanja Cukup Cerita, <br>
          <span class="text-clay-600">Biar AI yang Menyiapkan.</span>
        </h1>

        <!-- Subtitle -->
        <p class="text-base leading-relaxed text-stone-600 sm:text-lg">
          Tanyakan rekomendasi produk, cek ketersediaan stok fisik gudang secara instan, dan selesaikan transaksi langsung dari ruang chat tanpa repot mengisi keranjang belanja.
        </p>

        <!-- Quick Prompt Chips -->
        <div class="space-y-2.5 pt-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-stone-400">Coba tanyakan ke AI:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="prompt in suggestedPrompts"
              :key="prompt"
              class="group flex items-center gap-1.5 rounded-xl border border-stone-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-xs transition-all hover:border-clay-400 hover:bg-clay-50/60 hover:text-clay-600"
              @click="triggerPrompt(prompt)"
            >
              <span>{{ prompt }}</span>
              <span class="text-stone-400 transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>

        <!-- Key Metrics Strip -->
        <div class="grid grid-cols-3 gap-3 pt-4 border-t border-stone-200/70">
          <div>
            <p class="font-display text-xl font-bold text-stone-900">100%</p>
            <p class="text-xs text-stone-500">Stok Real-time</p>
          </div>
          <div>
            <p class="font-display text-xl font-bold text-stone-900">&lt; 2 dtk</p>
            <p class="text-xs text-stone-500">Respon AI Sales</p>
          </div>
          <div>
            <p class="font-display text-xl font-bold text-stone-900">0 Klik</p>
            <p class="text-xs text-stone-500">Tanpa Keranjang</p>
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Chat Widget -->
      <div class="lg:col-span-6">
        <ChatWidget ref="chatWidgetRef" />
      </div>
    </section>

    <!-- 3-Step Process Showcase -->
    <section class="space-y-6 pt-6">
      <div class="text-center max-w-2xl mx-auto">
        <h2 class="font-display text-2xl font-bold text-stone-900 sm:text-3xl">Bagaimana Cara Kerjanya?</h2>
        <p class="mt-2 text-sm text-stone-600">
          Proses belanja revolusioner yang didesain untuk kecepatan, kejelasan stok, dan kenyamanan.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <Card class="relative overflow-hidden group hover:border-clay-300 transition-all">
          <CardContent>
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-clay-50 text-clay-600 font-bold">
              01
            </div>
            <h3 class="font-display text-base font-bold text-stone-900">1. Ceritakan Kebutuhan</h3>
            <p class="mt-2 text-sm text-stone-600 leading-relaxed">
              Ketik pertanyaan atau deskripsi kebutuhan Anda secara santai seperti mengobrol dengan staf pramuniaga profesional.
            </p>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-clay-300 transition-all">
          <CardContent>
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-clay-50 text-clay-600 font-bold">
              02
            </div>
            <h3 class="font-display text-base font-bold text-stone-900">2. AI Verifikasi Stok & Harga</h3>
            <p class="mt-2 text-sm text-stone-600 leading-relaxed">
              AI Tool Calling langsung mencari katalog toko dan mengecek jumlah stok fisik yang tersedia tanpa halusinasi inventaris.
            </p>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-clay-300 transition-all">
          <CardContent>
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              03
            </div>
            <h3 class="font-display text-base font-bold text-stone-900">3. Konfirmasi Pesanan Atomik</h3>
            <p class="mt-2 text-sm text-stone-600 leading-relaxed">
              Ringkasan pesanan muncul di chat. Cukup tekan satu tombol konfirmasi pesanan; stok otomatis terkunci aman anti-ganda.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Demo Toko — AI-Native Store' })

const chatWidgetRef = ref<{ sendPrompt: (prompt: string) => void } | null>(null)

const suggestedPrompts = [
  'Laptop RAM 16GB budget 10 juta',
  'Keyboard wireless ergonomis',
  'Ada promo diskon apa hari ini?',
  'Mouse gaming responsif'
]

function triggerPrompt(prompt: string) {
  chatWidgetRef.value?.sendPrompt(prompt)
}
</script>

