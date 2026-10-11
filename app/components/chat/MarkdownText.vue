<script setup lang="ts">
/**
 * Render teks AI (Markdown GFM) jadi HTML di bubble chat.
 *
 * Dua lapis pertahanan:
 *  1. Escape HTML SEBELUM parse -> tidak ada markup mentah yang lolos.
 *  2. Renderer link kustom -> tolak protokol berbahaya (lihat safeUrl).
 *
 * Lapis 2 wajib: escape-HTML saja tidak menutup Stored XSS via tautan, karena
 * `<a href="javascript:...">` adalah HTML yang valid.
 */
import { marked } from 'marked'

const props = defineProps<{ text: string }>()

/** Protokol yang boleh dipakai di href. Selain itu ditolak. */
const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i
/**
 * Buang whitespace + karakter kontrol sebelum cek skema.
 *
 * Tanpa ini, "java\tscript:alert(1)" lolos sebagai URL harmless lalu
 * browser menormalisasikannya jadi `javascript:` yang hidup.
 *
 * eslint-disable no-control-regex -- karakter kontrol DISENGaja di sini:
 * justru inilah yang menutup bypass tersebut. Regex lain memakai `\s`
 * hanya, yang tidak menyaring CR/LF/NUL.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0020\u007f]+/g

/**
 * Kembalikan URL yang aman, atau null bila protokolnya berbahaya.
 *
 * PERBAIKAN KEAMANAN: `marked` v5+ menghapus opsi `sanitize` dan tidak lagi
 * menyaring URL. `[klik](javascript:alert(1))` menghasilkan `<a href="javascript:...">`
 * yang hidup; karena dirender lewat `v-html`, teks dari Telegram atau balasan AI
 * bisa menyisipkan tautan yang menjalankan JS di origin toko saat diklik.
 */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const raw = url.trim()
  const normalized = raw.replace(CONTROL_CHARS, '')
  if (SAFE_PROTOCOL.test(raw) || SAFE_PROTOCOL.test(normalized)) return raw
  // Tanpa skema sama sekali (mis. "www.toko.com") -> Treat sebagai relative.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return raw
  return null
}

const renderer = new marked.Renderer()

renderer.link = function (token) {
  const body = this.parser.parseInline(token.tokens ?? [])
  const href = safeUrl(token.href)
  if (href === null) {
    // Tetap tampilkan teksnya, tapi tanpa tautan yang bisa diklik.
    return body
  }
  const external = /^https?:/i.test(href)
  const rel = external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''
  const title = token.title ? ` title="${token.title.replace(/"/g, '&quot;')}"` : ''
  return `<a href="${href.replace(/"/g, '&quot;')}"${title}${rel}>${body}</a>`
}

const html = computed(() => {
  const escaped = props.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const parsed = marked.parse(escaped, {
    gfm: true,
    breaks: true,
    async: false,
    renderer
  }) as string
  // Tabel dibungkus agar bisa di-scroll horizontal di layar sempit.
  return parsed.replace(/<table>/g, '<div class="md-table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- html sudah di-escape + link disaring di atas -->
  <div class="md-content" v-html="html" />
</template>

<style scoped>
.md-content :deep(p) { margin: 0 0 0.5rem; }
.md-content :deep(p:last-child) { margin-bottom: 0; }
.md-content :deep(ul), .md-content :deep(ol) { margin: 0.25rem 0 0.5rem; padding-left: 1.25rem; }
.md-content :deep(li) { margin: 0.15rem 0; }
.md-content :deep(strong) { font-weight: 700; }
.md-content :deep(em) { font-style: italic; }
.md-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8em;
  background: rgb(0 0 0 / 5%);
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}
.md-content :deep(h1), .md-content :deep(h2), .md-content :deep(h3), .md-content :deep(h4) {
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.3;
  margin: 0.5rem 0 0.35rem;
}
.md-content :deep(h1:first-child), .md-content :deep(h2:first-child), .md-content :deep(h3:first-child) { margin-top: 0; }
.md-content :deep(blockquote) {
  border-left: 2px solid rgb(0 0 0 / 15%);
  margin: 0.35rem 0;
  padding-left: 0.6rem;
  color: var(--color-stone-500, #78716c);
}
.md-content :deep(.md-table-wrap) {
  overflow-x: auto;
  margin: 0.5rem 0;
  max-width: 100%;
}
.md-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85em;
}
.md-content :deep(th), .md-content :deep(td) {
  border: 1px solid rgb(0 0 0 / 12%);
  padding: 0.3rem 0.55rem;
  text-align: left;
  vertical-align: top;
}
.md-content :deep(th) { background: rgb(0 0 0 / 4%); font-weight: 600; white-space: nowrap; }
.md-content :deep(hr) { border: none; border-top: 1px dashed rgb(0 0 0 / 15%); margin: 0.5rem 0; }
</style>