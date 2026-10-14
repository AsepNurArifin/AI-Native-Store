<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:justify-end sm:px-0 sm:pb-0"
    role="region"
    aria-label="Notifikasi"
  >
    <TransitionGroup
      tag="div"
      name="toast"
      class="flex w-full max-w-[26rem] flex-col gap-2 sm:w-[26rem]"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto relative overflow-hidden rounded-xl border bg-white/95 shadow-lg shadow-stone-900/10 backdrop-blur"
        :class="tones[t.variant].border"
        :role="t.variant === 'error' ? 'alert' : 'status'"
        :aria-live="t.variant === 'error' ? 'assertive' : 'polite'"
      >
        <div class="flex items-start gap-2.5 p-3">
          <span class="mt-0.5 shrink-0" :class="tones[t.variant].icon">
            <CircleCheck v-if="t.variant === 'success'" class="h-5 w-5" aria-hidden="true" />
            <CircleAlert v-else-if="t.variant === 'error'" class="h-5 w-5" aria-hidden="true" />
            <TriangleAlert v-else-if="t.variant === 'warning'" class="h-5 w-5" aria-hidden="true" />
            <Info v-else class="h-5 w-5" aria-hidden="true" />
          </span>
          <p class="min-w-0 flex-1 text-sm leading-snug text-stone-800 [overflow-wrap:anywhere]">
            {{ t.message }}
          </p>
          <button
            type="button"
            class="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Tutup notifikasi"
            @click="dismiss(t.id)"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <!-- Batang waktu: sisa durasi kelihatan, jadi pengguna tidak perlu
             menebak kapan toast ini hilang sendiri. -->
        <span
          class="toast-timer block h-0.5 w-full origin-left"
          :class="tones[t.variant].bar"
          :style="{ animationDuration: `${t.duration}ms` }"
          aria-hidden="true"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from '@lucide/vue'
import type { ToastVariant } from '~/composables/useToast'

/**
 * Host notifikasi global. Dipasang sekali di app.vue supaya notifikasi dari
 * halaman mana pun (termasuk /login yang memakai `layout: false`) muncul di
 * atas layout yang sedang aktif.
 */
const { toasts, dismiss } = useToast()

const tones: Record<ToastVariant, { border: string, icon: string, bar: string }> = {
  success: { border: 'border-emerald-200', icon: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { border: 'border-rose-200', icon: 'text-rose-600', bar: 'bg-rose-500' },
  warning: { border: 'border-amber-200', icon: 'text-amber-600', bar: 'bg-amber-500' },
  info: { border: 'border-stone-200', icon: 'text-brand-700', bar: 'bg-brand-700' }
}

/**
 * Auto-dismiss satu timer per toast, dikunci di daftar id yang sedang tampil
 * supaya toast yang DIGANTI (pesan sama diulang) dapat timer baru, dan timer
 * yang sudah tidak berlaku ikut dibuang.
 */
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function syncTimers(list: { id: number, duration: number }[]) {
  const live = new Set(list.map(t => t.id))
  for (const [id, handle] of timers) {
    if (!live.has(id)) { clearTimeout(handle); timers.delete(id) }
  }
  for (const t of list) {
    if (timers.has(t.id)) continue
    timers.set(t.id, setTimeout(() => { timers.delete(t.id); dismiss(t.id) }, t.duration))
  }
}

watch(toasts, list => syncTimers(list), { immediate: true, deep: true })
onUnmounted(() => {
  for (const handle of timers.values()) clearTimeout(handle)
  timers.clear()
})
</script>

<style scoped>
/* Toast masuk naik sedikit dari bawah, keluar mengikuti arah yang sama. */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
.toast-move {
  transition: transform 180ms ease;
}

.toast-timer {
  animation-name: toast-drain;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes toast-drain {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: none;
  }
  .toast-timer {
    animation: none;
  }
}
</style>
