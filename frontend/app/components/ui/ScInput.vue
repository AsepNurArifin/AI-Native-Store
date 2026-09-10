<template>
  <input
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :class="cn('flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950')"
    v-bind="$attrs"
  >
</template>

<script setup lang="ts">
import { cn } from '~/utils/cn'
const model = defineModel<string | number | null>()
withDefaults(defineProps<{ type?: string, placeholder?: string }>(), { type: 'text', placeholder: '' })
</script>
