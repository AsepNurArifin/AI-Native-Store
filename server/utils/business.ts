import { createHash } from 'node:crypto'
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import {
  auditLogs, customers, idempotencyKeys, inventoryTransactions, orderItems, orderPaymentProofs, orders, products,
  promotions
} from '../database/schema'
import { discountedPrice, quoteLine, round2 } from '../../shared/utils/pricing'
import { OrderError, firstRow, isUuid } from './errors'
import type { OrderSummary } from './summary'
import type { DbLike } from './db'
import { validatePaymentProof, type PaymentProofInput } from './payment-proof'
import { readStoreSettings } from './store-settings'

export const num = (v: unknown): number => Number((v as string | number) ?? 0)

// ---------- Inventory ----------
/** Stok = agregasi transaksi lewat view `v_product_stock` (sumber kebenaran tunggal). */
export async function stocksFor(db: DbLike, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!ids.length) return map
  const rows = await db.execute(sql`SELECT product_id, current_stock FROM v_product_stock WHERE product_id IN (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})`)
  const list = (rows as unknown as Array<{ product_id: string, current_stock: string | number }>) ?? (rows as unknown as { rows?: Array<{ product_id: string, current_stock: string | number }> })?.rows ?? []
  for (const r of list) map.set(String(r.product_id), Number(r.current_stock ?? 0))
  for (const id of ids) if (!map.has(id)) map.set(id, 0)
  return map
}

export async function currentStock(db: DbLike, productId: string): Promise<number> {
  return (await stocksFor(db, [productId])).get(productId) ?? 0
}

// Cache stok jangka pendek untuk kebutuhan TAMPILAN katalog (beranda/rak/detail
// admin). `stocksFor` = agregasi SELURUH riwayat inventory_transactions lewat
// view v_product_stock — mahal, dan dipanggil di endpoint publik paling hot.
// Stok untuk display boleh stale ~3 detik; jalur yang MENGUBAH stok (checkout)
// tetap memakai `stocksFor` segar di dalam transaksi dengan lock FOR UPDATE
// (anti oversell tidak berubah).
const _stockCache = new Map<string, { at: number, stock: number }>()
const STOCK_TTL_MS = 3000

export async function stocksForCached(db: DbLike, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const now = Date.now()
  const miss: string[] = []
  for (const id of ids) {
    const c = _stockCache.get(id)
    if (c && now - c.at < STOCK_TTL_MS) out.set(id, c.stock)
    else miss.push(id)
  }
  if (miss.length) {
    for (const [pid, s] of await stocksFor(db, miss)) {
      if (_stockCache.size > 4096) _stockCache.clear()
      _stockCache.set(pid, { at: now, stock: s })
      out.set(pid, s)
    }
  }
  return out
}

export async function recordTx(db: DbLike, input: {
  productId: string, type: string, movement: 'IN' | 'OUT', referenceType?: string, quantity: number, referenceId?: string | null, actorId?: string | null
}) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new OrderError('INVALID_QTY', 'Quantity harus bilangan bulat positif')
  await db.insert(inventoryTransactions).values({
    productId: input.productId as never, type: input.type, movement: input.movement,
    referenceType: input.referenceType || 'MANUAL', quantity: input.quantity,
    referenceId: (input.referenceId || null) as never, actorId: (input.actorId || null) as never
  })
}

export async function stockSummary(db: DbLike, lowDefault: number) {
  const all = await db.select().from(products)
  const stocks = await stocksFor(db, all.map(p => String(p.id)))
  // `status` ikut — halaman inventori butuh untuk menyaring produk
  // nonaktif dari dropdown penyesuaian stok (endpoint adjustment menolaknya).
  return all.map((p) => {
    const stock = stocks.get(String(p.id)) ?? 0
    const thr = (p.lowStockThreshold as number | null) ?? lowDefault
    return {
      product_id: String(p.id), name: p.name, category: p.category, price: num(p.price),
      status: p.status,
      current_stock: stock, low_stock_threshold: p.lowStockThreshold ?? null, is_low_stock: stock <= thr,
      image_urls: p.imageUrls,
      image_url: p.imageUrls[0] || null
    }
  })
}

export async function withStock(db: DbLike, p: typeof products.$inferSelect, lowDefault: number) {
  const stock = await currentStock(db, String(p.id))
  // Termasuk field promo supaya AI/chat mengutip harga yang sama dengan katalog.
  const promo = await activePromotionFor(db, String(p.id))
  return catalogOut(p, stock, lowDefault, promo)
}

