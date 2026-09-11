<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from '@lucide/vue'
import { cn } from '~/lib/utils'

/**
 * shadcn-vue (new-york) — tema "Toko Digital" (design.md).
 * - Varian `ai` = aksen brand terracotta solid (tanpa gradient).
 * - `size="md"` = alias `default` (kompatibilitas migrasi dari ScButton).
 * - `loading` menampilkan spinner lucide dan otomatis men-disable tombol.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        ai: 'bg-clay-600 text-white shadow-md hover:bg-clay-500',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        md: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5',
        lg: 'h-11 rounded-md px-6 text-base has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonVariants = VariantProps<typeof buttonVariants>

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    loading?: boolean
    disabled?: boolean
    class?: any
  }>(),
  { variant: 'default', size: 'default', loading: false, disabled: false },
)
</script>

<template>
  <button
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
    :disabled="props.disabled || props.loading"
  >
    <LoaderCircle v-if="props.loading" class="animate-spin" />
    <slot />
  </button>
</template>
