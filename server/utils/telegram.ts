import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { conversationMessages, conversations, idempotencyKeys } from '../database/schema'
import { ensureCustomer, ensureSeeded } from './business'
import { getSummary, popForConversation, type OrderSummary } from './summary'
import { createOrderFromSummary } from './business'
import { salesHandleMessage } from './agents'
import { OrderError } from './errors'

export function verifyTelegramSecret(header: string | undefined): boolean {
  const provider = String(useRuntimeConfig().telegramProvider || process.env.TELEGRAM_PROVIDER || 'mock')
  if (provider === 'mock') return true
  const secret = String(useRuntimeConfig().telegramWebhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET || '')
  if (!secret || !header) return false
  try {
    const a = Buffer.from(header)
    const b = Buffer.from(secret)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  catch {
    return false
  }
}

export function parseTelegramUpdate(payload: Record<string, unknown>): { kind: 'message' | 'confirm' | 'cancel' | 'ignore', chatId?: string, text?: string, ref?: string, messageId?: string, name?: string } | null {
  const updateId = String((payload.update_id as number) ?? '')
  if (payload.callback_query) {
    const cq = payload.callback_query as Record<string, unknown>
    const data = String((cq.data as string) || '')
    const msg = cq.message as Record<string, unknown> | undefined
    const chat = msg?.chat as Record<string, unknown> | undefined
    const chatId = String(chat?.id || (cq.from as Record<string, unknown>)?.id || '')
    if (data.startsWith('CONFIRM:')) return { kind: 'confirm', chatId, ref: data.slice(8), messageId: updateId }
    if (data === 'CANCEL') return { kind: 'cancel', chatId, messageId: updateId }
    return { kind: 'ignore', messageId: updateId }
  }
  const msg = payload.message as Record<string, unknown> | undefined
  if (!msg || typeof msg.text !== 'string') return { kind: 'ignore', messageId: updateId }
  const chat = msg.chat as Record<string, unknown>
  const from = msg.from as Record<string, unknown> | undefined
  const text = String(msg.text)
  if (text.startsWith('CONFIRM:')) return { kind: 'confirm', chatId: String(chat.id), ref: text.slice(8), messageId: updateId }
  if (text.trim().toUpperCase() === 'CANCEL') return { kind: 'cancel', chatId: String(chat.id), messageId: updateId }
  return { kind: 'message', chatId: String(chat.id), text, messageId: updateId, name: String(from?.first_name || 'Telegram User') }
}

export async function sendTelegramMessage(chatId: string, text: string, buttons?: Array<{ text: string, callback: string }>) {
  const provider = String(useRuntimeConfig().telegramProvider || 'mock')
  if (provider === 'mock') return { mocked: true }
  const token = String(useRuntimeConfig().telegramBotToken || '')
  const base = String(useRuntimeConfig().telegramApiBase || 'https://api.telegram.org')
  if (!token) return { mocked: true }
  try {
    await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: buttons ? { inline_keyboard: [buttons.map(b => ({ text: b.text, callback_data: b.callback }))] } : undefined
      })
    })
  }
  catch (e) {
    console.error('[telegram] send failed', e)
  }
  return { sent: true }
}

