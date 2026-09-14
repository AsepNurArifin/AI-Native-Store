<script setup lang="ts">
/*
 * Render teks AI (Markdown GFM) jadi HTML di bubble chat.
 * Escape HTML dulu, baru parse — tidak ada markup mentah yang lolos,
 * jadi aman tanpa sanitizer eksternal.
 */
import { marked } from 'marked'

const props = defineProps<{ text: string }>()

const html = computed(() => {
  // escape semua HTML dulu; marked hanya memroses markup markdown yang tersisa
  const escaped = props.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const parsed = marked.parse(escaped, { gfm: true, breaks: true, async: false }) as string
  // tabel dibungkus agar bisa di-scroll horizontal di layar sempit
  return parsed.replace(/<table>/g, '<div class="md-table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
})
</script>

<template>
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
