<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Customer</h1>
    <p class="text-sm text-stone-500">Identitas per-channel (tidak disatukan lintas channel).</p>
    <Card>
      <CardContent>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Nama</th><th class="pr-2">Channel</th><th class="pr-2">Identifier</th><th class="pr-2">Kontak</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">{{ c.name }}</td>
                <td class="pr-2">{{ c.channel }}</td>
                <td class="pr-2 font-mono text-xs">{{ c.identifier }}</td>
                <td class="pr-2">{{ c.contact || '-' }}</td>
                <td><NuxtLink :to="`/admin/customers/${c.id}`"><Button size="sm" variant="outline">Detail</Button></NuxtLink></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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
