<script setup lang="ts">
/* Hallmark · component: specification list · theme: Toko Digital (locked)
 * Read-only data: empty / populated; no new page structure or motion.
 * pre-emit critique: P4 H4 E4 S5 R5 V3
 */
const props = defineProps<{ specification: Record<string, unknown> }>()

const labels: Record<string, string> = {
  brand: 'Merek', chipset: 'Chipset', prosesor: 'Prosesor', ram_gb: 'RAM',
  storage_gb: 'Penyimpanan', storage: 'Media penyimpanan', gpu: 'GPU',
  layar: 'Layar', kamera: 'Kamera', baterai_mah: 'Kapasitas baterai',
  baterai: 'Baterai', os: 'Sistem operasi', berat_kg: 'Berat', ecg: 'ECG',
  koneksi: 'Koneksi', fitur: 'Fitur', tipe: 'Tipe', kompatibel: 'Kompatibilitas',
  form_factor: 'Bentuk', interface: 'Antarmuka', model: 'Model',
}
const units: Record<string, string> = { ram_gb: 'GB', storage_gb: 'GB', baterai_mah: 'mAh', berat_kg: 'kg' }
function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Belum tersedia'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (Array.isArray(value)) return value.map(v => displayValue('', v)).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${displayValue('', v)}`).join('; ')
  return `${value}${typeof value === 'number' && units[key] ? ` ${units[key]}` : ''}`
}
const entries = computed(() => Object.entries(props.specification || {}).map(([key, value]) => ({
  key, label: labels[key] || key.replaceAll('_', ' '), value: displayValue(key, value),
})))
</script>

<template>
  <dl v-if="entries.length" class="min-w-0 space-y-2 text-xs">
    <div v-for="entry in entries" :key="entry.key" class="grid min-w-0 gap-0.5 border-b border-stone-100 pb-1.5">
      <dt class="font-medium text-stone-500">{{ entry.label }}</dt>
      <dd class="min-w-0 whitespace-pre-wrap text-stone-800 [overflow-wrap:anywhere]">{{ entry.value }}</dd>
    </div>
  </dl>
  <p v-else class="text-xs text-stone-500">Spesifikasi belum tersedia di katalog.</p>
</template>
