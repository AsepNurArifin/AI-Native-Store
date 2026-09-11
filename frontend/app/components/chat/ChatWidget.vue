<template>
  <div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/50 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-none transition-all">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-100/90 bg-slate-50/70 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
          <Bot class="h-5 w-5" />
          <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display font-bold text-slate-900 dark:text-white text-sm sm:text-base">AI Sales Assistant</h3>
            <ScBadge tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" :dot="true">
              Live
            </ScBadge>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">Tanya produk, cek stok, & pesan via tombol</p>
        </div>
      </div>
      <button
        v-if="messages.length"
        class="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        title="Reset percakapan"
        @click="resetChat"
      >
        <RefreshCw class="h-4 w-4" />
      </button>
    </div>

    <!-- Message Area -->
    <div ref="scrollBox" class="modern-scrollbar max-h-[440px] min-h-[360px] space-y-4 overflow-y-auto p-4 sm:p-5">
      <!-- Empty State -->
      <div v-if="!messages.length" class="flex flex-col items-center justify-center py-8 text-center">
        <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <MessageSquare class="h-7 w-7" />
        </div>
        <h4 class="font-display font-semibold text-slate-800 dark:text-slate-200">Mulai Tanya ke AI Sales</h4>
        <p class="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Ceritakan kebutuhan belanja Anda, misalnya: <i>“Cari laptop RAM 16GB budget 8 juta”</i> atau <i>“Ada diskon apa saja?”</i>
        </p>
      </div>

      <!-- Messages Loop -->
      <div v-for="(m, i) in messages" :key="i" class="space-y-2.5">
        <!-- Chat Bubble -->
        <div class="flex items-end gap-2" :class="m.role === 'me' ? 'justify-end' : 'justify-start'">
          <div
            v-if="m.role === 'ai'"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-[10px] font-bold"
          >
            AI
          </div>
          <div
            class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs"
            :class="m.role === 'me'
              ? 'rounded-br-xs bg-slate-900 text-white dark:bg-indigo-600'
              : 'rounded-bl-xs border border-slate-200/80 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-100'"
          >
            <p class="whitespace-pre-wrap">{{ m.text }}</p>
          </div>
        </div>

        <!-- Product Cards Recommendation -->
        <div v-if="m.products?.length" class="ml-9 mt-2 grid gap-2.5 sm:grid-cols-2">
          <div
            v-for="p in m.products"
            :key="p.id"
            class="group relative rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-800/90 dark:hover:border-indigo-500/50"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {{ p.category }}
              </span>
              <span
                class="text-[11px] font-medium"
                :class="p.current_stock > 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
              >
                Stok: {{ p.current_stock }}
              </span>
            </div>
            <h5 class="mt-2 font-medium text-slate-900 dark:text-white line-clamp-1 text-sm">{{ p.name }}</h5>
            <p class="mt-1 font-display font-bold text-indigo-600 dark:text-indigo-400 text-base">
              {{ formatIDR(p.price) }}
            </p>
          </div>
        </div>

        <!-- Order Summary (Receipt Style) -->
        <div
          v-if="m.summary"
          class="ml-9 mt-3 overflow-hidden rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-b from-indigo-50/30 to-white dark:from-indigo-950/20 dark:to-slate-900 shadow-md p-4 space-y-3"
        >
          <div class="flex items-center justify-between border-b border-dashed border-slate-200 pb-2.5 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold">
                ✓
              </span>
              <span class="font-display font-bold text-slate-900 dark:text-white text-sm">Ringkasan Pesanan</span>
            </div>
            <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500">Ref: {{ m.summary.summary_ref.slice(0, 8) }}</span>
          </div>

          <!-- Items list -->
          <div class="space-y-1.5 text-sm">
            <div
              v-for="it in m.summary.items"
              :key="it.product_id"
              class="flex items-center justify-between text-slate-700 dark:text-slate-300 py-0.5"
            >
              <div class="flex items-center gap-2">
                <span class="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                  {{ it.quantity }}x
                </span>
                <span class="font-medium line-clamp-1">{{ it.name }}</span>
              </div>
              <span class="font-semibold">{{ formatIDR(it.line_total) }}</span>
            </div>
          </div>

          <!-- Total Calculation -->
          <div class="border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-500 dark:text-slate-400 text-sm">Total Tagihan</span>
              <span class="font-display text-lg font-bold text-slate-900 dark:text-white">
                {{ formatIDR(m.summary.total) }}
              </span>
            </div>
            <p class="mt-0.5 text-[10px] text-slate-400">Harga & stok diverifikasi secara atomik saat konfirmasi.</p>
          </div>

          <!-- Customer Input fields if needed -->
          <div v-if="needsInfo" class="rounded-xl bg-white/80 p-3 ring-1 ring-slate-200/80 dark:bg-slate-800/80 dark:ring-slate-700 space-y-2">
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Data Pemesan:</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <ScInput v-model="custName" placeholder="Nama lengkap" class="h-8 text-xs" />
              <ScInput v-model="custContact" placeholder="No. WhatsApp / HP" class="h-8 text-xs" />
            </div>
          </div>

          <!-- Confirm Button -->
          <Button
            variant="ai"
            size="md"
            class="w-full justify-center shadow-md font-semibold"
            :loading="confirming"
            @click="confirm(m.summary!)"
          >
            Konfirmasi Pesanan Sekarang
          </Button>

          <p v-if="confirmMsg" class="text-center text-xs font-medium" :class="confirmOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            {{ confirmMsg }}
          </p>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div v-if="sending" class="flex items-center gap-2 text-xs text-slate-400">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <span class="inline-block h-2 w-2 rounded-full bg-current animate-ping" />
        </div>
        <span>AI Sales sedang mencari stok toko…</span>
      </div>
    </div>

    <!-- Input Footer -->
    <div class="border-t border-slate-100/90 bg-slate-50/50 p-3 sm:p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
      <p v-if="error" class="mb-2 text-xs font-medium text-rose-600 dark:text-rose-400">{{ error }}</p>
      <form class="flex items-center gap-2" @submit.prevent="send()">
        <ScInput
          v-model="draft"
          placeholder="Ketik produk atau pertanyaan belanja kamu di sini…"
          class="flex-1 bg-white dark:bg-slate-950"
        />
        <Button type="submit" variant="ai" size="md" :loading="sending" class="shrink-0 px-4">
          <span>Kirim</span>
          <Send class="h-4 w-4" />
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bot, MessageSquare, RefreshCw, Send } from '@lucide/vue'
import { formatIDR } from '~/utils/format'
import type { ChatReply, OrderSummary, ProductOut } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

