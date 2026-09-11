<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'text-foreground',
        success:
          'border-transparent bg-emerald-100 text-emerald-700',
        warning:
          'border-transparent bg-amber-100 text-amber-700',
        info: 'border-transparent bg-clay-100 text-clay-700',
        muted: 'border-transparent bg-stone-100 text-stone-600',
        danger: 'border-transparent bg-red-100 text-red-800',
        neutral: 'border-transparent bg-stone-200 text-stone-800',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type BadgeVariants = VariantProps<typeof badgeVariants>

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants['variant']
    /** Titik indikator berkedip (ekstensi brand lokal, kompatibel ScBadge). */
    dot?: boolean
    class?: any
  }>(),
  { variant: 'default', dot: false },
)
</script>

<template>
  <span :class="cn(badgeVariants({ variant: props.variant }), props.class)">
    <span v-if="props.dot" class="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
    <slot />
  </span>
</template>
