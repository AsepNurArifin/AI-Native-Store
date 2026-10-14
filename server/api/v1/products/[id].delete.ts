import { eq, sql } from 'drizzle-orm'
import { products } from '../../../database/schema'
import { requireOwner } from '../../../utils/auth'
import { ensureSeeded, logAudit } from '../../../utils/business'
import { isUuid } from '../../../utils/errors'

/** Postgres: foreign_key_violation. */
const FK_VIOLATION = '23503'
const IN_USE_MESSAGE = 'Produk sudah dipakai order/percakapan, nonaktifkan saja'

function productInUse() {
  return createError({
    statusCode: 409,
    message: IN_USE_MESSAGE,
    data: { detail: { code: 'PRODUCT_IN_USE', message: IN_USE_MESSAGE } }
  })
}

/** Bentuk hasil `db.execute` berbeda antar driver (array vs `{ rows }`). */
function hasRows(result: unknown): boolean {
  if (Array.isArray(result)) return result.length > 0
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) && rows.length > 0
}

/**
 * Cari kode error Postgres di rantai `cause`.
 * Drizzle/postgres.js kadang membungkus error driver, jadi `e.code` di
 * permukaan belum tentu ada.
 */
function isForeignKeyViolation(e: unknown): boolean {
  const seen = new Set<unknown>()
  let cur: unknown = e
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    if ((cur as { code?: unknown }).code === FK_VIOLATION) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })
  const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
  if (!rows[0]) throw createError({ statusCode: 404, message: 'Produk tidak ditemukan', data: { detail: 'Produk tidak ditemukan' } })

  try {
    // PERBAIKAN: hapus + cek referensi dalam SATU transaksi.
    // Sebelumnya tiap DELETE berjalan sendiri-sendiri, jadi permintaan paralel
    // bisa mengecek "belum ada referensi" lalu bentrok dengan request lain.
    await db.transaction(async (tx) => {
      // Kunci baris produk selama transaksi: dua request hapus paralel tidak
      // bisa saling lolos cek referensi.
      await tx.execute(sql`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`)
      // recommendations.product_id DAN order_items.product_id sama-sama
      // FK tanpa ON DELETE. Sebelumnya hanya order_items yang dicek, jadi
      // produk yang pernah direkomendasikan sales agent di chat gagal hapus
      // -> Postgres 23503 -> HTTP 500 "Server Error".
      const refs = await tx.execute(sql`
        SELECT 1 FROM order_items WHERE product_id = ${id}::uuid
        UNION ALL
        SELECT 1 FROM recommendations WHERE product_id = ${id}::uuid
        LIMIT 1`)
      if (hasRows(refs)) throw productInUse()
      await tx.execute(sql`DELETE FROM inventory_transactions WHERE product_id = ${id}::uuid`)
      await tx.execute(sql`DELETE FROM promotions WHERE product_id = ${id}::uuid`)
      await tx.delete(products).where(eq(products.id, id as never))
    })
  }
  catch (e: unknown) {
    // Jaring pengaman: tabel referensi yang DITAMBAHKAN di masa depan (mis.
    // wishlist) tidak lagi mengubah 409 yang bermakna menjadi 500 yang tidak
    // bisa dibaca pengguna — meski tabelnya terlewat di cek di atas.
    if (isForeignKeyViolation(e)) throw productInUse()
    throw e
  }

  // Audit di luar transaksi: rollback DELETE tidak boleh meninggalkan jejak
  // "produk dihapus" di audit trail.
  await logAudit(db, 'PRODUCT_DELETED', 'USER', { actorId: owner.id, detail: { product_id: id } })
  setResponseStatus(event, 204)
  return null
})
