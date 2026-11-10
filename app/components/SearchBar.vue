<script setup lang="ts">
import { Search } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  autofocus?: boolean
}>(), { modelValue: '', placeholder: 'Cari iPhone, Samsung Galaxy, aksesoris…', autofocus: false })

const emit = defineEmits<{ (e: 'update:modelValue' | 'submit', v: string): void }>()

const inner = ref(props.modelValue)
watch(() => props.modelValue, v => { inner.value = v })

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  inner.value = v
  emit('update:modelValue', v)
}

function onSubmit() {
  emit('submit', inner.value.trim())
}
</script>

<template>
  <form role="search" class="store-search-form flex w-full min-w-0 items-center gap-2" @submit.prevent="onSubmit">
    <div class="relative min-w-0 flex-1">
      <Search aria-hidden="true" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
      <input
        v-model="inner"
        type="search"
        :placeholder="placeholder"
        :autofocus="autofocus"
        aria-label="Cari produk"
        class="h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white pl-9 pr-2 text-base text-stone-900 placeholder:text-stone-500 md:text-sm"
        @input="onInput"
      >
    </div>
    <button
      type="submit"
      class="flex h-11 shrink-0 items-center justify-center rounded-lg bg-promo-400 px-4 text-sm font-bold text-brand-950 transition-colors hover:bg-promo-300"
    >
      Cari
    </button>
  </form>
</template>
