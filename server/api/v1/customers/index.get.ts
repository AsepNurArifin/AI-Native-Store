import { desc } from 'drizzle-orm'
import { customers } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const rows = await db.select().from(customers).orderBy(desc(customers.registeredAt)).limit(200)
  return rows.map(c => ({
    id: String(c.id), channel: c.channel, identifier: c.identifier, name: c.name,
    contact: c.contact, registered_at: (c.registeredAt as Date).toISOString()
  }))
})
