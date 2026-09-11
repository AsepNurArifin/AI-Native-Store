<script setup lang="ts">
import { cn } from '~/lib/utils'
const props = defineProps<{ class?: any; for?: string }>()
</script>

<template>
  <label
    :for="props.for"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </label>
</template>
