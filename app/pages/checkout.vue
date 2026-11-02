<script setup lang="ts">
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingCart, Truck } from '@lucide/vue'
import type { ConfirmOrderResponse, FulfillmentInfo, ProductOut } from '~/utils/api-types'
import type { NormalizedApiError } from '~/composables/useApi'
import { formatIDR, formatWIB } from '~/utils/format'
import { effectivePrice, hasPromo } from '~/utils/product'
import { quoteLine } from '#shared/utils/pricing'

/**
 * Checkout langsung (tanpa chat/AI): 1 produk + qty -> data pemesan ->
 * pilih ambil di toko / diantar -> buat pesanan -> bayar via QRIS.
 */
definePageMeta({
  layout: 'default',
  // Key per-URL penuh: ganti ?item=A ke ?item=B harus meremount halaman —
  // sebelumnya produk/qty/idempotency key lama tetap terpakai.
  key: route => route.fullPath
})

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const { request } = useApi()
const toast = useToast()

const id = computed(() => String(route.query.item || ''))
// ?qty=99 dari URL jangan langsung jadi qty — dicek ulang terhadap stok saat
// produk termuat (watch di bawah).
const qty = ref(Math.max(1, Number(route.query.qty || 1) || 1))

// Error TIDAK lagi ditelan (catch -> null menyamarkan gangguan DB sebagai
// "Produk tidak ditemukan"): 4xx = produk tidak ada, 5xx/network = gagal muat.
const { data: product, error: productError, refresh: refreshProduct } = await useAsyncData(`checkout-${id.value}`, async () => {
  if (!id.value) return null as ProductOut | null
  return await request<ProductOut>(`/catalog/${id.value}`, { auth: false })
}, { default: () => null as ProductOut | null })

// useAsyncData mengetik error sebagai NuxtError, tetapi yang dilempar di sini
// NormalizedApiError (punya `status`) — dibaca longgar lewat cast `unknown`.
const errorStatus = computed(() => {
  const e = productError.value as unknown as { statusCode?: number, status?: number } | null
  return e?.status ?? e?.statusCode ?? 0
})
const loadFailed = computed(() => !product.value && !!productError.value && (errorStatus.value === 0 || errorStatus.value >= 500))

