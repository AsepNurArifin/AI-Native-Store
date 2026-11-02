<template>
  <div
    v-if="state"
    class="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center"
  >
    <div class="absolute inset-0 bg-stone-950/45" aria-hidden="true" @click="cancel" />
    <div
      ref="dialogRef"
      class="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl shadow-stone-900/20 outline-none"
      role="dialog"
      aria-modal="true"
      :aria-label="state.title"
      tabindex="-1"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          :class="state.tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'"
        >
          <TriangleAlert v-if="state.tone === 'danger'" class="h-5 w-5" aria-hidden="true" />
          <MessageCircleQuestion v-else class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-display text-base font-bold text-stone-900">{{ state.title }}</h2>
          <p v-if="state.message" class="mt-1 text-sm leading-relaxed text-stone-600">
            {{ state.message }}
          </p>
        </div>
      </div>

      <div v-if="state.mode === 'askText'" class="mt-4">
        <label
          v-if="state.input?.label"
          for="confirm-input"
          class="mb-1 block text-sm font-medium text-stone-700"
        >
          {{ state.input.label }}
        </label>
        <Input
          id="confirm-input"
          v-model="inputValue"
          :placeholder="state.input?.placeholder"
          class="min-h-11 text-base md:text-sm"
          @keydown.enter.prevent="accept"
        />
      </div>

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" class="min-h-11" @click="cancel">{{ state.cancelLabel }}</Button>
        <Button
          v-if="state.alt"
          type="button"
          class="min-h-11"
          :variant="state.alt.tone === 'danger' ? 'ghostDanger' : 'secondary'"
          @click="resolveConfirm('alt')"
        >
          {{ state.alt.label }}
        </Button>
        <Button
          type="button"
          class="min-h-11"
          :variant="state.tone === 'danger' ? 'destructive' : 'default'"
          @click="accept"
        >
          {{ state.confirmLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageCircleQuestion, TriangleAlert } from '@lucide/vue'
import { handleDialogKeydown } from '~/utils/focus'

/**
 * Host dialog konfirmasi. Satu instance di app.vue, dipakai seluruh aplikasi
 * lewat `useConfirm()`. Escape atau klik backdrop membatalkan — perilaku yang
 * sama dengan dialog native yang digantikan, tapi tampilannya ikut bahasa
 * visual panel.
 */
const { state } = useConfirm()
const dialogRef = ref<HTMLElement | null>(null)
const inputValue = ref('')
let opener: HTMLElement | null = null
let mounted = false

watch(state, async (dialog, previous) => {
  inputValue.value = dialog?.input?.value ?? ''
  if (dialog) {
    if (!previous) opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (!mounted || state.value !== dialog) return
    const input = dialogRef.value?.querySelector('input')
    if (input instanceof HTMLInputElement) input.focus()
    else dialogRef.value?.focus()
    return
  }

  const target = opener
  opener = null
  await nextTick()
  if (!mounted || state.value) return
  if (target?.isConnected && target.getClientRects().length && getComputedStyle(target).visibility !== 'hidden') target.focus()
  else document.getElementById('admin-main')?.focus()
})

function onKeydown(event: KeyboardEvent) {
  if (state.value && dialogRef.value) handleDialogKeydown(event, dialogRef.value, cancel)
}
onMounted(() => {
  mounted = true
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  mounted = false
  document.removeEventListener('keydown', onKeydown)
})

function accept() {
  resolveConfirm(state.value?.mode === 'askText' ? inputValue.value : true)
}
function cancel() {
  // `false` (bukan `null`) supaya `ask()` lama yang membandingkan `=== true`
  // tetap dianggap batal.
  resolveConfirm(false)
}
</script>
