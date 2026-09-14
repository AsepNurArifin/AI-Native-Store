<script setup lang="ts">
/*
 * Storefront Toko Bu Ratna: halaman depan toko (bukan landing produk).
 * Pivot single-user: situs ini ADALAH toko. Pembeli datang, lihat rak,
 * lalu belanja lewat chat (docs/SRS_AMENDMENTS.md §E).
 * Hallmark · genre: playful (soft-retail) · design-system: design.md
 * macrostructure: papan nama asimetris → rak harga nyata (SSR /catalog) →
 * satu nota (langkah + apa yang kamu dapat) → strip penutup putus-putus
 * motif: nota & rak · enrichment: typography + data nyata
 * Read: ENERGY 2 / RHYTHM 3 / MOTION 1
 * pre-emit critique: P4 H5 E5 S4 R5 V4
 */
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const ogImage = `${siteUrl}/og-image.png`

useSeoMeta({
  title: 'Toko Bu Ratna: Toko Elektronik HP, Laptop & Aksesoris',
  description:
    'Toko elektronik yang buka lewat chat: sebut gadget dan budgetnya, kami cek stok, spesifikasi, dan harga dari katalog. Tanpa daftar akun.',
  ogTitle: 'Toko Bu Ratna: Toko Elektronik HP, Laptop & Aksesoris',
  ogDescription:
    'Sebut gadget dan budgetnya; stok, spesifikasi, dan harga kami cek dari katalog. Harga demo simulasi, tanpa daftar akun.',
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Papan nama Toko Bu Ratna: toko elektronik yang buka lewat chat',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Toko Bu Ratna: Toko Elektronik HP, Laptop & Aksesoris',
  twitterDescription: 'Sebut gadget dan budgetnya; sisanya kami cek dari katalog.',
  twitterImage: ogImage
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl }]
})

interface ShelfProduct {
  name: string
  price: number
  current_stock: number
  is_low_stock: boolean
}
interface Shelf {
  name: string
  total: number
  products: ShelfProduct[]
}

/* Rak = data nyata dari endpoint publik /catalog (tanpa JWT, produk ACTIVE).
   SSR supaya nama + harga asli ikut ter-render di HTML. */
const fallbackCategories = ['Smartphone', 'Laptop', 'Tablet', 'Audio', 'Wearable', 'Aksesori', 'Komputer & Gaming']

const { data: shelves, error: shelvesError } = await useAsyncData('storefront-rak', async () => {
  const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'
  const cats = await $fetch<string[]>(`${base}/catalog/categories`)
  const lists = await Promise.all(cats.map(async (c) => {
    const prods = await $fetch<ShelfProduct[]>(`${base}/catalog/products`, { query: { category: c } })
    return { name: c, total: prods.length, products: prods.slice(0, 4) }
  }))
  return lists satisfies Shelf[]
}, { default: () => null as Shelf[] | null })

const categoryNames = computed(() => shelves.value?.map(s => s.name) ?? fallbackCategories)

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: 'Toko Bu Ratna',
        description: 'Toko elektronik demo: tanya spesifikasi dan stok lewat chat, katalog dengan harga simulasi.',
        url: siteUrl,
        image: ogImage,
        priceRange: 'Rp89.000 - Rp26.999.000',
        inLanguage: 'id',
        department: categoryNames.value.map(c => ({ '@type': 'Store', name: c }))
      })
    }
  ]
})
</script>

