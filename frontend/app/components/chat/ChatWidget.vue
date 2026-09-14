<template>
  <div class="min-w-0 overflow-hidden rounded-3xl border border-stone-200/80 bg-white/95 shadow-xl shadow-stone-200/50 transition-all">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b border-stone-100/90 bg-stone-50/70 px-4 py-4 sm:px-5 backdrop-blur-sm">
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-clay-600 text-white shadow-md">
          <Bot class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-display font-bold text-stone-900 text-sm sm:text-base">Asisten toko</h3>
            <Badge variant="muted">Demo</Badge>
          </div>
          <p class="text-xs text-stone-500">Tanya produk, cek stok, & pesan via tombol</p>
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
        <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-clay-50 text-clay-600">
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
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-clay-700 text-white text-[10px] font-bold"
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
            class="group relative rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-clay-300 hover:shadow-md"
          >
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
            <p class="mt-1 font-display font-bold text-clay-700 text-base">
              {{ formatIDR(p.price) }}
            </p>
            <details class="mt-3 min-w-0">
              <summary class="cursor-pointer rounded text-xs font-semibold text-clay-700 hover:text-clay-600 focus-visible:outline-2 focus-visible:outline-clay-600 focus-visible:outline-offset-2 active:text-clay-800">Lihat spesifikasi</summary>
              <ProductSpecifications class="mt-3" :specification="p.specification" />
            </details>
          </div>
        </div>

        <!-- Order Summary (Receipt Style) -->
        <div
          v-if="m.summary"
          class="min-w-0 sm:ml-9 mt-3 overflow-hidden rounded-2xl border-2 border-clay-500/30 bg-clay-50/50 shadow-md p-4 space-y-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-stone-200 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-clay-100 text-clay-700 text-xs font-bold">
                ✓
              </span>
              <span class="font-display font-bold text-stone-900 text-sm">Ringkasan Pesanan</span>
            </div>
            <span class="text-[11px] font-mono text-stone-500">Ref: {{ m.summary.summary_ref.slice(0, 8) }}</span>
          </div>

          <!-- Items list -->
          <div class="space-y-1.5 text-sm">
            <div
              v-for="it in m.summary.items"
              :key="it.product_id"
              class="flex flex-wrap items-center justify-between gap-2 text-stone-700 py-0.5"
            >
              <div class="flex items-center gap-2">
                <span class="rounded bg-stone-200/80 px-1.5 py-0.5 text-xs font-semibold text-stone-800">
                  {{ it.quantity }}x
                </span>
                <span class="font-medium [overflow-wrap:anywhere]">{{ it.name }}</span>
              </div>
              <span class="shrink-0 font-semibold">{{ formatIDR(it.line_total) }}</span>
            </div>
          </div>

          <!-- Total Calculation -->
          <div class="border-t border-dashed border-stone-200 pt-2.5">
            <div class="flex items-center justify-between">
              <span class="font-medium text-stone-500 text-sm">Total Tagihan</span>
              <span class="font-display text-lg font-bold text-stone-900">
                {{ formatIDR(m.summary.total) }}
              </span>
            </div>
            <p class="mt-0.5 text-[10px] text-stone-500">Harga & stok diverifikasi secara atomik saat konfirmasi.</p>
          </div>

          <!-- Customer Input fields if needed -->
          <div v-if="needsInfo" class="rounded-xl bg-white/80 p-3 ring-1 ring-stone-200/80 space-y-2">
            <p class="text-xs font-semibold text-stone-700">Data Pemesan:</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <Input v-model="custName" placeholder="Nama lengkap" class="h-8 text-xs" />
              <Input v-model="custContact" placeholder="No. HP / Telegram" class="h-8 text-xs" />
            </div>
          </div>

          <!-- Fulfillment: tanya ambil di toko vs diantar SEBELUM order dibuat -->
          <div v-if="fulfillment && fulfillment.ref === m.summary.summary_ref && fulfillment.stage === 'choice'" class="space-y-2">
            <p class="text-xs font-semibold text-stone-700">Mau diambil di toko, atau diantar ke alamat?</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" size="md" class="h-11 justify-center" @click="choosePickup(m.summary!)">
                Ambil di toko
              </Button>
              <Button variant="ai" size="md" class="h-11 justify-center" @click="fulfillment.stage = 'delivery'">
                Diantar ke alamat
              </Button>
            </div>
          </div>

          <!-- Form alamat pengiriman (khusus delivery) -->
          <div v-else-if="fulfillment && fulfillment.ref === m.summary.summary_ref && fulfillment.stage === 'delivery'" class="space-y-2 rounded-xl bg-white/80 p-3 ring-1 ring-stone-200/80">
            <p class="text-xs font-semibold text-stone-700">Kirim ke mana?</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <Input v-model="dlvRecipient" placeholder="Nama penerima" class="h-9 text-xs" />
              <Input v-model="dlvPhone" placeholder="No. HP penerima" class="h-9 text-xs" />
            </div>
            <Textarea v-model="dlvAddress" placeholder="Alamat lengkap (jalan, nomor, kota, kode pos)" rows="2" class="text-xs" />
            <Input v-model="dlvNotes" placeholder="Catatan kurir (opsional)" class="h-9 text-xs" />
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" size="md" class="justify-center" @click="fulfillment.stage = 'choice'">Kembali</Button>
              <Button variant="ai" size="md" class="flex-1 justify-center font-semibold" :loading="confirming" @click="submitDelivery(m.summary!)">
                Buat pesanan &amp; kirim
              </Button>
            </div>
          </div>

          <Button
            v-else
            variant="ai"
            size="md"
            class="w-full justify-center shadow-md font-semibold"
            :loading="confirming"
            @click="startConfirm(m.summary!)"
          >
            Konfirmasi pesanan
          </Button>

          <p v-if="confirmMsg" class="text-center text-xs font-medium" :class="confirmOk ? 'text-emerald-600 ' : 'text-rose-600 '">
            {{ confirmMsg }}
          </p>
        </div>

        <!-- Panel QRIS muncul setelah order tercatat (pickup: langsung; delivery: setelah detail tujuan) -->
        <QrisPanel v-if="m.payment" class="mt-3 sm:ml-9" :amount="m.payment.amount" :reference="m.payment.orderId" />
      </div>

      <!-- Typing Indicator -->
      <div v-if="sending" class="flex items-center gap-2 text-xs text-stone-500">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-clay-600/10 text-clay-600">
          <span class="inline-block h-2 w-2 rounded-full bg-current animate-ping" />
        </div>
        <span>Asisten sedang mengecek katalog toko…</span>
      </div>
    </div>

    <!-- Input Footer -->
    <div class="border-t border-stone-100/90 bg-stone-50/50 p-3 sm:p-4">
      <p class="mb-2 text-xs text-stone-500">Demo toko. Harga simulasi; chat memerlukan backend dan layanan AI yang aktif.</p>
      <p v-if="error" role="alert" class="mb-2 text-xs font-medium text-rose-600">{{ error }}</p>
      <form class="flex items-center gap-2" @submit.prevent="send()">
        <Input
          v-model="draft"
          placeholder="Ketik produk atau pertanyaan belanja kamu di sini…"
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
import type { ChatReply, ConfirmOrderResponse, FulfillmentInfo, OrderSummary, ProductOut } from '~/utils/api-types'
import { NormalizedApiError } from '~/composables/useApi'

