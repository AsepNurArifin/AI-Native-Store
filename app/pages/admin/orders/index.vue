<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Pesanan</h1>
    <Card>
      <CardContent>
        <div class="mb-3 flex flex-wrap gap-2">
          <select v-model="fStatus" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua status</option>
            <option>CONFIRMED</option><option>COMPLETED</option><option>CANCELLED</option>
          </select>
          <select v-model="fChannel" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua channel</option><option>WEB</option><option>TELEGRAM</option>
          </select>
          <select v-model="fPayment" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua pembayaran</option><option value="UNPAID">Belum dibayar</option><option value="PAID">Sudah dibayar</option>
          </select>
          <Button size="sm" variant="secondary" @click="page = 1; load()">Terapkan filter</Button>
        </div>
        <!-- Mobile: kartu per pesanan (tabel tidak muat di <640px) -->
        <div v-if="loading" class="py-4 text-center text-sm text-stone-500 sm:hidden">
          Memuat daftar pesanan…
        </div>
        <div v-else-if="!items.length" class="py-4 text-center text-sm text-stone-500 sm:hidden">
          Belum ada pesanan yang cocok. Pesanan tercatat saat customer mengonfirmasi lewat chat.
        </div>
        <div v-else class="space-y-3 sm:hidden">
          <div v-for="o in items" :key="o.id" class="rounded-xl border border-stone-200 bg-white p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-bold text-stone-800">#{{ o.id.slice(0, 8) }}…</span>
              <div class="flex gap-1">
                <Badge :variant="statusVariant(o.status)">{{ o.status }}</Badge>
                <Badge v-if="o.status === 'CONFIRMED'" :variant="statusVariant(o.payment_status)">{{ o.payment_status === 'PAID' ? 'Lunas' : 'Belum bayar' }}</Badge>
              </div>
            </div>
            <div class="mt-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span class="font-semibold text-stone-900">{{ formatIDR(o.total_amount) }}</span>
              <span class="text-xs text-stone-500">{{ o.channel_origin }} · {{ formatWIB(o.created_at) }}</span>
            </div>
            <div class="mt-2.5 flex gap-2">
              <NuxtLink :to="`/admin/orders/${o.id}`" class="flex-1"><Button size="sm" variant="outline" class="w-full">Detail</Button></NuxtLink>
              <template v-if="o.status === 'CONFIRMED'">
                <Button v-if="o.payment_status !== 'PAID'" size="sm" variant="secondary" class="flex-1" @click="markPaid(o)">Tandai Lunas</Button>
                <Button size="sm" variant="secondary" class="flex-1" @click="complete(o)">Complete</Button>
                <Button size="sm" variant="ghostDanger" class="flex-1" @click="cancel(o)">Cancel</Button>
              </template>
            </div>
          </div>
        </div>
        <div class="hidden overflow-x-auto sm:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">ID</th><th class="pr-2">Channel</th><th class="pr-2">Status</th><th class="pr-2">Bayar</th>
              <th class="pr-2">Total</th><th class="pr-2">Dibuat</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="py-4 text-center text-sm text-stone-500">Memuat daftar pesanan…</td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="7" class="py-4 text-center text-sm text-stone-500">
                  Belum ada pesanan yang cocok. Pesanan tercatat saat customer mengonfirmasi lewat chat.
                </td>
              </tr>
              <tr v-for="o in items" :key="o.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ o.id.slice(0, 8) }}…</td>
                <td class="pr-2">{{ o.channel_origin }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(o.status)">{{ o.status }}</Badge></td>
                <td class="pr-2">
                  <Badge v-if="o.status === 'CONFIRMED'" :variant="statusVariant(o.payment_status)">
                    {{ o.payment_status === 'PAID' ? 'Lunas' : 'Belum bayar' }}
                  </Badge>
                  <span v-else class="text-xs text-stone-400">—</span>
                </td>
                <td class="pr-2">{{ formatIDR(o.total_amount) }}</td>
                <td class="pr-2 text-xs">{{ formatWIB(o.created_at) }}</td>
                <td class="flex gap-1">
                  <NuxtLink :to="`/admin/orders/${o.id}`"><Button size="sm" variant="outline">Detail</Button></NuxtLink>
                  <Button v-if="o.status === 'CONFIRMED' && o.payment_status !== 'PAID'" size="sm" variant="secondary" @click="markPaid(o)">Lunas</Button>
                  <Button v-if="o.status === 'CONFIRMED'" size="sm" variant="secondary" @click="complete(o)">Complete</Button>
                  <Button v-if="o.status === 'CONFIRMED'" size="sm" variant="ghostDanger" @click="cancel(o)">Cancel</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminPager :page="page" :count="items.length" :page-size="pageSize" :loading="loading" @prev="page--; load()" @next="page++; load()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { OrderOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const toast = useToast()
const confirmAction = useConfirm()
const items = ref<OrderOut[]>([])
const loading = ref(false)
const fStatus = ref('')
const fChannel = ref('')
const fPayment = ref('')
const page = ref(1)
const pageSize = 10

async function load() {
  loading.value = true
  try {
    items.value = await request<OrderOut[]>('/orders', {
      query: {
        status: fStatus.value || undefined,
        channel: fChannel.value || undefined,
        payment_status: fPayment.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    })
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat pesanan') }
  finally { loading.value = false }
}
onMounted(load)
async function markPaid(o: OrderOut) {
  try {
    await request(`/orders/${o.id}/pay`, { method: 'POST' })
    toast.success(`Order #${o.id.slice(0, 8)}… ditandai lunas.`)
    await load()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menandai lunas') }
}
async function complete(o: OrderOut) {
  try {
    await request(`/orders/${o.id}/complete`, { method: 'POST' })
    toast.success(`Order #${o.id.slice(0, 8)}… diselesaikan.`)
    await load()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal menyelesaikan order') }
}
async function cancel(o: OrderOut) {
  const ok = await confirmAction.ask({
    title: `Batalkan order #${o.id.slice(0, 8)}…?`,
    message: 'Stok produk di order ini akan dikembalikan ke katalog.',
    confirmLabel: 'Batalkan order',
    tone: 'danger'
  })
  if (!ok) return
  try {
    await request(`/orders/${o.id}/cancel`, { method: 'POST' })
    toast.success('Order dibatalkan, stok dikembalikan.')
    await load()
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal membatalkan order') }
}
</script>