/** Batch: promo ACTIVE (belum kedaluwarsa) banyak produk dalam 1 query. */
export async function activePromosFor(db: DbLike, ids: string[]): Promise<Map<string, typeof promotions.$inferSelect>> {
  const map = new Map<string, typeof promotions.$inferSelect>()
  if (!ids.length) return map
  const rows = await db.select().from(promotions)
    .where(and(eq(promotions.status, 'ACTIVE'), inArray(promotions.productId, ids as never)))
  for (const p of rows) {
    const pid = String(p.productId)
    if (map.has(pid)) continue
    if (effectiveStatus({ status: p.status, startDate: p.startDate as unknown as Date, endDate: p.endDate as unknown as Date }) === 'ACTIVE') {
      map.set(pid, p)
    }
  }
  return map
}

/** Bentuk payload katalog publik: gambar + promo + harga efektif (via shared/utils/pricing). */
export function catalogOut(
  p: typeof products.$inferSelect, stock: number, lowDefault: number,
  promo: typeof promotions.$inferSelect | null
) {
  const thr = (p.lowStockThreshold as number | null) ?? lowDefault
  const discount = promo ? num(promo.discountPercentage) : 0
  return {
    id: String(p.id), name: p.name, category: p.category, specification: p.specification || {},
    price: num(p.price), status: p.status, low_stock_threshold: p.lowStockThreshold ?? null,
    current_stock: stock, is_low_stock: stock <= thr,
    image_urls: p.imageUrls,
    image_url: p.imageUrls[0] || null,
    discount_percentage: discount,
    discounted_price: discount > 0 ? discountedPrice(num(p.price), discount) : null,
    promotion: promo ? {
      id: String(promo.id), discount_percentage: discount,
      start_date: new Date(promo.startDate as unknown as string).toISOString(),
      end_date: new Date(promo.endDate as unknown as string).toISOString()
    } : null
  }
}

/** Satu paket: stok + promo + payload untuk daftar produk (2 query tambahan saja). */
export async function catalogList(
  db: DbLike, rows: Array<typeof products.$inferSelect>, lowDefault: number
) {
  const ids = rows.map(p => String(p.id))
  const [stocks, promos] = await Promise.all([stocksFor(db, ids), activePromosFor(db, ids)])
  return rows.map(p => catalogOut(p, stocks.get(String(p.id)) ?? 0, lowDefault, promos.get(String(p.id)) ?? null))
}

// ---------- Promotions ----------
export function effectiveStatus(promo: { status: string, startDate: Date | string, endDate: Date | string }, now = new Date()): string {
  if (promo.status === 'REJECTED' || promo.status === 'DRAFT') return promo.status
  const start = new Date(promo.startDate)
  const end = new Date(promo.endDate)
  if (now >= end) return 'EXPIRED'
  if (now < start) return 'SCHEDULED'
  return promo.status === 'ACTIVE' ? 'ACTIVE' : promo.status
}

export async function refreshPromotionExpiry(db: DbLike) {
  // Satu statement (sebelumnya loop UPDATE satu-per-satu — N round trip di
  // GET /promotions saat promo kedaluwarsa menumpuk). Saringan end_date <
  // now() di sisi DB, memakai filter yang sama dengan effectiveStatus().
  await db.update(promotions).set({ status: 'EXPIRED' })
    .where(and(eq(promotions.status, 'ACTIVE'), lt(promotions.endDate, new Date())))
}

export async function checkOverlap(db: DbLike, productId: string, start: Date, end: Date, excludeId?: string): Promise<boolean> {
  // PERBAIKAN: filter `end_date > now()`. Sebelumnya hanya status='ACTIVE' yang
  // dicek, sehingga promo yang sudah lewat tanggal tapi belum di-refresh oleh
  // refreshPromotionExpiry() tetap dianggap aktif dan bisa menolak promo baru
  // dengan 409 PROMO_OVERLAP (false positive) — tergantung apakah Owner kebetulan
  // membuka halaman list promo lebih dulu.
  const actives = await db.select().from(promotions).where(and(
    eq(promotions.productId, productId as never),
    eq(promotions.status, 'ACTIVE'),
    gt(promotions.endDate, new Date())
  ))
  for (const p of actives) {
    if (excludeId && String(p.id) === excludeId) continue
    const s = new Date(p.startDate as unknown as string)
    const e = new Date(p.endDate as unknown as string)
    if (s < end && e > start) return true
  }
  return false
}

