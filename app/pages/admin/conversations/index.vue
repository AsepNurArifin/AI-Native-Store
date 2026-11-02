<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Percakapan</h1>
    <Card>
      <CardContent>
        <!-- Form: tekan Enter langsung mencari. -->
        <form class="mb-3 flex flex-wrap gap-2" @submit.prevent="page = 1; load()">
          <Input v-model="fQ" placeholder="Cari ID percakapan / pelanggan…" class="min-w-0 max-w-full sm:max-w-64" aria-label="Cari percakapan" />
          <select v-model="fChannel" aria-label="Filter channel" class="h-9 min-w-0 max-w-full rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua channel</option><option>WEB</option><option>TELEGRAM</option><option>WHATSAPP</option>
          </select>
          <Button type="submit" size="sm" variant="secondary">Cari</Button>
        </form>
        <p v-if="loading" class="py-4 text-center text-sm text-stone-500">Memuat daftar percakapan…</p>
        <div v-else-if="loadError" role="alert" class="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <h2 class="font-semibold">Gagal memuat percakapan</h2>
          <p v-if="loadError !== 'Gagal memuat percakapan'" class="[overflow-wrap:anywhere]">{{ loadError }}</p>
          <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
        </div>
        <p v-else-if="!items.length" class="py-4 text-center text-sm text-stone-500">
          Belum ada percakapan. Obrolan customer lewat chat toko akan tercatat di sini.
        </p>
        <div v-else class="max-w-full overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">ID</th><th class="pr-2">Channel</th><th class="pr-2">Outcome</th><th class="pr-2">Aktivitas</th><th/>
            </tr></thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ c.id.slice(0, 8) }}…</td>
                <td class="pr-2">{{ c.channel }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(c.outcome)">{{ c.outcome || '-' }}</Badge></td>
                <td class="pr-2 text-xs">{{ formatWIB(c.last_activity_at) }}</td>
                <td><Button :to="`/admin/conversations/${c.id}`" size="sm" variant="outline">Buka</Button></td>
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
import { formatWIB, statusVariant } from '~/utils/format'
import type { ConversationOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const items = ref<ConversationOut[]>([])
const loading = ref(true)
const loadError = ref('')
const fChannel = ref('')
const fQ = ref('')
const page = ref(1)
const pageSize = 10

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await request<ConversationOut[]>('/conversations', {
      query: { q: fQ.value || undefined, channel: fChannel.value || undefined, page: page.value, page_size: pageSize }
    })
  }
  catch (e: unknown) {
    loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat percakapan'
    toast.fromError(e, 'Gagal memuat percakapan')
  }
  finally { loading.value = false }
}
onMounted(load)
</script>
