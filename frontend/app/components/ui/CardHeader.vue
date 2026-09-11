<script setup lang="ts">
import { cn } from '~/lib/utils'
const props = defineProps<{ class?: any }>()
</script>

<template>
  <div
    :class="cn('grid auto-rows-min items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]', props.class)"
  >
    <slot />
  </div>
</template>
