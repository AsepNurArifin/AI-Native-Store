<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Percakapan</h1>
    <Card>
      <CardContent>
        <div class="mb-3 flex gap-2">
          <select v-model="fChannel" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua channel</option><option>WEB</option><option>TELEGRAM</option><option>WHATSAPP</option>
          </select>
          <Button size="sm" variant="secondary" @click="load()">Muat</Button>
        </div>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">ID</th><th class="pr-2">Channel</th><th class="pr-2">Outcome</th><th class="pr-2">Aktivitas</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">Memuat daftar percakapan…</td>
              </tr>
              <tr v-else-if="!items.length">
                <td colspan="5" class="py-4 text-center text-sm text-stone-500">
                  Belum ada percakapan. Obrolan customer lewat chat toko akan tercatat di sini.
                </td>
              </tr>
              <tr v-for="c in items" :key="c.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ c.id.slice(0, 8) }}…</td>
                <td class="pr-2">{{ c.channel }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(c.outcome)">{{ c.outcome || '-' }}</Badge></td>
                <td class="pr-2 text-xs">{{ formatWIB(c.last_activity_at) }}</td>
                <td><NuxtLink :to="`/admin/conversations/${c.id}`"><Button size="sm" variant="outline">Buka</Button></NuxtLink></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusVariant } from '~/utils/format'
import type { ConversationOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const { request } = useApi()
const items = ref<ConversationOut[]>([])
const error = ref('')
const loading = ref(false)
const fChannel = ref('')

async function load() {
  error.value = ''
  loading.value = true
  try {
    items.value = await request<ConversationOut[]>('/conversations', {
      query: { channel: fChannel.value || undefined, page: 1, page_size: 50 }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
  finally { loading.value = false }
}
onMounted(load)
</script>
