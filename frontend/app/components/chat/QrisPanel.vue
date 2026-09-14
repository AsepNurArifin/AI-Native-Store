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
      <p class="text-xs font-semibold text-stone-700">Pembayaran QRIS</p>
      <p class="font-display text-base font-bold text-stone-900">{{ formatIDR(amount) }}</p>
    </div>

    <div class="inline-block rounded-xl border border-stone-200 bg-white p-2.5">
      <QrcodeVue :value="payload" :size="168" level="M" />
    </div>

    <div class="space-y-0.5">
      <p class="font-display text-xs font-bold tracking-normal text-stone-800">TOKO BU RATNA</p>
      <p class="font-mono text-[10px] text-stone-500">Ref: {{ reference.slice(0, 8) }}</p>
    </div>

    <p class="text-[10px] leading-relaxed text-amber-700">
      QRIS simulasi demo: nominal &amp; merchant tidak terdaftar, tidak dapat dibayar.
    </p>
  </div>
</template>
