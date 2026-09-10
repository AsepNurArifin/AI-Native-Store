<template>
  <div :class="cn('rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900')">
    <div v-if="$slots.header" class="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <slot name="header" />
    </div>
    <div class="px-4 py-4">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '~/utils/cn'
</script>
