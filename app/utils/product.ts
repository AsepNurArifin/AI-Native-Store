import type { ProductOut } from './api-types'
import { discountedPrice } from '#shared/utils/pricing'

/** Harga efektif: promo dulu, harga normal bila tidak ada diskon. */
export function effectivePrice(p: Pick<ProductOut, 'price' | 'discounted_price' | 'discount_percentage'>): number {
  if (typeof p.discounted_price === 'number' && p.discounted_price !== null) return p.discounted_price
  if (p.discount_percentage && p.discount_percentage > 0) {
    // Rumus kanonik shared/utils/pricing (sama dengan yang ditagih server).
    return discountedPrice(p.price, p.discount_percentage)
  }
  return p.price
}

export function hasPromo(p: Pick<ProductOut, 'discount_percentage'>): boolean {
  return !!p.discount_percentage && p.discount_percentage > 0
}

/** Fallback visual per kategori bila image_url kosong (tanpa file eksternal). */
export function categoryAccent(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('hp') || c.includes('smartphone')) return 'bg-brand-100 text-brand-700'
  if (c.includes('tablet') || c.includes('wearable')) return 'bg-emerald-100 text-emerald-700'
  if (c.includes('audio')) return 'bg-stone-200 text-stone-700'
  return 'bg-stone-100 text-stone-600'
}

/** Label inisial 1-2 huruf untuk tile fallback (mis. "iP" untuk iPhone). */
export function productInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const [first, second] = words
  if (!first) return 'PR'
  if (!second) return first.slice(0, 2).toUpperCase()
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
}

/* ---- Spesifikasi produk: label, satuan, format nilai (dipakai tabel & chip spek) ---- */

export const specLabels: Record<string, string> = {
  brand: 'Merek', chipset: 'Chipset', prosesor: 'Prosesor', ram_gb: 'RAM',
  storage_gb: 'Penyimpanan', storage: 'Media penyimpanan', gpu: 'GPU',
  layar: 'Layar', kamera: 'Kamera', baterai_mah: 'Kapasitas baterai',
  baterai: 'Baterai', os: 'Sistem operasi', berat_kg: 'Berat', ecg: 'ECG',
  koneksi: 'Koneksi', fitur: 'Fitur', tipe: 'Tipe', kompatibel: 'Kompatibilitas',
  form_factor: 'Bentuk', interface: 'Antarmuka', model: 'Model',
}

const specUnits: Record<string, string> = { ram_gb: 'GB', storage_gb: 'GB', baterai_mah: 'mAh', berat_kg: 'kg' }

export function specValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Belum tersedia'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (Array.isArray(value)) return value.map(v => specValue('', v)).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${specValue('', v)}`).join('; ')
  return `${value}${typeof value === 'number' && specUnits[key] ? ` ${specUnits[key]}` : ''}`
}

export interface SpecEntry { key: string, label: string, value: string }

export function specEntries(spec: Record<string, unknown> | null | undefined): SpecEntry[] {
  return Object.entries(spec || {}).map(([key, value]) => ({
    key, label: specLabels[key] || key.replaceAll('_', ' '), value: specValue(key, value),
  }))
}

/** Grup kandidat spek unggulan (chip): kunci pertama yang ada di data menang per grup. */
const keySpecGroups = [
  ['ram_gb'], ['storage_gb', 'storage'], ['chipset', 'prosesor'], ['gpu'],
  ['layar'], ['kamera'], ['baterai_mah', 'baterai'], ['os'],
]

/** Spek unggulan untuk chip ala marketplace: urutan prioritas, maksimal `limit`. */
export function keySpecs(spec: Record<string, unknown> | null | undefined, limit = 4): SpecEntry[] {
  const data = spec || {}
  const out: SpecEntry[] = []
  for (const group of keySpecGroups) {
    if (out.length >= limit) break
    const key = group.find(k => k in data && data[k] !== null && data[k] !== undefined && data[k] !== '')
    if (!key) continue
    const entry = { key, label: specLabels[key] || key.replaceAll('_', ' '), value: specValue(key, data[key]) }
    if (entry.value !== 'Belum tersedia') out.push(entry)
  }
  return out
}

/**
 * Ada data spek apa pun (tidak terbatas grup unggulan) → tombol "Lihat spesifikasi"
 * tetap tampil. Tanpa ini produk yang hanya punya mis. `fitur` jadi tampak seperti
 * fitur lihat-spesifikasinya hilang padahal datanya ada.
 */
export function hasSpecData(spec: Record<string, unknown> | null | undefined): boolean {
  return Object.values(spec || {}).some(v => v !== null && v !== undefined && v !== '')
}