export async function activePromotionFor(db: DbLike, productId: string) {
  const rows = await db.select().from(promotions).where(and(eq(promotions.productId, productId as never), eq(promotions.status, 'ACTIVE')))
  for (const p of rows) {
    if (effectiveStatus({ status: p.status, startDate: p.startDate as unknown as Date, endDate: p.endDate as unknown as Date }) === 'ACTIVE') return p
  }
  return null
}

// ---------- Orders ----------
export interface CreateOrderInput {
  conversationId?: string | null
  channel: string
  customerIdentity: { channel: string, identifier: string, name?: string | null, contact?: string | null }
  items: Array<{ product_id: string, quantity: number }>
  idempotencyKey?: string | null
  payment?: { method: 'CASH' | 'QRIS' }
  buyerPhone?: string | null
  paymentProof?: PaymentProofInput
  expectedTotal?: number
  fulfillment?: Record<string, unknown> | null
  /** Ringkasan yang dilihat & dikonfirmasi customer (price lock). */
  expected?: OrderSummary | null
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)]))
  return value
}

function orderRequestHash(input: CreateOrderInput): string | null {
  if (!input.payment) return null
  return createHash('sha256').update(JSON.stringify(canonicalValue({
    customer: input.customerIdentity, phone: input.buyerPhone ?? null,
    items: [...input.items].sort((a, b) => a.product_id.localeCompare(b.product_id)),
    fulfillment: input.fulfillment ?? null, payment: input.payment,
    expected_total: input.expectedTotal ?? null,
    proof: input.paymentProof ? { mime: input.paymentProof.mime, sha256: createHash('sha256').update(input.paymentProof.data).digest('hex') } : null
  }))).digest('hex')
}

export function isDeliveryOrder(order: { fulfillment: unknown }): boolean {
  return !!order.fulfillment && typeof order.fulfillment === 'object' && (order.fulfillment as Record<string, unknown>).method === 'DELIVERY'
}

