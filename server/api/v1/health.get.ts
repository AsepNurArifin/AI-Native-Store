import { sql } from 'drizzle-orm'
import { ensureSeeded } from '../../utils/business'

export default defineEventHandler(async () => {
  try {
    const db = getDb()
    await ensureSeeded(db)
    await db.execute(sql`SELECT 1`)
    const cfg = useRuntimeConfig()
    return {
      status: 'ok',
      db: 'up',
      llm: cfg.llmProvider || process.env.LLM_PROVIDER || 'mock',
      telegram_provider: cfg.telegramProvider || process.env.TELEGRAM_PROVIDER || 'mock',
      env: cfg.appEnv || process.env.APP_ENV || 'development',
      scheduler: 'nitro-lazy'
    }
  }
  catch (e) {
    // Detail error dicatat di LOG SERVER SAJA, bukan di response — body error DB
    // berisi URL koneksi (di dalamnya ada password), jangan bocor ke publik.
    // Tanpa log ini, outage seperti `EMAXCONNSESSION max clients reached` mustahil
    // didiagnosis dari luar: klien cuma melihat `degraded` dan tidak tahu kenapa.
    console.error('[health] cek DB gagal:', e instanceof Error ? e.message : e)
    throw createError({ statusCode: 503, message: 'degraded', data: { detail: 'degraded' } })
  }
})
