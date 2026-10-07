<script setup lang="ts">
import { CheckCircle2, MessageCircle, Minus, Plus, ShoppingCart, Truck } from '@lucide/vue'
import type { ConfirmOrderResponse, FulfillmentInfo, ProductOut } from '~/utils/api-types'
import { formatIDR } from '~/utils/format'
import { effectivePrice, hasPromo } from '~/utils/product'
import { quoteLine } from '#shared/utils/pricing'
import { NormalizedApiError } from '~/composables/useApi'

/**
 * Checkout langsung (tanpa chat/AI): 1 produk + qty -> data pemesan ->
 * pilih ambil di toko / diantar -> buat pesanan -> bayar via QRIS.
 */
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl as string) || 'http://localhost:3000'
const { request } = useApi()

const id = computed(() => String(route.query.item || ''))
const qty = ref(Math.max(1, Number(route.query.qty || 1) || 1))

const { data: product } = await useAsyncData(`checkout-${id.value}`, async () => {
  if (!id.value) return null as ProductOut | null
  try { return await request<ProductOut>(`/catalog/${id.value}`, { auth: false }) }
  catch { return null as ProductOut | null }
}, { default: () => null as ProductOut | null })

useSeoMeta({
  title: 'Checkout SHAF STORE: Pesan Langsung & Bayar QRIS',
  description: 'Checkout langsung tanpa daftar akun: pilih produk, tentukan ambil di toko atau diantar, bayar via QRIS.',
  ogTitle: 'Checkout SHAF STORE: Pesan Langsung & Bayar QRIS',
  ogDescription: 'Checkout langsung tanpa daftar akun, bayar via QRIS.',
  ogType: 'website',
  ogUrl: `${siteUrl}/checkout`,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image'
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
const errorMsg = ref('')
const placed = ref<ConfirmOrderResponse | null>(null)
const placedInfo = ref<FulfillmentInfo | null>(null)
const idemKey = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function decQty() { qty.value = Math.max(1, qty.value - 1) }
function incQty() { qty.value = Math.min(maxQty.value, qty.value + 1) }

async function submit() {
  if (submitting.value || !product.value) return
  errorMsg.value = ''
  if (!custName.value.trim() || !custContact.value.trim()) {
    errorMsg.value = 'Isi nama & kontak dulu sebelum membuat pesanan.'
    return
  }
  const info: FulfillmentInfo = { method: method.value }
  if (method.value === 'DELIVERY') {
    if (!dlvRecipient.value.trim() || !dlvPhone.value.trim() || !dlvAddress.value.trim()) {
      errorMsg.value = 'Isi nama penerima, no. HP, dan alamat lengkap dulu.'
      return
    }
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
  }
  catch (e: unknown) {
    errorMsg.value = e instanceof NormalizedApiError ? e.message : 'Gagal membuat pesanan'
  }
  finally { submitting.value = false }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6 py-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-700">Checkout langsung</p>
      <h1 class="mt-1 font-display text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
        {{ placed ? 'Pesanan tercatat' : 'Selesaikan pesanan' }}
      </h1>
      <p class="mt-1 text-sm text-stone-600">
        {{ placed ? 'Simpan ID pesanan; pembayaran dikonfirmasi kasir setelah transfer/scan QRIS.' : 'Tanpa daftar akun, tanpa lewat chat. Isi data, konfirmasi, bayar via QRIS.' }}
      </p>
    </div>

    <!-- Produk tidak ditemukan -->
    <div v-if="!product && !placed" class="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <h2 class="font-display text-xl font-bold text-stone-900">Produk tidak ditemukan</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">Pilih produk dari katalog dulu, atau tanya lewat chat.</p>
      <div class="mt-5 flex justify-center gap-2">
        <Button to="/#katalog" variant="outline">Lihat katalog</Button>
        <Button to="/chat" variant="ai">Chat toko</Button>
      </div>
    </div>

    <!-- Sukses: ringkasan + QRIS -->
    <template v-else-if="placed">
      <div class="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 p-4 shadow-md space-y-3">
        <div class="flex items-center gap-2 border-b border-dashed border-stone-200 pb-2.5">
          <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
          <span class="font-display font-bold text-stone-900 text-sm">Pesanan #{{ placed.order_id.slice(0, 8) }} tercatat</span>
        </div>
        <div class="space-y-1 text-sm text-stone-700">
          <p v-if="placed.replayed" class="text-xs font-medium text-stone-500">Order ini sudah tercatat sebelumnya, tidak ada duplikasi.</p>
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

      <QrisPanel :amount="placed.total" :reference="placed.order_id" />

      <div class="flex flex-col gap-2 sm:flex-row">
        <Button to="/#katalog" variant="outline" class="flex-1 justify-center">Lihat katalog lagi</Button>
        <Button to="/chat" variant="ai" class="flex-1 justify-center">
          <MessageCircle class="h-4 w-4" />
          Ada pertanyaan? Chat
        </Button>
      </div>
    </template>

    <!-- Form checkout -->
    <template v-else>
      <!-- Item + qty -->
      <div class="overflow-hidden rounded-2xl border-2 border-brand-500/30 bg-brand-50/50 shadow-md p-4 space-y-3">
        <div class="flex items-center justify-between gap-2 border-b border-dashed border-stone-200 pb-2.5">
          <span class="font-display font-bold text-stone-900 text-sm">Ringkasan Pesanan</span>
          <NuxtLink :to="`/produk/${product!.id}`" class="text-[11px] font-semibold text-brand-700 hover:underline">Ubah produk</NuxtLink>
        </div>

        <div class="flex items-start gap-3">
          <ProductImage :image-url="product!.image_url" :name="product!.name" :category="product!.category" size="thumb" class="h-16 w-16 shrink-0 !rounded-xl" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-stone-900 text-sm [overflow-wrap:anywhere]">{{ product!.name }}</p>
            <p class="mt-0.5 text-xs text-stone-500">{{ product!.category }} · Stok: {{ product!.current_stock }}</p>
            <p class="mt-1 font-display font-bold text-brand-700">{{ formatIDR(finalPrice) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
              :disabled="qty <= 1"
              aria-label="Kurangi jumlah"
              @click="decQty"
            >
              <Minus class="h-3.5 w-3.5" />
            </button>
            <span class="w-8 text-center font-display text-sm font-bold tabular-nums">{{ qty }}</span>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40"
              :disabled="qty >= maxQty"
              aria-label="Tambah jumlah"
              @click="incQty"
            >
              <Plus class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div class="space-y-1 border-t border-dashed border-stone-200 pt-2.5 text-sm">
          <div class="flex justify-between text-stone-600">
            <span>{{ qty }}x {{ formatIDR(finalPrice) }}</span>
            <span>{{ formatIDR(lineTotal) }}</span>
          </div>
          <div v-if="promo" class="flex justify-between text-emerald-700">
            <span>Diskon promo</span>
            <span>-{{ formatIDR(discountTotal) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-medium text-stone-500">Total Tagihan</span>
            <span class="font-display text-lg font-bold text-stone-900">{{ formatIDR(lineTotal) }}</span>
          </div>
          <p class="text-[10px] text-stone-500">Harga &amp; stok diverifikasi secara atomik saat pesanan dibuat.</p>
        </div>
      </div>

      <!-- Data pemesan -->
      <div class="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
        <p class="text-xs font-semibold text-stone-700">Data Pemesan</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <Input v-model="custName" placeholder="Nama lengkap" class="h-9 text-xs" />
          <Input v-model="custContact" placeholder="No. HP / Telegram" class="h-9 text-xs" />
        </div>
      </div>

      <!-- Fulfillment -->
      <div class="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <p class="text-xs font-semibold text-stone-700">Mau diambil di toko, atau diantar ke alamat?</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="md" class="h-11 justify-center" :class="method === 'PICKUP' ? 'border-brand-500 bg-brand-50 text-brand-800' : ''" @click="method = 'PICKUP'">
            Ambil di toko
          </Button>
          <Button variant="outline" size="md" class="h-11 justify-center" :class="method === 'DELIVERY' ? 'border-brand-500 bg-brand-50 text-brand-800' : ''" @click="method = 'DELIVERY'">
            <Truck class="h-4 w-4" />
            Diantar ke alamat
          </Button>
        </div>

        <div v-if="method === 'DELIVERY'" class="space-y-2 rounded-xl bg-stone-50/80 p-3 ring-1 ring-stone-200/80">
          <p class="text-xs font-semibold text-stone-700">Kirim ke mana?</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <Input v-model="dlvRecipient" placeholder="Nama penerima" class="h-9 text-xs" />
            <Input v-model="dlvPhone" placeholder="No. HP penerima" class="h-9 text-xs" />
          </div>
          <Textarea v-model="dlvAddress" placeholder="Alamat lengkap (jalan, nomor, kota, kode pos)" rows="2" class="text-xs" />
          <Input v-model="dlvNotes" placeholder="Catatan kurir (opsional)" class="h-9 text-xs" />
        </div>
      </div>

      <p v-if="errorMsg" role="alert" class="text-center text-xs font-medium text-rose-600">{{ errorMsg }}</p>

      <Button
        variant="ai"
        size="lg"
        class="w-full justify-center font-semibold"
        :loading="submitting"
        :disabled="soldOut"
        @click="submit"
      >
        <ShoppingCart class="h-4 w-4" />
        {{ soldOut ? 'Stok habis' : `Buat pesanan · ${formatIDR(lineTotal)}` }}
      </Button>

      <p class="flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-500">
        <CheckCircle2 class="h-3.5 w-3.5 text-emerald-600" />
        Stok terkunci saat pesanan tercatat · QRIS simulasi, pembayaran dikonfirmasi kasir
      </p>
    </template>
  </div>
</template>
