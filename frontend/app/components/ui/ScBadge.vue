<template>
  <span :class="cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone)">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { cn } from '~/utils/cn'
withDefaults(defineProps<{ tone?: string }>(), { tone: '' })
</script>
