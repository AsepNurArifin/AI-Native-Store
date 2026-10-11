import { defineNitroPlugin } from 'nitropack/runtime'
import { assertProductionSafe, serverConfig } from '../utils/config'

/**
 * Guard produksi fail-closed.
 *
 * SEBELUMNYA `assertProductionSafe()` hanya didefinisikan di server/utils/config.ts
 * dan TIDAK PERNAH dipanggil -> semua proteksi produksi (JWT secret, DEBUG,
 * SEED_ON_STARTUP, LLM/Telegram provider) jadi dead code.
 *
 * Plugin Nitro ini menjalankannya SEKALI saat server start. Kalau environment
 * produksi tidak aman, server menolak boot lebih baik daripada diam-diam
 * memakai JWT secret default 'change-me-...' yang bisa ditebak siapa saja.
 */
export default defineNitroPlugin(() => {
  const cfg = serverConfig()
  // Mask SEMUA nilai sensitif sebelum masuk log.
  // PERBAIKAN: versi pertama hanya mask sebagian (jwtSecret, apiKey, token) dan
  // TIDAK mask databaseUrl — sehingga password DB tercetak polos di log.
  // Sekarang pakai allowlist: hanya nama field yang aman untuk diagnostik.
  const SAFE_KEYS = ['appEnv', 'debug', 'telegramProvider', 'llmProvider', 'seedOnStartup', 'jwtAlgorithm', 'orderTtlMinutes'] as const
  const safe: Record<string, unknown> = {}
  for (const k of SAFE_KEYS) safe[k] = (cfg as unknown as Record<string, unknown>)[k]
  safe.hasJwtSecret = Boolean(cfg.jwtSecret) && !cfg.jwtSecret.includes('change-me') && cfg.jwtSecret.length >= 32
  safe.hasDatabaseUrl = Boolean(cfg.databaseUrl)
  safe.hasTelegramSecret = Boolean(cfg.telegramWebhookSecret)
  try {
    assertProductionSafe(cfg)
    console.log('[config] guard produksi OK (appEnv=%s, debug=%s)', cfg.appEnv, cfg.debug)
  }
  catch (e) {
    console.error('[config] GAGAL guard produksi:', (e as Error).message, safe)
    throw e
  }
})