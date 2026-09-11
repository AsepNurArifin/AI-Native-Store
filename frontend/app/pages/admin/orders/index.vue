<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Order</h1>
    <ScCard>
      <div class="mb-3 flex flex-wrap gap-2">
        <select v-model="fStatus" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Semua status</option>
          <option>CONFIRMED</option><option>COMPLETED</option><option>CANCELLED</option>
        </select>
        <select v-model="fChannel" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Semua channel</option><option>WEB</option><option>WHATSAPP</option>
        </select>
        <Button size="sm" variant="secondary" @click="load()">Muat</Button>
      </div>
      <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-slate-500">
            <th class="py-2 pr-2">ID</th><th class="pr-2">Channel</th><th class="pr-2">Status</th>
            <th class="pr-2">Total</th><th class="pr-2">Dibuat</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="o in items" :key="o.id" class="border-b border-slate-100">
              <td class="py-2 pr-2 font-mono text-xs">{{ o.id.slice(0, 8) }}…</td>
              <td class="pr-2">{{ o.channel_origin }}</td>
              <td class="pr-2"><ScBadge :tone="statusClass(o.status)">{{ o.status }}</ScBadge></td>
              <td class="pr-2">{{ formatIDR(o.total_amount) }}</td>
              <td class="pr-2 text-xs">{{ formatWIB(o.created_at) }}</td>
              <td class="flex gap-1">
                <NuxtLink :to="`/admin/orders/${o.id}`"><Button size="sm" variant="outline">Detail</Button></NuxtLink>
                <Button v-if="o.status === 'CONFIRMED'" size="sm" variant="secondary" @click="complete(o)">Complete</Button>
                <Button v-if="o.status === 'CONFIRMED'" size="sm" variant="destructive" @click="cancel(o)">Cancel</Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusClass } from '~/utils/format'
import type { OrderOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const items = ref<OrderOut[]>([])
const error = ref('')
const fStatus = ref('')
const fChannel = ref('')

async function load() {
  error.value = ''
  try {
    items.value = await request<OrderOut[]>('/orders', {
      query: { status: fStatus.value || undefined, channel: fChannel.value || undefined, page: 1, page_size: 50 }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
async function complete(o: OrderOut) {
  try { await request(`/orders/${o.id}/complete`, { method: 'POST' }); await load() }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal' }
}
async function cancel(o: OrderOut) {
  if (!confirm('Batalkan order ini? Stok dikembalikan.')) return
  try { await request(`/orders/${o.id}/cancel`, { method: 'POST' }); await load() }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal' }
}
</script>
