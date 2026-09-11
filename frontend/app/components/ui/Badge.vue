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
          'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        warning:
          'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        info: 'border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
        muted: 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        danger:
          'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
        neutral:
          'border-transparent bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
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
