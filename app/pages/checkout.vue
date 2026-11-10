<script setup lang="ts">
import { CheckCircle2, ClipboardCopy, Minus, Plus, ShoppingBag, Truck, QrCode, Banknote, ImagePlus, ArrowLeft } from '@lucide/vue'
import type { ConfirmOrderResponse, FulfillmentInfo, ProductOut } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'
import { formatIDR, formatWIB } from '~/utils/format'
import { productView } from '~/utils/storefront'
import { round2 } from '#shared/utils/pricing'

definePageMeta({ layout: 'default', key: route => route.fullPath })
const { settings, status: settingsStatus, pending: settingsPending, error: settingsError, refresh: refreshSettings } = useStoreSettings()
useSeoMeta({ title: () => `Checkout langsung — ${settings.value.store_name}`, description: 'Pilih produk, isi data pemesan dan konfirmasi pesanan tanpa daftar akun.', robots: 'noindex, nofollow' })
const route = useRoute()
const config = useRuntimeConfig()
useHead({ link: [{ rel: 'canonical', href: `${config.public.siteUrl || 'http://localhost:3000'}/checkout` }] })
const { request } = useApi()
const toast = useToast()
const itemId = typeof route.query.item === 'string' ? route.query.item : ''
const qty = ref(Math.max(1, Math.floor(Number(route.query.qty || 1)) || 1))
const { data: product, status: productStatus, error: productError, refresh: refreshProduct } = useAsyncData(`checkout-${itemId}`, async () => {
  if (!itemId) return null as ProductOut | null
  return await request<ProductOut>(`/catalog/${itemId}`, { auth: false })
}, { server: false, lazy: true, immediate: !!itemId, default: () => null as ProductOut | null })
const checkoutPending = computed(() => !!itemId && (productStatus.value === 'idle' || productStatus.value === 'pending' || settingsPending.value))
const errorStatus = computed(() => {
  const error = productError.value as unknown as { statusCode?: number, status?: number } | null
  return error?.status ?? error?.statusCode ?? 0
})
const loadFailed = computed(() => !!productError.value && errorStatus.value !== 404)
const observedProducts = computed(() => product.value ? [product.value] : [])
const { now, refreshError, refreshExpired } = useStorefrontClock(observedProducts, async () => {
  await refreshProduct()
  if (productError.value) throw new Error('Harga terbaru belum bisa dimuat.')
})
const view = computed(() => product.value ? productView(product.value, now.value) : null)
const maxQty = computed(() => Math.max(1, Math.min(product.value?.current_stock ?? 1, 10)))
const total = computed(() => round2((view.value?.price ?? 0) * qty.value))
watch(product, value => { if (value) qty.value = Math.min(qty.value, maxQty.value) }, { immediate: true })
const buyerName = ref('')
const buyerContact = ref('')
const buyerPhone = ref('')
const paymentMethod = ref<'CASH' | 'QRIS'>('CASH')
const method = ref<'PICKUP' | 'DELIVERY'>('PICKUP')
const recipient = ref('')
const phone = ref('')
const address = ref('')
const notes = ref('')
watch(method, value => { if (value === 'DELIVERY') paymentMethod.value = 'QRIS' })
const qrisImageLoaded = ref(false)
const qrisImageError = ref(false)
const qrisAvailable = computed(() => settingsStatus.value === 'success' && !!settings.value.qris_image_url && !!settings.value.qris_merchant_name)
const proofInput = ref<HTMLInputElement | null>(null)
const proofFile = shallowRef<File | null>(null)
const proofPreview = ref('')
const proofError = ref('')
const confirmationUncertain = ref(false)
interface CheckoutDraft {
  items: Array<{ product_id: string, quantity: number }>
  customer: { name: string, contact: string, phone: string }
  fulfillment: FulfillmentInfo
  payment: { method: 'CASH' | 'QRIS' }
  expected_total: number
  idempotency_key: string
}
const qrisDraft = ref<CheckoutDraft | null>(null)
const pendingDraft = ref<CheckoutDraft | null>(null)
function clearProof() {
  if (proofPreview.value) URL.revokeObjectURL(proofPreview.value)
  proofPreview.value = ''
  proofFile.value = null
  proofError.value = ''
  if (proofInput.value) proofInput.value.value = ''
}
function selectProof(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  clearProof()
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { proofError.value = 'Gunakan gambar JPG, PNG atau WebP.'; return }
  if (file.size > 2 * 1024 * 1024) { proofError.value = 'Ukuran bukti maksimal 2 MB.'; return }
  proofFile.value = file
  proofPreview.value = URL.createObjectURL(file)
}
onUnmounted(clearProof)
async function editDetails() {
  if (submitting.value || confirmationUncertain.value) return
  qrisDraft.value = null
  clearProof()
  if (idempotency) {
    try { sessionStorage.removeItem(`checkout_payment_idem_${idempotency.flow}`) }
    catch { /* A fresh in-memory intent is sufficient without storage. */ }
  }
  idempotency = null
  await nextTick()
  document.getElementById('checkout-name')?.focus()
}
const hydrated = ref(false)
const sessionReady = ref(false)
const sessionLoading = ref(false)
const sessionError = ref('')
async function prepareSession() {
  if (sessionLoading.value) return
  sessionLoading.value = true
  sessionError.value = ''
  try { await request<{ ready: boolean }>('/checkout/session', { auth: false }); sessionReady.value = true }
  catch (error) { sessionError.value = error instanceof Error ? error.message : 'Sesi checkout belum siap. Coba lagi.' }
  finally { sessionLoading.value = false }
}
const submitting = ref(false)
const tried = ref(false)
const actionError = ref('')
const receipt = ref<ConfirmOrderResponse | null>(null)
const placedInfo = ref<FulfillmentInfo | null>(null)
const placedBuyer = ref<{ name: string, contact: string, phone: string } | null>(null)
const placedQuantity = ref(0)
const placedTotal = ref(0)
const payDeadline = computed(() => receipt.value?.expires_at ? formatWIB(receipt.value.expires_at) : '—')
let idempotency: { flow: string, key: string } | null = null
onMounted(() => { hydrated.value = true; void prepareSession() })
async function orderKey(input: Omit<CheckoutDraft, 'idempotency_key'>) {
  const encoded = new TextEncoder().encode(JSON.stringify(input))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  const flow = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (idempotency?.flow === flow) return idempotency.key
  const storageKey = `checkout_payment_idem_${flow}`
  let key: string = globalThis.crypto.randomUUID()
  try {
    key = sessionStorage.getItem(storageKey) || key
    sessionStorage.setItem(storageKey, key)
  }
  catch { /* Only the digest and UUID are stored; buyer data remains in memory. */ }
  idempotency = { flow, key }
  return key
}
const errors = computed<Record<string, string>>(() => {
  if (!tried.value) return {}
  const result: Record<string, string> = {}
  if (!buyerName.value.trim() || buyerName.value.trim().length > 100) result['checkout-name'] = 'Isi nama lengkap, maksimal 100 karakter.'
  const digits = buyerPhone.value.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) result['checkout-phone'] = 'Nomor telepon pembeli wajib 8–15 digit.'
  if (buyerContact.value.trim().length > 100) result['checkout-contact'] = 'Kontak tambahan maksimal 100 karakter.'
  if (method.value === 'DELIVERY') {
    if (!recipient.value.trim() || recipient.value.trim().length > 100) result['delivery-recipient'] = 'Isi nama penerima, maksimal 100 karakter.'
    const deliveryDigits = phone.value.replace(/\D/g, '')
    if (deliveryDigits.length < 8 || deliveryDigits.length > 15) result['delivery-phone'] = 'Nomor HP penerima wajib 8–15 digit.'
    if (!address.value.trim() || address.value.trim().length > 500) result['delivery-address'] = 'Isi alamat lengkap, maksimal 500 karakter.'
    if (notes.value.trim().length > 500) result['delivery-notes'] = 'Catatan maksimal 500 karakter.'
  }
  return result
})
async function submit() {
  if (!hydrated.value || !sessionReady.value || settingsStatus.value !== 'success' || submitting.value || !product.value || (!qrisDraft.value && !pendingDraft.value && !view.value?.available)) return
  actionError.value = ''
  let input = qrisDraft.value || (confirmationUncertain.value ? pendingDraft.value : null)
  if (!input) {
    tried.value = true
    const first = Object.keys(errors.value)[0]
    if (first) { await nextTick(); document.getElementById(first)?.focus(); return }
    if (paymentMethod.value === 'QRIS' && !qrisAvailable.value) { actionError.value = 'QRIS resmi toko belum tersedia. Hubungi toko; jangan melakukan pembayaran.'; return }
    const fulfillment: FulfillmentInfo = method.value === 'PICKUP' ? { method: 'PICKUP' } : {
      method: 'DELIVERY', recipient: recipient.value.trim(), phone: phone.value.replace(/\D/g, ''), address: address.value.trim(), notes: notes.value.trim() || undefined
    }
    const draft = {
      items: [{ product_id: product.value.id, quantity: qty.value }],
      customer: { name: buyerName.value.trim(), contact: buyerContact.value.trim() || buyerPhone.value.replace(/\D/g, ''), phone: buyerPhone.value.replace(/\D/g, '') },
      fulfillment, payment: { method: paymentMethod.value }, expected_total: total.value
    }
    submitting.value = true
    try { input = { ...draft, idempotency_key: await orderKey(draft) } }
    catch { actionError.value = 'Browser ini tidak mendukung konfirmasi aman. Gunakan browser terbaru melalui HTTPS.'; return }
    finally { submitting.value = false }
    if (input.payment.method === 'QRIS') {
      qrisDraft.value = input
      qrisImageLoaded.value = false
      qrisImageError.value = false
      await nextTick()
      document.getElementById('checkout-qris')?.focus()
      return
    }
  }
  if (input.payment.method === 'QRIS') {
    if (!qrisAvailable.value || !qrisImageLoaded.value || qrisImageError.value) { actionError.value = 'Gambar QRIS belum berhasil dimuat. Jangan membayar sebelum QRIS terlihat.'; return }
    if (!proofFile.value) { proofError.value = 'Lampirkan screenshot transaksi berhasil sebelum konfirmasi pembelian.'; await nextTick(); proofInput.value?.focus(); return }
  }
  const submitted = input
  pendingDraft.value = submitted
  let body: CheckoutDraft | FormData = submitted
  if (submitted.payment.method === 'QRIS') {
    const form = new FormData()
    form.append('input', JSON.stringify(submitted))
    form.append('proof', proofFile.value!)
    body = form
  }
  submitting.value = true
  confirmationUncertain.value = true
  try {
    const result = await request<ConfirmOrderResponse>('/orders', { method: 'POST', auth: false, body })
    receipt.value = result
    placedInfo.value = submitted.fulfillment
    placedBuyer.value = submitted.customer
    placedQuantity.value = submitted.items[0]!.quantity
    placedTotal.value = submitted.expected_total
    pendingDraft.value = null
    confirmationUncertain.value = false
    clearProof()
    toast.success(`Pesanan #${result.order_id.slice(0, 8)}… tercatat.`)
    await nextTick()
    document.getElementById('checkout-success')?.focus()
  }
  catch (error) {
    const definite = error instanceof NormalizedApiError && error.status >= 400 && error.status < 500
    if (definite) confirmationUncertain.value = false
    actionError.value = error instanceof Error ? error.message : 'Gagal membuat pesanan. Coba lagi.'
    if (confirmationUncertain.value) actionError.value += ' Hasil belum diketahui. Coba lagi dengan rincian dan bukti yang sama; jangan membuat pesanan baru.'
    if (qrisDraft.value && error instanceof NormalizedApiError && ['INSUFFICIENT_STOCK', 'PRICE_CHANGED', 'PRODUCT_INACTIVE'].includes(error.code)) actionError.value += ' Jika sudah membayar, hubungi toko dengan bukti pembayaran. Jangan melakukan pembayaran kedua.'
    if (!qrisDraft.value && error instanceof NormalizedApiError && ['INSUFFICIENT_STOCK', 'PRICE_CHANGED', 'PRODUCT_INACTIVE'].includes(error.code)) await refreshProduct()
    await nextTick()
    document.getElementById('checkout-action-error')?.focus()
  }
  finally { submitting.value = false }
}
async function copyOrderId() {
  if (!receipt.value) return
  try { await navigator.clipboard.writeText(receipt.value.order_id); toast.success('ID pesanan disalin.') }
  catch { toast.error('Tidak bisa menyalin. Simpan ID pesanan secara manual.') }
}
</script>