interface Msg {
  role: 'me' | 'ai'
  text: string
  products?: ProductOut[]
  summary?: OrderSummary | null
}

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
  requestAnimationFrame(() => { scrollBox.value?.scrollTo({ top: 99999, behavior: 'smooth' }) })
}

function uuid(): string {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function resetChat() {
  localStorage.removeItem(CONV_KEY)
  conversationId.value = null
  messages.value = []
  error.value = ''
  confirmMsg.value = ''
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

async function send(customText?: string) {
  const text = (customText || draft.value).trim()
  if (!text || sending.value) return
  if (!customText) draft.value = ''
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
      : `Order ${res.status}! ID: ${res.order_id.slice(0, 8)}… — Total: ${formatIDR(res.total)}`
    messages.value.push({ role: 'ai', text: confirmMsg.value })
  }
  catch (e: unknown) {
    confirmOk.value = false
    if (e instanceof NormalizedApiError) { confirmMsg.value = e.message; return }
    const f = e as { data?: { detail?: unknown }, message?: string }
    const d = f?.data?.detail as { code?: string, message?: string } | string | undefined
    if (typeof d === 'object' && d?.message) {
      confirmMsg.value = d.message
    }
    else confirmMsg.value = f?.message || 'Konfirmasi gagal'
  }
  finally { confirming.value = false; scrollDown() }
}

onMounted(() => {
  try { conversationId.value = localStorage.getItem(CONV_KEY) }
  catch { conversationId.value = null }
})

defineExpose({
  sendPrompt: (prompt: string) => send(prompt)
})
</script>