export async function handleTelegramWebhook(db: ReturnType<typeof getDb>, payload: Record<string, unknown>) {
  await ensureSeeded(db)
  const parsed = parseTelegramUpdate(payload)
  if (!parsed || parsed.kind === 'ignore') return { status: 'ignored' }
  // Dedup update di DB (tahan restart & multi-instance) + bersihkan key lama.
  const dedupKey = `tg:upd:${String(parsed.messageId ?? '').slice(0, 20) || `${parsed.chatId}:${String(parsed.text ?? '').slice(0, 30)}`.slice(0, 50)}`
  const fresh = await db.insert(idempotencyKeys).values({ key: dedupKey, orderId: null as never }).onConflictDoNothing().returning()
  if (!fresh.length) return { status: 'duplicate' }
  await db.execute(sql`DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours'`)

  const customer = await ensureCustomer(db, 'TELEGRAM', parsed.chatId!, parsed.name || 'Telegram User', null)
  const open = await db.select().from(conversations).where(eq(conversations.customerId, customer.id as never))
  let conv = open.filter(c => c.channel === 'TELEGRAM' && (c.outcome === 'OPEN' || !c.outcome)).sort((a, b) => +new Date(b.lastActivityAt as unknown as string) - +new Date(a.lastActivityAt as unknown as string))[0]
  if (!conv) {
    const ins = await db.insert(conversations).values({ customerId: customer.id, channel: 'TELEGRAM', outcome: 'OPEN' }).returning()
    conv = ins[0]
  }
  const convId = String(conv.id)

  if (parsed.kind === 'cancel') {
    await db.insert(conversationMessages).values({ conversationId: convId as never, sender: 'CUSTOMER', content: 'CANCEL', messageType: 'BUTTON_REPLY' })
    await db.update(conversations).set({ outcome: 'ABANDONED', lastActivityAt: new Date() as never }).where(eq(conversations.id, convId as never))
    await popForConversation(db, convId)
    await sendTelegramMessage(parsed.chatId!, 'Pesanan dibatalkan. Tidak ada order yang dibuat.')
    return { status: 'ok', reply: 'cancelled' }
  }
  if (parsed.kind === 'confirm') {
    const summary = await getSummary(db, parsed.ref!)
    if (!summary) {
      await sendTelegramMessage(parsed.chatId!, 'Ringkasan pesanan sudah kedaluwarsa. Silakan ulangi pencarian produk.')
      return { status: 'ok', reply: 'expired' }
    }
    // Scoping: summary hanya bisa dikonfirmasi dari percakapan pemiliknya.
    if (summary.conversation_id && summary.conversation_id !== convId) {
      await sendTelegramMessage(parsed.chatId!, 'Ringkasan pesanan ini bukan milik percakapan ini. Ulangi pencarian produk.')
      return { status: 'ok', reply: 'mismatch' }
    }
    try {
      const { order, replayed } = await createOrderFromSummary(db, {
        conversationId: convId, channel: 'TELEGRAM',
        customerIdentity: { channel: 'TELEGRAM', identifier: parsed.chatId!, name: customer.name, contact: customer.contact },
        items: summary.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        idempotencyKey: `tg:${parsed.ref}`,
        expected: summary
      })
      await db.update(conversations).set({ outcome: 'ORDERED', lastActivityAt: new Date() as never }).where(eq(conversations.id, convId as never))
      await popForConversation(db, convId)
      const total = Number(order.totalAmount)
      await sendTelegramMessage(parsed.chatId!, `Pesanan #${String(order.id).slice(0, 8)} ${replayed ? 'sudah diproses' : 'berhasil'}. Total Rp${total.toLocaleString('id-ID')}`)
      return { status: 'ok', reply: 'ordered', order_id: String(order.id) }
    }
    catch (e) {
      const msg = e instanceof OrderError ? e.message : 'Gagal membuat pesanan.'
      await sendTelegramMessage(parsed.chatId!, msg)
      return { status: 'ok', reply: 'error', message: msg }
    }
  }
  // Pesan biasa -> sales agent
  try {
    const r = await salesHandleMessage(db, convId, parsed.text!)
    let text = r.reply
    const buttons = r.order_summary
      ? [{ text: 'Konfirmasi', callback: `CONFIRM:${r.order_summary.summary_ref}` }, { text: 'Batalkan', callback: 'CANCEL' }]
      : undefined
    if (r.order_summary) text += `\n\n${formatSummaryText(r.order_summary)}`
    await sendTelegramMessage(parsed.chatId!, text, buttons)
    return { status: 'ok', reply: r.reply }
  }
  catch (e) {
    await db.update(conversations).set({ outcome: 'ERROR' }).where(eq(conversations.id, convId as never))
    throw e
  }
}

/** Ringkasan tekstual quote — user melihat persis isi & total sebelum menekan Konfirmasi. */
function formatSummaryText(s: OrderSummary): string {
  const lines = s.items.map((i) => {
    const disc = i.discount_per_unit > 0 ? ` (hemat Rp${i.discount_per_unit.toLocaleString('id-ID')}/unit)` : ''
    return `${i.quantity}x ${i.name} @ Rp${i.unit_effective.toLocaleString('id-ID')}${disc} = Rp${i.line_total.toLocaleString('id-ID')}`
  })
  return `Ringkasan pesanan:\n${lines.join('\n')}\nTotal: Rp${s.total.toLocaleString('id-ID')}\n\nTekan "Konfirmasi" untuk membuat pesanan ini, atau "Batalkan".`
}
