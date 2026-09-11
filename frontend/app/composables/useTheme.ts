/**
 * Tema terang/gelap berbasis kelas `.dark` pada <html>.
 *
 * Kelas awal dipasang oleh skrip anti-FOUC di `nuxt.config.ts` (app.head.script),
 * lalu disinkronkan ke state Nuxt oleh `plugins/theme.client.ts`.
 */
export function useTheme() {
  const isDark = useState<boolean>('theme-is-dark', () => false)

  function apply(dark: boolean) {
    isDark.value = dark
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', dark)
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light')
      } catch {
        // localStorage bisa diblokir (mode privat) — abaikan.
      }
    }
  }

  return {
    isDark,
    apply,
    toggle: () => apply(!isDark.value),
  }
}
