import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Catatan: anotasi eksplisit WAJIB. Tanpa itu TS menyimpulkan `null` dari
// `= null`, sehingga `typeof _db` = `null` dan `NonNullable<...>` di bawah
// menjadi `never` — membuat SETIUA pemanggilan service error TS2345.
let _db: ReturnType<typeof drizzle> | null = null
let _sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (_db) return _db
  const url = useRuntimeConfig().databaseUrl as string || process.env.DATABASE_URL || ''
  if (!url) throw new Error('DATABASE_URL belum diset. Salin .env.example menjadi .env dan isi DATABASE_URL (Supabase session pooler :5432).')
  _sql = postgres(url, {
    prepare: false,
    // Supabase session pooler membatasi total koneksi (pool_size kecil):
    // batasi pool driver + tutup koneksi idle agar tidak menghabiskan slot.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10
  })
  _db = drizzle(_sql)
  return _db
}

export function getSql() {
  getDb()
  return _sql!
}

/**
 * Tipe DB yang diterima utility: koneksi utama **atau** transaction (`tx`).
 *
 * SEBELUMNYA fungsi-fungsi service hanya menerima `ReturnType<typeof getDb>`,
 * sehingga setiap pemanggilan di dalam `db.transaction()` harus di-cast
 * (`tx as never`). Cast itu menutupi error tipe tanpa menambah keamanan.
 * Dengan `DbLike`, pemanggilan `await logAudit(tx, ...)` langsung valid.
 */
export type Db = ReturnType<typeof getDb>
export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbLike = Db | DbTx
