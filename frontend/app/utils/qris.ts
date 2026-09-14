/**
 * Pembangun payload QRIS (EMV QRCPS Merchant-Presented QR) — SIMULASI DEMO.
 *
 * Struktur TLV EMVCo + CRC16-CCITT sesuai spesifikasi QRIS, tetapi merchant
 * ID bersifat contoh: hasilnya TIDAK dapat dibayar di aplikasi pembayaran
 * sungguhan (label "simulasi" wajib tampil di samping QR).
 */

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`
}

/** CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021) — wajib QRIS tag 63. */
function crc16(payload: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface QrisOptions {
  amount: number
  reference: string
  merchantName?: string
  merchantCity?: string
}

/** Bangun string QRIS dinamis (dengan nominal) untuk satu pesanan. */
export function buildQrisPayload(opts: QrisOptions): string {
  const name = (opts.merchantName ?? 'TOKO BU RATNA').slice(0, 25)
  const city = (opts.merchantCity ?? 'JAKARTA').slice(0, 15)
  const amount = opts.amount.toFixed(2)

  const merchantAccount = tlv('00', 'ID.CO.QRIS.WWW') + tlv('01', 'ID1024387542109') + tlv('02', 'U')
  const additionalData = tlv('05', opts.reference.slice(0, 25))

  const payload
    = tlv('00', '01')
    + tlv('01', '12') // dinamis: ada nominal
    + tlv('26', merchantAccount)
    + tlv('52', '5732') // MCC toko elektronik
    + tlv('53', '360') // IDR
    + tlv('54', amount)
    + tlv('58', 'ID')
    + tlv('59', name)
    + tlv('60', city)
    + tlv('62', additionalData)
    + '6304'

  return payload + crc16(payload)
}
