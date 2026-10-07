<script setup lang="ts">
/*
 * Panel pembayaran QRIS — motif nota (border putus-putus) agar konsisten
 * dengan identitas struk toko. QR = string EMV QRIS simulasi demo.
 */
import QrcodeVue from 'qrcode.vue'
import { buildQrisPayload } from '~/utils/qris'
import { formatIDR } from '~/utils/format'

const props = defineProps<{
  amount: number
  reference: string
}>()

const payload = computed(() => buildQrisPayload({
  amount: props.amount,
  reference: props.reference,
}))
</script>

<template>
  <div class="mx-auto max-w-[240px] space-y-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-4 text-center">
    <div class="space-y-0.5">
      <p class="text-xs font-semibold text-stone-700">
        Pembayaran QRIS
        <span class="ml-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[9px] font-black uppercase text-amber-800">Simulasi</span>
      </p>
      <p class="font-display text-base font-bold text-stone-900">{{ formatIDR(amount) }}</p>
    </div>

    <div class="inline-block rounded-xl border border-stone-200 bg-white p-2.5">
      <QrcodeVue :value="payload" :size="168" level="M" />
    </div>

    <div class="space-y-0.5">
      <div class="flex items-center justify-center gap-1.5">
        <img src="/logo.jpeg" alt="SHAF STORE Logo" class="h-4 w-4 rounded object-contain" />
        <p class="font-display text-xs font-bold tracking-normal text-stone-800">SHAF STORE</p>
      </div>
      <p class="font-mono text-[10px] text-stone-500">Ref: {{ reference.slice(0, 8) }}</p>
      <p class="text-[9px] font-semibold text-amber-700">Simulasi — QR tidak dapat dibayar</p>
    </div>
  </div>
</template>