export async function createOrderFromSummary(db: DbLike, input: CreateOrderInput) {
  if (!input.items?.length) throw new OrderError('EMPTY_ORDER', 'Tidak ada item untuk dipesan.')
  for (const it of input.items) {
    if (!isUuid(it.product_id)) {
      throw new OrderError('PRODUCT_NOT_FOUND', `Produk ${it.product_id} tidak ditemukan.`)
    }
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new OrderError('INVALID_QTY', 'Quantity harus bilangan bulat positif.')
    }
  }
  // Urut per product_id -> kunci FOR UPDATE tidak pernah deadlock antar order.
  const items = [...input.items].sort((a, b) => a.product_id.localeCompare(b.product_id))
  const orderTtlMinutes = Number(useRuntimeConfig().orderTtlMinutes ?? 120)
  const requestHash = orderRequestHash(input)

  return await db.transaction(async (tx) => {
    // Idempotency atomik (UC-02 E5): key diklaim di AWAL transaksi dengan
    // ON CONFLICT -> tidak ada window dobel-order saat request paralel.
    if (input.idempotencyKey) {
      const ttlMs = Number(useRuntimeConfig().idempotencyTtlMinutes ?? 30) * 60_000
      const claimed = await tx.insert(idempotencyKeys)
        .values({ key: input.idempotencyKey, orderId: null as never, requestHash })
        .onConflictDoNothing().returning()
      if (!claimed.length) {
        const row = (await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, input.idempotencyKey)).limit(1))[0]
        if (row?.orderId) {
          const existing = (await tx.select().from(orders).where(eq(orders.id, row.orderId)).limit(1))[0]
          const customer = existing ? (await tx.select().from(customers).where(eq(customers.id, existing.customerId)).limit(1))[0] : null
          if (existing && (!customer || customer.channel !== input.customerIdentity.channel || customer.identifier !== input.customerIdentity.identifier || (requestHash && row.requestHash !== requestHash) || (!requestHash && row.requestHash))) {
            throw new OrderError('IDEMPOTENCY_CONFLICT', 'Idempotency key sudah dipakai untuk pesanan atau pembeli berbeda.')
          }
          const age = Date.now() - new Date(row.createdAt as unknown as string).getTime()
          // Direct checkout replay is durable: paid proof may be retried after prices/TTL change.
          if (requestHash || age <= ttlMs) {
            if (existing) return { order: existing, replayed: true }
          }
          // Key kedaluwarsa -> diperlakukan sebagai key baru.
          await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.key, input.idempotencyKey))
          await tx.insert(idempotencyKeys).values({ key: input.idempotencyKey, orderId: null as never, requestHash })
        }
        else {
          throw new OrderError('IN_PROGRESS', 'Permintaan serupa sedang diproses. Coba lagi sebentar.')
        }
      }
    }

    // Validate only after committed replay lookup, before reserving any stock.
    if (input.payment?.method === 'QRIS') {
      const paymentSettings = await readStoreSettings(tx)
      if (!paymentSettings.qris_image_url || !paymentSettings.qris_merchant_name) {
        throw new OrderError('QRIS_UNAVAILABLE', 'Pembayaran QRIS belum dikonfigurasi. Hubungi toko.')
      }
      if (!input.paymentProof) throw new OrderError('PAYMENT_PROOF_REQUIRED', 'Bukti pembayaran QRIS wajib diunggah.')
      if (input.expectedTotal === undefined || !Number.isFinite(input.expectedTotal) || input.expectedTotal < 0) throw new OrderError('EXPECTED_TOTAL_REQUIRED', 'expected_total pembayaran QRIS wajib berupa jumlah yang telah dibayar.')
      await validatePaymentProof(input.paymentProof)
    }
    else if (input.paymentProof) throw new OrderError('INVALID_PAYMENT_METHOD', 'Bukti pembayaran hanya boleh dilampirkan untuk QRIS.')
    if (input.payment && isDeliveryOrder({ fulfillment: input.fulfillment }) && input.payment.method !== 'QRIS') {
      throw new OrderError('INVALID_PAYMENT_METHOD', 'Pesanan antar hanya menerima pembayaran QRIS.')
    }

    // Customer channel-specific
    const found = await tx.select().from(customers).where(
      and(eq(customers.channel, input.customerIdentity.channel), eq(customers.identifier, input.customerIdentity.identifier))
    ).limit(1)
    let customerId: string
    if (found[0]) customerId = String(found[0].id)
    else {
      const ins = await tx.insert(customers).values({
        channel: input.customerIdentity.channel,
        identifier: input.customerIdentity.identifier,
        name: input.customerIdentity.name || null,
        contact: input.customerIdentity.contact || null
      }).returning({ id: customers.id })
      customerId = String(firstRow(ins, 'insert customer').id)
    }

    // Kunci baris produk sebelum cek stok (anti oversell saat paralel).
    await tx.execute(sql`SELECT id FROM products WHERE id IN (${sql.join(items.map(i => sql`${i.product_id}::uuid`), sql`, `)}) ORDER BY id FOR UPDATE`)

    const created = await tx.insert(orders).values({
      customerId: customerId as never,
      status: 'CONFIRMED',
      // Reservasi stok tidak otomatis berarti dibayar: CASH menunggu deadline,
      // QRIS menunggu review bukti tanpa expiry. PAID hanya lewat admin /pay.
      paymentStatus: 'UNPAID',
      buyerName: input.customerIdentity.name ?? found[0]?.name ?? 'Tamu',
      buyerContact: input.customerIdentity.contact ?? (input.payment ? null : found[0]?.contact) ?? null,
      buyerPhone: input.buyerPhone ?? null,
      paymentMethod: input.payment?.method ?? null,
      paymentReview: input.payment?.method === 'QRIS' ? 'PENDING' : null,
      deliveryStatus: input.payment && isDeliveryOrder({ fulfillment: input.fulfillment }) ? 'NOT_SHIPPED' : null,
      expiresAt: input.payment?.method === 'QRIS' ? null : new Date(Date.now() + orderTtlMinutes * 60_000),
      conversationId: (input.conversationId || null) as never,
      channelOrigin: input.channel,
      totalAmount: '0' as never,
      fulfillment: (input.fulfillment || null) as never
    }).returning()
    const order = firstRow(created, 'insert orders')

    // Price lock: bandingkan quote baru vs ringkasan yang dikonfirmasi customer.
    const expectedByProduct = new Map<string, NonNullable<OrderSummary['items']>>()
    for (const it of input.expected?.items ?? []) {
      const arr = expectedByProduct.get(it.product_id) ?? []
      arr.push(it)
      expectedByProduct.set(it.product_id, arr)
    }

    let total = 0
    const snapshot: Record<string, { promotion_id: string, discount_percentage: number, price_before: number, discount_per_unit: number }> = {}
    // Data dibatch SEKALI di depan loop (sebelumnya 3 query per item di dalam
    // transaksi sambil memegang kunci FOR UPDATE — order 10 item ≈ 30 round
    // trip; sekarang 3 query total). Validasi & urutan error per item tetap
    // identik: PRODUCT_NOT_FOUND -> PRODUCT_INACTIVE -> INSUFFICIENT_STOCK.
    const productIds = items.map(i => i.product_id)
    const prowRows = await tx.select().from(products).where(inArray(products.id, productIds as never))
    const prowMap = new Map(prowRows.map(p => [String(p.id), p]))
    const stockMap = await stocksFor(tx, productIds)
    const promoMap = await activePromosFor(tx, productIds)
    for (const item of items) {
      const p = prowMap.get(item.product_id)
      if (!p) throw new OrderError('PRODUCT_NOT_FOUND', `Produk ${item.product_id} tidak ditemukan.`)
      if (p.status !== 'ACTIVE') throw new OrderError('PRODUCT_INACTIVE', `${p.name} tidak aktif.`)
      const stock = stockMap.get(item.product_id) ?? 0
      if (stock < item.quantity) throw new OrderError('INSUFFICIENT_STOCK', `Stok ${p.name} hanya tersisa ${stock}.`, { product_id: String(p.id), available: stock })

      const promo = promoMap.get(item.product_id) ?? null
      const discountPct = promo ? num(promo.discountPercentage) : 0
      const q = quoteLine(num(p.price), discountPct, item.quantity)
      if (promo) {
        snapshot[String(p.id)] = {
          promotion_id: String(promo.id), discount_percentage: discountPct,
          price_before: q.unit_price, discount_per_unit: q.discount_per_unit
        }
      }
      const exp = expectedByProduct.get(item.product_id)?.shift()
      // PERBAIKAN price lock: bandingkan komposisi harga, bukan hanya total.
      // Dua promo berbeda bisa menghasilkan line_total identik (mis. basis 100
      // qty 2 diskon 10% = 180 vs basis 90 qty 2 tanpa diskon = 180), sehingga
      // pelanggan sempat menyetujui harga/unit yang berbeda tanpa ketahuan.
      const unchanged = !!exp
        && exp.quantity === item.quantity
        && Math.abs(exp.line_total - q.line_total) <= 0.001
        && Math.abs(Number(exp.unit_price ?? 0) - q.unit_price) <= 0.001
        && Math.abs(Number(exp.discount_per_unit ?? 0) - q.discount_per_unit) <= 0.001
      if (input.expected && !unchanged) {
        throw new OrderError(
          'PRICE_CHANGED',
          `Harga/promo ${p.name} berubah sejak ringkasan dibuat (Rp${exp?.line_total ?? '-'} -> Rp${q.line_total}). Ulangi pesanan untuk harga terbaru.`,
          { product_id: String(p.id), expected_line_total: exp?.line_total ?? null, current_line_total: q.line_total }
        )
      }
      total += q.line_total
      // price_at_order = harga efektif per unit (net) -> qty x price_at_order == line_total.
      await tx.insert(orderItems).values({
        orderId: order.id, productId: p.id, quantity: item.quantity,
        priceAtOrder: String(q.unit_effective) as never, lineTotal: String(q.line_total) as never
      })
      await tx.insert(inventoryTransactions).values({
        productId: p.id, type: 'OUT', movement: 'OUT', referenceType: 'ORDER',
        quantity: item.quantity, referenceId: order.id
      })
    }
    if (input.expected && [...expectedByProduct.values()].some(arr => arr.length)) {
      throw new OrderError('PRICE_CHANGED', 'Isi ringkasan pesanan berubah. Ulangi pesanan untuk harga terbaru.')
    }
    const rounded = round2(total)
    if (input.payment?.method === 'QRIS' && rounded !== input.expectedTotal) {
      throw new OrderError('PRICE_CHANGED', 'Total pesanan berubah dari jumlah QRIS yang dibayar. Hubungi toko sebelum mengirim ulang bukti.', { expected_total: input.expectedTotal, current_total: rounded })
    }
    if (input.paymentProof) {
      await tx.insert(orderPaymentProofs).values({ orderId: order.id, mime: input.paymentProof.mime, size: input.paymentProof.data.length, data: input.paymentProof.data })
    }
    await tx.update(orders).set({ totalAmount: String(rounded) as never, promotionSnapshot: (Object.keys(snapshot).length ? snapshot : null) as never }).where(eq(orders.id, order.id))
    if (input.idempotencyKey) {
      await tx.update(idempotencyKeys).set({ orderId: order.id }).where(eq(idempotencyKeys.key, input.idempotencyKey))
    }
    await logAudit(tx, 'ORDER_CREATED', 'CUSTOMER', {
      detail: { order_id: String(order.id), customer_id: customerId, channel: input.channel, total: rounded }
    })
    const final = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1)
    return { order: { ...final[0], totalAmount: String(rounded) }, replayed: false }
  })
}

