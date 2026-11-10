// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

// Basis URL situs untuk canonical/og:url/og:image (absolut).
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const appEnv = process.env.APP_ENV || (process.env.VERCEL_ENV === 'production' ? 'production' : 'development')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',

  // WAJIB false: payload extraction meng-bake /produk/{id}/_payload.json?_b=<buildId>
  // sebagai artefak statis saat build. Deployment 28 Okt (SEBELUM gambar produk
  // di-reupload 30 Okt) membekukan snapshot data image_url: null, dan swr: 60
  // TIDAK meng-regenerasi file itu (X-Vercel-Cache: HIT, Age ~2,8 hari tanpa
  // berubah) — akibatnya SEMUA gambar di /produk/[id] dirender placeholder.
  // Dengan false, data di-embed inline di HTML yang di-regenerate ISR/Vercel,
  // sehingga edit admin (gambar/harga/stok) selalu langsung terkirim ke user.
  experimental: {
    payloadExtraction: false
  },

  // Tailwind CSS v4 — plugin Vite resmi (sebelumnya disediakan @nuxt/ui).
  vite: {
    plugins: [tailwindcss()]
  },

  // Halaman internal tidak perlu diindeks mesin pencari
  // (X-Robots-Tag: noindex via headers; /admin juga tercakup karena ** di Nitro
  // tidak memMatch path persisnya).
  routeRules: {
    // `robots: false` bukan properti yang sah di routeRules Nitro (TS2353).
    // Set header X-Robots-Tag eksplisit — inilah yang dibaca mesin pencari.
    '/admin': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/admin/**': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/login': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/checkout': { cache: false, headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } },

    // /produk/** SENGAJA tidak di-cache: detail produk harus langsung
    // menampilkan hasil edit admin (gambar/harga/stok). SSR fresh per request;
    // jalurnya ringan (1 select + stok cached 3 dtk + promo batch).
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Toko: Katalog produk',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Toko spesialis iPhone, iPad, Apple Watch, AirPods dan Samsung Galaxy flagship. Cek stok dan spesifikasi lewat chat, lalu pesan langsung tanpa daftar akun.'
        },
        { property: 'og:site_name', content: 'Toko' },
        { property: 'og:locale', content: 'id_ID' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Katalog toko' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'robots', content: 'index, follow, max-image-preview:large' },
        { name: 'theme-color', content: '#0046be' }
      ],
      link: [
        { rel: 'icon', type: 'image/jpeg', href: '/logo.jpeg' }
      ],
    }
  },

  css: ['~/assets/css/main.css', '~/assets/css/storefront.css', '~/assets/css/admin.css'],

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
    //
    // PENTING — `appEnv` TIDAK boleh memakai `process.env.NODE_ENV` sebagai
    // fallback. `nuxt build` MEMAKSA NODE_ENV='production' sebelum nuxt.config
    // dievaluasi (@nuxt/cli: `overrideEnv('production')` di build-*.mjs). Jadi
    // fallback itu membuat setiap build Vercel yang tanpa APP_ENV ikut jadi
    // mode production — lengkap dengan default tidak aman di bawah ini
    // (debug=true, seedOnStartup=true, provider=mock) yang membuat guard
    // produksi menolak boot. Gejalanya di Vercel hanya "FUNCTION_INVOCATION_FAILED"
    // di SEMUA route, karena plugin Nitro gagal start.
    //
    // Lokal tidak terpengaruh karena `.env` selalu menyediakan APP_ENV.
    // Sumber kebenaran: APP_ENV eksplisit, atau VERCEL_ENV untuk auto-deteksi
    // (production -> production, preview -> development).
    appEnv,
    debug: process.env.DEBUG || 'true',
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET_KEY || 'change-me-64-char-random-secret',
    accessTokenExpireMinutes: process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '60',
    seedOnStartup: process.env.SEED_ON_STARTUP || 'true',
    lowStockDefault: process.env.LOW_STOCK_THRESHOLD_DEFAULT || '5',
    stockoutRiskDays: process.env.STOCKOUT_RISK_DAYS || '7',
    maxDiscountPercent: process.env.MAX_DISCOUNT_PERCENT || '50',
    idempotencyTtlMinutes: process.env.IDEMPOTENCY_TTL_MINUTES || '30',
    orderTtlMinutes: process.env.ORDER_TTL_MINUTES || '120',
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
    llmTimeoutSeconds: process.env.LLM_TIMEOUT_SECONDS || '8',
    llmMaxRetries: process.env.LLM_MAX_RETRIES || '1',
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
