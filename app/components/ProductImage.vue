<script setup lang="ts">
import { Headphones, Smartphone, Tablet, Watch, Package } from '@lucide/vue'
import { categoryAccent, productInitials } from '~/utils/product'

const props = withDefaults(defineProps<{
  imageUrl?: string | null
  name?: string
  category?: string
  size?: 'card' | 'detail' | 'thumb'
  /** true = gambar di atas viewport pertama (hero/detail) → eager + fetchpriority high (LCP). */
  eager?: boolean
}>(), { imageUrl: null, name: '', category: '', size: 'card', eager: false })

const icons: Record<string, unknown> = { hp: Smartphone, smartphone: Smartphone, tablet: Tablet, wearable: Watch, audio: Headphones, aksesori: Package }

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

// URL yang di-load browser: gambar Supabase Storage di-resize server-side lewat
// query param transform (tidak mengunduh file full-size untuk thumbnail 56px).
// Ukuran mengikuti ukuran tampil: card ~480px, detail ~800px, thumb ~160px.
// URL non-Supabase (placeholder lokal / eksternal) dilewatkan mentah.
const displayUrl = computed(() => {
  const url = props.imageUrl || ''
  if (!url || !url.includes('/storage/v1/object/public/')) return url || undefined
  const width = props.size === 'detail' ? 800 : props.size === 'card' ? 480 : 160
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}width=${width}&quality=70`
})
</script>

<template>
  <div :class="['relative flex items-center justify-center overflow-hidden bg-stone-100', boxClass, categoryAccent(category)]">
    <img
      v-if="imageUrl"
      :src="displayUrl"
      :alt="name"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      decoding="async"
      class="h-full w-full object-cover"
    >
    <div v-else class="flex flex-col items-center gap-1.5 p-4 text-center">
      <component :is="iconComp" class="h-8 w-8 opacity-70" />
      <span class="font-display text-lg font-extrabold tracking-tight opacity-60">{{ productInitials(name) }}</span>
      <span class="max-w-full truncate text-[10px] font-medium opacity-60">{{ category }}</span>
    </div>
    <slot />
  </div>
</template>
