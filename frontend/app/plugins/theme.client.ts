/**
 * Sinkronkan preferensi tema (localStorage / prefers-color-scheme) ke state Nuxt
 * dan ke kelas `.dark` pada <html>. Berjalan sebelum aplikasi di-hydrate.
 */
export default defineNuxtPlugin(() => {
  const isDark = useState<boolean>('theme-is-dark', () => false)
  const root = document.documentElement

  let stored: string | null = null
  try {
    stored = localStorage.getItem('theme')
  } catch {
    stored = null
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = stored ? stored === 'dark' : prefersDark

  root.classList.toggle('dark', dark)
  isDark.value = dark

  // Ikuti perubahan preferensi sistem selama user belum memilih manual.
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => {
    let hasStored: string | null = null
    try {
      hasStored = localStorage.getItem('theme')
    } catch {
      hasStored = null
    }
    if (!hasStored) {
      root.classList.toggle('dark', e.matches)
      isDark.value = e.matches
    }
  })
})
