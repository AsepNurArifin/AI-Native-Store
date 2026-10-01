<script setup lang="ts">
import { cn } from '~/lib/utils'
const props = defineProps<{ class?: any }>()
</script>

<template>
  <caption :class="cn('text-muted-foreground mt-4 text-sm', props.class)">
    <slot />
  </caption>
</template>