useSeoMeta({
  title: 'Checkout SHAF STORE: Pesan Langsung & Bayar QRIS',
  description: 'Checkout langsung tanpa daftar akun: pilih produk, tentukan ambil di toko atau diantar, bayar via QRIS.',
  ogTitle: 'Checkout SHAF STORE: Pesan Langsung & Bayar QRIS',
  ogDescription: 'Checkout langsung tanpa daftar akun, bayar via QRIS.',
  ogType: 'website',
  ogUrl: `${siteUrl}/checkout`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  // Halaman funnel transaksional (?item=<uuid> unik per klik) tak bernilai
  // indeks — robots.txt tidak bisa menyaring ini karena ada dinamis.
  robots: 'noindex, follow'
})
useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/checkout` }] })

const finalPrice = computed(() => (product.value ? effectivePrice(product.value) : 0))
const promo = computed(() => (product.value ? hasPromo(product.value) : false))
const soldOut = computed(() => (product.value?.current_stock ?? 0) <= 0)
const maxQty = computed(() => Math.max(1, Math.min(product.value?.current_stock ?? 1, 10)))
// Rumus kanonik shared/utils/pricing — persis sama dengan hitungan server.
const lineTotal = computed(() => (product.value ? quoteLine(product.value.price, product.value.discount_percentage || 0, qty.value).line_total : 0))
const discountTotal = computed(() => (promo.value ? (product.value!.price - finalPrice.value) * qty.value : 0))

const custName = ref('')
const custContact = ref('')
const method = ref<'PICKUP' | 'DELIVERY'>('PICKUP')
const dlvRecipient = ref('')
const dlvPhone = ref('')
const dlvAddress = ref('')
const dlvNotes = ref('')

const submitting = ref(false)
const placed = ref<ConfirmOrderResponse | null>(null)
const placedInfo = ref<FulfillmentInfo | null>(null)
// Idempotency key bertahan di sessionStorage per (item, qty): reload di
// tengah-tengah submit yang gagal jaringan tidak menciptakan order dobel —
// retry dengan key sama dijawab replay server, bukan order kedua.
// Membuat_order_baru → ganti qty/item (URL berubah) atau chat toko.
const idemKey = (() => {
  const fallback = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const storeKey = `checkout_idem_${id.value}_q${qty.value}`
  try {
    const existing = sessionStorage.getItem(storeKey)
    if (existing) return existing
    sessionStorage.setItem(storeKey, fallback)
  }
  catch { /* mode privat tanpa storage: key in-memory tetap berfungsi */ }
  return fallback
})()

/**
 * Batas pembayaran: dihitung dari `expires_at` yang dikembalikan server
 * (sumber tunggal). Fallback konstanta hanya dipakai bila field belum ada.
 */
const PAY_WINDOW_FALLBACK_MINUTES = 120
const placedAt = ref<number | null>(null)
const payDeadline = computed(() => {
  if (placed.value?.expires_at) return formatWIB(placed.value.expires_at)
  return placedAt.value ? formatWIB(new Date(placedAt.value + PAY_WINDOW_FALLBACK_MINUTES * 60_000).toISOString()) : '-'
})

function decQty() { qty.value = Math.max(1, qty.value - 1) }
function incQty() { qty.value = Math.min(maxQty.value, qty.value + 1) }

/** Qty dari URL di-clamp ke stok yang benar-benar tersedia. */
watch(product, (p) => {
  if (!p) return
  if (qty.value > maxQty.value) qty.value = maxQty.value
}, { immediate: true })

// Validasi inline (bukan hanya toast): di-set saat percobaan submit pertama.
const triedSubmit = ref(false)
const nameError = computed(() => (triedSubmit.value && !custName.value.trim()) ? 'Nama wajib diisi.' : '')
const contactError = computed(() => {
  if (!triedSubmit.value) return ''
  const t = custContact.value.trim()
  if (!t) return 'Kontak wajib diisi.'
  if (!contactLooksReasonable(t)) return 'Isi nomor HP (min. 8 angka) atau username Telegram @pemilik.'
  return ''
})
const recipientError = computed(() => (triedSubmit.value && method.value === 'DELIVERY' && !dlvRecipient.value.trim()) ? 'Nama penerima wajib diisi.' : '')
const phoneError = computed(() => (triedSubmit.value && method.value === 'DELIVERY' && !dlvPhone.value.trim()) ? 'No. HP penerima wajib diisi.' : '')
const addressError = computed(() => (triedSubmit.value && method.value === 'DELIVERY' && !dlvAddress.value.trim()) ? 'Alamat lengkap wajib diisi.' : '')

/** Kontak diterima server apa adanya; klien hanya mencegah isian yang jelas salah. */
function contactLooksReasonable(v: string): boolean {
  if (v.startsWith('@')) return v.length >= 4 // username Telegram
  return v.replace(/\D/g, '').length >= 8 // nomor HP (dengan/beberapa kode area)
}

async function submit() {
  if (submitting.value || !product.value) return
  triedSubmit.value = true
  const invalidField = nameError.value ? 'checkout-name'
    : contactError.value ? 'checkout-contact'
      : recipientError.value ? 'delivery-recipient'
        : phoneError.value ? 'delivery-phone'
          : addressError.value ? 'delivery-address' : ''
  if (invalidField) {
    await nextTick()
    document.getElementById(invalidField)?.focus()
    return
  }
  const info: FulfillmentInfo = { method: method.value }
  if (method.value === 'DELIVERY') {
    info.recipient = dlvRecipient.value.trim()
    info.phone = dlvPhone.value.trim()
    info.address = dlvAddress.value.trim()
    info.notes = dlvNotes.value.trim() || undefined
  }
  submitting.value = true
  try {
    const res = await request<ConfirmOrderResponse>('/orders', {
      method: 'POST',
      auth: false,
      body: {
        items: [{ product_id: product.value.id, quantity: qty.value }],
        customer: { name: custName.value.trim(), contact: custContact.value.trim() },
        fulfillment: info,
        idempotency_key: idemKey
      }
    })
    placed.value = res
    placedInfo.value = info
    placedAt.value = Date.now()
    toast.success(`Pesanan #${res.order_id.slice(0, 8)}… tercatat.`)
  }
  catch (e: unknown) {
    toast.fromError(e, 'Gagal membuat pesanan')
    // 409 stok/harga berarti data yang tampil sudah basi — muat ulang produk
    // supaya stepper qty, stok, dan harga menunjuk angka terbaru.
    const code = (e as NormalizedApiError)?.code || ''
    if (code === 'INSUFFICIENT_STOCK' || code === 'PRICE_CHANGED' || code === 'PRODUCT_INACTIVE') {
      await refreshProduct()
    }
  }
  finally { submitting.value = false }
}

