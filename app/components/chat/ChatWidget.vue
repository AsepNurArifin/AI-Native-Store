<template>
  <div class="min-w-0 overflow-hidden rounded-3xl border border-stone-200/80 bg-white/95 shadow-xl shadow-stone-200/50 transition-all">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b border-stone-100/90 bg-stone-50/70 px-4 py-4 sm:px-5 backdrop-blur-sm">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
          <Bot class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-display font-bold text-stone-900 text-sm sm:text-base">Asisten toko</h3>
          </div>
          <p class="text-xs text-stone-500">Tanya produk, cek stok, &amp; spesifikasi</p>
        </div>
      </div>
      <button
        v-if="messages.length"
        class="shrink-0 rounded-lg p-1.5 text-xs text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
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
        <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <MessageSquare class="h-7 w-7" />
        </div>
        <h4 class="font-display font-semibold text-stone-800">Mulai tanya stok</h4>
        <p class="mt-1 max-w-xs text-xs text-stone-500">
          Ceritakan gadget yang kamu cari, misalnya: <i>“Laptop untuk desain grafis budget 15 juta”</i> atau <i>“iPhone 15 Pro ada stok?”</i>
        </p>
      </div>

      <!-- Messages Loop -->
      <div v-for="(m, i) in messages" :key="i" class="space-y-2.5">
        <!-- Chat Bubble -->
        <div class="flex items-end gap-2" :class="m.role === 'me' ? 'justify-end' : 'justify-start'">
          <div
            v-if="m.role === 'ai'"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white text-[10px] font-bold"
          >
            AI
          </div>
          <div
            class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs"
            :class="m.role === 'me' ? 'rounded-br-xs bg-stone-900 text-white ' : 'rounded-bl-xs border border-stone-200/80 bg-stone-50 text-stone-800 '" 
          >
            <MarkdownText v-if="m.role === 'ai'" :text="m.text" />
            <p v-else class="whitespace-pre-wrap">{{ m.text }}</p>
          </div>
        </div>

        <!-- Product Cards Recommendation -->
        <div v-if="m.products?.length" class="min-w-0 sm:ml-9 mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div
            v-for="p in m.products"
            :key="p.id"
            class="group relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xs transition-all hover:border-brand-300 hover:shadow-md"
          >
            <ProductImage :image-url="p.image_url" :name="p.name" :category="p.category" size="thumb" class="h-20 w-full !rounded-none" />
            <div class="p-3.5 pt-3">
              <div class="flex items-start justify-between gap-2">
                <span class="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                  {{ p.category }}
                </span>
                <span
                  class="text-[11px] font-medium"
                  :class="p.current_stock > 5 ? 'text-emerald-600 ' : 'text-amber-700 '"
                >
                  Stok: {{ p.current_stock }}
                </span>
              </div>
              <h5 class="mt-2 font-medium text-stone-900 text-sm [overflow-wrap:anywhere]">{{ p.name }}</h5>
              <p v-if="hasPromo(p)" class="text-[11px] text-stone-400 line-through">{{ formatIDR(p.price) }}</p>
              <p class="mt-1 font-display font-bold text-brand-700 text-base">
                {{ formatIDR(effectivePrice(p)) }}
              </p>
              <NuxtLink :to="`/produk/${p.id}`" class="mt-1.5 inline-block text-xs font-semibold text-brand-700 hover:underline">Lihat detail</NuxtLink>
              <details class="mt-2 min-w-0">
                <summary class="cursor-pointer rounded text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 focus-visible:outline-offset-2 active:text-brand-900">Lihat spesifikasi</summary>
                <ProductSpecifications class="mt-3" :specification="p.specification" />
              </details>
            </div>
          </div>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div v-if="sending" class="flex items-center gap-2 text-xs text-stone-500">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600">
          <span class="inline-block h-2 w-2 rounded-full bg-current animate-ping" />
        </div>
        <span>Asisten sedang mengecek katalog toko…</span>
      </div>
    </div>

    <!-- Input Footer -->
    <div class="border-t border-stone-100/90 bg-stone-50/50 p-3 sm:p-4">
      <p v-if="error" role="alert" class="mb-2 text-xs font-medium text-rose-600">{{ error }}</p>
      <form class="flex items-center gap-2" @submit.prevent="send()">
        <Input
          v-model="draft"
          placeholder="Tanya produk, stok, atau spesifikasi di sini…"
          class="h-11 flex-1 bg-white"
        />
        <Button type="submit" variant="ai" size="lg" :loading="sending" class="shrink-0">
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
import { effectivePrice, hasPromo } from '~/utils/product'
import type { ChatReply, ProductOut } from '~/utils/api-types'

/**
 * Chat = tanya-jawab produk/stok/rekomendasi.
 * Pembelian dilakukan lewat checkout langsung (/checkout) dari kartu/halaman produk.
 */
interface Msg {
  role: 'me' | 'ai'
  text: string
  products?: ProductOut[]
}

const CONV_KEY = 'ai_store_conversation_id'
const config = useRuntimeConfig()
const base = (config.public.apiBase as string) || '/api/v1'

const messages = ref<Msg[]>([])
const draft = ref('')
const sending = ref(false)
const error = ref('')
const conversationId = ref<string | null>(null)
const scrollBox = ref<HTMLElement | null>(null)

function scrollDown() {
  requestAnimationFrame(() => { scrollBox.value?.scrollTo({ top: 99999, behavior: 'smooth' }) })
}

function resetChat() {
  localStorage.removeItem(CONV_KEY)
  conversationId.value = null
  messages.value = []
  error.value = ''
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
  error.value = ''
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
    messages.value.push({ role: 'ai', text: reply!.reply, products: reply!.products })
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Gagal mengirim pesan'
  }
  finally { sending.value = false; scrollDown() }
}

onMounted(() => {
  try { conversationId.value = localStorage.getItem(CONV_KEY) }
  catch { conversationId.value = null }
})

defineExpose({
  sendPrompt: (prompt: string) => send(prompt)
})
</script>
