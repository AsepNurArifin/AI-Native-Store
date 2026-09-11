/** Format integer rupiah tanpa desimal, mis. 9500000 -> "Rp9.500.000". */
export function formatIDR(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  if (Number.isNaN(n)) return 'Rp0'
  return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Format ISO UTC ke WIB yang mudah dibaca. */
export function formatWIB(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB'
}

/** Varian badge shadcn untuk status (dipakai `<Badge :variant="statusVariant(...)">`). */
export function statusVariant(status: string | null | undefined): string {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'EXECUTED':
    case 'APPROVED':
    case 'ORDERED':
      return 'success'
    case 'DRAFT':
    case 'OPEN':
      return 'muted'
    case 'INACTIVE':
    case 'EXPIRED':
    case 'ABANDONED':
    case 'NO_MATCH':
      return 'neutral'
    case 'CANCELLED':
    case 'REJECTED':
    case 'APPROVED_VALIDATION_FAILED':
    case 'ERROR':
      return 'danger'
    default:
      return 'muted'
  }
}
