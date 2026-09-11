<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Audit Log <span class="text-sm font-normal text-slate-500">(Owner only, append-only)</span></h1>
    <ScCard>
      <div class="mb-3 flex flex-wrap gap-2">
        <ScInput v-model="fAction" placeholder="ai_action_id…" class="max-w-64" />
        <select v-model="fEvent" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Semua event</option>
          <option>CREATED</option><option>APPROVED</option><option>REJECTED</option>
          <option>VALIDATION_FAILED</option><option>EXECUTED</option>
        </select>
        <select v-model="fActor" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Semua actor</option><option>USER</option><option>AI_SYSTEM</option>
        </select>
        <Button size="sm" variant="secondary" @click="load()">Muat</Button>
      </div>
      <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b text-left text-slate-500">
            <th class="py-2 pr-2">Waktu</th><th class="pr-2">Event</th><th class="pr-2">Actor</th><th class="pr-2">Aksi</th><th>Detail</th>
          </tr></thead>
          <tbody>
            <tr v-for="l in items" :key="l.id" class="border-b border-slate-100 align-top">
              <td class="py-1 pr-2 text-xs">{{ formatWIB(l.timestamp) }}</td>
              <td class="pr-2"><ScBadge :tone="statusClass(l.event)">{{ l.event }}</ScBadge></td>
              <td class="pr-2 text-xs">{{ l.actor_type }}</td>
              <td class="pr-2 font-mono text-xs">{{ (l.ai_action_id || '-').slice(0, 8) }}</td>
              <td class="max-w-72 truncate text-xs text-slate-500" :title="JSON.stringify(l.detail)">{{ JSON.stringify(l.detail) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusClass } from '~/utils/format'
import type { AuditLogOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const items = ref<AuditLogOut[]>([])
const error = ref('')
const fAction = ref('')
const fEvent = ref('')
const fActor = ref('')

async function load() {
  error.value = ''
  try {
    items.value = await request<AuditLogOut[]>('/audit/logs', {
      query: {
        ai_action_id: fAction.value || undefined,
        event: fEvent.value || undefined,
        actor_type: fActor.value || undefined,
        page: 1, page_size: 50
      }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
</script>
