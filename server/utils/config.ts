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
    seedSkuCount: Number(c.seedSkuCount ?? process.env.SEED_SKU_COUNT ?? 100)
  }
}

export function assertProductionSafe(cfg: ReturnType<typeof serverConfig>) {
  if (cfg.appEnv !== 'production') return
  if (!cfg.jwtSecret || cfg.jwtSecret.includes('change-me') || cfg.jwtSecret.length < 32)
    throw new Error('JWT_SECRET_KEY wajib non-default (>=32 char) di production')
  if (cfg.debug) throw new Error('DEBUG wajib false di production')
  if (cfg.seedOnStartup) throw new Error('SEED_ON_STARTUP wajib false di production')
  if (cfg.llmProvider === 'mock') throw new Error('LLM_PROVIDER=mock tidak boleh di production')
  if (cfg.telegramProvider === 'mock' && cfg.telegramBotToken) throw new Error('TELEGRAM_PROVIDER tidak konsisten di production')
}
