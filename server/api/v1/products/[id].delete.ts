import { eq } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'
import { isForeignKeyViolation, productInUse, purgeProducts } from '../../../utils/products'

/**
 * Hapus satu produk.
 *
 * - `?force=1` mengizinkan produk yang sudah dipakai order ikut terhapus
 *   (untuk data demo/seed). Order yang terpengaruh diselaraskan oleh
 *   `purgeProducts`: total dihitung ulang, order tanpa item -> CANCELLED.
 * - Tanpa `force`, produk yang masih punya `order_items` ditolak `409`.
 *
 * `recommendations` (log rekomendasi AI) tidak lagi memblokir — tidak ada
 * nilai historis di sana.
 */
export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  if (!rows[0]) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })

  const q = getQuery(event)
  const force = q.force === '1' || q.force === 'true'
  try {
    // Cek referensi + hapus dalam SATU transaksi: dua request hapus paralel
    // tidak bisa saling lolos cek lalu bentrok di tengah jalan.
    await purgeProducts(db, [id], { force, actorId: owner.id })
  }
  catch (e: unknown) {
    // Jaring pengaman: tabel referensi yang DITAMBAHKAN di masa depan tidak
    // lagi mengubah 409 yang bermakna jadi 500 yang tidak terbaca.
    if (isForeignKeyViolation(e)) throw productInUse(0)
    throw e
  }

  setResponseStatus(event, 204)
  return null
})
