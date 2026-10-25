import { formatIDR } from '~/utils/format'
import type { AuditLogOut, AuditNames } from '~/utils/api-types'
import type { BadgeVariant } from '~/utils/format'

/**
 * Kamus "bahasa toko" untuk halaman Riwayat (audit).
 *
 * Database menyimpan fakta mentah (kode event, UUID, angka) supaya jejak tetap
 * append-only dan tidak bisa diedit. Lapisan INI yang mengubah fakta menjadi
 * bahasa pemilik toko: kode -> kalimat, UUID -> nama, angka dampak -> badge.
 * Kunci detail yang tidak dikenal pun dihumanisasi (garis bawah -> spasi),
 * jadi tidak ada JSON/camelCase yang lolos ke tampilan.
 */

export type AuditCat = 'order' | 'stock' | 'product' | 'promo' | 'ai' | 'system'

export interface AuditChip {
  text: string
  /** Class tailwind chip (bg/text) — default netral. */
  cls?: string
  /** Tautan admin bila chip sifatnya navigasi (mis. buka order). */
  href?: string
}

export interface AuditRow {
  cat: AuditCat
  icon: 'order' | 'stock-in' | 'stock-out' | 'product-add' | 'product-edit' | 'product-dump' | 'promo' | 'ai' | 'ok' | 'bug'
  tone: BadgeVariant
  /** Kalimat utama kejadian (sudah bahasa toko). */
  title: string
  chips: AuditChip[]
  /** Belang yang wajib tertangkap sekali lirik (angka dampak, peringatan). */
  badges: Array<{ text: string, variant: BadgeVariant }>
  /** Detail masih banyak (mis. 63 produk) → toggle "Lihat semua". */
  expandable?: { summary: string, chips: AuditChip[] }
  internal: boolean
}

/* ---------- Label backdrop ---------- */

/** Label field yang diubah (PRODUCT_UPDATED / PROMO_UPDATED `changed`). */
const fieldLabels: Record<string, string> = {
  name: 'Nama', category: 'Kategori', specification: 'Spesifikasi', imageUrl: 'Foto produk',
  price: 'Harga', status: 'Status', lowStockThreshold: 'Ambang stok kritis',
  start_date: 'Tanggal mulai', end_date: 'Tanggal selesai', discount_percentage: 'Diskon',
  product_id: 'Produk', updatedAt: 'Waktu perubahan',
}

export function humanizeField(key: string): string {
  if (fieldLabels[key]) return fieldLabels[key]
  return key
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, c => c.toUpperCase())
}

/* ---------- Substansi nilai ---------- */

const isUuidish = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{32,64}$/i.test(v)

/** Nama produk dari peta nama; bila tidak ketemu berarti produk lama yang sudah dihapus. */
function productName(id: unknown, names?: AuditNames): string {
  if (typeof id === 'string' && names?.products?.[id]) return names.products[id] ?? ''
  return 'Produk lama (sudah tidak ada)'
}

/** Nama pelanggan; fallback tanpa membocorkan kode mentah. */
function customerName(id: unknown, names?: AuditNames): string {
  const c = typeof id === 'string' ? names?.customers?.[id] : undefined
  if (!c) return 'belum terdaftar nama'
  return c.name || c.identifier
}

const channelLabel: Record<string, string> = { WEB: 'etalase web', CHAT: 'chat toko' }

const aiActionLabels: Record<string, string> = {
  CREATE_PROMOTION: 'rencana promo otomatis',
  ADJUST_STOCK: 'rencana penyesuaian stok',
}

/** Chip identitas order — kode pendek (bukan UUID penuh) yang tetap referensibel. */
function orderChip(id: unknown): AuditChip {
  const short = typeof id === 'string' ? id.slice(0, 8) : ''
  return {
    text: `Order #${short}`,
    href: typeof id === 'string' ? `/admin/orders/${id}` : undefined,
  }
}

