import { desc, ilike, or } from 'drizzle-orm'
import { customers } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page || 1))
  const pageSize = Math.min(100, Number(q.page_size || 50))
  // Paginasi + pencarian di SQL (bukan limit 200 mentah / filter di JS).
  // `q` cocok dengan nama, kontak, ATAU identifier (no. TG / session id).
  let where
  if (q.q) {
    const like = `%${String(q.q).trim().replace(/[\\%_]/g, '\\$&')}%`
    where = or(ilike(customers.name, like), ilike(customers.contact, like), ilike(customers.identifier, like))
  }
  const rows = await db.select().from(customers)
    .where(where)
    .orderBy(desc(customers.registeredAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return rows.map(c => ({
    id: String(c.id), channel: c.channel, identifier: c.identifier, name: c.name,
    contact: c.contact, registered_at: (c.registeredAt as Date).toISOString()
  }))
})
