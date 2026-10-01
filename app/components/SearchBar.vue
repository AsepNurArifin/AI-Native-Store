<script setup lang="ts">
import { Search } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  autofocus?: boolean
}>(), { modelValue: '', placeholder: 'Cari HP, laptop, aksesoris…', autofocus: false })

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
  <form role="search" class="flex w-full items-center gap-2" @submit.prevent="onSubmit">
    <div class="relative flex-1">
      <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        v-model="inner"
        type="search"
        :placeholder="placeholder"
        :autofocus="autofocus"
        aria-label="Cari produk"
        class="h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/30 focus:outline-hidden"
        @input="onInput"
      />
    </div>
    <!-- Best Buy Yellow Submit Button -->
    <button
      type="submit"
      class="flex h-11 shrink-0 items-center justify-center rounded-xl bg-promo-400 px-5 text-sm font-black text-stone-950 shadow-sm transition-all duration-150 hover:bg-promo-500"
    >
      Cari
    </button>
  </form>
</template>
