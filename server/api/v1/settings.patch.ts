import { eq } from 'drizzle-orm'
import { storeSettings } from '../../database/schema'
import { requireOwner } from '../../utils/auth'
import { logAudit } from '../../utils/business'
import { apiError } from '../../utils/errors'
import { readStoreSettings } from '../../utils/store-settings'
import { validateProductImages } from '../../utils/product-images'

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const input: unknown = await readBody(event)
  if (!input || typeof input !== 'object' || Array.isArray(input)) apiError(422, 'VALIDATION', 'Pengaturan wajib berupa objek.')
  const body = input as Record<string, unknown>
  const allowed = ['store_name', 'owner_name', 'qris_merchant_name', 'qris_image_url']
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) apiError(422, 'VALIDATION', 'Kolom pengaturan tidak valid.')
  const changes: Partial<typeof storeSettings.$inferInsert> = {}
  for (const [key, field] of [['store_name', 'storeName'], ['owner_name', 'ownerName'], ['qris_merchant_name', 'qrisMerchantName']] as const) {
    if (!(key in body)) continue
    const value = body[key]
    if (typeof value !== 'string' || value.trim().length > 100 || (key !== 'qris_merchant_name' && !value.trim())) apiError(422, 'VALIDATION', `${key} wajib teks maksimal 100 karakter dan tidak boleh kosong.`)
    changes[field] = (value as string).trim()
  }
  if ('qris_image_url' in body) {
    const value = body.qris_image_url
    if (value === null || value === '') changes.qrisImageUrl = null
    else {
      changes.qrisImageUrl = validateProductImages([value])[0]!
    }
  }
  const db = getDb()
  return await db.transaction(async tx => {
    const [current] = await tx.select().from(storeSettings).where(eq(storeSettings.id, 1)).for('update')
    if (!current) apiError(503, 'SETTINGS_UNAVAILABLE', 'Jalankan migrasi pengaturan toko.')
    const next = { ...current!, ...changes }
    if (next.qrisImageUrl && !next.qrisMerchantName?.trim()) apiError(422, 'VALIDATION', 'Nama merchant wajib diisi ketika gambar QRIS tersedia.')
    await tx.update(storeSettings).set({ ...changes, updatedAt: new Date() }).where(eq(storeSettings.id, 1))
    await logAudit(tx, 'SETTINGS_UPDATED', 'USER', { actorId: owner.id, detail: { fields: Object.keys(body) } })
    return await readStoreSettings(tx)
  })
})
