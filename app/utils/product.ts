import type { ProductOut } from './api-types'

/** Harga efektif: promo dulu, harga normal bila tidak ada diskon. */
export function effectivePrice(p: Pick<ProductOut, 'price' | 'discounted_price' | 'discount_percentage'>): number {
  if (typeof p.discounted_price === 'number' && p.discounted_price !== null) return p.discounted_price
  if (p.discount_percentage && p.discount_percentage > 0) {
    return Math.max(Math.round(p.price * (1 - p.discount_percentage / 100)), 0)
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
  if (c.includes('laptop') || c.includes('komputer') || c.includes('gaming')) return 'bg-amber-100 text-amber-800'
  if (c.includes('tablet') || c.includes('wearable')) return 'bg-emerald-100 text-emerald-700'
  if (c.includes('audio')) return 'bg-stone-200 text-stone-700'
  return 'bg-stone-100 text-stone-600'
}

/** Label inisial 1-2 huruf untuk tile fallback (mis. "iP" untuk iPhone). */
export function productInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'PR'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Helper spec parser ala Newegg/BestBuy: ekstrak chip/RAM/Storage/Layar dari nama atau deskripsi. */
export function extractSpecs(p: { name: string; description?: string | null }): string[] {
  const text = `${p.name} ${p.description || ''}`
  const specs: string[] = []

  // Chip / Processor / GPU
  const chipMatch = text.match(/(M[1-4]|Ryzen\s+[3579]|Core\s+i[3579]|RTX\s+\d{4}|Snapdragon\s+\d+|A1[678]\s+Pro|Dimensity\s+\d+)/i)
  if (chipMatch) specs.push(chipMatch[0])

  // RAM
  const ramMatch = text.match(/(\d+\s*GB\s*(?:DDR[45]|RAM)?)/i) // match RAM
  const ramSpecific = text.match(/(\d{1,2}\s*GB)\s+(?:RAM|DDR)/i) || text.match(/(?:RAM|DDR)\s*(\d{1,2}\s*GB)/i)
  if (ramSpecific) specs.push(ramSpecific[1])
  else if (ramMatch && !specs.some(s => s.toLowerCase().includes('gb'))) specs.push(ramMatch[1])

  // Storage
  const storageMatch = text.match(/(\d{3}\s*GB|1\s*TB|2\s*TB)\s*(?:SSD|NVMe|Storage)?/i)
  if (storageMatch && !specs.includes(storageMatch[1])) specs.push(storageMatch[1])

  // Screen
  const screenMatch = text.match(/(\d{1,2}(?:\.\d)?["”']|\d{1,2}(?:\.\d)?\s*inch)/i)
  if (screenMatch) specs.push(screenMatch[1])

  return [...new Set(specs)].slice(0, 3)
}

/** Rating terhitung stabil berdasarkan hash ID produk (4.7 - 5.0) ala Marketplace */
export function productRating(id: string): { score: string; count: number } {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i)
  const abs = Math.abs(hash)
  const score = (4.7 + (abs % 4) * 0.1).toFixed(1)
  const count = 18 + (abs % 85)
  return { score, count }
}
