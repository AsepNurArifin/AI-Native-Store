import { sql } from 'drizzle-orm'
import { ensureSeeded } from '../../utils/business'

export default defineEventHandler(async () => {
  const db = getDb()
  try {
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
    throw createError({ statusCode: 503, message: 'degraded', data: { detail: 'degraded' } })
  }
})
