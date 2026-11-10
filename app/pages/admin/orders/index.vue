<template>
  <div class="min-w-0 space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-promo-700">Operasional toko</p>
        <h1 class="mt-2 text-3xl font-bold text-brand-900 [font-family:var(--font-display)]">Pesanan</h1>
        <p class="mt-2 text-sm text-muted-foreground">Periksa pembayaran, hubungi pembeli, dan pantau penerimaan pesanan.</p>
      </div>
      <Button type="button" variant="outline" class="min-h-11" :disabled="!!mutation" :loading="loading" @click="load()">Muat ulang</Button>
    </header>
    <Card>
      <CardContent class="pt-6">
        <form class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto]" @submit.prevent="page = 1; load()">
          <Input v-model="fQ" aria-label="Cari pesanan" placeholder="Cari ID pesanan / nama pembeli…" class="min-h-11 min-w-0" :disabled="!!mutation" />
          <select v-model="fStatus" aria-label="Filter status pesanan" class="min-h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm" :disabled="!!mutation">
            <option value="">Semua status</option><option value="CONFIRMED">Aktif</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option>
          </select>
          <select v-model="fChannel" aria-label="Filter channel" class="min-h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm" :disabled="!!mutation">
            <option value="">Semua channel</option><option>WEB</option><option>TELEGRAM</option>
          </select>
          <select v-model="fPayment" aria-label="Filter pembayaran" class="min-h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm" :disabled="!!mutation">
            <option value="">Semua pembayaran</option><option value="UNPAID">Belum lunas</option><option value="PAID">Lunas</option>
          </select>
          <Button type="submit" class="min-h-11" :disabled="loading || !!mutation">Terapkan filter</Button>
        </form>
        <p class="mt-4 text-xs leading-relaxed text-muted-foreground">Pembayaran QRIS harus diperiksa melalui detail pesanan. Bukti unggahan tidak otomatis menjadikan pesanan lunas.</p>
        <div v-if="mutationError" role="alert" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 [overflow-wrap:anywhere]">{{ mutationError }}</div>
        <div v-if="loading" role="status" class="py-10 text-center text-sm text-muted-foreground">Memuat daftar pesanan…</div>
        <div v-else-if="loadError" role="alert" class="mt-5 space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <h2 class="font-semibold">Gagal memuat pesanan</h2>
          <p class="[overflow-wrap:anywhere]">{{ loadError }}</p>
          <Button type="button" variant="outline" class="min-h-11" @click="load()">Coba lagi</Button>
        </div>
        <div v-else-if="!items.length" class="py-10 text-center text-sm text-muted-foreground">Belum ada pesanan yang cocok dengan filter.</div>
        <template v-else>
          <div class="mt-6 space-y-4 lg:hidden">
            <article v-for="o in items" :key="o.id" class="rounded-xl border border-border bg-background p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><NuxtLink :to="`/admin/orders/${o.id}`" class="font-mono text-sm font-bold text-brand-900 hover:underline">#{{ o.id.slice(0, 8) }}</NuxtLink><p class="mt-1 text-xs text-muted-foreground">{{ o.channel_origin }} · {{ formatWIB(o.created_at) }}</p></div>
                <Badge :variant="statusVariant(o.status)">{{ orderStatusLabel(o.status) }}</Badge>
              </div>
              <div class="mt-4 space-y-1 text-sm">
                <p class="font-semibold [overflow-wrap:anywhere]">{{ o.buyer?.name || 'Nama pembeli tidak tersedia' }}</p>
                <a v-if="o.buyer?.phone" :href="phoneLink(o.buyer.phone)" class="inline-flex min-h-8 items-center text-brand-700 underline underline-offset-4">{{ o.buyer.phone }}</a>
                <p v-else class="text-xs text-muted-foreground">Telepon tidak dicantumkan</p>
                <p v-if="o.buyer?.contact" class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ o.buyer.contact }}</p>
              </div>
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p class="text-lg font-bold text-brand-900 tabular-nums">{{ formatIDR(o.total_amount) }}</p>
                <div class="flex flex-wrap gap-2"><Badge :variant="statusVariant(o.payment_status)">{{ o.payment_status === 'PAID' ? 'Lunas' : 'Belum lunas' }}</Badge><Badge v-if="o.payment_review" variant="outline">{{ reviewLabel(o.payment_review) }}</Badge></div>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">{{ paymentLabel(o) }}</p>
              <p v-if="isPendingReview(o) && o.status === 'CONFIRMED'" class="mt-1 text-xs font-semibold text-promo-700">Menunggu pemeriksaan bukti · tanpa kedaluwarsa</p>
              <p class="mt-2 text-sm font-medium text-brand-700">{{ fulfillmentLabel(o) }}<span v-if="o.fulfillment?.method === 'DELIVERY'"> · {{ deliveryLabel(o.delivery_status) }}</span></p>
              <p v-if="deliveryTimestamp(o)" class="mt-1 text-xs text-muted-foreground">{{ formatWIB(deliveryTimestamp(o)) }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <Button :to="`/admin/orders/${o.id}`" size="sm" :variant="isPendingReview(o) && o.status === 'CONFIRMED' ? 'default' : 'outline'" class="min-h-11 whitespace-normal">{{ isPendingReview(o) && o.status === 'CONFIRMED' ? 'Periksa bukti' : 'Detail' }}</Button>
                <Button v-if="canCollectCash(o)" type="button" size="sm" variant="secondary" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === `${o.id}:pay`" @click="markPaid(o)">{{ o.payment_method === 'CASH' ? 'Terima tunai' : 'Tandai lunas' }}</Button>
                <Button v-if="canComplete(o)" type="button" size="sm" variant="secondary" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === `${o.id}:complete`" @click="complete(o)">Selesaikan</Button>
                <Button v-if="canCancel(o)" type="button" size="sm" variant="ghostDanger" class="min-h-11" :disabled="!!mutation" :loading="mutation === `${o.id}:cancel`" @click="cancel(o)">Batalkan</Button>
              </div>
            </article>
          </div>
          <div class="mt-6 hidden max-w-full overflow-x-auto lg:block" tabindex="0" role="region" aria-label="Daftar pesanan">
            <table class="w-full min-w-[66rem] text-sm">
              <thead><tr class="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th class="pb-3 pr-4">Pesanan</th><th class="pb-3 pr-4">Pembeli</th><th class="pb-3 pr-4">Pembayaran</th><th class="pb-3 pr-4">Penerimaan</th><th class="pb-3 pr-4">Total</th><th class="pb-3">Aksi</th></tr></thead>
              <tbody>
                <tr v-for="o in items" :key="o.id" class="border-b border-border last:border-0">
                  <td class="py-5 pr-4 align-top"><NuxtLink :to="`/admin/orders/${o.id}`" class="font-mono font-bold text-brand-900 hover:underline">#{{ o.id.slice(0, 8) }}</NuxtLink><p class="mt-1 text-xs text-muted-foreground">{{ o.channel_origin }} · {{ formatWIB(o.created_at) }}</p><Badge class="mt-2" :variant="statusVariant(o.status)">{{ orderStatusLabel(o.status) }}</Badge></td>
                  <td class="max-w-56 py-5 pr-4 align-top"><p class="font-semibold [overflow-wrap:anywhere]">{{ o.buyer?.name || 'Nama tidak tersedia' }}</p><a v-if="o.buyer?.phone" :href="phoneLink(o.buyer.phone)" class="mt-1 inline-flex min-h-8 items-center text-xs text-brand-700 underline underline-offset-4">{{ o.buyer.phone }}</a><p v-else class="mt-1 text-xs text-muted-foreground">Telepon tidak dicantumkan</p><p v-if="o.buyer?.contact" class="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ o.buyer.contact }}</p></td>
                  <td class="py-5 pr-4 align-top"><Badge :variant="statusVariant(o.payment_status)">{{ o.payment_status === 'PAID' ? 'Lunas' : 'Belum lunas' }}</Badge><p class="mt-2 text-xs text-muted-foreground">{{ paymentLabel(o) }}</p><p v-if="o.payment_review" class="mt-1 text-xs font-semibold" :class="isPendingReview(o) ? 'text-promo-700' : 'text-brand-700'">{{ reviewLabel(o.payment_review) }}</p><p v-if="isPendingReview(o) && o.status === 'CONFIRMED'" class="mt-1 text-xs text-muted-foreground">Tanpa kedaluwarsa selama pemeriksaan</p></td>
                  <td class="py-5 pr-4 align-top"><p class="font-medium">{{ fulfillmentLabel(o) }}</p><p v-if="o.fulfillment?.method === 'DELIVERY'" class="mt-2 text-xs font-semibold text-brand-700">{{ deliveryLabel(o.delivery_status) }}</p><p v-if="deliveryTimestamp(o)" class="mt-1 text-xs text-muted-foreground">{{ formatWIB(deliveryTimestamp(o)) }}</p></td>
                  <td class="py-5 pr-4 align-top font-bold text-brand-900 tabular-nums">{{ formatIDR(o.total_amount) }}</td>
                  <td class="py-5 align-top"><div class="flex max-w-64 flex-wrap gap-2">
                    <Button :to="`/admin/orders/${o.id}`" size="sm" :variant="isPendingReview(o) && o.status === 'CONFIRMED' ? 'default' : 'outline'" class="min-h-11 whitespace-normal">{{ isPendingReview(o) && o.status === 'CONFIRMED' ? 'Periksa bukti' : 'Detail' }}</Button>
                    <Button v-if="canCollectCash(o)" type="button" size="sm" variant="secondary" class="min-h-11 whitespace-normal" :disabled="!!mutation" :loading="mutation === `${o.id}:pay`" @click="markPaid(o)">{{ o.payment_method === 'CASH' ? 'Terima tunai' : 'Tandai lunas' }}</Button>
                    <Button v-if="canComplete(o)" type="button" size="sm" variant="secondary" class="min-h-11" :disabled="!!mutation" :loading="mutation === `${o.id}:complete`" @click="complete(o)">Selesaikan</Button>
                    <Button v-if="canCancel(o)" type="button" size="sm" variant="ghostDanger" class="min-h-11" :disabled="!!mutation" :loading="mutation === `${o.id}:cancel`" @click="cancel(o)">Batalkan</Button>
                  </div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <AdminPager class="mt-5" :page="page" :count="items.length" :page-size="pageSize" :loading="loading || !!loadError || !!mutation" @prev="page--; load()" @next="page++; load()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
const items = ref<OrderOut[]>([])
const loading = ref(true)
const loadError = ref('')
const mutation = ref('')
const mutationError = ref('')
const fStatus = ref('')
const fChannel = ref('')
const fPayment = ref('')
const fQ = ref('')
const page = ref(1)
const pageSize = 10
let loadSequence = 0

function isPendingReview(o: OrderOut) { return o.payment_method === 'QRIS' && o.payment_review === 'PENDING' }
function canCollectCash(o: OrderOut) { return o.status === 'CONFIRMED' && o.payment_status !== 'PAID' && o.payment_method !== 'QRIS' && (o.fulfillment?.method !== 'DELIVERY' || !o.payment_method) }
function canComplete(o: OrderOut) { return o.status === 'CONFIRMED' && o.payment_status === 'PAID' && (o.payment_method !== 'QRIS' || o.payment_review === 'VERIFIED') && (o.fulfillment?.method !== 'DELIVERY' || !o.payment_method || o.delivery_status === 'DELIVERED') }
function canCancel(o: OrderOut) { return o.status === 'CONFIRMED' && (o.payment_method !== 'QRIS' || o.payment_review === 'VERIFIED') && o.delivery_status !== 'SHIPPING' && o.delivery_status !== 'DELIVERED' }
function phoneLink(phone: string) { return `tel:${phone.replace(/[^\d+]/g, '')}` }
function orderStatusLabel(status: string) { return ({ CONFIRMED: 'Aktif', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' } as Record<string, string>)[status] || status }
function reviewLabel(status: string) { return ({ PENDING: 'Menunggu verifikasi', VERIFIED: 'Terverifikasi', REJECTED: 'Bukti ditolak' } as Record<string, string>)[status] || status }
function paymentLabel(o: OrderOut) { return o.payment_method === 'QRIS' ? 'QRIS' : o.payment_method === 'CASH' ? o.payment_status === 'PAID' ? 'Tunai' : 'Tunai · tagih saat ambil' : 'Metode tidak dicantumkan' }
function fulfillmentLabel(o: OrderOut) { return o.fulfillment?.method === 'DELIVERY' ? 'Pengiriman' : o.fulfillment?.method === 'PICKUP' ? 'Ambil di toko' : 'Pesanan lama' }
function deliveryLabel(status: OrderOut['delivery_status']) { return status === 'DELIVERED' ? 'Diterima pelanggan' : status === 'SHIPPING' ? 'Dalam pengiriman' : 'Belum dikirim' }
function deliveryTimestamp(o: OrderOut) { return (o.delivery_status === 'DELIVERED' ? o.delivered_at : o.delivery_status === 'SHIPPING' ? o.shipped_at : null) || null }

async function load() {
  if (mutation.value) return
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = ''
  mutationError.value = ''
  try {
    const result = await request<OrderOut[]>('/orders', {
      query: {
        q: fQ.value || undefined,
        status: fStatus.value || undefined,
        channel: fChannel.value || undefined,
        payment_status: fPayment.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    })
    if (sequence === loadSequence) items.value = result
  }
  catch (e: unknown) {
    if (sequence !== loadSequence) return
    loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat pesanan'
    toast.fromError(e, 'Gagal memuat pesanan')
  }
  finally { if (sequence === loadSequence) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { loadSequence++ })

function applyOrder(result: OrderOut) {
  const index = items.value.findIndex(o => o.id === result.id)
  const keep = (!fStatus.value || result.status === fStatus.value)
    && (!fChannel.value || result.channel_origin === fChannel.value)
    && (!fPayment.value || result.payment_status === fPayment.value)
  if (!keep) {
    if (index >= 0) items.value.splice(index, 1)
    return
  }
  if (index >= 0) items.value[index] = result
}
async function mutate(o: OrderOut, endpoint: 'pay' | 'complete' | 'cancel', allowed: (o: OrderOut) => boolean, confirmation: Parameters<typeof confirmAction.ask>[0], message: string) {
  if (mutation.value || loading.value || !allowed(o)) return
  mutation.value = `${o.id}:${endpoint}`
  mutationError.value = ''
  try {
    if (!await confirmAction.ask(confirmation)) return
    const current = items.value.find(item => item.id === o.id)
    if (!current || !allowed(current)) return
    applyOrder(await request<OrderOut>(`/orders/${encodeURIComponent(o.id)}/${endpoint}`, { method: 'POST' }))
    toast.success(message)
  }
  catch (e: unknown) {
    mutationError.value = `Pesanan #${o.id.slice(0, 8)}: ${e instanceof Error && e.message ? e.message : 'Perubahan gagal. Coba lagi.'}`
    toast.fromError(e, 'Gagal memperbarui pesanan')
  }
  finally { mutation.value = '' }
}
async function markPaid(o: OrderOut) {
  await mutate(o, 'pay', canCollectCash, {
    title: `Pembayaran pesanan #${o.id.slice(0, 8)} sudah diterima?`,
    message: `Pastikan ${o.payment_method === 'CASH' ? 'uang tunai' : 'pembayaran'} sebesar ${formatIDR(o.total_amount)} benar-benar diterima. Pesanan akan ditandai lunas dan dicatat sebagai pendapatan.`,
    confirmLabel: 'Ya, pembayaran diterima'
  }, `Pembayaran pesanan #${o.id.slice(0, 8)} dikonfirmasi.`)
}
async function complete(o: OrderOut) {
  await mutate(o, 'complete', canComplete, {
    title: `Selesaikan pesanan #${o.id.slice(0, 8)}?`,
    message: o.fulfillment?.method === 'DELIVERY' ? 'Pastikan kurir atau pelanggan telah mengonfirmasi seluruh produk diterima dan pembayaran sudah lunas. Pesanan baru wajib berstatus diterima pelanggan; pesanan lama tanpa metode pembayaran memerlukan konfirmasi penerimaan manual.' : 'Pastikan seluruh produk sudah diserahkan kepada pembeli dan pembayaran sudah lunas. Pesanan tidak dapat diubah setelah selesai.',
    confirmLabel: 'Ya, serah terima selesai'
  }, `Pesanan #${o.id.slice(0, 8)} diselesaikan.`)
}
async function cancel(o: OrderOut) {
  await mutate(o, 'cancel', canCancel, {
    title: `Batalkan pesanan #${o.id.slice(0, 8)}?`,
    message: 'Pesanan akan dibatalkan dan stok dikembalikan. Pastikan pelanggan telah diberi tahu. Jika pembayaran sudah diterima, koordinasikan pengembalian dana secara manual.',
    confirmLabel: 'Batalkan pesanan',
    tone: 'danger'
  }, `Pesanan #${o.id.slice(0, 8)} dibatalkan, stok dikembalikan.`)
}
</script>
