// In-memory Order Summary store TTL 30 menit — port backend/app/services/summary_store.py
export interface SummaryItem {
  product_id: string
  quantity: number
}

export interface OrderSummary {
  summary_ref: string
  items: Array<{ product_id: string, name: string, quantity: number, unit_price: number, discount: number, line_total: number }>
  total: number
}

const byRef = new Map<string, { summary: OrderSummary, expiresAt: number }>()
const byConv = new Map<string, { ref: string, expiresAt: number }>()
const TTL_MS = 30 * 60 * 1000

export function putSummary(summary: OrderSummary) {
  byRef.set(summary.summary_ref, { summary, expiresAt: Date.now() + TTL_MS })
}

export function getSummary(ref: string): OrderSummary | null {
  const e = byRef.get(ref)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    byRef.delete(ref)
    return null
  }
  return e.summary
}

export function putForConversation(convId: string, summary: OrderSummary) {
  putSummary(summary)
  byConv.set(convId, { ref: summary.summary_ref, expiresAt: Date.now() + TTL_MS })
}

export function getForConversation(convId: string): OrderSummary | null {
  const e = byConv.get(convId)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    byConv.delete(convId)
    return null
  }
  return getSummary(e.ref)
}

export function popForConversation(convId: string) {
  byConv.delete(convId)
}

export function purgeExpiredSummaries() {
  const now = Date.now()
  for (const [k, v] of byRef) if (now > v.expiresAt) byRef.delete(k)
  for (const [k, v] of byConv) if (now > v.expiresAt) byConv.delete(k)
}