/** Salin ID pesanan penuh (halaman sukses menyuruh menyimpan; kini 1 klik). */
const orderIdCopied = ref(false)
async function copyOrderId() {
  if (!placed.value) return
  try {
    await navigator.clipboard.writeText(placed.value.order_id)
    orderIdCopied.value = true
    toast.success('ID pesanan disalin.')
  }
  catch { toast.error('Tidak bisa menyalin — catat ID pesanan secara manual.') }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 py-4 max-[320px]:min-w-0 max-[320px]:[overflow-wrap:anywhere]">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-700">Checkout langsung</p>
      <h1 class="mt-1 font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
        {{ placed ? 'Pesanan tercatat' : 'Selesaikan pesanan' }}
      </h1>
      <p class="mt-1 text-sm text-stone-600">
        {{ placed ? 'Simpan ID pesanan. Pembayaran dikonfirmasi kasir; QRIS pada demo tidak dapat dibayar.' : 'Tanpa daftar akun. Isi data dan konfirmasi pesanan. QRIS pada demo adalah simulasi.' }}
      </p>
    </div>

    <!-- Gagal muat katalog (server/DB gangguan) — beda dari "tidak ditemukan" -->
    <div v-if="loadFailed && !placed" class="rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 p-8 text-center max-[320px]:p-3" role="alert">
      <h2 class="font-display text-xl font-bold text-stone-900">Katalog gagal dimuat</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Koneksi ke database toko sedang terganggu — bukan berarti produknya hilang. Coba muat ulang beberapa saat lagi.</p>
      <div class="mt-5 flex justify-center gap-2 max-[320px]:flex-col max-[320px]:[&>a]:h-auto max-[320px]:[&>a]:whitespace-normal max-[320px]:[&>button]:h-auto max-[320px]:[&>button]:whitespace-normal">
        <Button variant="ai" @click="refreshProduct()">Muat Ulang</Button>
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
      </div>
    </div>

    <!-- Produk tidak ditemukan -->
    <div v-else-if="!product && !placed" class="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center max-[320px]:p-3">
      <h2 class="font-display text-xl font-bold text-stone-900">Produk tidak ditemukan</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Pilih produk dari katalog dulu, atau tanya lewat chat.</p>
      <div class="mt-5 flex justify-center gap-2 max-[320px]:flex-col max-[320px]:[&>a]:h-auto max-[320px]:[&>a]:whitespace-normal">
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
        <Button to="/chat" variant="ai">Chat toko</Button>
      </div>
    </div>

    <!-- Sukses: ringkasan + QRIS -->
    <template v-else-if="placed">
      <div class="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 p-4 shadow-md space-y-3">
        <div class="flex items-center gap-2 border-b border-dashed border-stone-200 pb-2.5 max-[320px]:flex-wrap">
          <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
          <span class="font-display font-bold text-stone-900 text-sm">Pesanan #{{ placed.order_id.slice(0, 8) }} tercatat</span>
        </div>
        <div class="space-y-1 text-sm text-stone-700">
          <p v-if="placed.replayed" class="text-xs font-medium text-stone-500">Order ini sudah tercatat sebelumnya, tidak ada duplikasi.</p>
          <p class="text-xs font-medium text-amber-700">
            Menunggu pembayaran — stok ditahan sampai {{ payDeadline }}. Belum dibayar dalam batas itu, pesanan otomatis dibatalkan dan stok dikembalikan.
          </p>
          <p class="text-xs">ID pesanan: <code class="font-mono [overflow-wrap:anywhere]">{{ placed.order_id }}</code></p>
          <p><button
            type="button"
            class="rounded text-xs font-semibold text-brand-700 underline hover:text-brand-800"
            @click="copyOrderId"
          >{{ orderIdCopied ? '✓ Disalin' : 'Salin ID pesanan' }}</button></p>
          <template v-if="placedInfo?.method === 'PICKUP'">
            <p><span class="font-semibold">Ambil di toko.</span> Tunjukkan ID pesanan ini ke kasir saat pengambilan.</p>
          </template>
          <template v-else>
            <p class="font-semibold">Dikirim ke:</p>
            <p>- Penerima: {{ placedInfo?.recipient }} ({{ placedInfo?.phone }})</p>
            <p>- Alamat: {{ placedInfo?.address }}</p>
            <p v-if="placedInfo?.notes">- Catatan kurir: {{ placedInfo?.notes }}</p>
          </template>
          <p class="border-t border-dashed border-stone-200 pt-2 font-display text-lg font-bold text-stone-900">
            Total tagihan: {{ formatIDR(placed.total) }}
          </p>
          <p v-if="placed.total !== lineTotal" class="text-[11px] font-medium text-amber-700">
            Total berubah dari {{ formatIDR(lineTotal) }} karena harga diperbarui saat pesanan dibuat.
          </p>
          <p class="text-[11px] text-stone-500">QRIS di samping simulasi — pembayaran dikonfirmasi kasir.</p>
        </div>
      </div>

      <LazyQrisPanel :amount="placed.total" :reference="placed.order_id" class="max-[320px]:max-w-full max-[320px]:[&>div:nth-child(2)]:max-w-full max-[320px]:[&_canvas]:max-w-full max-[320px]:[&_canvas]:h-auto!" />

      <div class="flex flex-col gap-2 sm:flex-row">
        <Button to="/#katalog" variant="outline" class="w-full min-h-11 justify-center sm:w-auto sm:flex-1 max-[320px]:h-auto max-[320px]:flex-wrap max-[320px]:whitespace-normal">Lihat katalog lagi</Button>
        <Button to="/chat" variant="ai" class="w-full min-h-11 justify-center sm:w-auto sm:flex-1 max-[320px]:h-auto max-[320px]:flex-wrap max-[320px]:whitespace-normal">
          <MessageCircle class="h-4 w-4" />
          Ada pertanyaan? Chat
        </Button>
      </div>
    </template>

    <!-- Form checkout -->
    <form v-else class="space-y-6" novalidate @submit.prevent="submit">
      <!-- Item + qty -->
      <div class="overflow-hidden rounded-2xl border-2 border-brand-500/30 bg-brand-50/50 shadow-md p-4 space-y-3">
        <div class="flex items-center justify-between gap-2 border-b border-dashed border-stone-200 pb-2.5 max-[320px]:flex-wrap">
          <span class="font-display font-bold text-stone-900 text-sm">Ringkasan Pesanan</span>
          <NuxtLink :to="`/produk/${product!.id}`" class="text-[11px] font-semibold text-brand-700 hover:underline">Ubah produk</NuxtLink>
        </div>

        <div class="flex flex-wrap items-start gap-3">
          <ProductImage :image-url="product!.image_url" :name="product!.name" :category="product!.category" size="thumb" class="h-16 w-16 shrink-0 !rounded-xl" />
          <div class="min-w-0 flex-1 max-[320px]:basis-full">
            <p class="font-medium text-stone-900 text-sm [overflow-wrap:anywhere]">{{ product!.name }}</p>
            <p class="mt-0.5 text-xs text-stone-500">{{ product!.category }} · Stok: {{ product!.current_stock }}</p>
            <p class="mt-1 font-display font-bold text-brand-700">{{ formatIDR(finalPrice) }}</p>
          </div>
          <div class="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto max-[320px]:gap-0 max-[320px]:[&>button]:shrink-0">
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
              :disabled="qty <= 1"
              aria-label="Kurangi jumlah"
              @click="decQty"
            >
              <Minus class="h-3.5 w-3.5" />
            </button>
            <span class="w-8 text-center font-display text-sm font-bold tabular-nums max-[320px]:w-auto max-[320px]:flex-1">{{ qty }}</span>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
              :disabled="qty >= maxQty"
              aria-label="Tambah jumlah"
              @click="incQty"
            >
              <Plus class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div class="space-y-1 border-t border-dashed border-stone-200 pt-2.5 text-sm">
          <div class="flex justify-between text-stone-600 max-[320px]:flex-col">
            <span>{{ qty }}x {{ formatIDR(finalPrice) }}</span>
            <span>{{ formatIDR(lineTotal) }}</span>
          </div>
          <div v-if="promo" class="flex justify-between text-emerald-700 max-[320px]:flex-col">
            <span>Diskon promo</span>
            <span>-{{ formatIDR(discountTotal) }}</span>
          </div>
          <div class="flex items-center justify-between max-[320px]:flex-col max-[320px]:items-start">
            <span class="font-medium text-stone-500">Total Tagihan</span>
            <span class="font-display text-lg font-bold text-stone-900">{{ formatIDR(lineTotal) }}</span>
          </div>
          <p class="text-[10px] text-stone-500">Harga dan stok dicek kembali saat pesanan dibuat.</p>
        </div>
      </div>

      <!-- Data pemesan -->
      <div class="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
        <p class="text-xs font-semibold text-stone-700">Data Pemesan</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label for="checkout-name" class="mb-1.5 block text-sm font-semibold text-stone-700">Nama lengkap</label>
            <Input
              id="checkout-name"
              v-model="custName"
              name="name"
              autocomplete="name"
              placeholder="Contoh: Ari Pratama"
              required
              :aria-invalid="nameError ? true : undefined"
              :aria-describedby="nameError ? 'checkout-name-error' : undefined"
              class="h-11 min-h-11 text-base md:text-sm"
            />
            <p v-if="nameError" id="checkout-name-error" class="mt-1 text-xs font-medium text-rose-700">{{ nameError }}</p>
          </div>
          <div>
            <label for="checkout-contact" class="mb-1.5 block text-sm font-semibold text-stone-700">No. HP atau Telegram</label>
            <Input
              id="checkout-contact"
              v-model="custContact"
              name="contact"
              autocomplete="tel"
              placeholder="Contoh: 081234567890 atau @pemilik"
              required
              :aria-invalid="contactError ? true : undefined"
              :aria-describedby="contactError ? 'checkout-contact-error' : undefined"
              class="h-11 min-h-11 text-base md:text-sm"
            />
            <p v-if="contactError" id="checkout-contact-error" class="mt-1 text-xs font-medium text-rose-700">{{ contactError }}</p>
          </div>
        </div>
      </div>

      <!-- Fulfillment -->
      <div class="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <fieldset class="min-w-0">
          <legend class="mb-3 text-sm font-semibold text-stone-700">Metode penerimaan</legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-700 max-[320px]:flex-wrap"
              :class="method === 'PICKUP' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-700'"
            >
              <input v-model="method" type="radio" name="fulfillment" value="PICKUP" class="h-4 w-4 shrink-0 accent-brand-700" >
              Ambil di toko
            </label>
            <label
              class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-700 max-[320px]:flex-wrap"
              :class="method === 'DELIVERY' ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-300 text-stone-700'"
            >
              <input v-model="method" type="radio" name="fulfillment" value="DELIVERY" class="h-4 w-4 shrink-0 accent-brand-700" >
              <Truck class="h-4 w-4 shrink-0" aria-hidden="true" />
              Diantar ke alamat
            </label>
          </div>
        </fieldset>

        <div v-if="method === 'DELIVERY'" class="space-y-2 rounded-xl bg-stone-50/80 p-3 ring-1 ring-stone-200/80">
          <p class="text-xs font-semibold text-stone-700">Kirim ke mana?</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="delivery-recipient" class="mb-1.5 block text-sm font-semibold text-stone-700">Nama penerima</label>
              <Input
                id="delivery-recipient"
                v-model="dlvRecipient"
                name="recipient"
                autocomplete="shipping name"
                placeholder="Contoh: Ari Pratama"
                required
                :aria-invalid="recipientError ? true : undefined"
                :aria-describedby="recipientError ? 'delivery-recipient-error' : undefined"
                class="h-11 min-h-11 text-base md:text-sm"
              />
              <p v-if="recipientError" id="delivery-recipient-error" class="mt-1 text-xs font-medium text-rose-700">{{ recipientError }}</p>
            </div>
            <div>
              <label for="delivery-phone" class="mb-1.5 block text-sm font-semibold text-stone-700">No. HP penerima</label>
              <Input
                id="delivery-phone"
                v-model="dlvPhone"
                type="tel"
                name="phone"
                autocomplete="shipping tel"
                placeholder="Contoh: 081234567890"
                required
                :aria-invalid="phoneError ? true : undefined"
                :aria-describedby="phoneError ? 'delivery-phone-error' : undefined"
                class="h-11 min-h-11 text-base md:text-sm"
              />
              <p v-if="phoneError" id="delivery-phone-error" class="mt-1 text-xs font-medium text-rose-700">{{ phoneError }}</p>
            </div>
          </div>
          <div>
            <label for="delivery-address" class="mb-1.5 block text-sm font-semibold text-stone-700">Alamat lengkap</label>
            <Textarea
              id="delivery-address"
              v-model="dlvAddress"
              name="address"
              autocomplete="shipping street-address"
              placeholder="Contoh: Jalan Melati No. 10, Bandung 40115"
              rows="2"
              required
              :aria-invalid="addressError ? true : undefined"
              :aria-describedby="addressError ? 'delivery-address-error' : undefined"
              class="min-h-11 text-base md:text-sm"
            />
            <p v-if="addressError" id="delivery-address-error" class="mt-1 text-xs font-medium text-rose-700">{{ addressError }}</p>
          </div>
          <div>
            <label for="delivery-notes" class="mb-1.5 block text-sm font-semibold text-stone-700">Catatan kurir (opsional)</label>
            <Input
              id="delivery-notes"
              v-model="dlvNotes"
              name="notes"
              placeholder="Contoh: Titipkan di resepsionis"
              class="h-11 min-h-11 text-base md:text-sm"
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="ai"
        size="lg"
        class="w-full min-h-11 justify-center font-semibold max-[320px]:h-auto max-[320px]:flex-wrap max-[320px]:whitespace-normal"
        :loading="submitting"
        :disabled="soldOut"
      >
        <ShoppingCart class="h-4 w-4" />
        {{ soldOut ? 'Stok habis' : `Buat pesanan · ${formatIDR(lineTotal)}` }}
      </Button>

      <p class="flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-500">
        <CheckCircle2 class="h-3.5 w-3.5 text-emerald-600" />
        Stok terkunci saat pesanan tercatat · QRIS simulasi, pembayaran dikonfirmasi kasir
      </p>
    </form>
  </div>
</template>
