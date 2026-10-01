import { eq } from 'drizzle-orm'
import { conversationMessages, conversations, recommendations } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  const rows = await db.select().from(conversations).where(eq(conversations.id, id as never)).limit(1)
  const c = rows[0]
  if (!c) throw createError({ statusCode: 404, message: 'Percakapan tidak ditemukan', data: { detail: 'Percakapan tidak ditemukan' } })
  const msgs = await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, c.id))
  msgs.sort((a, b) => +new Date(a.timestamp as unknown as string) - +new Date(b.timestamp as unknown as string))
  const recs = await db.select().from(recommendations).where(eq(recommendations.conversationId, c.id))
  return {
    id: String(c.id), customer_id: String(c.customerId), channel: c.channel,
    started_at: (c.startedAt as Date).toISOString(), last_activity_at: (c.lastActivityAt as Date).toISOString(),
    ended_at: c.endedAt ? (c.endedAt as Date).toISOString() : null, outcome: c.outcome,
    messages: msgs.map(m => ({
      id: String(m.id), sender: m.sender, content: m.content, message_type: m.messageType,
      timestamp: (m.timestamp as Date).toISOString()
    })),
    recommendations: recs.map(r => ({
      id: String(r.id), product_id: String(r.productId), reason: r.reason,
      timestamp: (r.timestamp as Date).toISOString()
    }))
  }
})
