import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, expireStaleOrders, stockSummary } from '../../../utils/business'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  // Lazy expiry: order UNPAID lewat TTL dibatalkan + stok kembali BEFORE ringkasan
  // stok dihitung, supaya angka stok yang dilihat Owner sudah real-time.
  await expireStaleOrders(db)
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  return await stockSummary(db, lowDefault)
})
