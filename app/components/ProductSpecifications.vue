<script setup lang="ts">
/* Hallmark · component: specification table · theme: Best Buy Marketplace (main.css)
 * Read-only data: empty / populated; no new page structure or motion.
 * pre-emit critique: P4 H4 E4 S5 R5 V3
 */
import { specEntries } from '~/utils/product'

const props = defineProps<{ specification: Record<string, unknown> }>()

const entries = computed(() => specEntries(props.specification))
</script>

<template>
  <!-- gap-px + background hairline: pemisah rapi di 1 kolom maupun 2 kolom (tanpa nth-child) -->
  <div v-if="entries.length" class="@container">
    <dl class="grid gap-px overflow-hidden rounded-lg bg-stone-200 text-xs @lg:grid-cols-2">
      <div v-for="entry in entries" :key="entry.key" class="grid grid-cols-[minmax(5.5rem,35%)_1fr] gap-px bg-stone-200">
        <dt class="min-w-0 bg-stone-50 px-3 py-2 font-medium text-stone-500">{{ entry.label }}</dt>
        <dd class="min-w-0 whitespace-pre-wrap bg-white px-3 py-2 font-semibold text-stone-900 [overflow-wrap:anywhere]">{{ entry.value }}</dd>
      </div>
    </dl>
  </div>
  <p v-else class="text-xs text-stone-500">Spesifikasi belum tersedia di katalog.</p>
</template>
