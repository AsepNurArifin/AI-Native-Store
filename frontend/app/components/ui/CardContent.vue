<script setup lang="ts">
import { cn } from '~/lib/utils'
const props = defineProps<{ class?: any }>()
</script>

<template>
  <div :class="cn('px-6', props.class)">
    <slot />
  </div>
</template>
