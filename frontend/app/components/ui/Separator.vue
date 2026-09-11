<script setup lang="ts">
import { cn } from '~/lib/utils'
const props = withDefaults(
  defineProps<{ class?: any; orientation?: 'horizontal' | 'vertical' }>(),
  { orientation: 'horizontal' },
)
</script>

<template>
  <div
    role="separator"
    :aria-orientation="props.orientation"
    :class="
      cn(
        'bg-border shrink-0',
        props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        props.class,
      )
    "
  />
</template>
