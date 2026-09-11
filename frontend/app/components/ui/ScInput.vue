<template>
  <input
    v-model="model"
    :class="cn(
      'h-10 w-full rounded-xl border border-slate-300/80 bg-white/90 px-3.5 py-2 text-sm transition-all duration-150',
      'placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/20',
      'disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-100 dark:focus-visible:border-indigo-400 dark:focus-visible:ring-indigo-400/20 shadow-xs',
      $attrs.class as string
    )"
    v-bind="$attrs"
  >
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils'

const model = defineModel<string | number | null>()
defineOptions({ inheritAttrs: false })
</script>