// ---------- Order lifecycle (payment state machine, migrasi 0004) ----------

/** Batch projection: full buyer/delivery state without ever selecting proof bytes. */
export async function ordersOut(db: DbLike, rows: Array<typeof orders.$inferSelect>) {
  if (!rows.length) return []
  const ids = rows.map(order => order.id)
  const items = await db.select({ item: orderItems, name: products.name }).from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId)).where(inArray(orderItems.orderId, ids))
  const buyers = await db.select().from(customers).where(inArray(customers.id, [...new Set(rows.map(order => order.customerId))]))
  const proofs = await db.select({ orderId: orderPaymentProofs.orderId, mime: orderPaymentProofs.mime, size: orderPaymentProofs.size, submittedAt: orderPaymentProofs.submittedAt })
    .from(orderPaymentProofs).where(inArray(orderPaymentProofs.orderId, ids))
  const buyerById = new Map(buyers.map(buyer => [buyer.id, buyer]))
  const proofByOrder = new Map(proofs.map(proof => [proof.orderId, proof]))
  const itemsByOrder = new Map<string, Array<(typeof items)[number]>>()
  for (const item of items) {
    const group = itemsByOrder.get(item.item.orderId) ?? []
    group.push(item)
    itemsByOrder.set(item.item.orderId, group)
  }
  return rows.map(o => {
    const buyer = buyerById.get(o.customerId)
    const proof = proofByOrder.get(o.id)
    const fulfillment = o.fulfillment as Record<string, unknown> | null
    return {
      id: String(o.id), customer_id: String(o.customerId), status: o.status,
      buyer: { name: o.buyerName ?? buyer?.name ?? 'Tamu', contact: o.buyerName !== null ? o.buyerContact : buyer?.contact ?? null, phone: o.buyerPhone ?? (typeof fulfillment?.phone === 'string' ? fulfillment.phone : null) },
      payment_status: o.paymentStatus, payment_method: o.paymentMethod,
      payment_review: o.paymentReview, payment_review_note: o.paymentReviewNote,
      payment_proof: proof ? { mime: proof.mime, size: proof.size, submitted_at: proof.submittedAt.toISOString() } : null,
      delivery_status: o.deliveryStatus,
      shipped_at: o.shippedAt?.toISOString() ?? null, delivered_at: o.deliveredAt?.toISOString() ?? null,
      paid_at: o.paidAt?.toISOString() ?? null, expires_at: o.expiresAt?.toISOString() ?? null,
      conversation_id: o.conversationId ? String(o.conversationId) : null,
      channel_origin: o.channelOrigin, total_amount: num(o.totalAmount),
      promotion_snapshot: o.promotionSnapshot || null, fulfillment: o.fulfillment || null,
      created_at: o.createdAt.toISOString(), completed_at: o.completedAt?.toISOString() ?? null, cancelled_at: o.cancelledAt?.toISOString() ?? null,
      items: (itemsByOrder.get(o.id) ?? []).map(({ item: i, name }) => ({ id: String(i.id), product_id: String(i.productId), name, quantity: i.quantity, price_at_order: num(i.priceAtOrder), line_total: num(i.lineTotal) }))
    }
  })
}

