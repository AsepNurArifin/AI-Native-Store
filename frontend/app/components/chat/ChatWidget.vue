<template>
  <ScCard class="overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold">Chat Toko — AI Sales</p>
          <p class="text-xs text-slate-500">Tanya produk, bandingkan, lalu konfirmasi via tombol (bukan teks bebas).</p>
        </div>
        <ScBadge tone="bg-emerald-100 text-emerald-800">{{ conversationId ? 'Terhubung' : '…' }}</ScBadge>
      </div>
    </template>

    <div ref="scrollBox" class="max-h-[420px] space-y-3 overflow-y-auto pr-1">
      <div v-if="!messages.length" class="rounded bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800">
        Halo! Ceritakan kebutuhanmu, mis. <i>“cari laptop 16GB di bawah 10 juta”</i>.
      </div>
      <div v-for="(m, i) in messages" :key="i">
        <!-- bubble -->
        <div class="flex" :class="m.role === 'me' ? 'justify-end' : 'justify-start'">
          <div class="max-w-[85%] rounded-lg px-3 py-2 text-sm" :class="m.role === 'me' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800'">
            <p class="whitespace-pre-wrap">{{ m.text }}</p>
          </div>
        </div>
        <!-- kartu produk -->
        <div v-if="m.products?.length" class="mt-2 grid gap-2 sm:grid-cols-2">
          <div v-for="p in m.products" :key="p.id" class="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
            <p class="font-medium">{{ p.name }}</p>
            <p class="text-xs text-slate-500">{{ p.category }} · stok {{ p.current_stock }}</p>
            <p class="font-bold">{{ formatIDR(p.price) }}</p>
          </div>
        </div>
        <!-- ringkasan order + tombol konfirmasi eksplisit -->
        <div v-if="m.summary" class="mt-2 rounded-lg border-2 border-slate-900 p-3 text-sm dark:border-white">
          <p class="mb-1 font-semibold">Ringkasan pesanan</p>
          <div v-for="it in m.summary.items" :key="it.product_id" class="flex justify-between border-b border-slate-100 py-1">
            <span>{{ it.name }} × {{ it.quantity }}</span>
            <span class="font-medium">{{ formatIDR(it.line_total) }}</span>
          </div>
          <p class="mt-1 flex justify-between font-bold"><span>Total</span><span>{{ formatIDR(m.summary.total) }}</span></p>
          <p class="mt-1 text-[11px] text-slate-500">Harga & stok diverifikasi ulang saat konfirmasi.</p>
          <div v-if="needsInfo" class="mt-2 grid gap-2 sm:grid-cols-2">
            <ScInput v-model="custName" placeholder="Nama kamu" />
            <ScInput v-model="custContact" placeholder="Kontak (HP/email)" />
          </div>
          <ScButton class="mt-2 w-full" :loading="confirming" @click="confirm(m.summary!)">
            Konfirmasi Pesanan
          </ScButton>
          <p v-if="confirmMsg" class="mt-1 text-xs" :class="confirmOk ? 'text-emerald-600' : 'text-red-600'">{{ confirmMsg }}</p>
        </div>
      </div>
      <p v-if="sending" class="text-xs text-slate-500">AI mengetik…</p>
    </div>

    <template #footer>
      <p v-if="error" class="mb-2 text-sm text-red-600">{{ error }}</p>
      <form class="flex gap-2" @submit.prevent="send()">
        <ScInput v-model="draft" placeholder="Tulis pesan…" class="flex-1" />
        <ScButton type="submit" :loading="sending">Kirim</ScButton>
      </form>
    </template>
  </ScCard>
</template>

<script setup lang="ts">
import { formatIDR } from '~/utils/format'
import type { ChatReply, OrderSummary, ProductOut } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

interface Msg { role: 'me' | 'ai', text: string, products?: ProductOut[], summary?: OrderSummary | null }

const CONV_KEY = 'ai_store_conversation_id'
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || 'http://localhost:8000/api/v1'

const messages = ref<Msg[]>([])
const draft = ref('')
const sending = ref(false)
const confirming = ref(false)
const error = ref('')
const confirmMsg = ref('')
const confirmOk = ref(false)
const conversationId = ref<string | null>(null)
const needsInfo = ref(false)
const custName = ref('')
const custContact = ref('')
const idemKeys = new Map<string, string>()
const scrollBox = ref<HTMLElement | null>(null)