<template>
  <div class="store-private store-checkout">
    <header>
      <p class="store-eyebrow">Checkout langsung</p>
      <h1 class="store-title">{{ receipt ? 'Pesanan tercatat' : qrisDraft ? 'Bayar & lampirkan bukti' : 'Lengkapi rincian pesanan' }}</h1>
      <p class="store-description">{{ receipt ? 'Simpan ID pesanan. Pembayaran dan pengiriman diperiksa pengelola toko.' : qrisDraft ? 'Periksa nominal dan merchant, bayar melalui QRIS, lalu lampirkan screenshot transaksi berhasil.' : 'Tanpa daftar akun. Ambil di toko dengan Cash/QRIS, atau diantar dengan QRIS.' }}</p>
    </header>
    <nav class="store-checkout-step" aria-label="Langkah checkout"><span :aria-current="!receipt && !qrisDraft ? 'step' : undefined">1. Rincian</span><span aria-hidden="true">/</span><span :aria-current="qrisDraft && !receipt ? 'step' : undefined">2. Pembayaran &amp; konfirmasi</span><span aria-hidden="true">/</span><span :aria-current="receipt ? 'step' : undefined">3. Pesanan</span></nav>
    <div v-if="sessionError && !receipt" class="store-error" role="alert"><p>{{ sessionError }}</p><Button type="button" variant="outline" :loading="sessionLoading" @click="prepareSession">Siapkan sesi checkout lagi</Button></div>
    <template v-if="receipt">
      <section id="checkout-success" tabindex="-1" class="store-success">
        <h2><CheckCircle2 aria-hidden="true" class="size-6" /> Pesananmu tercatat</h2>
        <p v-if="receipt.replayed" class="store-description">Pesanan ini sudah tercatat sebelumnya. Tidak ada pesanan atau reservasi stok baru.</p>
        <code>{{ receipt.order_id }}</code>
        <Button variant="outline" class="mt-2 min-h-11" @click="copyOrderId"><ClipboardCopy aria-hidden="true" class="size-4" /> Salin ID pesanan</Button>
        <p class="store-description">Status: {{ receipt.status }} · {{ receipt.payment_method === 'QRIS' ? 'Bukti pembayaran menunggu verifikasi admin' : 'Cash saat ambil di toko' }}</p>
        <p v-if="receipt.expires_at" class="store-description">Stok ditahan sampai {{ payDeadline }}. Pesanan yang belum dibayar dalam batas waktu otomatis dibatalkan dan stok dikembalikan.</p>
        <p v-else class="store-description">Bukti pembayaran tersimpan privat pada transaksi. Pengelola akan memeriksa sebelum menandai lunas dan menyerahkan atau mengirim barang.</p>
      </section>
      <section class="store-panel store-checkout-panel">
        <h2>Rincian pesanan</h2>
        <div class="store-checkout-line"><div><h3>{{ product?.name }}</h3><p>{{ placedQuantity }} unit</p></div><strong>{{ formatIDR(receipt.total) }}</strong></div>
        <div class="store-checkout-total"><span>Total produk</span><strong>{{ formatIDR(receipt.total) }}</strong></div>
        <p v-if="receipt.total !== placedTotal" class="store-muted">Total berubah dari {{ formatIDR(placedTotal) }} karena harga diperbarui saat pesanan dibuat.</p>
        <div class="store-review-details">
          <div><h3>Pembeli</h3><p>{{ placedBuyer?.name }}</p><p>Telepon: {{ placedBuyer?.phone }}</p><p v-if="placedBuyer?.contact && placedBuyer.contact !== placedBuyer.phone">Kontak tambahan: {{ placedBuyer.contact }}</p></div>
          <div><h3>{{ placedInfo?.method === 'PICKUP' ? 'Ambil di toko' : 'Diantar ke alamat' }}</h3><p v-if="placedInfo?.method === 'PICKUP'">Tunjukkan ID pesanan ini ke kasir saat pengambilan.</p><template v-else><p>{{ placedInfo?.recipient }} · {{ placedInfo?.phone }}</p><p>{{ placedInfo?.address }}</p><p v-if="placedInfo?.notes">{{ placedInfo.notes }}</p><p>Ongkir dibayar pembeli secara terpisah.</p></template></div>
        </div>
      </section>
      <p v-if="receipt.delivery_status" class="store-muted">Pengiriman: Belum dikirim. Pengelola memperbarui status setelah penyerahan ke kurir dan konfirmasi penerimaan.</p>
      <p class="store-muted">{{ receipt.payment_method === 'QRIS' ? 'Screenshot bukan bukti otomatis lunas; pengelola mencocokkan transaksi masuk ke merchant toko.' : 'Pembayaran Cash diverifikasi kasir saat pengambilan.' }}</p>
      <div class="store-actions"><Button to="/#katalog" variant="outline">Lanjut belanja</Button><Button to="/chat" variant="ai">Tanya melalui chat</Button></div>
    </template>
    <div v-else-if="!itemId" class="store-panel store-state"><h2>Pilih produk untuk checkout</h2><p>Buka katalog, lalu pilih produk yang ingin dipesan.</p><Button to="/#katalog" variant="outline" class="mt-3">Pilih produk</Button></div>
    <div v-else-if="checkoutPending" class="store-panel store-checkout-panel space-y-5" role="status" aria-label="Memuat checkout" aria-busy="true">
      <span class="sr-only">Memuat produk dan pengaturan pembayaran…</span>
      <div class="store-skeleton h-6 w-48 rounded" aria-hidden="true" />
      <div class="store-skeleton h-28 rounded-xl" aria-hidden="true" />
      <div class="store-skeleton h-12 rounded-lg" aria-hidden="true" />
      <div class="store-skeleton h-40 rounded-xl" aria-hidden="true" />
    </div>
    <div v-else-if="loadFailed" class="store-error" role="alert"><h2>Katalog gagal dimuat</h2><p>Koneksi ke database toko sedang terganggu — bukan berarti produknya hilang. Coba muat ulang beberapa saat lagi.</p><div class="store-actions"><Button variant="outline" @click="refreshProduct()">Muat ulang checkout</Button><Button to="/#katalog" variant="outline">Pilih produk</Button></div></div>
    <div v-else-if="!product" class="store-panel store-state"><h2>Produk tidak ditemukan</h2><p>Pilih produk dari katalog dulu, atau tanya lewat chat.</p><div class="store-actions"><Button to="/#katalog" variant="outline">Pilih produk</Button><Button to="/chat" variant="ai">Chat toko</Button></div></div>
    <div v-else-if="settingsError" class="store-error" role="alert"><h2>Pengaturan pembayaran belum bisa dimuat</h2><p>Muat ulang pengaturan resmi toko sebelum melanjutkan checkout.</p><Button variant="outline" class="mt-3" @click="refreshSettings()">Muat ulang pengaturan pembayaran</Button></div>
    <form v-else-if="qrisDraft" class="store-form !mt-0" method="post" enctype="multipart/form-data" novalidate @submit.prevent="submit">
      <fieldset class="contents" :disabled="!hydrated || !sessionReady || submitting" aria-label="Pembayaran QRIS">
        <section id="checkout-qris" tabindex="-1" class="store-panel store-checkout-panel">
          <h2><QrCode aria-hidden="true" class="mr-2 inline size-5" /> QRIS toko</h2>
          <div class="store-checkout-line"><div><h3>{{ product?.name }}</h3><p>{{ qrisDraft.items[0]?.quantity }} unit · {{ qrisDraft.customer.name }}</p><p>{{ qrisDraft.fulfillment.method === 'PICKUP' ? 'Ambil di toko' : 'Diantar ke alamat' }}</p></div><strong>{{ formatIDR(qrisDraft.expected_total) }}</strong></div>
          <p class="store-description">Merchant: <strong>{{ settings.qris_merchant_name }}</strong>. Pastikan nama merchant di aplikasi pembayaran sesuai sebelum membayar. Nominal produk {{ formatIDR(qrisDraft.expected_total) }}; ongkir terpisah.</p>
          <div v-if="settings.qris_image_url" class="mt-5 text-center">
            <img :src="settings.qris_image_url" :alt="`QRIS resmi ${settings.qris_merchant_name}`" class="mx-auto max-h-96 w-full max-w-xs rounded-xl border border-input bg-white p-3 object-contain" @load="qrisImageLoaded = true; qrisImageError = false" @error="qrisImageError = true; qrisImageLoaded = false" >
            <p v-if="qrisImageError" class="store-error mt-3" role="alert">Gambar QRIS gagal dimuat. Jangan membayar; hubungi toko.</p>
          </div>
          <p class="store-muted mt-4">Rincian dan nominal dibekukan untuk pembayaran ini. Harga dan stok diperiksa server saat konfirmasi. Jika sudah membayar lalu terjadi kendala, hubungi toko dengan screenshot; jangan membayar lagi.</p>
        </section>
        <section class="store-panel store-checkout-panel">
          <h2><ImagePlus aria-hidden="true" class="mr-2 inline size-5" /> Bukti pembayaran berhasil</h2>
          <div class="store-field"><label for="checkout-proof">Screenshot pembayaran QRIS (wajib)</label><input id="checkout-proof" ref="proofInput" type="file" name="proof" accept="image/jpeg,image/png,image/webp" required :disabled="confirmationUncertain" :aria-invalid="!!proofError" :aria-describedby="proofError ? 'checkout-proof-help checkout-proof-error' : 'checkout-proof-help'" class="block w-full rounded-lg border border-input bg-white" @change="selectProof" ><p id="checkout-proof-help" class="store-muted">JPG, PNG atau WebP, maksimal 2 MB. Tampilkan status berhasil, nominal, tanggal dan merchant. Hindari data pribadi lain. Bukti hanya dapat dilihat pengelola.</p><p v-if="proofError" id="checkout-proof-error" role="alert" class="store-field-error">{{ proofError }}</p></div>
          <figure v-if="proofPreview" class="mt-4"><img :src="proofPreview" alt="Pratinjau screenshot bukti pembayaran yang dipilih" class="mx-auto max-h-96 max-w-full rounded-lg border border-input object-contain" ><figcaption class="store-muted mt-2">{{ proofFile?.name }} · {{ Math.ceil((proofFile?.size ?? 0) / 1024) }} KB</figcaption><Button v-if="!confirmationUncertain" type="button" variant="outline" class="mt-3" @click="clearProof">Hapus bukti</Button></figure>
        </section>
        <p v-if="actionError" id="checkout-action-error" tabindex="-1" class="store-error" role="alert">{{ actionError }}</p>
        <Button type="submit" variant="ai" class="store-wide-button" :loading="submitting" :disabled="!hydrated"><CheckCircle2 v-if="!submitting" aria-hidden="true" class="size-4" /> {{ confirmationUncertain ? 'Coba konfirmasi lagi dengan bukti yang sama' : 'Kirim bukti & konfirmasi pembelian' }}</Button>
        <Button v-if="!confirmationUncertain" type="button" variant="outline" class="store-wide-button" @click="editDetails"><ArrowLeft aria-hidden="true" class="size-4" /> Kembali ke rincian (jika belum membayar)</Button>
        <p class="store-muted">Pengiriman baru diproses setelah admin memverifikasi pembayaran. Screenshot tidak otomatis menjadikan transaksi lunas.</p>
      </fieldset>
    </form>
    <form v-else class="store-form !mt-0" method="post" novalidate @submit.prevent="submit">
      <fieldset class="contents" :disabled="!hydrated || !sessionReady || submitting || confirmationUncertain" aria-label="Rincian checkout">
        <section class="store-panel store-checkout-panel">
          <h2>Ringkasan pesanan</h2>
          <article class="store-checkout-line"><ProductImage :image-url="product.image_url" :name="product.name" :category="product.category" size="thumb" /><div><h3>{{ product.name }}</h3><p>Stok {{ product.current_stock }} unit · {{ formatIDR(view?.price ?? 0) }} / unit</p><p v-if="!view?.available" class="store-field-error">Produk tidak tersedia untuk checkout. Pilih produk lain atau tanyakan stok lewat chat.</p><div class="mt-3 flex items-center gap-3"><Button type="button" variant="outline" aria-label="Kurangi jumlah" :disabled="qty <= 1" @click="qty = Math.max(1, qty - 1)"><Minus aria-hidden="true" class="size-4" /></Button><span class="tabular-nums" aria-live="polite">{{ qty }}</span><Button type="button" variant="outline" aria-label="Tambah jumlah" :disabled="qty >= maxQty" @click="qty = Math.min(maxQty, qty + 1)"><Plus aria-hidden="true" class="size-4" /></Button></div></div></article>
          <div class="store-checkout-total"><span>Total produk</span><strong>{{ formatIDR(total) }}</strong></div>
          <NuxtLink :to="`/produk/${product.id}`" class="store-link">Ubah produk</NuxtLink>
          <p class="store-muted">Harga dan stok diperiksa kembali oleh server saat pesanan dibuat.</p>
          <div v-if="refreshError" class="store-error" role="alert"><p>{{ refreshError }}</p><Button type="button" variant="outline" @click="refreshExpired">Muat ulang harga</Button></div>
        </section>
        <section class="store-panel store-checkout-panel">
          <h2>Data pembeli</h2>
          <div class="store-checkout-fields">
            <div class="store-field"><label for="checkout-name">Nama lengkap</label><Input id="checkout-name" v-model="buyerName" name="name" autocomplete="name" required :aria-invalid="!!errors['checkout-name']" :aria-describedby="errors['checkout-name'] ? 'checkout-name-error' : undefined" /><p v-if="errors['checkout-name']" id="checkout-name-error" class="store-field-error">{{ errors['checkout-name'] }}</p></div>
            <div class="store-field"><label for="checkout-phone">Nomor telepon pembeli</label><Input id="checkout-phone" v-model="buyerPhone" type="tel" name="phone" autocomplete="tel" placeholder="081234567890" required :aria-invalid="!!errors['checkout-phone']" :aria-describedby="errors['checkout-phone'] ? 'checkout-phone-error' : undefined" /><p v-if="errors['checkout-phone']" id="checkout-phone-error" class="store-field-error">{{ errors['checkout-phone'] }}</p></div>
            <div class="store-field sm:col-span-2"><label for="checkout-contact">Kontak tambahan (opsional)</label><Input id="checkout-contact" v-model="buyerContact" name="contact" placeholder="Username Telegram atau kontak lain" maxlength="100" :aria-invalid="!!errors['checkout-contact']" :aria-describedby="errors['checkout-contact'] ? 'checkout-contact-error' : undefined" /><p v-if="errors['checkout-contact']" id="checkout-contact-error" class="store-field-error">{{ errors['checkout-contact'] }}</p></div>
          </div>
        </section>
        <section class="store-panel store-checkout-panel">
          <fieldset><legend class="mb-3 font-display text-lg font-semibold">Metode penerimaan</legend><div class="store-fulfillment-options"><label><input v-model="method" type="radio" name="fulfillment" value="PICKUP" ><ShoppingBag aria-hidden="true" class="size-4" /> Ambil di toko</label><label><input v-model="method" type="radio" name="fulfillment" value="DELIVERY" ><Truck aria-hidden="true" class="size-4" /> Diantar ke alamat</label></div></fieldset>
          <template v-if="method === 'DELIVERY'">
            <p class="store-description">Ongkir dibayar pembeli secara terpisah; tidak termasuk total produk.</p>
            <div class="store-checkout-fields mt-5">
              <div class="store-field"><label for="delivery-recipient">Nama penerima</label><Input id="delivery-recipient" v-model="recipient" name="recipient" autocomplete="shipping name" required :aria-invalid="!!errors['delivery-recipient']" :aria-describedby="errors['delivery-recipient'] ? 'delivery-recipient-error' : undefined" /><p v-if="errors['delivery-recipient']" id="delivery-recipient-error" class="store-field-error">{{ errors['delivery-recipient'] }}</p></div>
              <div class="store-field"><label for="delivery-phone">No. HP penerima</label><Input id="delivery-phone" v-model="phone" type="tel" name="phone" autocomplete="shipping tel" required :aria-invalid="!!errors['delivery-phone']" :aria-describedby="errors['delivery-phone'] ? 'delivery-phone-error' : undefined" /><p v-if="errors['delivery-phone']" id="delivery-phone-error" class="store-field-error">{{ errors['delivery-phone'] }}</p></div>
              <div class="store-field sm:col-span-2"><label for="delivery-address">Alamat lengkap</label><textarea id="delivery-address" v-model="address" name="address" autocomplete="shipping street-address" rows="3" required :aria-invalid="!!errors['delivery-address']" :aria-describedby="errors['delivery-address'] ? 'delivery-address-error' : undefined" class="rounded-md border border-input" /><p v-if="errors['delivery-address']" id="delivery-address-error" class="store-field-error">{{ errors['delivery-address'] }}</p></div>
              <div class="store-field sm:col-span-2"><label for="delivery-notes">Catatan kurir (opsional)</label><Input id="delivery-notes" v-model="notes" name="notes" /></div>
            </div>
          </template>
        </section>
        <section class="store-panel store-checkout-panel"><fieldset><legend class="mb-3 font-display text-lg font-semibold">Metode pembayaran</legend><div v-if="method === 'PICKUP'" class="store-fulfillment-options"><label><input v-model="paymentMethod" type="radio" name="payment" value="CASH" ><Banknote aria-hidden="true" class="size-4" /> Cash saat ambil di toko</label><label><input v-model="paymentMethod" type="radio" name="payment" value="QRIS" ><QrCode aria-hidden="true" class="size-4" /> QRIS sebelum konfirmasi</label></div><p v-else class="store-description"><QrCode aria-hidden="true" class="mr-2 inline size-4" /> Pengiriman ke alamat wajib QRIS; Cash tidak tersedia.</p><p v-if="paymentMethod === 'QRIS'" class="store-muted mt-3">Pada langkah berikutnya, bayar nominal QRIS dan lampirkan screenshot berhasil sebelum konfirmasi pembelian.</p><p v-if="paymentMethod === 'QRIS' && !qrisAvailable" class="store-error mt-3" role="alert">QRIS resmi belum dikonfigurasi toko. Hubungi toko untuk pembayaran; jangan transfer ke QR lain.</p></fieldset></section>
        <p v-if="actionError" id="checkout-action-error" tabindex="-1" class="store-error" role="alert">{{ actionError }}</p>
        <Button v-if="!confirmationUncertain" type="submit" variant="ai" class="store-wide-button" :loading="submitting" :disabled="!hydrated || !view?.available"><CheckCircle2 v-if="!submitting" aria-hidden="true" class="size-4" /> {{ !view?.available ? 'Produk tidak tersedia' : paymentMethod === 'QRIS' ? `Lanjut pembayaran QRIS · ${formatIDR(total)}` : `Konfirmasi pesanan Cash · ${formatIDR(total)}` }}</Button>
        <p class="store-muted">Stok ditahan saat pesanan tercatat. Pembayaran QRIS diperiksa admin; Cash dibayar saat pengambilan.</p>
      </fieldset>
    </form>
    <template v-if="confirmationUncertain && !qrisDraft && !receipt"><p id="checkout-action-error" tabindex="-1" class="store-error" role="alert">{{ actionError }}</p><Button variant="ai" class="store-wide-button" :loading="submitting" @click="submit">Coba konfirmasi lagi</Button></template>
  </div>
</template>
