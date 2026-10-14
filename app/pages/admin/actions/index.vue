<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Aksi AI <span class="text-sm font-normal text-stone-500">(khusus Owner)</span></h1>
    <p class="text-sm text-stone-500">Antrean draft aksi dari AI Action Assistant (promosi, penyesuaian stok). Approve / reject; eksekusi hanya bila validasi lolos.</p>
    <Card>
      <CardContent>
        <div class="mb-3 flex gap-2">
          <select v-model="fStatus" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua status</option>
            <option>DRAFT</option><option>APPROVED</option><option>REJECTED</option>
            <option>APPROVED_VALIDATION_FAILED</option><option>EXECUTED</option>
          </select>
          <Button size="sm" variant="secondary" @click="page = 1; load()">Muat</Button>
        </div>
        <div class="mb-4 rounded-md border border-stone-200 bg-stone-50 p-3">
          <label class="mb-1 block text-sm font-medium">Buat draft dengan AI (FR-AA-01)</label>
          <p class="mb-2 text-xs text-stone-500">
            Contoh: “buat promosi 15% untuk produk Smartphone G066 selama 2 minggu” ·
            “tambahkan stok produk Soda R057 sebanyak 20”
          </p>
          <textarea v-model="instruction" rows="2" class="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm" placeholder="Instruksi natural language…" />
          <div class="mt-2">
            <Button size="sm" :loading="creating" @click="createDraft()">Buat Draft</Button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b text-left text-stone-500">
              <th class="py-2 pr-2">ID</th><th class="pr-2">Tipe</th><th class="pr-2">Status</th><th class="pr-2">Dibuat</th><th/>
            </tr></thead>
            <tbody>
              <tr v-for="a in items" :key="a.id" class="border-b border-stone-100">
                <td class="py-2 pr-2 font-mono text-xs">{{ a.id.slice(0, 8) }}…</td>
                <td class="pr-2">{{ a.action_type }}</td>
                <td class="pr-2"><Badge :variant="statusVariant(a.status)">{{ a.status }}</Badge></td>
                <td class="pr-2 text-xs">{{ formatWIB(a.created_at) }}</td>
                <td><NuxtLink :to="`/admin/actions/${a.id}`"><Button size="sm" variant="outline">Buka</Button></NuxtLink></td>
              </tr>
            </tbody>
          </table>
          <p v-if="loading" class="py-4 text-center text-sm text-stone-500">Memuat antrean draft…</p>
          <p v-else-if="!items.length" class="py-4 text-center text-sm text-stone-500">Belum ada draft. Tulis instruksi di kotak AI di atas, lalu tekan Buat Draft.</p>
        </div>
        <AdminPager :page="page" :count="items.length" :page-size="pageSize" :loading="loading" @prev="page--; load()" @next="page++; load()" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { formatWIB, statusVariant } from '~/utils/format'
import type { AIActionOut } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()
const items = ref<AIActionOut[]>([])
const fStatus = ref('')
const instruction = ref('')
const creating = ref(false)
const loading = ref(false)
const page = ref(1)
const pageSize = 10

async function createDraft() {
  if (creating.value) return
  if (!instruction.value.trim()) { toast.warning('Isi instruksi dulu.'); return }
  creating.value = true
  try {
    const created = await request<AIActionOut>('/ai-actions/draft', { method: 'POST', body: { instruction: instruction.value.trim() } })
    toast.success('Draft dibuat. Tinjau di antrean bawah.')
    instruction.value = ''
    // Sisipkan ke antrean (list diurut terbaru dulu) tanpa refetch. Draft yang
    // tidak cocok filter status aktif dibiarkan — akan muncul saat filter dibuka.
    if (!fStatus.value || created.status === fStatus.value) {
      items.value.unshift(created)
      if (items.value.length > pageSize) items.value.pop()
    }
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal membuat draft') }
  finally { creating.value = false }
}

async function load() {
  loading.value = true
  try {
    items.value = await request<AIActionOut[]>('/ai-actions', {
      query: { status_: fStatus.value || undefined, page: page.value, page_size: pageSize }
    })
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat antrean draft') }
  finally { loading.value = false }
}
onMounted(load)
</script>
