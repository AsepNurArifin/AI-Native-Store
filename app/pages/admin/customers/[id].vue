<template>
  <div class="min-w-0 space-y-4">
    <NuxtLink to="/admin/customers" class="text-sm text-brand-700 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail pelanggan</h1>
    <Card v-if="loading">
      <CardContent><p class="text-sm text-stone-500">Memuat detail…</p></CardContent>
    </Card>
    <Card v-else-if="loadError" role="alert">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Gagal memuat detail pelanggan</h2>
        <p v-if="loadError !== 'Gagal memuat detail pelanggan'" class="text-sm [overflow-wrap:anywhere]">{{ loadError }}</p>
        <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
      </CardContent>
    </Card>
    <Card v-else-if="notFound">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Pelanggan tidak ditemukan.</h2>
        <Button to="/admin/customers" variant="outline">Kembali ke daftar</Button>
      </CardContent>
    </Card>
    <Card v-else-if="detail">
      <CardContent>
        <dl class="grid min-w-0 gap-2 text-sm [overflow-wrap:anywhere] md:grid-cols-2 [&>div]:min-w-0">
          <div><dt class="text-stone-500">Nama</dt><dd class="font-medium">{{ detail.name }}</dd></div>
          <div><dt class="text-stone-500">Channel</dt><dd>{{ detail.channel }}</dd></div>
          <div><dt class="text-stone-500">Identifier</dt><dd class="font-mono text-xs">{{ detail.identifier }}</dd></div>
          <div><dt class="text-stone-500">Kontak</dt><dd>{{ detail.contact || '-' }}</dd></div>
        </dl>
        <h2 class="mb-2 mt-4 font-semibold">Riwayat pesanan</h2>
        <div class="max-w-full overflow-x-auto" tabindex="0" role="region" aria-label="Riwayat pesanan pelanggan">
        <table class="w-full min-w-[32rem] text-sm">
          <thead><tr class="border-b text-left text-stone-500"><th class="py-1">ID</th><th>Status</th><th>Total</th><th>Dibuat</th></tr></thead>
          <tbody>
            <tr v-for="o in detail.orders" :key="o.id" class="border-b border-stone-100">
              <td class="py-1 font-mono text-xs">{{ o.id.slice(0, 8) }}…</td>
              <td><Badge :variant="statusVariant(o.status)">{{ o.status }}</Badge></td>
              <td>{{ formatIDR(o.total) }}</td><td class="text-xs">{{ formatWIB(o.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p v-if="!detail.orders.length" class="py-2 text-sm text-stone-500">Belum ada pesanan.</p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { CustomerDetail } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const toast = useToast()
const detail = ref<CustomerDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    detail.value = await request<CustomerDetail | null>(`/customers/${route.params.id}`)
    notFound.value = detail.value === null
  }
  catch (e: unknown) {
    if (e instanceof NormalizedApiError && e.status === 404) notFound.value = true
    else {
      loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat detail pelanggan'
      toast.fromError(e, 'Gagal memuat detail pelanggan')
    }
  }
  finally { loading.value = false }
}
onMounted(load)
</script>
