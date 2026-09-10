<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Customer</h1>
    <p class="text-sm text-slate-500">Identitas per-channel (tidak disatukan lintas channel).</p>
    <ScCard>
      <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-slate-500">
            <th class="py-2 pr-2">Nama</th><th class="pr-2">Channel</th><th class="pr-2">Identifier</th><th class="pr-2">Kontak</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="c in items" :key="c.id" class="border-b border-slate-100">
              <td class="py-2 pr-2 font-medium">{{ c.name }}</td>
              <td class="pr-2">{{ c.channel }}</td>
              <td class="pr-2 font-mono text-xs">{{ c.identifier }}</td>
              <td class="pr-2">{{ c.contact || '-' }}</td>
              <td><NuxtLink :to="`/admin/customers/${c.id}`"><ScButton size="sm" variant="outline">Detail</ScButton></NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
import type { CustomerOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const items = ref<CustomerOut[]>([])
const error = ref('')

onMounted(async () => {
  try { items.value = await request<CustomerOut[]>('/customers') }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
})
</script>
