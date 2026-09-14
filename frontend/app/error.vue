<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error.statusCode === 404)
/** Detail teknis ditampilkan apa adanya; pesan utama tetap berbahasa manusia. */
const detail = computed(() => props.error.message || 'Tidak ada detail tambahan.')

useHead({ title: computed(() => `Kesalahan ${props.error.statusCode} · Toko Bu Ratna`) })

function goHome() {
  clearError({ redirect: '/' })
}
function reload() {
  window.location.reload()
}
</script>

<template>
  <NuxtLayout>
    <section class="mx-auto max-w-lg space-y-6 py-16 text-center sm:py-24">
      <p class="text-sm font-medium text-stone-500">Kesalahan {{ error.statusCode }}</p>
      <h1 class="font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">
        {{ is404 ? 'Halaman tidak ditemukan' : 'Ada yang tidak beres' }}
      </h1>
      <p class="mx-auto max-w-md text-base leading-relaxed text-stone-600">
        {{ is404
          ? 'Alamat yang kamu tuju tidak ada di toko ini. Mungkin salah ketik, atau halamannya sudah dipindah.'
          : 'Terjadi kesalahan tak terduga. Coba muat ulang; bila tetap gagal, kembali ke halaman depan toko.' }}
      </p>

      <!-- Nota kesalahan: motif struk toko dengan garis putus-putus -->
      <div class="mx-auto max-w-xs rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-left text-sm text-stone-600">
        <div class="flex items-baseline justify-between border-b border-dashed border-stone-200 pb-2">
          <span class="font-semibold text-stone-800">Nota Kesalahan</span>
          <span class="font-mono text-xs">#{{ error.statusCode }}</span>
        </div>
        <p class="break-words pt-2 font-mono text-xs leading-relaxed text-stone-500">{{ detail }}</p>
        <p class="border-t border-dashed border-stone-200 pt-2 text-xs text-stone-500">
          Terima kasih sudah berbelanja di sini.
        </p>
      </div>

      <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" variant="ai" @click="goHome">
          Kembali ke Toko
        </Button>
        <Button v-if="!is404" size="lg" variant="outline" @click="reload">
          Muat Ulang
        </Button>
      </div>
    </section>
  </NuxtLayout>
</template>