interface PaymentInfo {
  orderId: string
  amount: number
  method: FulfillmentInfo['method']
  destination?: { recipient: string, phone: string, address: string, notes?: string }
}

interface Msg {
  role: 'me' | 'ai'
  text: string
  products?: ProductOut[]
  summary?: OrderSummary | null
  payment?: PaymentInfo
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
const fulfillment = ref<{ ref: string, stage: 'choice' | 'delivery' } | null>(null)
const dlvRecipient = ref('')
const dlvPhone = ref('')
const dlvAddress = ref('')
const dlvNotes = ref('')
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
  fulfillment.value = null
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

function startConfirm(summary: OrderSummary) {
  if (confirming.value) return
  if (needsInfo.value && (!custName.value.trim() || !custContact.value.trim())) {
    confirmOk.value = false
    confirmMsg.value = 'Isi nama & kontak dulu sebelum konfirmasi.'
    return
  }
  confirmMsg.value = ''
  fulfillment.value = { ref: summary.summary_ref, stage: 'choice' }
}

function choosePickup(summary: OrderSummary) {
  const info: FulfillmentInfo = { method: 'PICKUP' }
  fulfillment.value = null
  void confirmOrder(summary, info)
}

function submitDelivery(summary: OrderSummary) {
  if (!dlvRecipient.value.trim() || !dlvPhone.value.trim() || !dlvAddress.value.trim()) {
    confirmOk.value = false
    confirmMsg.value = 'Isi nama penerima, no. HP, dan alamat lengkap dulu.'
    return
  }
  const info: FulfillmentInfo = {
    method: 'DELIVERY',
    recipient: dlvRecipient.value.trim(),
    phone: dlvPhone.value.trim(),
    address: dlvAddress.value.trim(),
    notes: dlvNotes.value.trim() || undefined,
  }
  fulfillment.value = null
  void confirmOrder(summary, info)
}

function orderMessage(orderId: string, total: number, info: FulfillmentInfo, replayed: boolean): string {
  const replayNote = replayed ? '\n\n(Order ini sudah tercatat sebelumnya, tidak ada duplikasi.)' : ''
  if (info.method === 'PICKUP') {
    return `**Pesanan #${orderId.slice(0, 8)} tercatat.**\nAmbil di toko: tunjukkan ID pesanan ini ke kasir saat pengambilan.\n\nTotal tagihan: **${formatIDR(total)}**${replayNote}`
  }
  const dest = [`- **Penerima:** ${info.recipient} (${info.phone})`, `- **Alamat:** ${info.address}`]
  if (info.notes) dest.push(`- **Catatan kurir:** ${info.notes}`)
  return `**Pesanan #${orderId.slice(0, 8)} tercatat.**\nPaket akan dikirim ke:\n\n${dest.join('\n')}\n\nTotal tagihan: **${formatIDR(total)}**${replayNote}`
}

async function confirmOrder(summary: OrderSummary, fulfillmentInfo: FulfillmentInfo) {
  if (confirming.value) return
  confirming.value = true; confirmMsg.value = ''
  try {
    if (!idemKeys.has(summary.summary_ref)) idemKeys.set(summary.summary_ref, uuid())
    const conv = await ensureSession()
    const res = await $fetch<ConfirmOrderResponse>(
      `${base}/chat/${conv}/confirm`,
      {
        method: 'POST',
        body: {
          order_summary_ref: summary.summary_ref,
          idempotency_key: idemKeys.get(summary.summary_ref),
          customer: { name: custName.value.trim() || 'Tamu', contact: custContact.value.trim() || 'guest' },
          fulfillment: fulfillmentInfo
        }
      }
    )
    confirmOk.value = true
    confirmMsg.value = res.replayed
      ? `Order sudah tercatat sebelumnya (${res.order_id.slice(0, 8)}…). Tidak ada duplikasi.`
      : ''
    messages.value.push({
      role: 'ai',
      text: orderMessage(res.order_id, res.total, fulfillmentInfo, res.replayed),
      payment: {
        orderId: res.order_id,
        amount: res.total,
        method: fulfillmentInfo.method,
        destination: fulfillmentInfo.method === 'DELIVERY' && fulfillmentInfo.address
          ? {
              recipient: fulfillmentInfo.recipient || '',
              phone: fulfillmentInfo.phone || '',
              address: fulfillmentInfo.address,
              notes: fulfillmentInfo.notes,
            }
          : undefined,
      },
    })
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

