<script setup lang="ts">
/*
 * Storefront Toko Bu Ratna — halaman depan toko (bukan landing produk).
 * Pivot single-user: situs ini ADALAH toko. Pembeli datang, lihat rak,
 * lalu belanja lewat chat. (docs/SRS_AMENDMENTS.md §E)
 * Hallmark · genre: playful (soft-retail) · design-system: design.md
 * macrostructure: storefront (hero toko → rak kategori → cara belanja →
 * manfaat pembeli → CTA) · enrichment: none (typography + token only)
 * pre-emit critique: P4 H5 E5 S4 R5 V4
 */
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Toko Bu Ratna — Toko Elektronik: HP, Laptop & Aksesoris',
  description:
    'Demo toko elektronik: tanya spesifikasi dan stok HP, laptop, MacBook, iPhone, serta aksesori lewat chat. Katalog contoh 98 produk dengan harga simulasi.',
  ogTitle: 'Toko Bu Ratna — Toko Elektronik: HP, Laptop & Aksesoris',
  ogDescription:
    'Cari gadget dari katalog demo, periksa spesifikasi dan harga simulasi, lalu konfirmasi pesanan lewat chat.',
  ogType: 'website'
})

// Data riwayat dari seed (app/seed/generate.py) — bukan angka karangan.
const categories = [
  { name: 'Smartphone', emoji: '📱', sample: 'iPhone 15 Pro, Galaxy S24, Redmi, Poco' },
  { name: 'Laptop', emoji: '💻', sample: 'MacBook, ASUS, Lenovo, ROG, Victus' },
  { name: 'Tablet', emoji: '📲', sample: 'iPad, Galaxy Tab, Xiaomi Pad' },
  { name: 'Audio', emoji: '🎧', sample: 'AirPods, Sony WH-XM5, JBL, TWS' },
  { name: 'Wearable', emoji: '⌚', sample: 'Apple Watch, Galaxy Watch, smartband' },
  { name: 'Aksesori', emoji: '🔌', sample: 'Charger, powerbank, mouse, kabel, SSD' },
  { name: 'Komputer & Gaming', emoji: '🎮', sample: 'Monitor, keyboard mekanik, konsol, headset' }
] as const

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: 'Toko Bu Ratna',
        description: 'Demo toko elektronik dengan katalog contoh, harga simulasi, dan pemesanan via chat AI.',
        department: categories.map(c => ({ '@type': 'Store', name: c.name }))
      })
    }
  ]
})
</script>

