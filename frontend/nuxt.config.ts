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
    '/login': { robots: false }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Toko Bu Ratna: Toko Elektronik HP, Laptop & Aksesoris',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Toko elektronik yang buka lewat chat: sebut gadget dan budgetnya, kami cek stok, spesifikasi, dan harga dari katalog. Tanpa daftar akun.'
        },
        { property: 'og:site_name', content: 'Toko Bu Ratna' },
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'theme-color', content: '#c2662c' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' }
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
    experimental: { processCSSVariables: true },
    families: [
      { name: 'Outfit', provider: 'google', weights: [400, 500, 600, 700, 800] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700], styles: ['normal', 'italic'] }
    ]
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
      siteUrl
    }
  },

  // Komponen `~/components` auto-import tanpa prefix Ui (per konfigurasi shadcn-vue).
  components: [{ path: '~/components', pathPrefix: false }]
})
