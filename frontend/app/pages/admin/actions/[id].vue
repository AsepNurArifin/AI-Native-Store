<template>
  <div class="space-y-4">
    <NuxtLink to="/admin/actions" class="text-sm text-blue-600 hover:underline">← Kembali</NuxtLink>
    <h1 class="text-2xl font-bold">Detail AI Action</h1>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <ScCard v-if="action">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ action.action_type }}</span>
          <ScBadge :tone="statusClass(action.status)">{{ action.status }}</ScBadge>
        </div>
      </template>
      <h2 class="mb-1 font-semibold">Payload draft</h2>
      <pre class="mb-3 overflow-x-auto rounded bg-slate-950 p-3 font-mono text-xs text-emerald-200">{{ JSON.stringify(action.payload, null, 2) }}</pre>
      <div v-if="action.validation_failures" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
        Validasi gagal: <code>{{ JSON.stringify(action.validation_failures) }}</code>
      </div>
      <p v-if="action.result_target_id" class="mb-3 text-sm">Hasil eksekusi (promotion id): <code class="font-mono text-xs">{{ action.result_target_id }}</code></p>
      <p v-if="msg" class="mb-2 text-sm" :class="ok ? 'text-emerald-600' : 'text-red-600'">{{ msg }}</p>
      <template #footer>
        <div v-if="action.status === 'DRAFT'" class="flex gap-2">
          <ScButton size="sm" :loading="busy" @click="approve()">Approve & Eksekusi</ScButton>
          <ScButton size="sm" variant="destructive" :loading="busy" @click="reject()">Reject</ScButton>
        </div>
        <p v-else class="text-sm text-slate-500">Sudah diputuskan — read-only.</p>
      </template>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
import { statusClass } from '~/utils/format'
import type { AIActionOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const route = useRoute()
const { request } = useApi()
const action = ref<AIActionOut | null>(null)
const error = ref('')
const msg = ref('')
const ok = ref(false)
const busy = ref(false)

async function load() {
  try { action.value = await request<AIActionOut>(`/ai-actions/${route.params.id}`) }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
async function approve() {
  busy.value = true; msg.value = ''
  try {
    const res = await request<{ status: string }>(`/ai-actions/${route.params.id}/approve`, { method: 'POST' })
    ok.value = true; msg.value = `Hasil: ${res.status}`
    await load()
  }
  catch (e: unknown) { ok.value = false; msg.value = e instanceof Error ? e.message : 'Gagal' }
  finally { busy.value = false }
}
async function reject() {
  const note = prompt('Alasan reject (opsional):') || undefined
  busy.value = true; msg.value = ''
  try {
    await request(`/ai-actions/${route.params.id}/reject`, { method: 'POST', body: { note } })
    ok.value = true; msg.value = 'Draft ditolak.'
    await load()
  }
  catch (e: unknown) { ok.value = false; msg.value = e instanceof Error ? e.message : 'Gagal' }
  finally { busy.value = false }
}
</script>
