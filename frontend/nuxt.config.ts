// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Tailwind CSS v4 — plugin Vite resmi (sebelumnya disediakan @nuxt/ui).
  vite: {
    plugins: [tailwindcss()]
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Toko Bu Ratna — Toko Elektronik: HP, Laptop & Aksesoris',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Demo toko elektronik: tanya spesifikasi dan stok HP, laptop, MacBook, iPhone, serta aksesori lewat chat. Katalog contoh 98 produk dengan harga simulasi.'
        },
        { property: 'og:site_name', content: 'Toko Bu Ratna' },
        { name: 'theme-color', content: '#c2662c' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap' }
      ],
    }
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt'
  ],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1'
    }
  },

  // Komponen `~/components` auto-import tanpa prefix Ui (per konfigurasi shadcn-vue).
  components: [{ path: '~/components', pathPrefix: false }]
})