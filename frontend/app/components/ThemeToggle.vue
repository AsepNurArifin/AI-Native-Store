<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    :title="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
    :aria-label="isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'"
    :aria-pressed="isDark"
    class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    @click="toggle()"
  >
    <ClientOnly>
      <Sun v-if="isDark" class="h-4 w-4" />
      <Moon v-else class="h-4 w-4" />
      <template #fallback>
        <span class="h-4 w-4" />
      </template>
    </ClientOnly>
  </button>
</template>
