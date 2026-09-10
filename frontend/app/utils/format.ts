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

/** Warna badge status ala shadcn (kelas Tailwind). */
export function statusClass(status: string | null | undefined): string {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'EXECUTED':
    case 'APPROVED':
    case 'ORDERED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    case 'DRAFT':
    case 'OPEN':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
    case 'INACTIVE':
    case 'EXPIRED':
    case 'ABANDONED':
    case 'NO_MATCH':
      return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100'
    case 'CANCELLED':
    case 'REJECTED':
    case 'APPROVED_VALIDATION_FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default:
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
  }
}
