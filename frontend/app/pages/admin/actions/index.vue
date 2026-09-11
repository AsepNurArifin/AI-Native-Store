<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">AI Actions <span class="text-sm font-normal text-slate-500">(Owner only)</span></h1>
    <p class="text-sm text-slate-500">Antrean draft aksi dari AI Action Assistant (promosi, penyesuaian stok). Approve / reject — eksekusi hanya bila validasi lolos.</p>
    <Card>
      <CardContent>
        <div class="mb-3 flex gap-2">
          <select v-model="fStatus" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="">Semua status</option>
            <option>DRAFT</option><option>APPROVED</option><option>REJECTED</option>
            <option>APPROVED_VALIDATION_FAILED</option><option>EXECUTED</option>
          </select>
          <Button size="sm" variant="secondary" @click="load()">Muat</Button>
        </div>
        <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>

        <div class="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <label class="mb-1 block text-sm font-medium">Buat draft dengan AI (FR-AA-01)</label>
          <p class="mb-2 text-xs text-slate-500">
            Contoh: “buat promosi 15% untuk produk Smartphone G066 selama 2 minggu” ·
            “tambahkan stok produk Soda R057 sebanyak 20”
          </p>
          <textarea v-model="instruction" rows="2" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Instruksi natural language…" />
          <div class="mt-2 flex items-center gap-3">
            <Button size="sm" :loading="creating" @click="createDraft()">Buat Draft</Button>
            <span v-if="draftError" class="text-sm text-red-600">{{ draftError }}</span>
            <span v-if="draftOk" class="text-sm text-green-600">Draft dibuat ✓</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-slate-500">
              <th class="py-2 pr-2">ID</th><th class="pr-2">Tipe</th><th class="pr-2">Status</th><th class="pr-2">Dibuat</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="a in items" :key="a.id" class="border-b border-slate-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ a.id.slice(0, 8) }}…</td>
                <td class="pr-2">{{ a.action_type }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(a.status)">{{ a.status }}</Badge></td>
                <td class="pr-2 text-xs">{{ formatWIB(a.created_at) }}</td>
                <td><NuxtLink :to="`/admin/actions/${a.id}`"><Button size="sm" variant="outline">Buka</Button></NuxtLink></td>
              </tr>
            </tbody>
          </table>
          <p v-if="!items.length" class="py-4 text-center text-sm text-slate-500">Belum ada draft.</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusVariant } from '~/utils/format'
import type { AIActionOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const items = ref<AIActionOut[]>([])
const error = ref('')
const fStatus = ref('')
const instruction = ref('')
const creating = ref(false)
const draftError = ref('')
const draftOk = ref(false)

async function createDraft() {
  draftError.value = ''
  draftOk.value = false
  if (!instruction.value.trim()) { draftError.value = 'Isi instruksi dulu.'; return }
  creating.value = true
  try {
    await request<AIActionOut>('/ai-actions/draft', { method: 'POST', body: { instruction: instruction.value.trim() } })
    draftOk.value = true
    instruction.value = ''
    await load()
  }
  catch (e: unknown) { draftError.value = e instanceof Error ? e.message : 'Gagal membuat draft' }
  finally { creating.value = false }
}

async function load() {
  error.value = ''
  try {
    items.value = await request<AIActionOut[]>('/ai-actions', {
      query: { status_: fStatus.value || undefined, page: 1, page_size: 50 }
    })
  }
  catch (e: unknown) { error.value = e instanceof Error ? e.message : 'Gagal memuat' }
}
onMounted(load)
</script>