<template>
  <div class="space-y-14 sm:space-y-20">
    <!-- ============ PAPAN NAMA ============ -->
    <!-- Asimetris (bukan hero terpusat): nama toko seperti papan nama di
         atas toko; di sampingnya nota kecil. Papan rak di bawahnya. -->
    <section class="pt-8 sm:pt-14">
      <div class="grid items-end gap-8 sm:grid-cols-[1fr_auto] sm:gap-12">
        <div class="max-w-xl space-y-5">
          <p class="text-sm font-medium text-stone-500">
            Toko elektronik · buka lewat chat
          </p>
          <h1
            class="font-display text-5xl font-extrabold tracking-tight text-stone-900 sm:text-6xl sm:leading-[1.05]"
            style="overflow-wrap: anywhere; min-width: 0;"
          >
            Toko Bu Ratna
          </h1>
          <p class="text-base leading-relaxed text-stone-600 sm:text-lg">
            Handphone, laptop, tablet, sampai aksesorisnya.
            Ceritakan gadget yang kamu cari beserta budgetnya;
            stok, spesifikasi, dan harganya kami yang cek dari katalog.
          </p>
          <div class="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <Button size="lg" variant="ai" to="/chat">
              Mulai Ngobrol
            </Button>
            <Button size="lg" variant="outline" to="/#rak">Lihat Isi Rak</Button>
          </div>
        </div>

        <!-- Nota kecil: fakta cara belanja, bukan strip statistik -->
        <div class="w-full max-w-xs rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-4 text-sm sm:w-64">
          <p class="font-display text-xs font-bold uppercase tracking-wide text-stone-500">Catatan toko</p>
          <ul class="mt-2 space-y-1.5 text-stone-600">
            <li>Tanpa daftar akun</li>
            <li>Tanpa keranjang belanja</li>
            <li>Konfirmasi pesanan: satu tombol</li>
          </ul>
        </div>
      </div>

      <!-- Papan rak pembuka -->
      <div class="mt-10 h-1.5 rounded-full bg-stone-300/70" />
    </section>

    <!-- ============ RAK KATEGORI (harga nyata) ============ -->
    <!-- Daftar harga gaya papan toko: nama ..... harga. Data dari
         /catalog publik; bila backend mati, nota yang jujur tampil. -->
    <section id="rak" class="scroll-mt-24">
      <div class="mb-8 max-w-xl">
        <h2 class="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Isi rak
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
          Harga di bawah langsung dari katalog toko (demo, simulasi).
          Rak penuh bisa ditanya satu per satu di chat.
        </p>
      </div>

      <div v-if="shelvesError" class="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-4 text-sm text-stone-600">
        Rak tidak bisa dimuat sekarang (backend sedang tidak aktif).
        Chat toko tetap bisa dibuka; asisten akan cek katalog saat tersedia.
      </div>

      <div v-else class="space-y-10">
        <NuxtLink
          v-for="shelf in shelves"
          :key="shelf.name"
          :to="`/rak/${encodeURIComponent(shelf.name)}`"
          class="group block"
        >
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="font-display text-base font-bold text-stone-900 group-hover:text-clay-700">
              {{ shelf.name }}
              <span class="ml-1 font-sans text-xs font-normal text-stone-500">{{ shelf.total }} produk</span>
            </h3>
            <span class="text-xs font-medium text-stone-500 transition-colors group-hover:text-clay-700">
              lihat rak ini
            </span>
          </div>

          <!-- Daftar harga: nama ..... harga, seperti papan harga toko -->
          <ul class="mt-3 space-y-1.5">
            <li
              v-for="p in shelf.products"
              :key="p.name"
              class="flex items-baseline gap-2 text-sm"
            >
              <span class="text-stone-700">{{ p.name }}</span>
              <span class="min-w-4 flex-1 border-b border-dotted border-stone-300" aria-hidden="true" />
              <span class="font-medium tabular-nums text-stone-900">{{ formatIDR(p.price) }}</span>
              <span v-if="p.is_low_stock" class="text-xs text-amber-700">sisa {{ p.current_stock }}</span>
            </li>
          </ul>

          <div class="mt-3 h-1.5 rounded-full bg-stone-300/70 transition-colors group-hover:bg-clay-300" />
        </NuxtLink>
      </div>
    </section>

    <!-- ============ NOTA CARA BELANJA ============ -->
    <!-- Satu nota untuk semuanya: langkah, apa yang didapat, dan
         catatan channel; menggantikan grid manfaat + kartu langkah. -->
    <section id="cara-belanja" class="scroll-mt-24">
      <div class="mx-auto max-w-2xl rounded-2xl border border-dashed border-stone-300 bg-card px-6 py-8 sm:px-10">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-lg font-bold tracking-tight text-stone-900">Cara belanjanya</h2>
          <span class="text-xs text-stone-500">nota · simpan baik-baik</span>
        </div>

        <ol class="mt-6 space-y-5 text-sm leading-relaxed">
          <li class="flex gap-4">
            <span class="font-display font-extrabold text-clay-600">1.</span>
            <p class="text-stone-700">
              <span class="font-semibold text-stone-900">Ceritakan gadget dan budgetnya.</span>
              Tulis saja seperti chat ke kenalan:
              <i>&ldquo;Mau laptop buat kuliah, budget 8 juta&rdquo;</i>.
              Asisten mencarinya di katalog toko.
            </p>
          </li>
          <li class="flex gap-4">
            <span class="font-display font-extrabold text-clay-600">2.</span>
            <p class="text-stone-700">
              <span class="font-semibold text-stone-900">Periksa ringkasannya.</span>
              Spesifikasi, stok, dan harga diambil dari data katalog.
              Harga demo adalah simulasi; periksa lagi sebelum memesan.
            </p>
          </li>
          <li class="flex gap-4">
            <span class="font-display font-extrabold text-clay-600">3.</span>
            <p class="text-stone-700">
              <span class="font-semibold text-stone-900">Tekan konfirmasi, pilih cara terima.</span>
              Pesanan tercatat dan stok langsung berkurang sesuai pesanan:
              ambil di toko, atau diantar dengan mengisi alamat tujuan.
              Pembayaran QRIS disimulasikan (demo); pengiriman fisik tidak diproses.
            </p>
          </li>
        </ol>

        <ul class="mt-7 space-y-1.5 border-t border-dashed border-stone-300 pt-5 text-sm text-stone-600">
          <li>Tanpa install aplikasi, tanpa daftar akun.</li>
          <li>Stok dicek ulang saat konfirmasi; bila berubah, kamu diminta meninjau pesanan lagi.</li>
          <li>Channel Telegram bisa dipakai setelah bot toko dikonfigurasi.</li>
        </ul>

        <p class="mt-5 border-t border-dashed border-stone-300 pt-4 text-center font-display text-sm font-bold text-stone-800">
          Total klik yang perlu: satu tombol konfirmasi
        </p>
      </div>
    </section>

    <!-- ============ PENUTUP ============ -->
    <!-- Strip nota putus-putus; tanpa kotak CTA besar. -->
    <section class="border-t-2 border-dashed border-stone-300 pt-8 pb-4">
      <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 class="font-display text-xl font-bold tracking-tight text-stone-900">
            Lagi cari gadget apa hari ini?
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            HP, laptop, tablet, aksesoris: Bu Ratna (dibantu AI) yang siapkan.
          </p>
        </div>
        <Button size="lg" variant="ai" to="/chat" class="shrink-0">
          Chat Toko Bu Ratna
        </Button>
      </div>
    </section>
  </div>
</template>
