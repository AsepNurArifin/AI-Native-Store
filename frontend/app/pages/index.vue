<script setup lang="ts">
/*
 * Landing page promosi — AI-Native Store (SaaS).
 * Hallmark · genre: playful (soft-retail) · design-system: design.md
 * macrostructure: marketing landing (hero → masalah → cara kerja → fitur →
 * pricing → FAQ → CTA) · enrichment: none (typography + token only)
 * pre-emit critique: P4 H5 E5 S4 R5 V4
 */
definePageMeta({ layout: 'default' })
useHead({ title: 'AI-Native Store — Kelola Tokomu Lewat Obrolan' })

const faqs = [
  {
    q: 'Saya tidak paham teknologi, apakah bisa pakai?',
    a: 'Bisa. Seluruh sistem dirancang untuk pemilik toko: Anda mengatur produk lewat panel sederhana, dan pembeli cukup mengobrol. Tidak ada instalasi, tidak ada server yang perlu Anda rawat.'
  },
  {
    q: 'Apakah pembeli harus install aplikasi?',
    a: 'Tidak. Pembeli membuka webchat toko Anda langsung dari browser, atau mengobrol lewat bot Telegram toko Anda. Keduanya tanpa install apa pun.'
  },
  {
    q: 'Bagaimana AI menjawab pertanyaan pembeli?',
    a: 'AI Sales Agent hanya menjawab berdasarkan katalog dan stok asli toko Anda — bukan karangan. Saat pembeli konfirmasi pesanan, stok dikunci secara atomik sehingga tidak bisa terjual ganda.'
  },
  {
    q: 'Apakah stok bisa saya kelola dari HP?',
    a: 'Ya. Panel admin bisa dibuka dari browser HP, dan setiap aksi penting AI selalu menunggu persetujuan Anda terlebih dahulu.'
  }
]

const openFaq = ref<number | null>(0)
function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? null : i
}
</script>

