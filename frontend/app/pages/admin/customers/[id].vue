<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/customers" class="text-sm text-blue-600 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail Customer</h1>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <Card v-if="detail">
      <CardContent>
        <dl class="grid gap-2 text-sm md:grid-cols-2">
          <div><dt class="text-slate-500">Nama</dt><dd class="font-medium">{{ detail.name }}</dd></div>
          <div><dt class="text-slate-500">Channel</dt><dd>{{ detail.channel }}</dd></div>
          <div><dt class="text-slate-500">Identifier</dt><dd class="font-mono text-xs">{{ detail.identifier }}</dd></div>
          <div><dt class="text-slate-500">Kontak</dt><dd>{{ detail.contact || '-' }}</dd></div>
        </dl>
        <h2 class="mb-2 mt-4 font-semibold">Histori order</h2>
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-slate-500"><th class="py-1">ID</th><th>Status</th><th>Total</th><th>Dibuat</th></tr></thead>
          <tbody>
            <tr v-for="o in detail.orders" :key="o.id" class="border-b border-slate-100">
              <td class="py-1 font-mono text-xs">{{ o.id.slice(0, 8) }}…</td>
              <td><Badge :variant="statusVariant(o.status)">{{ o.status }}</Badge></td>
              <td>{{ formatIDR(o.total) }}</td><td class="text-xs">{{ formatWIB(o.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!detail.orders.length" class="py-2 text-sm text-slate-500">Belum ada order.</p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatIDR, formatWIB, statusVariant } from '~/utils/format'
import type { CustomerDetail } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const route = useRoute()
const { request } = useApi()
const detail = ref<CustomerDetail | null>(null)
const error = ref('')

onMounted(async () => {
  try { detail.value = await request<CustomerDetail>(`/customers/${route.params.id}`) }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
})
</script>
