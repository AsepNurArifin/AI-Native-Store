import { conversations } from '../../../database/schema'
import { ensureCustomer, ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ channel?: string, customer_ref?: string }>(event)
  const channel = body?.channel || 'WEB'
  if (!['WEB', 'TELEGRAM'].includes(channel)) {
    throw createError({ statusCode: 422, message: 'channel harus WEB/TELEGRAM', data: { detail: { code: 'VALIDATION', message: 'channel harus WEB/TELEGRAM' } } })
  }
  const ref = body?.customer_ref || 'Tamu|guest'
  const [name, contact] = ref.includes('|') ? ref.split('|') : [ref, null]
  const customer = await ensureCustomer(db, channel, ref, name || 'Tamu', contact || 'guest')
  const ins = await db.insert(conversations).values({ customerId: customer.id, channel, outcome: 'OPEN' }).returning()
  return { conversation_id: String(ins[0].id), customer_id: String(customer.id), channel }
})