function scrollDown() {
  requestAnimationFrame(() => { scrollBox.value?.scrollTo({ top: 99999 }) })
}
function uuid(): string {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Mulai sesi guest. customer_ref lazy "Tamu|guest". */
async function start(): Promise<string> {
  const saved = localStorage.getItem(CONV_KEY)
  if (saved) { conversationId.value = saved; return saved }
  const res = await $fetch<{ conversation_id: string }>(`${base}/chat/start`, {
    method: 'POST', body: { channel: 'WEB', customer_ref: 'Tamu|guest' }
  })
  conversationId.value = res.conversation_id
  localStorage.setItem(CONV_KEY, res.conversation_id)
  return res.conversation_id
}

async function ensureSession(): Promise<string> {
  if (conversationId.value) return conversationId.value
  return await start()
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  draft.value = ''
  error.value = ''; confirmMsg.value = ''
  messages.value.push({ role: 'me', text })
  scrollDown()
  sending.value = true
  try {
    const conv = await ensureSession()
    let reply: ChatReply
    try {
      reply = await $fetch<ChatReply>(`${base}/chat/${conv}/messages`, {
        method: 'POST', body: { content: text }
      })
    }
    catch (e: unknown) {
      // Sesi hilang di backend (restart) -> buat sesi baru sekali lalu ulangi
      const f = e as { status?: number, statusCode?: number }
      if ((f?.status === 404 || f?.statusCode === 404)) {
        localStorage.removeItem(CONV_KEY)
        conversationId.value = null
        const fresh = await start()
        reply = await $fetch<ChatReply>(`${base}/chat/${fresh}/messages`, {
          method: 'POST', body: { content: text }
        })
      }
      else throw e
    }
    if (reply!.needs_customer_info) needsInfo.value = true
    messages.value.push({ role: 'ai', text: reply!.reply, products: reply!.products, summary: reply!.order_summary })
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Gagal mengirim pesan'
  }
  finally { sending.value = false; scrollDown() }
}

/**
 * SATU-SATUNYA jalur pembuatan order (Jalur 1).
 * Dipicu tombol UI — bukan teks bebas. Idempotency key stabil per summary_ref
 * sehingga double-click tidak membuat order ganda.
 */
async function confirm(summary: OrderSummary) {
  if (confirming.value) return
  if (needsInfo.value && (!custName.value.trim() || !custContact.value.trim())) {
    confirmOk.value = false
    confirmMsg.value = 'Isi nama & kontak dulu sebelum konfirmasi.'
    return
  }
  confirming.value = true; confirmMsg.value = ''
  try {
    if (!idemKeys.has(summary.summary_ref)) idemKeys.set(summary.summary_ref, uuid())
    const conv = await ensureSession()
    const res = await $fetch<{ order_id: string, status: string, total: number, replayed?: boolean }>(
      `${base}/chat/${conv}/confirm`,
      {
        method: 'POST',
        body: {
          order_summary_ref: summary.summary_ref,
          idempotency_key: idemKeys.get(summary.summary_ref),
          customer: { name: custName.value.trim() || 'Tamu', contact: custContact.value.trim() || 'guest' }
        }
      }
    )
    confirmOk.value = true
    confirmMsg.value = res.replayed
      ? `Order sudah tercatat sebelumnya (${res.order_id.slice(0, 8)}…). Tidak ada duplikasi.`
      : `Order ${res.status}! ID ${res.order_id.slice(0, 8)}… — Total ${formatIDR(res.total)}`
    messages.value.push({ role: 'ai', text: confirmMsg.value })
  }
  catch (e: unknown) {
    confirmOk.value = false
    if (e instanceof NormalizedApiError) { confirmMsg.value = e.message; return }
    const f = e as { data?: { detail?: unknown }, message?: string }
    const d = f?.data?.detail as { code?: string, message?: string } | string | undefined
    if (typeof d === 'object' && d?.message) {
      // 409 stok/produk nonaktif, 410 summary kedaluwarsa — tampilkan jelas
      confirmMsg.value = d.message
    }
    else confirmMsg.value = f?.message || 'Konfirmasi gagal'
  }
  finally { confirming.value = false; scrollDown() }
}

onMounted(() => {
  try { conversationId.value = localStorage.getItem(CONV_KEY) }
  catch { conversationId.value = null }
  // Sesi dibuat lazy saat pesan pertama — hemat 1 request saat landing dibuka.
})
</script>
