<template>
  <div :class="cn('rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-none', $attrs.class as string)">
    <div v-if="$slots.header" class="border-b border-slate-100/90 px-5 py-4 dark:border-slate-800/80">
      <slot name="header" />
    </div>
    <div class="px-5 py-5">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-slate-100/90 bg-slate-50/50 px-5 py-3.5 rounded-b-2xl dark:border-slate-800/80 dark:bg-slate-900/50">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils'

defineOptions({
  inheritAttrs: false
})
</script>
