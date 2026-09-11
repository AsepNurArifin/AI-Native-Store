<script setup lang="ts">
import { cn } from '~/lib/utils'

const model = defineModel<string | null>()
const props = defineProps<{ class?: any }>()
</script>

<template>
  <textarea
    v-model="model"
    :class="
      cn(
        'border-input placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow]',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'dark:bg-input/30 md:text-sm',
        props.class,
      )
    "
  ></textarea>
</template>