/** Satu nilai detail diubah jadi chip/bagian kalimat. */
function valueToChip(key: string, v: unknown, names?: AuditNames): AuditChip {
  const k = String(key)
  switch (k) {
    case 'order_id':
      return orderChip(v)
    case 'total':
    case 'amount':
    case 'price':
      return { text: formatIDR(Number(v) || 0) }
    case 'quantity':
      return { text: `${Math.trunc(Number(v) || 0)} unit` }
    case 'initial_stock':
      return { text: `stok awal ${Math.trunc(Number(v) || 0)} unit` }
    case 'movement':
      return { text: v === 'IN' ? 'stok ditambah' : 'stok dikurangi', cls: v === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'discount_percentage':
      return { text: `Diskon ${Number(v)}%`, cls: 'bg-promo-50 text-promo-700 border-promo-200' }
    case 'status':
      return { text: String(v), cls: String(v) === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-600 border-stone-200' }
    case 'reason': {
      if (v === 'expired_unpaid') return { text: 'melewati batas waktu pembayaran', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
      if (v === 'manual') return { text: 'dibatalkan manual oleh toko' }
      return { text: humanizeField(String(v)) }
    }
    case 'note':
      return { text: `catatan: "${String(v).slice(0, 120)}"` }
    case 'action_type':
      return { text: aiActionLabels[String(v)] ?? humanizeField(String(v)), cls: 'bg-brand-50 text-brand-700 border-brand-200' }
    case 'forced':
      return v
        ? { text: 'Hapus paksa — permanen', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
        : { text: 'hapus biasa (riwayat produk lama tetap aman)' }
    case 'product_id':
      return { text: productName(v, names) }
    case 'orders_touched':
      return { text: `${Math.trunc(Number(v) || 0)} order turut diperhitungkan ulang` }
    case 'channel':
      return { text: `lewat ${channelLabel[String(v)] ?? String(v)}` }
    default:
      // Fallback: angka & teks apa pun tetap manusiawi, tanpa camelCase mentah.
      if (isUuidish(v)) return { text: humanizeField(k) }
      return { text: `${humanizeField(k)}: ${typeof v === 'object' && v !== null ? 'rincian tersimpan' : String(v)}` }
  }
}

/* ---------- Deteksi aktivitas internal (uji sistem) → disembunyikan default ---------- */

export function isInternalAudit(log: AuditLogOut): boolean {
  const d = log.detail || {}
  const name = typeof d.name === 'string' ? d.name : ''
  return name.startsWith('__') || name.includes('smoke_test') || name.includes('uji_sehat')
}

/* ---------- Baris utama per jenis kejadian ---------- */

const CAT_BY_EVENT: Record<string, AuditCat> = {
  ORDER_CREATED: 'order', ORDER_PAID: 'order', ORDER_COMPLETED: 'order', ORDER_CANCELLED: 'order',
  STOCK_ADJUSTED: 'stock',
  PRODUCT_CREATED: 'product', PRODUCT_UPDATED: 'product', PRODUCT_DELETED: 'product',
  PROMO_CREATED: 'promo', PROMO_UPDATED: 'promo',
  CREATED: 'ai', APPROVED: 'ai', REJECTED: 'ai', VALIDATION_FAILED: 'ai', EXECUTED: 'ai',
}

export function auditCategory(event: string): AuditCat {
  return CAT_BY_EVENT[event] ?? 'system'
}

/** Label kejadian satu frasa (untuk chip filter & baris). */
const eventTitles: Record<string, string> = {
  ORDER_CREATED: 'Order baru masuk',
  ORDER_PAID: 'Order dibayar',
  ORDER_COMPLETED: 'Order dituntaskan (selesai)',
  ORDER_CANCELLED: 'Order dibatalkan',
  STOCK_ADJUSTED: 'Penyesuaian stok',
  PRODUCT_CREATED: 'Produk baru ditambahkan',
  PRODUCT_UPDATED: 'Data produk diubah',
  PRODUCT_DELETED: 'Produk dihapus',
  PROMO_CREATED: 'Promo baru dibuat',
  PROMO_UPDATED: 'Promo diperbarui',
  CREATED: 'Asisten AI mengajukan usulan',
  APPROVED: 'Owner menyetujui usulan AI',
  REJECTED: 'Owner menolak usulan AI',
  VALIDATION_FAILED: 'Usulan AI digugurkan — datanya tidak konsisten',
  EXECUTED: 'Usulan AI dijalankan',
}

export function auditEventTitle(event: string): string {
  return eventTitles[event] ?? humanizeField(event)
}

/** Kelompok filter "Jenis kejadian" (bahasa toko, bukan kode). */
export const auditCategoryOptions: Array<{ value: '' | AuditCat, label: string }> = [
  { value: '', label: 'Semua kejadian' },
  { value: 'order', label: 'Order & pembayaran' },
  { value: 'stock', label: 'Stok' },
  { value: 'product', label: 'Katalog produk' },
  { value: 'promo', label: 'Promosi' },
  { value: 'ai', label: 'Rencana AI (pemeriksaan)' },
]

/** Pelaku → label manusia + nama dari peta. */
export function auditActorLabel(actorType: string, actorId: string | null, detail: Record<string, unknown>, names?: AuditNames): string {
  if (actorType === 'CUSTOMER') {
    const c = customerName(detail.customer_id, names)
    return c === 'belum terdaftar nama' ? 'Pelanggan' : `Pelanggan — ${c}`
  }
  if (actorType === 'AI_SYSTEM') return 'Asisten AI'
  if (actorType === 'SYSTEM') return 'Sistem (otomatis)'
  // USER — tampilkan nama & peran dari peta (fallback: "Toko").
  const u = actorId ? names?.users?.[actorId] : undefined
  const role = u?.role === 'STAF' ? 'Staf toko' : 'Owner'
  return u?.name ? `${role} — ${u.name}` : role
}

/**
 * Susun baris "Riwayat Toko" dari satu log mentah.
 *
 * Semua bahasa/keputusan tampil ditentukan DI SINI — halaman hanya merender.
 */
export function buildAuditRow(log: AuditLogOut, names?: AuditNames): AuditRow {
  const d = (log.detail || {}) as Record<string, unknown>
  const cat = auditCategory(log.event)
  const title = auditEventTitle(log.event)
  const chips: AuditChip[] = []
  const badges: AuditRow['badges'] = []

  switch (log.event) {
    case 'ORDER_CREATED': {
      chips.push(valueToChip('channel', d.channel ?? 'WEB'))
      if (d.order_id) chips.push(orderChip(d.order_id))
      return { cat, icon: 'order', tone: 'success', title: `${title} — ${formatIDR(Number(d.total) || 0)}`, chips, badges, internal: false }
    }
    case 'ORDER_PAID':
      chips.push(orderChip(d.order_id))
      if (d.amount != null) chips.push({ text: `diterima ${formatIDR(Number(d.amount) || 0)}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' })
      badges.push({ text: 'dana masuk', variant: 'success' })
      return { cat, icon: 'ok', tone: 'success', title, chips, badges, internal: false }
    case 'ORDER_COMPLETED':
      chips.push(orderChip(d.order_id))
      badges.push({ text: 'transaksi selesai', variant: 'success' })
      return { cat, icon: 'ok', tone: 'success', title, chips, badges, internal: false }
    case 'ORDER_CANCELLED': {
      chips.push(orderChip(d.order_id))
      chips.push(valueToChip('reason', d.reason ?? 'manual'))
      if ((Number(d.restocked_lines) || 0) > 0) chips.push({ text: `${Math.trunc(Number(d.restocked_lines))} baris barang kembali ke stok` })
      if (d.reason === 'expired_unpaid') badges.push({ text: 'otomatis oleh sistem', variant: 'warning' })
      else badges.push({ text: 'dibatalkan', variant: 'neutral' })
      return { cat, icon: 'stock-out', tone: 'warning', title, chips, badges, internal: false }
    }
    case 'PRODUCT_CREATED':
      chips.push({ text: String(d.name ?? 'produk baru'), cls: 'font-medium' })
      if (d.price != null) chips.push({ text: formatIDR(Number(d.price) || 0) })
      chips.push(valueToChip('status', d.status ?? 'ACTIVE'))
      if (d.initial_stock != null) chips.push(valueToChip('initial_stock', d.initial_stock))
      return { cat, icon: 'product-add', tone: 'success', title: `Produk baru: "${d.name ?? 'productId'}"`, chips, badges, internal: isInternalAudit(log) }
    case 'PRODUCT_UPDATED': {
      const changed = Array.isArray(d.changed) ? d.changed.map(x => humanizeField(String(x))) : []
      chips.push({ text: productName(d.product_id, names), cls: 'font-medium' })
      if (changed.length) chips.push({ text: `mengubah: ${changed.join(', ')}` })
      return { cat, icon: 'product-edit', tone: 'info', title, chips, badges, internal: false }
    }
    case 'PRODUCT_DELETED': {
      const ids = Array.isArray(d.product_ids) ? (d.product_ids as unknown[]) : []
      const forced = d.forced === true
      const touched = Math.trunc(Number(d.orders_touched) || 0)
      const cancelled = Math.trunc(Number(d.orders_cancelled) || 0)
      badges.push({ text: 'hapus permanen', variant: 'destructive' })
      if (touched) badges.push({ text: `${touched} order dipengaruhi`, variant: 'warning' })
      if (cancelled) badges.push({ text: `${cancelled} order ikut batal`, variant: 'destructive' })
      if (ids.length) {
        // Pratinjau nama; bila semuanya identik (mis. produk lama yang datanya
        // sudah tidak ada), cukup satu chip ringkasan — bukan 20 chip kembar.
        const labels = ids.slice(0, 8).map(id => productName(id, names))
        const unique = [...new Set(labels)]
        const allIdentical = unique.length === 1
        const chips: AuditChip[] = allIdentical
          ? [{ text: `${ids.length} produk: ${unique[0]}`, cls: 'font-medium' }]
          : labels.map(text => ({ text }))
        if (!allIdentical && ids.length > labels.length) chips.push({ text: `+${ids.length - labels.length} produk lain` })
        return {
          cat, icon: 'product-dump', tone: 'destructive',
          title: `${ids.length} produk dihapus${forced ? ' paksa (permanen)' : ''}`,
          chips,
          badges,
          expandable: { summary: `Lihat ${ids.length} produk`, chips: ids.map(id => ({ text: productName(id, names) })) },
          internal: isInternalAudit(log),
        }
      }
      return { cat, icon: 'product-dump', tone: 'destructive', title, chips: [], badges, internal: false }
    }
    case 'STOCK_ADJUSTED': {
      const qty = Math.trunc(Number(d.quantity) || 0)
      const isIn = d.movement === 'IN'
      chips.push({ text: `${qty} unit ${isIn ? 'masuk' : 'keluar'}`, cls: isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200' })
      chips.push({ text: productName(d.product_id, names), cls: 'font-medium' })
      return { cat, icon: isIn ? 'stock-in' : 'stock-out', tone: isIn ? 'success' : 'warning', title: isIn ? `Barang masuk: ${qty} unit` : `Barang keluar: ${qty} unit`, chips, badges, internal: false }
    }
    case 'PROMO_CREATED':
    case 'PROMO_UPDATED': {
      const promoRow = typeof d.promotion_id === 'string' ? names?.promotions?.[d.promotion_id] : undefined
      const prodLabel = promoRow?.product_name ?? (typeof d.product_id === 'string' ? productName(d.product_id, names) : '')
      if (d.discount_percentage != null) chips.push(valueToChip('discount_percentage', d.discount_percentage))
      if (prodLabel) chips.push({ text: prodLabel, cls: 'font-medium' })
      if (d.status) chips.push(valueToChip('status', d.status))
      const changed = Array.isArray(d.changed) ? d.changed.map(x => humanizeField(String(x))) : []
      if (changed.length) chips.push({ text: `mengubah: ${changed.join(', ')}` })
      return { cat, icon: 'promo', tone: 'info', title, chips, badges, internal: false }
    }
    case 'CREATED':
      chips.push(valueToChip('action_type', d.action_type ?? 'rencana'))
      badges.push({ text: 'menunggu keputusan owner', variant: 'warning' })
      return { cat, icon: 'ai', tone: 'warning', title, chips, badges, internal: false }
    case 'APPROVED':
      if (log.ai_action_id && names?.ai_actions?.[log.ai_action_id]) chips.push(valueToChip('action_type', names.ai_actions[log.ai_action_id]!.action_type))
      badges.push({ text: 'keputusan manusia', variant: 'success' })
      return { cat, icon: 'ok', tone: 'success', title: 'Owner menyetujui usulan AI', chips, badges, internal: false }
    case 'REJECTED':
      if (log.ai_action_id && names?.ai_actions?.[log.ai_action_id]) chips.push(valueToChip('action_type', names.ai_actions[log.ai_action_id]!.action_type))
      if (d.note) chips.push(valueToChip('note', d.note))
      badges.push({ text: 'keputusan manusia', variant: 'neutral' })
      return { cat, icon: 'ai', tone: 'neutral', title: 'Owner menolak usulan AI', chips, badges, internal: false }
    case 'VALIDATION_FAILED': {
      const fails = Array.isArray(d.failures) ? d.failures : (d.failures ? [d.failures] : [])
      chips.push(...fails.map(f => ({ text: typeof f === 'string' ? f : 'rincian validasi tersimpan', cls: 'bg-amber-50 text-amber-700 border-amber-200' })))
      badges.push({ text: 'tidak dijalankan', variant: 'warning' })
      return { cat, icon: 'bug', tone: 'warning', title: 'Usulan AI digugurkan — datanya tidak konsisten', chips, badges, internal: false }
    }
    case 'EXECUTED': {
      if (d.product_id) chips.push({ text: productName(d.product_id, names), cls: 'font-medium' })
      if (d.movement) chips.push(valueToChip('movement', d.movement))
      if (d.quantity != null) chips.push(valueToChip('quantity', d.quantity))
      if (log.ai_action_id && names?.ai_actions?.[log.ai_action_id]) chips.push(valueToChip('action_type', names.ai_actions[log.ai_action_id]!.action_type))
      badges.push({ text: 'tereksekusi setelah disetujui', variant: 'success' })
      return { cat, icon: 'ok', tone: 'success', title: 'Usulan AI dijalankan', chips, badges, internal: false }
    }
    default: {
      for (const [k, v] of Object.entries(d)) chips.push(valueToChip(k, v, names))
      return { cat, icon: 'bug', tone: 'neutral', title, chips, badges, internal: false }
    }
  }
}
