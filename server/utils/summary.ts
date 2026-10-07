// Order Summary store berbasis DB, TTL 30 menit (price lock).
// Sebelumnya in-memory Map — hilang antar-instance/restart (berbahaya di Vercel).
import { and, desc, eq, gt, lt } from 'drizzle-orm'
import { orderSummaries } from '../database/schema'

export interface SummaryItem {
  product_id: string
  quantity: number
}

export interface OrderSummaryLine {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  discount_per_unit: number
  unit_effective: number
  line_total: number
}

export interface OrderSummary {
  summary_ref: string
  items: OrderSummaryLine[]
  total: number
  quoted_at?: string
  conversation_id?: string | null
  channel?: string | null
}

const TTL_MS = 30 * 60 * 1000

async function purgeStale(db: ReturnType<typeof getDb>) {
  await db.delete(orderSummaries).where(lt(orderSummaries.expiresAt, new Date()))
}

export async function putSummary(
  db: ReturnType<typeof getDb>, summary: OrderSummary,
  opts: { conversationId?: string | null, channel?: string | null } = {}
) {
  await purgeStale(db)
  const values = {
    conversationId: (opts.conversationId ?? summary.conversation_id ?? null) as never,
    channel: (opts.channel ?? summary.channel ?? 'WEB'),
    payload: summary as never,
    expiresAt: new Date(Date.now() + TTL_MS)
  }
  await db.insert(orderSummaries).values({ summaryRef: summary.summary_ref, ...values })
    .onConflictDoUpdate({ target: orderSummaries.summaryRef, set: values })
}

export async function getSummary(db: ReturnType<typeof getDb>, ref: string): Promise<OrderSummary | null> {
  const row = (await db.select().from(orderSummaries)
    .where(and(eq(orderSummaries.summaryRef, ref), gt(orderSummaries.expiresAt, new Date())))
    .limit(1))[0]
  return row ? { ...(row.payload as unknown as OrderSummary), conversation_id: row.conversationId ? String(row.conversationId) : null, channel: row.channel } : null
}

export async function putForConversation(db: ReturnType<typeof getDb>, convId: string, summary: OrderSummary) {
  await putSummary(db, summary, { conversationId: convId })
}

export async function getForConversation(db: ReturnType<typeof getDb>, convId: string): Promise<OrderSummary | null> {
  const row = (await db.select().from(orderSummaries)
    .where(and(eq(orderSummaries.conversationId, convId as never), gt(orderSummaries.expiresAt, new Date())))
    .orderBy(desc(orderSummaries.createdAt)).limit(1))[0]
  return row ? { ...(row.payload as unknown as OrderSummary), conversation_id: String(row.conversationId), channel: row.channel } : null
}

export async function popForConversation(db: ReturnType<typeof getDb>, convId: string) {
  await db.delete(orderSummaries).where(eq(orderSummaries.conversationId, convId as never))
}
