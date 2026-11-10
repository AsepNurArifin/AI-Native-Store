import type { ProductOut } from './api-types'
import { effectivePrice, hasPromo, keySpecs } from './product'
import type { SpecEntry } from './product'
import { formatIDR } from './format'

export function normalizeCategory(name: string): string {
  return name.trim().toLocaleLowerCase('id')
}

export function storefrontCategories(names: string[]): string[] {
  const unique = new Map<string, string>()
  for (const raw of names) {
    const name = raw.trim()
    const key = normalizeCategory(name)
    if (!key) continue
    const previous = unique.get(key)
    if (previous === undefined || name < previous) unique.set(key, name)
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'id'))
}

/** A dated promotion must be active at the owner's reference time. */
export function activeStorefrontPromotion(product: ProductOut, at: number): boolean {
  const promotion = product.promotion
  if (!promotion || !hasPromo({ discount_percentage: promotion.discount_percentage })) return false
  const start = Date.parse(promotion.start_date)
  const end = Date.parse(promotion.end_date)
  return Number.isFinite(start) && Number.isFinite(end) && start <= at && at < end
}

export interface StorefrontProduct {
  id: string
  href: string
  name: string
  image: string | null
  category: string
  price: number
  priceLabel: string
  compareAt: number | null
  discount: number | null
  endDate: string | null
  stock: number
  available: boolean
  inactive: boolean
  specs: SpecEntry[]
}

export interface StorefrontCategory {
  name: string
  href: string
  image: string | null
}

export function productView(product: ProductOut, at: number): StorefrontProduct {
  const active = activeStorefrontPromotion(product, at)
  const percentage = active ? product.promotion!.discount_percentage : 0
  // Ignore stale discounted_price once the promotion has ended. The shared
  // pricing helper remains the source of rounding for an eligible promotion.
  const price = active
    ? effectivePrice({ price: product.price, discount_percentage: percentage })
    : product.price
  const discounted = active && price < product.price
  return {
    id: product.id,
    href: `/produk/${encodeURIComponent(product.id)}`,
    name: product.name,
    image: product.image_url,
    category: product.category,
    price,
    priceLabel: formatIDR(price),
    compareAt: discounted ? product.price : null,
    discount: discounted ? percentage : null,
    endDate: discounted ? product.promotion!.end_date : null,
    stock: product.current_stock,
    available: product.status === 'ACTIVE' && product.current_stock > 0,
    inactive: product.status !== 'ACTIVE',
    specs: keySpecs(product.specification, 2)
  }
}

export function categoryViews(names: string[], products: ProductOut[]): StorefrontCategory[] {
  const representatives = new Map<string, string>()
  const seen = new Set<string>()
  for (const product of products) {
    if (seen.has(product.id)) continue
    seen.add(product.id)
    const image = product.image_url?.trim()
    const category = normalizeCategory(product.category)
    if (image && !representatives.has(category)) representatives.set(category, image)
  }
  return storefrontCategories(names).map(name => ({
    name,
    href: `/rak/${encodeURIComponent(name)}`,
    image: representatives.get(normalizeCategory(name)) ?? null
  }))
}

export function promotionCountdown(endDate: string, now: number): string {
  const seconds = Math.max(0, Math.floor((Date.parse(endDate) - now) / 1000))
  if (!Number.isFinite(seconds)) return ''
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const clock = [hours, minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':')
  return days ? `${days} hari ${clock}` : clock
}