export async function orderOut(db: DbLike, id: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return (await ordersOut(db, rows))[0] ?? null
}

/**
 * Batalkan order + kembalikan stok. Dipakai oleh tiga jalur:
 *   (1) POST /orders/:id/cancel  — kasir membatalkan manual
 *   (2) expireStaleOrders()      — order UNPAID lewat TTL (abandoned)
 *   (3)ai-actions approve/reject (via endpoint cancel bila relevan)
 *
 * WAJIB dipanggil DI DALAM db.transaction dengan baris order sudah dikunci
 * FOR UPDATE supaya cancel & complete/expire paralel saling eksklusif.
 * Idempoten: order yang bukan CONFIRMED diloloskan tanpa aksi.
 */
export async function cancelOrderTx(
  tx: DbLike,
  orderId: string,
  opts: { actorId?: string | null, actorType?: string, reason?: string } = {}
) {
  const rows = await tx.select().from(orders).where(eq(orders.id, orderId as never)).limit(1)
  const o = rows[0]
  if (!o) throw new OrderError('ORDER_NOT_FOUND', 'Order tidak ditemukan.')
  if (o.status !== 'CONFIRMED') return { cancelled: false, order: o, restocked: 0 }
  if (o.deliveryStatus === 'SHIPPING' || o.deliveryStatus === 'DELIVERED') throw new OrderError('SHIPMENT_STARTED', 'Pesanan sudah dikirim; pembatalan dan pengembalian stok tidak diizinkan.')
  if (opts.reason === 'expired_unpaid' && (o.paymentStatus !== 'UNPAID' || !o.expiresAt || o.expiresAt > new Date() || (o.paymentMethod === 'QRIS' && o.paymentReview === 'PENDING'))) return { cancelled: false, order: o, restocked: 0 }

  if (o.paymentMethod === 'QRIS' && o.paymentReview === 'PENDING' && (!opts.reason?.trim() || opts.reason === 'manual')) throw new OrderError('VALIDATION', 'Alasan penolakan bukti QRIS wajib diisi.')
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id))
  for (const it of items) {
    await tx.insert(inventoryTransactions).values({
      productId: it.productId, type: 'ADJUSTMENT', movement: 'IN',
      referenceType: 'CANCELLATION', quantity: it.quantity, referenceId: o.id,
      actorId: (opts.actorId || null) as never
    })
  }
  const rejected = o.paymentMethod === 'QRIS' && o.paymentReview === 'PENDING'
  const reason = opts.reason?.trim() || 'manual'
  await tx.update(orders).set({ status: 'CANCELLED', cancelledAt: new Date(), ...(rejected ? { paymentReview: 'REJECTED', paymentReviewNote: reason } : {}) }).where(eq(orders.id, o.id))
  if (rejected) await logAudit(tx, 'REVIEW_REJECTED', opts.actorType || 'USER', { actorId: opts.actorId || null, detail: { order_id: orderId, reason, payment_review: 'REJECTED' } })
  await logAudit(tx, 'ORDER_CANCELLED', opts.actorType || 'USER', {
    actorId: opts.actorId || null,
    detail: { order_id: orderId, restocked_lines: items.length, reason: opts.reason || 'manual' }
  })
  return { cancelled: true, order: o, restocked: items.length }
}

