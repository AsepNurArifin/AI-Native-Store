<template>
  <div class="min-w-0 space-y-4">
    <NuxtLink to="/admin/conversations" class="text-sm text-brand-700 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail percakapan</h1>
    <Card v-if="loading">
      <CardContent><p class="text-sm text-stone-500">Memuat detail…</p></CardContent>
    </Card>
    <Card v-else-if="loadError" role="alert">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Gagal memuat detail percakapan</h2>
        <p v-if="loadError !== 'Gagal memuat detail percakapan'" class="text-sm [overflow-wrap:anywhere]">{{ loadError }}</p>
        <Button type="button" variant="outline" @click="load()">Coba lagi</Button>
      </CardContent>
    </Card>
    <Card v-else-if="notFound">
      <CardContent class="space-y-3">
        <h2 class="font-semibold">Percakapan tidak ditemukan.</h2>
        <Button to="/admin/conversations" variant="outline">Kembali ke daftar</Button>
      </CardContent>
    </Card>
    <div v-else-if="detail" class="grid gap-4 lg:grid-cols-3">
      <div class="min-w-0 space-y-3 lg:col-span-2">
        <Card>
          <CardHeader>
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{{ detail.channel }} · <Badge :variant="statusVariant(detail.outcome)">{{ detail.outcome || 'OPEN' }}</Badge></span>
              <span class="text-xs text-stone-500">{{ formatWIB(detail.last_activity_at) }}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div class="max-h-[480px] space-y-2 overflow-y-auto">
              <div v-for="m in detail.messages" :key="m.id" class="flex" :class="m.sender === 'CUSTOMER' ? 'justify-end' : 'justify-start'">
                <div class="min-w-0 max-w-[80%] rounded-lg px-3 py-2 text-sm [overflow-wrap:anywhere]" :class="m.sender === 'CUSTOMER' ? 'bg-stone-900 text-white' : 'bg-stone-100 '">
                  <MarkdownText v-if="m.sender === 'AI'" :text="m.content" />
                  <p v-else class="whitespace-pre-wrap">{{ m.content }}</p>
                  <p class="mt-1 text-[10px] text-stone-500">{{ m.message_type }} · {{ formatWIB(m.timestamp) }}</p>
                </div>
              </div>
              <p v-if="!detail.messages.length" class="text-sm text-stone-500">Belum ada pesan.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div class="min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Rekomendasi AI</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="detail.recommendations.length" class="space-y-2 text-sm">
              <div v-for="r in detail.recommendations" :key="r.id" class="min-w-0 rounded border border-stone-200 p-2 [overflow-wrap:anywhere]">
                <p class="font-mono text-xs">{{ r.product_id.slice(0, 8) }}…</p>
                <p class="text-stone-600">{{ r.reason }}</p>
              </div>
            </div>
            <p v-else class="text-sm text-stone-500">Belum ada rekomendasi.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusVariant } from '~/utils/format'
import type { ConversationDetail } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const toast = useToast()
const detail = ref<ConversationDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    detail.value = await request<ConversationDetail | null>(`/conversations/${route.params.id}`)
    notFound.value = detail.value === null
  }
  catch (e: unknown) {
    if (e instanceof NormalizedApiError && e.status === 404) notFound.value = true
    else {
      loadError.value = e instanceof Error && e.message ? e.message : 'Gagal memuat detail percakapan'
      toast.fromError(e, 'Gagal memuat detail percakapan')
    }
  }
  finally { loading.value = false }
}
onMounted(load)
</script>
