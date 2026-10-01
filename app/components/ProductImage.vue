<script setup lang="ts">
import { Laptop, Headphones, Smartphone, Tablet, Watch, Gamepad2, Package } from '@lucide/vue'
import { categoryAccent, productInitials } from '~/utils/product'

const props = withDefaults(defineProps<{
  imageUrl?: string | null
  name?: string
  category?: string
  size?: 'card' | 'detail' | 'thumb'
}>(), { imageUrl: null, name: '', category: '', size: 'card' })

const icons: Record<string, unknown> = { hp: Smartphone, smartphone: Smartphone, laptop: Laptop, tablet: Tablet, wearable: Watch, audio: Headphones, gaming: Gamepad2, komputer: Laptop }

const iconComp = computed(() => {
  const c = (props.category || '').toLowerCase()
  for (const [k, v] of Object.entries(icons)) if (c.includes(k)) return v as object
  return Package as object
})

const boxClass = computed(() => {
  if (props.size === 'detail') return 'aspect-square sm:aspect-[4/3] rounded-2xl'
  if (props.size === 'thumb') return 'h-14 w-14 rounded-xl'
  return 'aspect-square rounded-t-2xl'
})
</script>

<template>
  <div :class="['relative flex items-center justify-center overflow-hidden bg-stone-100', boxClass, categoryAccent(category)]">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="name"
      loading="lazy"
      class="h-full w-full object-cover"
    />
    <div v-else class="flex flex-col items-center gap-1.5 p-4 text-center">
      <component :is="iconComp" class="h-8 w-8 opacity-70" />
      <span class="font-display text-lg font-extrabold tracking-tight opacity-60">{{ productInitials(name) }}</span>
      <span class="max-w-full truncate text-[10px] font-medium opacity-60">{{ category }}</span>
    </div>
    <slot />
  </div>
</template>
