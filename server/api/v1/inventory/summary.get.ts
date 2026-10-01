import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, stockSummary } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  return await stockSummary(db, lowDefault)
})
