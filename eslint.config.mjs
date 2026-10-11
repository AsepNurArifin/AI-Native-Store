// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // `app/components/ui/**` = komponen hasil generate `npx shadcn-vue add ...`.
    // File-file ini bisa ditimpa kapan saja oleh CLI, jadi perubahan manual
    // akan hilang. Selain itu shadcn sengaja menulis `class?: any` untuk
    // menerima string | array | object dari Tailwind merge.
    // -> Jangan diedit, jangan dilint.
    ignores: ['app/components/ui/**'],
  },
  // Your custom configs here
)