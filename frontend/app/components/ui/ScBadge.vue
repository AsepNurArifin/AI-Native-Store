<template>
  <span :class="cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-xs', tone)">
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
    <slot />
  </span>
</template>

<script setup lang="ts">
import { cn } from '~/utils/cn'

withDefaults(defineProps<{
  tone?: string
  dot?: boolean
}>(), {
  tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  dot: false
})
</script>
