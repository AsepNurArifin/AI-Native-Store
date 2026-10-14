import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'
import { isForeignKeyViolation, productInUse, purgeProducts } from '../../../utils/products'

/** Batas satu permintaan: cukup untuk satu katalog, sekaligus membatasi SELECT. */
const MAX_IDS = 500

/**
 * Hapus banyak produk sekaligus (dipakai untuk membersihkan sisa katalog
 * seed). All-or-nothing: satu produk gagal -> tidak ada yang terhapus.
 *
 * Body: `{ ids: string[], force?: boolean }`
 * - `force: true` juga menghapus `order_items` produk tsb dan menyelaraskan
 *   order yang tersisa (total dihitung ulang, order tanpa item -> CANCELLED).
 * - `force` tidak di-set dan salah satu produk sudah dipakai order -> `409`.
 */
export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)

  const body = await readBody<{ ids?: unknown, force?: unknown }>(event).catch(() => ({}) as { ids?: unknown, force?: unknown })
  const raw = Array.isArray(body?.ids) ? body.ids : []
  const ids = raw.map(String)
  if (!ids.length) {
    throw createError({ statusCode: 400, message: 'Tidak ada produk dipilih.', data: { detail: { code: 'NO_SELECTION', message: 'Tidak ada produk dipilih.' } } })
  }
  if (ids.length > MAX_IDS) {
    throw createError({ statusCode: 400, message: `Maksimal ${MAX_IDS} produk per permintaan.`, data: { detail: { code: 'TOO_MANY_IDS', message: `Maksimal ${MAX_IDS} produk per permintaan.` } } })
  }
  const bad = ids.find(id => !isUuid(id))
  if (bad) {
    throw createError({ statusCode: 400, message: 'ID produk tidak valid.', data: { detail: { code: 'INVALID_ID', message: `ID produk tidak valid: ${bad}` } } })
  }

  const force = body?.force === true || body?.force === '1'
  try {
    const result = await purgeProducts(db, ids, { force, actorId: owner.id })
    return { status: 'ok', ...result }
  }
  catch (e: unknown) {
    if (isForeignKeyViolation(e)) throw productInUse(0)
    throw e
  }
})
