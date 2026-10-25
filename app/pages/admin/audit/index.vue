<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">Riwayat Toko</h1>
        <p class="mt-0.5 max-w-2xl text-sm text-stone-500">
          Catatan otomatis atas semua kejadian penting: order, stok, katalog, promosi, dan keputusan atas usulan AI.
          Catatan bersifat <span class="font-semibold text-stone-700">hanya bisa dibaca &amp; ditambah</span> — tidak ada
          tombol sunting/hapus, karena inilah bukti bahwa aksi berdampak uang selalu ada jejak pelakunya.
        </p>
      </div>
    </div>

    <Card>
      <CardContent>
        <!-- Filter: bahasa toko (jenis + pelaku + periode + cari), instant client-side -->
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <select v-model="fCat" aria-label="Jenis kejadian" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option v-for="o in auditCategoryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select v-model="fActor" aria-label="Pelaku" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="">Semua pelaku</option>
            <option value="USER">Toko (owner/staf)</option>
            <option value="CUSTOMER">Pelanggan</option>
            <option value="AI_SYSTEM">Asisten AI</option>
            <option value="SYSTEM">Sistem (otomatis)</option>
          </select>
          <select v-model="fPeriod" aria-label="Rentang waktu" class="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm">
            <option value="all">Sepanjang waktu</option>
            <option value="1">24 jam terakhir</option>
            <option value="7">7 hari terakhir</option>
            <option value="30">30 hari terakhir</option>
          </select>
          <Input v-model="fKeyword" placeholder="Cari kejadian, produk, order…" class="max-w-60" />
          <!-- Aktivitas internal (uji sehat sistem) disembunyikan default — bukan kejadian bisnis. -->
          <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-600">
            <input v-model="showInternal" type="checkbox" class="size-4 accent-brand-700">
            Tampilkan aktivitas internal
          </label>
        </div>

        <p v-if="loading" class="py-4 text-center text-sm text-stone-500">Memuat riwayat…</p>
        <p v-else-if="!visible.length" class="py-4 text-center text-sm text-stone-500">
          Belum ada kejadian untuk filter ini.
        </p>

        <!-- Daftar kejadian: kartu per baris, bukan tabel kunci-nilai -->
        <ul v-else class="divide-y divide-stone-100">
          <li v-for="row in visible" :key="row.id" class="py-3">
            <div class="flex items-start gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                :class="row.tone === 'destructive' ? 'bg-rose-50' : row.tone === 'warning' ? 'bg-amber-50' : row.tone === 'success' ? 'bg-emerald-50' : row.tone === 'info' ? 'bg-brand-50' : 'bg-stone-100'"
                aria-hidden="true"
              >
                <component :is="iconComp(row.icon)" class="h-4.5 w-4.5" :class="toneText(row.tone)" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p class="min-w-0 text-sm font-semibold text-stone-900 [overflow-wrap:anywhere]">{{ row.title }}</p>
                </div>
                <!-- Badge dampak: yang wajib tertangkap sekali lirik -->
                <div v-if="row.badges.length" class="mt-1 flex flex-wrap gap-1.5">
                  <Badge v-for="(b, i) in row.badges" :key="i" :variant="b.variant">{{ b.text }}</Badge>
                </div>
                <!-- Chip bahasa toko: nama pelaku, nilai, produk, dsb -->
                <div v-if="row.chips.length" class="mt-1.5 flex flex-wrap gap-1.5">
                  <template v-for="(c, i) in row.chips" :key="i">
                    <NuxtLink v-if="c.href" :to="c.href" class="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-xs font-medium text-brand-700 underline-offset-2 transition-colors hover:border-brand-300 hover:underline">{{ c.text }}</NuxtLink>
                    <span v-else class="rounded-md border px-1.5 py-0.5 text-xs" :class="c.cls ?? 'border-stone-200 bg-stone-50 text-stone-600'">{{ c.text }}</span>
                  </template>
                </div>
                <!-- Daftar panjang (mis. 63 produk yang dihapus) dilipat supaya tidak menumpuk -->
                <button
                  v-if="row.expandable"
                  type="button"
                  class="mt-1.5 rounded text-xs font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
                  @click="toggleExpand(row.id)"
                >
                  {{ expanded.has(row.id) ? 'Sembunyikan' : row.expandable.summary }}
                </button>
                <div v-if="row.expandable && expanded.has(row.id)" class="mt-1.5 flex flex-wrap gap-1.5">
                  <span v-for="(c, i) in row.expandable.chips" :key="i" class="max-w-64 truncate rounded-md border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-600" :title="c.text">{{ c.text }}</span>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-xs whitespace-nowrap text-stone-500">{{ formatWIB(row.timestamp) }}</p>
                <p class="mt-0.5 text-xs font-medium whitespace-nowrap text-stone-700">{{ row.actor }}</p>
              </div>
            </div>
          </li>
        </ul>

        <!-- Log besar? Muat bertambah dari server (append-only dijaga, tanpa membuat halaman berat). -->
        <div v-if="hasMore" class="mt-3 flex justify-center">
          <Button size="sm" variant="outline" :loading="loadingMore" @click="loadMore">Tampilkan 100 kejadian lagi</Button>
        </div>
      </CardContent>
    </Card>

    <p class="text-center text-xs text-stone-400">
      Kejadian dengan tag "Asisten AI" selalu diikuti keputusan Owner (setuju/tolak) sebelum dijalankan —
      itulah pemeriksaan berlapis manusia (HITL).
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  BadgePercent, Bot, CircleCheck, PackagePlus, Pencil, ShoppingCart,
  Trash2, Boxes, Bell, Minus, AlertTriangle,
} from '@lucide/vue'
import { formatWIB } from '~/utils/format'
import { auditCategoryOptions, auditCategory, auditActorLabel, buildAuditRow, isInternalAudit } from '~/utils/audit'
import type { AuditLogOut, AuditLogsResponse, AuditNames } from '~/utils/api-types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { request } = useApi()
const toast = useToast()

