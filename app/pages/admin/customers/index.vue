<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Pelanggan</h1>
    <p class="text-sm text-stone-500">Identitas per-channel (tidak disatukan lintas channel).</p>
    <Card>
      <CardContent>
        <!-- Form: tekan Enter langsung mencari. -->
        <form class="mb-3 flex flex-wrap gap-2" @submit.prevent="page = 1; load()">
          <Input v-model="fQ" placeholder="Cari nama / kontak / identifier…" class="min-w-0 max-w-full sm:max-w-72" aria-label="Cari pelanggan" />
          <Button type="submit" size="sm" variant="secondary">Cari</Button>
        </form>
        <p v-if="loading" class="py-4 text-center text-sm text-stone-500">Memuat daftar pelanggan…</p>
        <div v-else-if="loadError" role="alert" class="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <h2 class="font-semibold">Gagal memuat pelanggan</h2>
          <p v-if="loadError !== 'Gagal memuat pelanggan'" class="[overflow-wrap:anywhere]">{{ loadError }}</p>
          <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
        </div>
        <p v-else-if="!items.length" class="py-4 text-center text-sm text-stone-500">
          Belum ada pelanggan. Identitas tercatat saat customer pertama kali chat atau memesan.
        </p>
        <div v-else class="max-w-full overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">Nama</th><th class="pr-2">Channel</th><th class="pr-2">Identifier</th><th class="pr-2">Kontak</th><th/>
            </tr></thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-medium">{{ c.name }}</td>
                <td class="pr-2">{{ c.channel }}</td>
                <td class="pr-2 font-mono text-xs">{{ c.identifier }}</td>
                <td class="pr-2">{{ c.contact || '-' }}</td>
                <td><Button :to="`/admin/customers/${c.id}`" size="sm" variant="outline">Detail</Button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminPager :page="page" :count="items.length" :page-size="pageSize" :loading="loading || !!loadError" @prev="page--; load()" @next="page++; load()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { CustomerOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const items = ref<CustomerOut[]>([])
const loading = ref(true)
const loadError = ref('')
const fQ = ref('')
const page = ref(1)
const pageSize = 10

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await request<CustomerOut[]>('/customers', {
      query: { q: fQ.value || undefined, page: page.value, page_size: pageSize }
    })
  }
  catch (e: unknown) {
    loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat pelanggan'
    toast.fromError(e, 'Gagal memuat pelanggan')
  }
  finally { loading.value = false }
}
onMounted(load)
</script>