<template>
  <div class="space-y-20 sm:space-y-24">
    <!-- ============ HERO ============ -->
    <section class="pt-10 sm:pt-16">
      <div class="mx-auto max-w-3xl text-center space-y-6">
        <div class="inline-flex items-center gap-2 rounded-full border border-clay-200/60 bg-clay-50/70 px-3.5 py-1.5 text-xs font-semibold text-clay-700">
          <span class="h-2 w-2 rounded-full bg-clay-500 animate-pulse" />
          Conversational Commerce untuk Toko Anda
        </div>

        <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl sm:leading-[1.1]" style="overflow-wrap: anywhere; min-width: 0;">
          Toko Anda yang Menjawab,<br>
          <span class="text-clay-600">AI yang Mengerjakan.</span>
        </h1>

        <p class="mx-auto max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
          Pembeli mengobrol, AI membalas dengan stok &amp; harga yang selalu akurat,
          pesanan tercatat rapi. Anda cukup menyetujui — dari mana saja, tanpa
          harus paham teknologi.
        </p>

        <div class="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button size="lg" to="/subscribe">Coba Gratis 14 Hari</Button>
          <Button size="lg" variant="outline" to="/chat">Lihat Demo Toko</Button>
        </div>

        <p class="text-xs text-stone-500">
          Tanpa kartu kredit · Batalkan kapan saja
        </p>
      </div>

      <!-- Value strip -->
      <div class="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/70 px-5 py-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-50 font-display text-sm font-bold text-clay-600">AI</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-stone-800">3 AI Agent bekerja untuk Anda</p>
            <p class="text-xs text-stone-500">Sales, Analis, &amp; Asisten Aksi</p>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/70 px-5 py-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-600">✓</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-stone-800">Stok real-time, anti terjual ganda</p>
            <p class="text-xs text-stone-500">Konfirmasi pesanan yang atomik</p>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/70 px-5 py-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-600">☎</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-stone-800">Webchat &amp; bot Telegram</p>
            <p class="text-xs text-stone-500">Pembeli mengobrol lewat chat, tanpa install</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ MASALAH → SOLUSI ============ -->
    <section class="space-y-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Mengelola toko itu sudah berat.<br class="hidden sm:block">
          Balas chat seharian tidak harus.
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-stone-600 sm:text-base">
          Tiga keluhan yang paling sering kami dengar dari pemilik toko —
          dan bagaimana AI-Native Store menyelesaikannya.
        </p>
      </div>

      <div class="grid gap-5 md:grid-cols-3">
        <Card class="border-stone-200/70">
          <CardContent class="space-y-3 pt-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-500">!</div>
            <h3 class="font-display text-base font-bold text-stone-900">Kewalahan membalas pembeli</h3>
            <p class="text-sm leading-relaxed text-stone-600">
              Pertanyaan yang sama berulang: “ada stok?”, “berapa harganya?”, “boleh
              kurir instan?”. <span class="font-medium text-clay-700">AI Sales Agent membalas 24/7</span>
              — ramah, konsisten, dan hanya menjawab dari data toko Anda.
            </p>
          </CardContent>
        </Card>

        <Card class="border-stone-200/70">
          <CardContent class="space-y-3 pt-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-600">≠</div>
            <h3 class="font-display text-base font-bold text-stone-900">Catatan stok tidak pernah sinkron</h3>
            <p class="text-sm leading-relaxed text-stone-600">
              Yang tercatat dan yang ada di gudang sering beda — pesanan batal,
              pembeli kecewa. <span class="font-medium text-clay-700">Stok terverifikasi saat AI menjawab</span>
              dan terkunci otomatis saat pesanan dikonfirmasi.
            </p>
          </CardContent>
        </Card>

        <Card class="border-stone-200/70">
          <CardContent class="space-y-3 pt-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-sm font-bold text-stone-500">?</div>
            <h3 class="font-display text-base font-bold text-stone-900">Tidak ada waktu &amp; tenaga IT</h3>
            <p class="text-sm leading-relaxed text-stone-600">
              Tidak bisa bikin website, tidak paham server. <span class="font-medium text-clay-700">Cukup daftar,
              isi produk, toko Anda langsung online</span> — kami yang mengurus sisanya.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- ============ CARA KERJA ============ -->
    <section class="space-y-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Mulai jualan dalam 3 langkah</h2>
        <p class="mt-3 text-sm text-stone-600 sm:text-base">Tanpa instalasi apa pun — semuanya dari browser.</p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <div class="space-y-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">1</div>
          <h3 class="font-display text-base font-bold text-stone-900">Daftar &amp; isi produk</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            Buat akun, isi nama toko, tambahkan produk &amp; stok. Panel admin kami
            sederhana — selesai dalam hitungan menit.
          </p>
        </div>
        <div class="space-y-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">2</div>
          <h3 class="font-display text-base font-bold text-stone-900">Bagikan webchat / bot Anda</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            Pembeli membuka tautan webchat toko Anda, atau mengobrol dengan bot
            Telegram-nya. Tempelkan juga di bio toko Anda.
          </p>
        </div>
        <div class="space-y-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 font-display text-base font-bold text-white">3</div>
          <h3 class="font-display text-base font-bold text-stone-900">Setujui pesanan yang masuk</h3>
          <p class="text-sm leading-relaxed text-stone-600">
            AI memproses obrolan jadi pesanan siap kirim. Aksi penting selalu
            menunggu persetujuan Anda — Anda pemilik keputusan akhir.
          </p>
        </div>
      </div>
    </section>

    <!-- ============ FITUR ============ -->
    <section class="space-y-8">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Satu sistem, seluruh toko</h2>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="info">Webchat</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Chat toko 24/7</h3>
            <p class="text-sm leading-relaxed text-stone-600">Balasan instan dari AI Sales Agent: rekomendasi, cek stok &amp; harga, sampai ringkasan pesanan — langsung di chat.</p>
          </CardContent>
        </Card>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="info">Telegram</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Bot Telegram toko Anda</h3>
            <p class="text-sm leading-relaxed text-stone-600">Pembeli yang sudah ada di Telegram bisa langsung mengobrol dengan bot toko Anda — tanpa install aplikasi baru.</p>
          </CardContent>
        </Card>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="success">Anti-Overbooking</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Stok terkunci atomik</h3>
            <p class="text-sm leading-relaxed text-stone-600">Saat pesanan dikonfirmasi, stok dipotong sekali dan tidak bisa ganda — pembeli lain otomatis diberi tahu.</p>
          </CardContent>
        </Card>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="warning">Analis Bisnis</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Wawasan toko otomatis</h3>
            <p class="text-sm leading-relaxed text-stone-600">AI Analyst memantau penjualan, produk menumpuk, dan risiko stok habis — lalu mengusulkan tindakan.</p>
          </CardContent>
        </Card>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="warning">Asisten Aksi</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Eksekusi dengan izin Anda</h3>
            <p class="text-sm leading-relaxed text-stone-600">AI bisa menyiapkan draf promo atau penyesuaian stok, tapi selalu menunggu persetujuan Anda sebelum dieksekusi.</p>
          </CardContent>
        </Card>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-2 pt-6">
            <Badge variant="muted">Admin</Badge>
            <h3 class="font-display text-base font-bold text-stone-900">Panel sederhana, dari HP pun bisa</h3>
            <p class="text-sm leading-relaxed text-stone-600">Katalog, inventori, pesanan, pelanggan, dan promosi — semua dalam satu panel yang ramah non-IT.</p>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- ============ PRICING ============ -->
    <section id="harga" class="space-y-8 scroll-mt-20">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Harga sederhana, tanpa kejutan</h2>
        <p class="mt-3 text-sm text-stone-600 sm:text-base">Coba dulu gratis. Kalau cocok, lanjut satu paket — semua fitur terbuka.</p>
      </div>

      <div class="mx-auto grid max-w-4xl gap-5 md:grid-cols-3 items-start">
        <!-- Coba -->
        <Card class="border-stone-200/70">
          <CardHeader>
            <CardTitle class="text-base">Coba</CardTitle>
            <CardDescription>Untuk melihat rasanya</CardDescription>
          </CardHeader>
          <CardContent class="space-y-1">
            <p class="font-display text-3xl font-extrabold text-stone-900">Gratis</p>
            <p class="text-xs text-stone-500">14 hari penuh</p>
            <ul class="mt-4 space-y-2 text-sm text-stone-600">
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Semua fitur terbuka</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Tanpa kartu kredit</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Data toko Anda tetap tersimpan</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" class="w-full" to="/subscribe">Mulai Trial</Button>
          </CardFooter>
        </Card>

        <!-- Toko (utama) -->
        <Card class="relative border-clay-300 bg-white shadow-md md:-translate-y-2">
          <CardHeader>
            <Badge variant="default" class="absolute -top-2.5 left-4 bg-clay-600">Paling populer</Badge>
            <CardTitle class="text-base">Toko</CardTitle>
            <CardDescription>Satu paket, semua fitur</CardDescription>
          </CardHeader>
          <CardContent class="space-y-1">
            <p class="font-display text-3xl font-extrabold text-stone-900">Rp79rb<span class="text-sm font-medium text-stone-500">/bln</span></p>
            <p class="text-xs text-stone-500">atau Rp790rb/tahun — hemat 2 bulan</p>
            <ul class="mt-4 space-y-2 text-sm text-stone-600">
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Produk &amp; pesanan tanpa batas</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Webchat + bot Telegram</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> 3 AI Agent (1.000 chat AI/bln)</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Panel admin &amp; laporan</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button class="w-full bg-clay-600 hover:bg-clay-500" to="/subscribe">Langganan Sekarang</Button>
          </CardFooter>
        </Card>

        <!-- Top-up -->
        <Card class="border-stone-200/70">
          <CardHeader>
            <CardTitle class="text-base">Top-up AI</CardTitle>
            <CardDescription>Kalau kuota chat habis</CardDescription>
          </CardHeader>
          <CardContent class="space-y-1">
            <p class="font-display text-3xl font-extrabold text-stone-900">Rp25rb</p>
            <p class="text-xs text-stone-500">per 500 chat AI tambahan</p>
            <ul class="mt-4 space-y-2 text-sm text-stone-600">
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Opsional, bukan keharusan</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Tanpa kedaluwarsa</li>
              <li class="flex gap-2"><span class="text-clay-600">✓</span> Transparan, tanpa biaya tersembunyi</li>
            </ul>
          </CardContent>
          <CardFooter>
            <p class="w-full text-center text-xs text-stone-400">Aktif dari panel admin saat berlangganan</p>
          </CardFooter>
        </Card>
      </div>

      <p class="mx-auto max-w-xl text-center text-xs text-stone-400">
        WhatsApp untuk skala lebih besar akan tersedia di paket lanjutan.
      </p>
    </section>

    <!-- ============ FAQ ============ -->
    <section class="mx-auto max-w-2xl space-y-8">
      <div class="text-center">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Pertanyaan yang sering ditanyakan</h2>
      </div>

      <div class="space-y-3">
        <div
          v-for="(faq, i) in faqs"
          :key="i"
          class="rounded-2xl border border-stone-200/70 bg-white/70"
        >
          <button
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-stone-800 transition-colors hover:text-clay-700"
            :aria-expanded="openFaq === i"
            @click="toggleFaq(i)"
          >
            <span>{{ faq.q }}</span>
            <span class="shrink-0 text-stone-400 transition-transform duration-200" :class="openFaq === i ? 'rotate-180' : ''">▾</span>
          </button>
          <div v-show="openFaq === i" class="px-5 pb-4 text-sm leading-relaxed text-stone-600">
            {{ faq.a }}
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CTA PENUTUP ============ -->
    <section class="pb-8">
      <div class="rounded-3xl border border-clay-200/70 bg-clay-50/60 px-6 py-12 text-center sm:px-12">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl" style="overflow-wrap: anywhere; min-width: 0;">
          Toko Anda bisa mulai menjawab besok.
        </h2>
        <p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-600 sm:text-base">
          Coba gratis 14 hari — tanpa kartu kredit, tanpa instalasi.
          Kalau tidak cocok, tinggal berhenti.
        </p>
        <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" class="bg-clay-600 hover:bg-clay-500" to="/subscribe">Coba Gratis 14 Hari</Button>
          <Button size="lg" variant="ghost" to="/chat">Atau lihat dulu demonya</Button>
        </div>
      </div>
    </section>
  </div>
</template>
