import { ensureSeeded } from '../../../utils/business'

/**
 * Seed manual (owner demo + 12 SKU) untuk setup/reset DB.
 * Pengganti auto-seed di jalur katalog yang sudah dihapus demi latency.
 * Contoh: curl -X POST https://host/api/v1/dev/seed
 */
export default defineEventHandler(async () => {
  const debug = String(useRuntimeConfig().debug ?? process.env.DEBUG ?? 'true') === 'true'
  if (!debug) {
    throw createError({ statusCode: 404, message: 'Not found', data: { detail: 'Not found' } })
  }
  const db = getDb()
  await ensureSeeded(db)
  return { status: 'ok', seeded: true }
})
