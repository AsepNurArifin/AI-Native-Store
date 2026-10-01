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
  <div class="mt-3 flex items-center justify-between gap-2">
    <p class="text-xs text-stone-500">Halaman {{ page }}</p>
    <div class="flex gap-2">
      <Button size="sm" variant="outline" :disabled="page <= 1 || loading" @click="$emit('prev')">← Sebelumnya</Button>
      <Button size="sm" variant="outline" :disabled="!hasNext || loading" @click="$emit('next')">Berikutnya →</Button>
    </div>
  </div>
</template>
