<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/conversations" class="text-sm text-clay-600 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail Percakapan</h1>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="detail" class="grid gap-4 lg:grid-cols-3">
      <div class="space-y-3 lg:col-span-2">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between text-sm">
              <span>{{ detail.channel }} · <Badge :variant="statusVariant(detail.outcome)">{{ detail.outcome || 'OPEN' }}</Badge></span>
              <span class="text-xs text-stone-500">{{ formatWIB(detail.last_activity_at) }}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div class="max-h-[480px] space-y-2 overflow-y-auto">
              <div v-for="m in detail.messages" :key="m.id" class="flex" :class="m.sender === 'CUSTOMER' ? 'justify-end' : 'justify-start'">
                <div class="max-w-[80%] rounded-lg px-3 py-2 text-sm" :class="m.sender === 'CUSTOMER' ? 'bg-stone-900 text-white' : 'bg-stone-100 '">
                  <p class="whitespace-pre-wrap">{{ m.content }}</p>
                  <p class="mt-1 text-[10px] opacity-60">{{ m.message_type }} · {{ formatWIB(m.timestamp) }}</p>
                </div>
              </div>
              <p v-if="!detail.messages.length" class="text-sm text-stone-500">Belum ada pesan.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Rekomendasi AI</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="detail.recommendations.length" class="space-y-2 text-sm">
              <div v-for="r in detail.recommendations" :key="r.id" class="rounded border border-stone-200 p-2">
                <p class="font-mono text-xs">{{ r.product_id.slice(0, 8) }}…</p>
                <p class="text-stone-600">{{ r.reason }}</p>
              </div>
            </div>
            <p v-else class="text-sm text-stone-500">Belum ada rekomendasi.</p>
          </CardContent>
        </Card>
      </div>
    </div>
    <p v-else-if="!error" class="text-sm text-stone-500">Memuat…</p>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusVariant } from '~/utils/format'
import type { ConversationDetail } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: 'auth' })
const route = useRoute()
const { request } = useApi()
const detail = ref<ConversationDetail | null>(null)
const error = ref('')

onMounted(async () => {
  try { detail.value = await request<ConversationDetail>(`/conversations/${route.params.id}`) }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
})
</script>
