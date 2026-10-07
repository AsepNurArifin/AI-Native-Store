/**
 * SATU-SATUNYA rumus harga & diskon — dipakai server (katalog, order summary,
 * order) dan app (display). Semua sisi WAJIB lewat sini supaya harga yang
 * tampil == harga yang tertagih (dulu ada 4 rumus berbeda).
 */

export const round2 = (n: number) => Math.round(n * 100) / 100

export interface QuoteLine {
  unit_price: number
  discount_per_unit: number
  unit_effective: number
  quantity: number
  line_total: number
}

/** Quote satu baris item: harga dasar -> diskon/unit -> harga efektif -> total baris. */
export function quoteLine(basePrice: number, discountPct: number, quantity: number): QuoteLine {
  const discountPerUnit = round2(basePrice * discountPct / 100)
  const unitEffective = Math.max(round2(basePrice - discountPerUnit), 0)
  return {
    unit_price: basePrice,
    discount_per_unit: discountPerUnit,
    unit_effective: unitEffective,
    quantity,
    line_total: round2(unitEffective * quantity)
  }
}

/** Harga jual per unit setelah diskon (dipakai katalog & display). */
export function discountedPrice(basePrice: number, discountPct: number): number {
  return quoteLine(basePrice, discountPct, 1).unit_effective
}

/** Total order = jumlah bulat 2dp dari line_total. */
export function quoteTotal(lines: Array<{ line_total: number }>): number {
  return round2(lines.reduce((s, l) => s + l.line_total, 0))
}
