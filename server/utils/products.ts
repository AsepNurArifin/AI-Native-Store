import { eq, sql } from 'drizzle-orm'
import { orders, orderItems, products } from '../database/schema'
import { logAudit, num } from './business'
import { round2 } from '../../shared/utils/pricing'
import type { DbLike } from './db'

/**
 * Penghapusan produk.
 *
 * Kenapa tidak cascade buta di level Postgres? Karena menghapus baris pesanan
 * tanpa menyesuaikan order-nya membuat
 * `orders.total_amount` tetap menjumlahkan barang yang sudah tidak ada, dan
 * angka di detail order / analitik jadi tidak cocok dengan isi. Jadi
 * penghapusan produk + penyelarasan order dilakukan satu transaction di sini.
 *
 * Semua fungsi di file ini WAJIB dipanggil dari dalam `db.transaction`.
 */

/** Bentuk hasil `db.execute` berbeda antar driver (array vs `{ rows }`). */
function execRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) ? (rows as T[]) : []
}

/**
 * Cari kode error Postgres di rantai `cause`. Drizzle / postgres.js kadang
 * membungkus error driver, jadi `e.code` di permukaan belum tentu ada.
 */
export function isForeignKeyViolation(e: unknown): boolean {
  const seen = new Set<unknown>()
  let cur: unknown = e
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    if ((cur as { code?: unknown }).code === '23503') return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

export interface PurgeResult {
  deleted: number
  orders_touched: number
  orders_cancelled: number
}

/** Detail error 409 agar UI bisa menyebut jumlah order yang terpengaruh. */
export function productInUse(orderCount: number) {
  const message = 'Produk sudah dipakai order, nonaktifkan saja'
  return createError({
    statusCode: 409,
    message,
    data: { detail: { code: 'PRODUCT_IN_USE', message, order_count: orderCount } }
  })
}

/**
 * Hapus jejak order untuk satu produk lalu selaraskan order yang tersisa.
 * Dipanggil setelah baris produk dikunci `FOR UPDATE`.
 *
 * `force` = untuk data demo/seed. Menghapus `order_items` produk tsb lalu:
 *   - `total_amount` order dihitung ulang dari item yang tersisa,
 *   - key produk dibuang dari `promotion_snapshot`,
 *   - order yang jadi tanpa item sama sekali -> CANCELLED dengan total 0.
 * Order yang masih punya item lain tidak ikut terhapus — hanya angkanya yang
 * diselaraskan.
 */
async function purgeProductTx(tx: DbLike, id: string, force: boolean): Promise<PurgeResult> {
  // `recommendations` cuma log "AI menyarankan produk ini" — tidak ada nilai
  // historis, jadi tidak lagi menghalangi hapus dan dibersihkan diam-diam.
  // Inilah yang membuat produk yang hanya terkunci rekomendasi bisa dihapus.
  await tx.execute(sql`DELETE FROM recommendations WHERE product_id = ${id}::uuid`)

  const used = execRows<{ order_id: string }>(await tx.execute(
    sql`SELECT order_id FROM order_items WHERE product_id = ${id}::uuid`
  ))
  if (used.length && !force) throw productInUse(used.length)

  let ordersTouched = 0
  let ordersCancelled = 0
  if (used.length) {
    // Urut id -> kunci FOR UPDATE selalu diambil dengan urutan sama antar
    // request paralel, jadi tidak ada jalan ke deadlock.
    const orderIds = [...new Set(used.map(r => String(r.order_id)))].sort()
    for (const oid of orderIds) {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${oid}::uuid FOR UPDATE`)
    }
    await tx.execute(sql`DELETE FROM order_items WHERE product_id = ${id}::uuid`)

    for (const oid of orderIds) {
      const orderRows = await tx.select().from(orders).where(eq(orders.id, oid as never)).limit(1)
      const o = orderRows[0]
      if (!o) continue
      ordersTouched += 1
      // Buang key produk ini dari snapshot. Dibuat ulang lewat filter, bukan
      // `delete` dengan key dinamis (dilarang oleh aturan eslint
      // no-dynamic-delete).
      const snapshot = Object.fromEntries(
        Object.entries((o.promotionSnapshot || {}) as Record<string, unknown>).filter(([k]) => k !== id)
      )
      const remaining = await tx.select().from(orderItems).where(eq(orderItems.orderId, oid as never))
      if (!remaining.length) {
        await tx.update(orders).set({
          status: 'CANCELLED',
          cancelledAt: new Date() as never,
          totalAmount: '0' as never,
          promotionSnapshot: (Object.keys(snapshot).length ? snapshot : null) as never
        }).where(eq(orders.id, oid as never))
        ordersCancelled += 1
        continue
      }
      const total = round2(remaining.reduce((s, it) => s + num(it.lineTotal), 0))
      await tx.update(orders).set({
        totalAmount: String(total) as never,
        promotionSnapshot: (Object.keys(snapshot).length ? snapshot : null) as never
      }).where(eq(orders.id, oid as never))
    }
  }

  await tx.execute(sql`DELETE FROM inventory_transactions WHERE product_id = ${id}::uuid`)
  await tx.execute(sql`DELETE FROM promotions WHERE product_id = ${id}::uuid`)
  await tx.delete(products).where(eq(products.id, id as never))
  return { deleted: 1, orders_touched: ordersTouched, orders_cancelled: ordersCancelled }
}

/**
 * Hapus banyak produk dalam SATU transaksi: berhasil semua atau batal semua.
 * `ids` dikunci `FOR UPDATE` menurut urutan id agar request paralel tidak
 * mengunci silang.
 */
export async function purgeProducts(
  db: DbLike,
  ids: string[],
  opts: { force: boolean, actorId: string | null }
): Promise<PurgeResult> {
  const unique = [...new Set(ids)].sort()
  const out: PurgeResult = { deleted: 0, orders_touched: 0, orders_cancelled: 0 }
  await db.transaction(async (tx) => {
    for (const id of unique) {
      await tx.execute(sql`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`)
    }
    for (const id of unique) {
      const r = await purgeProductTx(tx, id, opts.force)
      out.deleted += r.deleted
      out.orders_touched += r.orders_touched
      out.orders_cancelled += r.orders_cancelled
    }
    // Audit DI DALAM transaksi: kalau ada rollback, tidak boleh tertinggal
    // jejak "produk dihapus" untuk produk yang sebenarnya masih ada.
    await logAudit(tx, 'PRODUCT_DELETED', 'USER', {
      actorId: opts.actorId,
      detail: {
        product_ids: unique,
        forced: opts.force,
        orders_touched: out.orders_touched,
        orders_cancelled: out.orders_cancelled
      }
    })
  })
  return out
}