<template>
  <div class="space-y-16 sm:space-y-20">
    <!-- ============ HERO TOKO ============ -->
    <section class="pt-8 sm:pt-12">
      <div class="mx-auto max-w-3xl text-center space-y-6">
        <div class="inline-flex items-center gap-2 rounded-full border border-clay-200/60 bg-clay-50/70 px-3.5 py-1.5 text-xs font-semibold text-clay-700">
          <span class="h-2 w-2 rounded-full bg-clay-500" />
          Demo toko elektronik
        </div>

        <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-[1.1]" style="overflow-wrap: anywhere; min-width: 0;">
          Toko Bu Ratna
        </h1>

        <p class="mx-auto max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
          Toko elektronik — handphone, laptop, tablet, sampai aksesorisnya.
          <span class="font-medium text-stone-800">Tidak perlu buka marketplace:</span>
          ceritakan gadget yang kamu cari, lengkap dengan spesifikasinya.
        </p>

        <div class="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button size="lg" class="bg-clay-600 hover:bg-clay-500" to="/chat">
            Mulai Ngobrol
          </Button>
          <Button size="lg" variant="outline" to="/#rak">Lihat Rak Dulu</Button>
        </div>

        <p class="text-xs text-stone-500">
          Demo · harga simulasi · tanpa daftar akun
        </p>
      </div>

      <!-- Fakta toko (data riil dari katalog seed) -->
      <div class="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3">
        <div class="rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-4 text-center">
          <p class="font-display text-xl font-bold text-stone-900 sm:text-2xl">98</p>
          <p class="text-xs text-stone-500">produk contoh</p>
        </div>
        <div class="rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-4 text-center">
          <p class="font-display text-xl font-bold text-stone-900 sm:text-2xl">7</p>
          <p class="text-xs text-stone-500">kategori</p>
        </div>
        <div class="rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-4 text-center">
          <p class="font-display text-xl font-bold text-stone-900 sm:text-2xl">Chat</p>
          <p class="text-xs text-stone-500">tanya spesifikasi</p>
        </div>
      </div>
    </section>

    <!-- ============ RAK KATEGORI ============ -->
    <section id="rak" class="space-y-8 scroll-mt-20">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Isi rak kami</h2>
        <p class="mt-3 text-sm leading-relaxed text-stone-600 sm:text-base">
          Pilih kategori, atau langsung sebut saja di chat —
          Bu Ratna siap cekkan spesifikasi &amp; stoknya.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="cat in categories"
          :key="cat.name"
          to="/chat"
          class="group rounded-2xl border border-stone-200/70 bg-white/70 p-5 transition-all hover:border-clay-400 hover:bg-clay-50/50"
        >
          <div class="flex items-start gap-4">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-2xl transition-colors group-hover:bg-clay-100">
              {{ cat.emoji }}
            </span>
            <div class="min-w-0">
              <h3 class="font-display text-base font-bold text-stone-900 group-hover:text-clay-700">
                {{ cat.name }}
              </h3>
              <p class="mt-1 text-sm leading-relaxed text-stone-500">{{ cat.sample }}</p>
            </div>
          </div>
        </NuxtLink>

        <!-- Kartu ajakan chat menutup rak -->
        <div class="flex flex-col justify-center rounded-2xl border border-clay-300 bg-clay-50/60 p-5">
          <h3 class="font-display text-base font-bold text-stone-900">Tidak ketemu?</h3>
          <p class="mt-1 text-sm leading-relaxed text-stone-600">
            Sebut saja gadget yang kamu cari — asisten memeriksa data stok &amp; spesifikasi di katalog.
          </p>
          <Button class="mt-4 w-fit bg-clay-600 hover:bg-clay-500" size="sm" to="/chat">
            Tanya Sekarang
          </Button>
        </div>
      </div>
    </section>

    <!-- ============ CARA BELANJA ============ -->
    <section id="cara-belanja" class="space-y-8 scroll-mt-20">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Cara belanjanya</h2>
        <p class="mt-3 text-sm text-stone-600 sm:text-base">Tanpa keranjang belanja, tanpa ribet — semuanya lewat obrolan.</p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white/70 p-6">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">1</div>
          <h3 class="font-display text-base font-bold text-stone-900">Ceritakan gadget yang kamu cari</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            Tulis saja seperti chat ke kenalan: <i>“Mau laptop buat kuliah
            budget 8 juta”</i> atau <i>“iPhone 15 Pro ada stok?”</i>
            Asisten akan mencari di katalog toko.
          </p>
        </div>
        <div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white/70 p-6">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">2</div>
          <h3 class="font-display text-base font-bold text-stone-900">Periksa spesifikasi, stok &amp; harga</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            Chipset, RAM, dan penyimpanan diambil dari data katalog.
            Harga demo adalah simulasi; periksa kembali ringkasan sebelum memesan.
          </p>
        </div>
        <div class="space-y-3 rounded-2xl border border-stone-200/70 bg-white/70 p-6">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">3</div>
          <h3 class="font-display text-base font-bold text-stone-900">Konfirmasi, selesai</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            Satu tombol konfirmasi — pesanan tercatat dan stok langsung
            berkurang sesuai pesanan. Pembayaran dan pengiriman tidak diproses oleh demo ini.
          </p>
        </div>
      </div>
    </section>

    <!-- ============ KENAPA VIA CHAT ============ -->
    <section class="space-y-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Belanja seenak ngobrol</h2>
      </div>

      <div class="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <div class="flex items-start gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-50 text-lg">💬</span>
          <div>
            <h3 class="font-display text-sm font-bold text-stone-900">Tanpa install, tanpa daftar</h3>
            <p class="mt-1 text-sm leading-relaxed text-stone-600">Buka halaman chat, langsung ngobrol. Selesai.</p>
          </div>
        </div>
        <div class="flex items-start gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-50 text-lg">⚡</span>
          <div>
            <h3 class="font-display text-sm font-bold text-stone-900">Cari sesuai kebutuhan</h3>
            <p class="mt-1 text-sm leading-relaxed text-stone-600">Sebutkan anggaran, RAM, penyimpanan, atau prosesor yang kamu inginkan.</p>
          </div>
        </div>
        <div class="flex items-start gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-50 text-lg">🧾</span>
          <div>
            <h3 class="font-display text-sm font-bold text-stone-900">Stok dicek saat konfirmasi</h3>
            <p class="mt-1 text-sm leading-relaxed text-stone-600">Jika stok berubah sejak percakapan, kamu akan diminta meninjau pesanan lagi.</p>
          </div>
        </div>
        <div class="flex items-start gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-50 text-lg">🤖</span>
          <div>
            <h3 class="font-display text-sm font-bold text-stone-900">Suka Telegram? Bisa</h3>
            <p class="mt-1 text-sm leading-relaxed text-stone-600">Channel Telegram dapat digunakan setelah bot toko dikonfigurasi dan backend aktif.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CTA PENUTUP ============ -->
    <section class="pb-8">
      <div class="rounded-3xl border border-clay-200/70 bg-clay-50/60 px-6 py-12 text-center sm:px-12">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl" style="overflow-wrap: anywhere; min-width: 0;">
          Lagi butuh apa hari ini?
        </h2>
        <p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600 sm:text-base">
          Sebut saja — HP, laptop, tablet, sampe aksesorisnya.
          Bu Ratna (dibantu AI) yang siapkan.
        </p>
        <div class="mt-6">
          <Button size="lg" class="bg-clay-600 hover:bg-clay-500" to="/chat">
            Chat Toko Bu Ratna
          </Button>
        </div>
      </div>
    </section>
  </div>
</template>
