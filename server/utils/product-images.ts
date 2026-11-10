export const MAX_PRODUCT_IMAGES = 10

function invalidImages(message: string): never {
  throw createError({ statusCode: 422, message, data: { detail: { code: 'VALIDATION', message } } })
}

/** URL gambar mengikuti katalog: path lokal absolut atau URL HTTP(S). */
export function validateProductImages(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_PRODUCT_IMAGES) {
    invalidImages(`image_urls harus berupa daftar maksimal ${MAX_PRODUCT_IMAGES} gambar`)
  }
  return value.map((image, index) => {
    if (typeof image !== 'string') invalidImages(`URL gambar ${index + 1} tidak valid`)
    const url = image.trim()
    const unsafeCharacter = [...url].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === '\\')
    if (!url || url.length > 500 || unsafeCharacter) {
      invalidImages(`URL gambar ${index + 1} tidak valid atau melebihi 500 karakter`)
    }
    if (url.startsWith('/') && !url.startsWith('//')) return url
    try {
      const parsed = new URL(url)
      if (/^https?:\/\//i.test(url) && ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname && !parsed.username && !parsed.password) return url
    }
    catch { /* Pesan validasi yang sama untuk URL yang tidak bisa diparse. */ }
    return invalidImages(`URL gambar ${index + 1} harus berupa path lokal / atau URL HTTP(S) yang aman`)
  })
}

/** image_url hanya proyeksi sampul; semua perubahan memakai daftar berurutan. */
export function rejectCoverInput(body: Record<string, unknown>): void {
  if (Object.prototype.hasOwnProperty.call(body, 'image_url')) {
    invalidImages('Gunakan image_urls untuk gambar produk; image_url adalah sampul hanya-baca')
  }
}
