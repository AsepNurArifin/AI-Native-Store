import { eq } from 'drizzle-orm'
import { storeSettings } from '../database/schema'
import type { DbLike } from './db'

export async function readStoreSettings(db: DbLike) {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1)
  if (!row) throw createError({ statusCode: 503, message: 'Pengaturan toko belum tersedia. Jalankan migrasi database.' })
  return {
    store_name: row.storeName,
    owner_name: row.ownerName,
    qris_merchant_name: row.qrisMerchantName,
    qris_image_url: row.qrisImageUrl
  }
}
