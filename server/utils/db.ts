import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

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