/** Baris yang sudah di-paras mantap + konteks filter. */
interface VisibleRow {
  id: string
  icon: ReturnType<typeof buildAuditRow>['icon']
  tone: ReturnType<typeof buildAuditRow>['tone']
  title: string
  chips: ReturnType<typeof buildAuditRow>['chips']
  expandable?: ReturnType<typeof buildAuditRow>['expandable']
  badges: ReturnType<typeof buildAuditRow>['badges']
  actor: string
  timestamp: string
  cat: ReturnType<typeof auditCategory>
  internal: boolean
  needle: string
}

const rows = ref<AuditLogOut[]>([])
const names = ref<AuditNames | undefined>(undefined)
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(0)
const pageSize = 100
const hasMore = ref(false)

const fCat = ref<'' | ReturnType<typeof auditCategory>>('')
const fActor = ref('')
const fPeriod = ref('all')
const fKeyword = ref('')
const showInternal = ref(false)
const expanded = ref(new Set<string>())

function toggleExpand(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function iconComp(icon: VisibleRow['icon']) {
  switch (icon) {
    case 'order': return ShoppingCart
    case 'stock-in': return Boxes
    case 'stock-out': return Minus
    case 'product-add': return PackagePlus
    case 'product-edit': return Pencil
    case 'product-dump': return Trash2
    case 'promo': return BadgePercent
    case 'ai': return Bot
    case 'ok': return CircleCheck
    case 'bug': return AlertTriangle
    default: return Bell
  }
}
function toneText(tone: VisibleRow['tone']) {
  return tone === 'destructive' ? 'text-rose-600'
    : tone === 'warning' ? 'text-amber-600'
      : tone === 'success' ? 'text-emerald-600'
        : tone === 'info' ? 'text-brand-700'
          : 'text-stone-500'
}

/** Muat halaman pertama dari endpoint (log + peta nama UUID). */
async function load() {
  loading.value = true
  rows.value = []
  page.value = 0
  try {
    const res = await request<AuditLogsResponse>('/audit/logs', { query: { page: 1, page_size: pageSize } })
    rows.value = res.items
    names.value = res.names
    hasMore.value = res.items.length >= pageSize
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat riwayat toko') }
  finally { loading.value = false }
}

/** Log besar? Ambil halaman berikutnya dari server dan tambahkan ke daftar. */
async function loadMore() {
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await request<AuditLogsResponse>('/audit/logs', { query: { page: next + 1, page_size: pageSize } })
    rows.value = [...rows.value, ...res.items]
    names.value = { ...(names.value ?? { products: {}, users: {}, customers: {}, promotions: {}, ai_actions: {} }), ...res.names }
    page.value = next
    hasMore.value = res.items.length >= pageSize
  }
  catch (e: unknown) { toast.fromError(e, 'Gagal memuat kejadian tambahan') }
  finally { loadingMore.value = false }
}
onMounted(load)

const visible = computed<VisibleRow[]>(() => {
  const now = Date.now()
  const periodMs = fPeriod.value === '1' ? 24 * 3600e3 : fPeriod.value === '7' ? 7 * 864e5 : fPeriod.value === '30' ? 30 * 864e5 : 0
  const kw = fKeyword.value.trim().toLowerCase()
  const out: VisibleRow[] = []
  for (const l of rows.value) {
    if (!showInternal.value && isInternalAudit(l)) continue
    if (fActor.value && l.actor_type !== fActor.value) continue
    const cat = auditCategory(l.event)
    if (fCat.value && cat !== fCat.value) continue
    const action = buildAuditRow(l, names.value)
    if (periodMs && now - new Date(l.timestamp).getTime() > periodMs) continue
    const actor = auditActorLabel(l.actor_type, l.actor_id, l.detail || {}, names.value)
    const needle = `${action.title} ${actor} ${action.chips.map(c => c.text).join(' ')} ${action.badges.map(b => b.text).join(' ')}`.toLowerCase()
    if (kw && !needle.includes(kw)) continue
    out.push({
      id: l.id, icon: action.icon, tone: action.tone, title: action.title,
      chips: action.chips, expandable: action.expandable, badges: action.badges,
      actor, timestamp: l.timestamp, cat, internal: action.internal, needle,
    })
  }
  return out
})
</script>
