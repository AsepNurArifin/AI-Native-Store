// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

// Basis URL situs untuk canonical/og:url/og:image (absolut).
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Tailwind CSS v4 — plugin Vite resmi (sebelumnya disediakan @nuxt/ui).
  vite: {
    plugins: [tailwindcss()]
  },

  // Halaman internal tidak perlu diindeks mesin pencari
  // (X-Robots-Tag: noindex; /admin juga dicakup karena ** di Nitro tidak
  // memMatch path persisnya).
  routeRules: {
    '/admin': { robots: false },
    '/admin/**': { robots: false },
    '/login': { robots: false },

    // SWR cache edge 60 detik — HANYA rute yang outputnya murni dari path.
    // PENTING: cache key di Vercel mengabaikan query string. JANGAN pasang di
    // rute yang bervariasi via query (/api/v1/catalog/search?..., '/?q=...')
    // — response query A bocor ke query B (bug 24-vs-18, katalog kosong).
    // JANGAN juga untuk /orders, /chat, /checkout, /admin, /auth — bisa oversell.
    '/rak/**': { swr: 60 },
    '/produk/**': { swr: 60 }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'SHAF STORE: Toko Elektronik HP, Laptop & Aksesoris',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Toko elektronik yang buka lewat chat: sebut gadget dan budgetnya, kami cek stok, spesifikasi, dan harga dari katalog. Tanpa daftar akun.'
        },
        { property: 'og:site_name', content: 'SHAF STORE' },
        { property: 'og:locale', content: 'id_ID' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Papan nama SHAF STORE: toko elektronik yang buka lewat chat' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'robots', content: 'index, follow, max-image-preview:large' },
        { name: 'theme-color', content: '#177b2c' }
      ],
      link: [
        { rel: 'icon', type: 'image/jpeg', href: '/logo.jpeg' }
      ],
    }
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@pinia/nuxt'
  ],

  // Font self-host lewat @nuxt/fonts (Outfit + Plus Jakarta Sans sesuai
  // design.md); menggantikan stylesheet Google Fonts yang render-blocking.
  // Family dipakai lewat CSS variables (--font-sans) -> flag experimental.
  fonts: {
    experimental: { processCSSVariables: 'font-prefixed-only' },
    families: [
      { name: 'Outfit', provider: 'google', weights: [400, 500, 600, 700, 800] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700], styles: ['normal', 'italic'] }
    ]
  },

  runtimeConfig: {
    // Private (server-only, tidak ikut ke bundle browser):
    appEnv: process.env.APP_ENV || 'development',
    debug: process.env.DEBUG || 'true',
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET_KEY || 'change-me-64-char-random-secret',
    accessTokenExpireMinutes: process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '60',
    seedOwnerEmail: process.env.SEED_OWNER_EMAIL || 'owner@store.demo',
    seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!',
    seedOnStartup: process.env.SEED_ON_STARTUP || 'true',
    lowStockDefault: process.env.LOW_STOCK_THRESHOLD_DEFAULT || '5',
    stockoutRiskDays: process.env.STOCKOUT_RISK_DAYS || '7',
    maxDiscountPercent: process.env.MAX_DISCOUNT_PERCENT || '50',
    idempotencyTtlMinutes: process.env.IDEMPOTENCY_TTL_MINUTES || '30',
    llmProvider: process.env.LLM_PROVIDER || 'mock',
    llmApiKey: process.env.LLM_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModelFast: process.env.GROQ_MODEL_FAST || 'qwen/qwen3-32b',
    groqModelReasoning: process.env.GROQ_MODEL_REASONING || 'qwen/qwen3-32b',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterModelFast: process.env.OPENROUTER_MODEL_FAST || 'qwen/qwen3-32b:free',
    openrouterModelReasoning: process.env.OPENROUTER_MODEL_REASONING || 'qwen/qwen3-32b:free',
    llmModelSales: process.env.LLM_MODEL_SALES || '',
    llmModelAnalyst: process.env.LLM_MODEL_ANALYST || '',
    llmModelAction: process.env.LLM_MODEL_ACTION || '',
    llmTimeoutSeconds: process.env.LLM_TIMEOUT_SECONDS || '20',
    llmMaxRetries: process.env.LLM_MAX_RETRIES || '2',
    telegramProvider: process.env.TELEGRAM_PROVIDER || 'mock',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    telegramApiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',

    // Supabase Storage (upload gambar produk): service_role, server-only.
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    public: {
      // Fullstack: API satu origin — tanpa backend Python :8000 lagi.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1',
      siteUrl
    }
  },

  // Komponen `~/components` auto-import tanpa prefix Ui (per konfigurasi shadcn-vue).
  components: [{ path: '~/components', pathPrefix: false }]
})
