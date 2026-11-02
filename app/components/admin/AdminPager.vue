<script setup lang="ts">
/**
 * Pager shared halaman admin (Prev/Next + nomor halaman).
 * Tanpa total dari server: halaman berikutnya dianggap ada bila halaman ini penuh.
 */
const props = withDefaults(defineProps<{
  page: number
  count: number
  pageSize: number
  loading?: boolean
}>(), { loading: false })
defineEmits<{ prev: [], next: [] }>()
const hasNext = computed(() => props.count >= props.pageSize)
</script>

<template>
  <div class="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-xs text-stone-500">Halaman {{ page }}</p>
    <div class="grid grid-cols-2 gap-2 sm:flex">
      <Button size="sm" variant="outline" class="min-h-11 px-2 sm:min-h-8" :disabled="page <= 1 || loading" @click="$emit('prev')">← Sebelumnya</Button>
      <Button size="sm" variant="outline" class="min-h-11 px-2 sm:min-h-8" :disabled="!hasNext || loading" @click="$emit('next')">Berikutnya →</Button>
    </div>
  </div>
</template>
