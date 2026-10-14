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
  if (!url) {
    throw new Error(
      'DATABASE_URL belum diset. Isi DATABASE_URL di .env (lokal), atau NUXT_DATABASE_URL di Vercel '
      + '(scope Production) memakai Supabase TRANSACTION POOLER port 6543 — bukan session pooler 5432.'
    )
  }
  _sql = postgres(url, {
    // WAJIB untuk transaction pooler: prepared statement tidak boleh di-cache
    // antar transaksi karena backend Postgres-nya berganti-ganti.
    prepare: false,
    // Transaction pooler (:6543) multiplex banyak client ke sedikit backend,
    // jadi `max: 3` di sini bukan upaya memperlelah session pooler — ini cuma
    // menjaga jumlah koneksi driver tetap kecil dan murah.
    // `idle_timeout` hanya berguna saat instance hidup (dev). Di Vercel lambda
    // dibekukan di antara request sehingga timer ini praktis tidak pernah jalan.
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
