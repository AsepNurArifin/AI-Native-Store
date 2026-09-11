<script setup lang="ts">
import { cn } from '~/lib/utils'

const model = defineModel<string | number | null>()
const props = defineProps<{ class?: any }>()
</script>

<template>
  <input
    v-model="model"
    :class="cn( 'border-input bg-transparent flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow]', 'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium', 'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground', 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]', 'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50', 'aria-invalid:border-destructive aria-invalid:ring-destructive/20 ', ' md:text-sm', props.class, )"
  >
</template>
