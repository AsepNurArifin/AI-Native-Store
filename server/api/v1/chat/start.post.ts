import { conversations } from '../../../database/schema'
import { ensureCustomer, ensureSeeded } from '../../../utils/business'
import { webIdentity } from '../../../utils/identity'
import { firstRow } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const db = getDb()
  await ensureSeeded(db)
  const body = await readBody<{ channel?: string, customer_ref?: string, customer_name?: string }>(event)
  const channel = body?.channel || 'WEB'
  if (!['WEB', 'TELEGRAM'].includes(channel)) {
    throw createError({ statusCode: 422, message: 'channel harus WEB/TELEGRAM', data: { detail: { code: 'VALIDATION', message: 'channel harus WEB/TELEGRAM' } } })
  }
  // PERBAIKAN: default 'Tamu|guest' membuat semua pembeli anonim menyatu ke satu
  // baris customers. Identitas web sekarang session id dari cookie server.
  const web = webIdentity(event)
  const ref = web.identifier
  const name = body?.customer_name?.trim() || 'Tamu'
  const customer = await ensureCustomer(db, channel, ref, name, null)
  const conv = firstRow(
    await db.insert(conversations).values({ customerId: customer.id, channel, outcome: 'OPEN' }).returning(),
    'insert percakapan'
  )
  return { conversation_id: String(conv.id), customer_id: String(customer.id), channel }
})
