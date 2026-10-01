import { eq, sql } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { ensureSeeded } from '../../../utils/business'

export default defineEventHandler(async () => {
  const db = getDb()
  await ensureSeeded(db)
  const rows = await db.execute(sql`SELECT DISTINCT category FROM products WHERE status = 'ACTIVE' ORDER BY category`)
  const list = (rows as unknown as Array<{ category: string }>) ?? (rows as unknown as { rows?: Array<{ category: string }> })?.rows ?? []
  return list.map(r => r.category)
})