// Key chat legacy mempunyai TTL dan dibersihkan setelah 24 jam (throttle/indeks).
// Key checkout request_hash dipertahankan: retry bukti pembayaran berhari-hari
// kemudian tetap mengembalikan order awal, bukan reservasi stok/pembayaran baru.
let _lastIdemCleanup = 0
export async function cleanupIdempotencyKeys(db: DbLike) {
  const now = Date.now()
  if (now - _lastIdemCleanup < 60_000) return
  _lastIdemCleanup = now
  try {
    await db.execute(sql`DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours' AND request_hash IS NULL`)
  }
  catch {
    // Tabel/index belum siap -> coba lagi di siklus berikutnya.
  }
}

/**
 * Lazy expiry: batalkan order UNPAID yang lewat deadline dan kembalikan stok.
 *
 * Dipanggil di awal endpoint baca (GET /orders, GET /inventory/summary, katalog)
 * alih-alih cron — aman di serverless tanpa Vercel Cron, dan idempoten.
 * Order yang sudah dibayar (PAID) tidak pernah disentuh.
 */
export async function expireStaleOrders(db: DbLike): Promise<number> {
  // Sekalian housekeeping idempotency_keys (throttled 1x/menit, lihat di atas) —
  // dulu jalan per-pesan-webhook dengan full scan.
  await cleanupIdempotencyKeys(db)
  const now = new Date()
  const stale = await db.select({ id: orders.id }).from(orders).where(
    and(eq(orders.paymentStatus, 'UNPAID'), eq(orders.status, 'CONFIRMED'), lt(orders.expiresAt, now))
  )
  let n = 0
  for (const s of stale) {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM orders WHERE id = ${s.id}::uuid FOR UPDATE`)
        const r = await cancelOrderTx(tx as never, s.id, { actorType: 'SYSTEM', reason: 'expired_unpaid' })
        if (r.cancelled) n++
      })
    }
    catch {
      // Order sudah dibatal/dibayar racing -> abaikan, coba lagi di request berikutnya.
    }
  }
  return n
}

// ---------- Conversations ----------
export async function ensureCustomer(db: DbLike, channel: string, identifier: string, name?: string | null, contact?: string | null) {
  const found = await db.select().from(customers).where(and(eq(customers.channel, channel), eq(customers.identifier, identifier))).limit(1)
  const existing = found[0]
  if (existing) return existing
  const ins = await db.insert(customers).values({ channel, identifier, name: name || null, contact: contact || null }).returning()
  return firstRow(ins, `insert customer ${channel}:${identifier}`)
}

export async function logAudit(db: DbLike, event: string, actorType: string, opts: { actorId?: string | null, aiActionId?: string | null, detail?: Record<string, unknown> } = {}) {
  await db.insert(auditLogs).values({
    event, actorType,
    actorId: (opts.actorId || null) as never,
    aiActionId: (opts.aiActionId || null) as never,
    detail: (opts.detail || {}) as never
  })
}

// ---------- Seed ----------
let _seeded = false
export async function ensureSeeded(db: DbLike) {
  if (_seeded) return
  const cfg = useRuntimeConfig()
  const seedOn = String(cfg.seedOnStartup ?? process.env.SEED_ON_STARTUP ?? 'true') === 'true'
  if (!seedOn) {
    _seeded = true
    return
  }
  const existing = await db.select({ id: products.id }).from(products).limit(1)
  if (existing.length) {
    _seeded = true
    return
  }
  // Satu transaksi dan lock lintas instance mencegah katalog ganda/seed parsial.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72701)`)
    const still = await tx.select({ id: products.id }).from(products).limit(1)
    if (still.length) return
  // Katalog demo 12 SKU — hanya Apple (tanpa MacBook) & Samsung Galaxy flagship.
  const demo: Array<{ name: string, category: string, price: number, spec: Record<string, unknown>, stock: number }> = [
    { name: 'iPhone 15 Pro 128GB', category: 'Smartphone', price: 18999000, spec: { brand: 'Apple', ram_gb: 8, storage_gb: 128 }, stock: 12 },
    { name: 'iPhone 15 128GB', category: 'Smartphone', price: 12999000, spec: { brand: 'Apple', ram_gb: 6, storage_gb: 128 }, stock: 15 },
    { name: 'Samsung Galaxy S24 Ultra 256GB', category: 'Smartphone', price: 21999000, spec: { brand: 'Samsung', ram_gb: 12, storage_gb: 256 }, stock: 8 },
    { name: 'Samsung Galaxy S24 256GB', category: 'Smartphone', price: 13999000, spec: { brand: 'Samsung', ram_gb: 8, storage_gb: 256 }, stock: 15 },
    { name: 'Samsung Galaxy Z Flip 5 256GB', category: 'Smartphone', price: 15999000, spec: { brand: 'Samsung', ram_gb: 8, storage_gb: 256 }, stock: 6 },
    { name: 'AirPods Pro 2 USB-C', category: 'Audio', price: 3499000, spec: { brand: 'Apple' }, stock: 25 },
    { name: 'AirPods 3 Lightning', category: 'Audio', price: 2199000, spec: { brand: 'Apple' }, stock: 20 },
    { name: 'iPad Air M2 128GB', category: 'Tablet', price: 10999000, spec: { brand: 'Apple', ram_gb: 8, storage_gb: 128 }, stock: 9 },
    { name: 'Samsung Galaxy Tab S9 128GB', category: 'Tablet', price: 11499000, spec: { brand: 'Samsung', ram_gb: 8, storage_gb: 128 }, stock: 7 },
    { name: 'Apple Watch SE 2 44mm', category: 'Wearable', price: 3999000, spec: { brand: 'Apple' }, stock: 10 },
    { name: 'Samsung Galaxy Watch 6 44mm', category: 'Wearable', price: 4299000, spec: { brand: 'Samsung' }, stock: 8 },
    { name: 'Casing Spigen iPhone 15 Pro', category: 'Aksesori', price: 249000, spec: { brand: 'Spigen' }, stock: 40 }
  ]
    for (const d of demo) {
      const pins = await tx.insert(products).values({
        name: d.name, category: d.category, specification: d.spec as never, price: String(d.price) as never, status: 'ACTIVE'
      }).returning({ id: products.id })
      await tx.insert(inventoryTransactions).values({
        productId: firstRow(pins, `insert seed produk "${d.name}"`).id, type: 'IN', movement: 'IN', referenceType: 'MANUAL', quantity: d.stock
      })
    }
  })
  _seeded = true
}
