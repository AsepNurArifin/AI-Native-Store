// Server runtime config — pengganti backend/app/core/config.py (tanpa Python).
export function serverConfig() {
  const c = useRuntimeConfig()
  return {
    appEnv: (c.appEnv as string) || process.env.APP_ENV || 'development',
    debug: String(c.debug ?? process.env.DEBUG ?? 'true') === 'true',
    databaseUrl: (c.databaseUrl as string) || process.env.DATABASE_URL || '',
    jwtSecret: (c.jwtSecret as string) || process.env.JWT_SECRET_KEY || 'change-me-64-char-random-secret',
    jwtAlgorithm: 'HS256',
    accessTokenExpireMinutes: Number(c.accessTokenExpireMinutes ?? process.env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 60),
    seedOwnerEmail: (c.seedOwnerEmail as string) || process.env.SEED_OWNER_EMAIL || 'owner@store.demo',
    seedDefaultPassword: (c.seedDefaultPassword as string) || process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!',
    seedOnStartup: String(c.seedOnStartup ?? process.env.SEED_ON_STARTUP ?? 'true') === 'true',
    lowStockDefault: Number(c.lowStockDefault ?? process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 5),
    stockoutRiskDays: Number(c.stockoutRiskDays ?? process.env.STOCKOUT_RISK_DAYS ?? 7),
    maxDiscountPercent: Number(c.maxDiscountPercent ?? process.env.MAX_DISCOUNT_PERCENT ?? 50),
    idempotencyTtlMinutes: Number(c.idempotencyTtlMinutes ?? process.env.IDEMPOTENCY_TTL_MINUTES ?? 30),
    /** TTL order UNPAID sebelum auto-expire (menahan stok). Default 120 menit. */
    orderTtlMinutes: Number(c.orderTtlMinutes ?? process.env.ORDER_TTL_MINUTES ?? 120),
    llmProvider: (c.llmProvider as string) || process.env.LLM_PROVIDER || 'mock',
    llmApiKey: (c.llmApiKey as string) || process.env.LLM_API_KEY || '',
    groqApiKey: (c.groqApiKey as string) || process.env.GROQ_API_KEY || '',
    groqModelFast: (c.groqModelFast as string) || process.env.GROQ_MODEL_FAST || 'qwen/qwen3-32b',
    groqModelReasoning: (c.groqModelReasoning as string) || process.env.GROQ_MODEL_REASONING || 'qwen/qwen3-32b',
    openrouterApiKey: (c.openrouterApiKey as string) || process.env.OPENROUTER_API_KEY || '',
    openrouterModelFast: (c.openrouterModelFast as string) || process.env.OPENROUTER_MODEL_FAST || 'qwen/qwen3-32b:free',
    openrouterModelReasoning: (c.openrouterModelReasoning as string) || process.env.OPENROUTER_MODEL_REASONING || 'qwen/qwen3-32b:free',
    llmModelSales: (c.llmModelSales as string) || process.env.LLM_MODEL_SALES || '',
    llmModelAnalyst: (c.llmModelAnalyst as string) || process.env.LLM_MODEL_ANALYST || '',
    llmModelAction: (c.llmModelAction as string) || process.env.LLM_MODEL_ACTION || '',
    llmTimeoutSeconds: Number(c.llmTimeoutSeconds ?? process.env.LLM_TIMEOUT_SECONDS ?? 20),
    llmMaxRetries: Number(c.llmMaxRetries ?? process.env.LLM_MAX_RETRIES ?? 2),
    telegramProvider: (c.telegramProvider as string) || process.env.TELEGRAM_PROVIDER || 'mock',
    telegramBotToken: (c.telegramBotToken as string) || process.env.TELEGRAM_BOT_TOKEN || '',
    telegramWebhookSecret: (c.telegramWebhookSecret as string) || process.env.TELEGRAM_WEBHOOK_SECRET || '',
    telegramApiBase: (c.telegramApiBase as string) || process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',

  }
}

/** True kalau aplikasi dianggap produksi (fail-closed: NODE_ENV ikut dicek). */
export function isProduction(cfg: ReturnType<typeof serverConfig>): boolean {
  return cfg.appEnv === 'production' || process.env.NODE_ENV === 'production'
}

/**
 * Guard wajibnya environment produksi. Dijalankan dari server/plugins/00-assert-production.ts.
 * PERBAIKAN: semula `TELEGRAM_PROVIDER=mock` hanya ditolak kalau token ikut
 * ter-set, sehingga mock tanpa token lolos dan webhook terbuka tanpa secret.
 *
 * Semua pelanggaran dikumpulkan dulu lalu dilempar SEKALI. Versi lama melempar
 * error pertama yang ketemu, jadi begitu satu var kurang, vars lain yang juga
 * kurang ikut terlewat — harus tambah env satu-satu, redeploy, gagal lagi.
 * Di Vercel yang terlihat dari luar cuma 500 `FUNCTION_INVOCATION_FAILED` tanpa
 * petunjuk apa pun, karena satu plugin Nitro yang gagal start mematikan seluruh
 * site. Sekarang pesannya langsung menyebut seluruh env yang harus di-set.
 *
 * Kriteria fail-closed TIDAK dilonggarkan — hanya cara melaporkannya.
 */
export function assertProductionSafe(cfg: ReturnType<typeof serverConfig>) {
  if (!isProduction(cfg)) return
  const problems: string[] = []
  if (!cfg.databaseUrl)
    problems.push('NUXT_DATABASE_URL wajib diset (Supabase session pooler :5432, bukan 6543)')
  if (!cfg.jwtSecret || cfg.jwtSecret.includes('change-me') || cfg.jwtSecret.length < 32)
    problems.push('NUXT_JWT_SECRET_KEY wajib string acak >= 32 char (bukan default `change-me-...`)')
  if (cfg.debug) problems.push('NUXT_DEBUG wajib `false`')
  if (cfg.seedOnStartup) problems.push('NUXT_SEED_ON_STARTUP wajib `false`')
  if (cfg.llmProvider === 'mock')
    problems.push('NUXT_LLM_PROVIDER tidak boleh `mock` (mis. `groq`) + NUXT_GROQ_API_KEY')
  // Mock apa pun = jebakan: verifyTelegramSecret() fail-closed saat mock sehingga
  // webhook 401 total. Tolak di boot lebih baik daripada diam-diam lumpuh.
  if (cfg.telegramProvider === 'mock')
    problems.push('NUXT_TELEGRAM_PROVIDER tidak boleh `mock` (mis. `bot`) + NUXT_TELEGRAM_WEBHOOK_SECRET')
  if (problems.length) {
    throw new Error(
      'Environment produksi tidak aman — server menolak boot:\n'
      + problems.map(p => `  - ${p}`).join('\n')
      + '\n\nSet di Vercel → Project → Settings → Environment Variables (scope Production), lalu redeploy.'
      + '\nNama env WAJIB berawalan NUXT_ (Nitro hanya override runtimeConfig lewat prefix itu).'
    )
  }
}
