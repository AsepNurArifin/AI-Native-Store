<template>
  <Transition name="spec-modal">
    <div
      v-if="product"
      class="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center"
      @keydown="trapFocus"
    >
      <div class="absolute inset-0 bg-stone-950/45" aria-hidden="true" @click="close" />

      <!-- Panel: boneka dialog mengikuti ConfirmHost (rounded-2xl, shadow batu) — isi beda: spec sheet -->
      <div
        ref="panelRef"
        class="spec-panel relative flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/20 outline-none sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        :aria-label="`Spesifikasi ${product.name}`"
        tabindex="-1"
      >
        <!-- Header: identitas produk (thumbnail transform ?width=160 ikut promo-etiket) -->
        <div class="flex items-start gap-3 border-b border-stone-100 p-4 pr-2">
          <ProductImage
            :image-url="product.image_url"
            :name="product.name"
            :category="product.category"
            size="thumb"
            eager
          />
          <div class="min-w-0 flex-1">
            <h2 class="font-display text-base font-bold leading-snug text-stone-900 [overflow-wrap:anywhere]">
              {{ product.name }}
            </h2>
            <p class="mt-0.5 text-xs text-stone-500">
              <span class="capitalize">{{ product.category }}</span>
              ·
              <s v-if="hasPromo(product)" class="text-stone-400">{{ formatIDR(product.price) }}</s>
              <span class="font-semibold text-stone-800">{{ formatIDR(effectivePrice(product)) }}</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label="Tutup spesifikasi"
            @click="close"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <!-- Body: 2 tingkat — 4 spek unggulan (tile ikon tinted) + sisanya (chip grid) -->
        <div class="max-h-[min(28rem,60vh)] overflow-y-auto p-4">
          <template v-if="heroEntries.length">
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="(entry, i) in heroEntries"
                :key="entry.key"
                class="rounded-xl border border-stone-100 bg-stone-50 p-3"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    :class="tileTints[i % tileTints.length]"
                  >
                    <component :is="tileIcon(entry.key)" class="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span class="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    {{ entry.label }}
                  </span>
                </div>
                <p class="mt-1.5 truncate font-display text-sm font-bold text-stone-900" :title="entry.value">
                  {{ entry.value }}
                </p>
              </div>
            </div>
            <p
              v-if="restEntries.length"
              class="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wide text-stone-400"
            >
              Semua spesifikasi
            </p>
          </template>

          <div v-if="restEntries.length" class="grid gap-1.5 sm:grid-cols-2">
            <div
              v-for="entry in restEntries"
              :key="entry.key"
              class="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5"
              :class="entry.value.length > 44 ? 'sm:col-span-2' : ''"
            >
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-500">{{ entry.label }}</span>
                <span class="min-w-0 text-xs font-semibold text-stone-800 [overflow-wrap:anywhere]">{{ entry.value }}</span>
              </div>
            </div>
          </div>

          <!-- State kosong: jujur + aksi langsung (bukan tabel dengan "Belum tersedia" declutter) -->
          <div
            v-if="!heroEntries.length && !restEntries.length"
            class="flex flex-col items-center gap-2 py-8 text-center"
          >
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <Package class="h-5 w-5" aria-hidden="true" />
            </span>
            <p class="text-sm font-semibold text-stone-700">Spesifikasi belum diisi.</p>
            <p class="max-w-64 text-xs leading-relaxed text-stone-500">
              Tambahkan detail seperti RAM, penyimpanan, dan chipset — chip spek otomatis tampil di baris daftar produk.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
          <Button size="sm" variant="outline" @click="close">Tutup</Button>
          <Button size="sm" @click="edit">
            <Pencil class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Ubah spesifikasi
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/* Hallmark · component: spec sheet modal · theme: Best Buy Marketplace (token stone/brand yang ada)
 * Modal sisi admin — pembaharui tampilan "Lihat spesifikasi" (details + tabel hairline) yang kaku
 * menjadi popup spec sheet ala retail: chip unggulan + chip grid, diikuti identitas produk.
 * states: trigger default/hover/focus/active · modal open/empty · esc & backdrop close
 * motion: fade+scale 130ms, hormat prefers-reduced-motion · ikon: @lucide/vue (tanpa dep baru)
 */
import {
  BatteryCharging, Camera, CircuitBoard, Cog, Cpu, HardDrive, Layers,
  MemoryStick, MonitorSmartphone, Package, Pencil, X,
} from '@lucide/vue'
import { effectivePrice, hasPromo, keySpecs, specEntries } from '~/utils/product'
import { formatIDR } from '~/utils/format'
import type { ProductOut } from '~/utils/api-types'

const props = defineProps<{ product: ProductOut | null }>()
const emit = defineEmits<{ close: [], edit: [product: ProductOut] }>()

const heroEntries = computed(() => keySpecs(props.product?.specification ?? null, 4))
const restEntries = computed(() => {
  const heroKeys = new Set(heroEntries.value.map(entry => entry.key))
  return specEntries(props.product?.specification ?? null).filter(entry => !heroKeys.has(entry.key))
})

/* Ikon per kunci spek (fallback Layers) + rotasi tint 4 warna agar tidak monoton. */
const tileIcons: Record<string, unknown> = {
  ram_gb: MemoryStick, storage_gb: HardDrive, storage: HardDrive,
  chipset: Cpu, prosesor: Cpu, gpu: CircuitBoard,
  layar: MonitorSmartphone, kamera: Camera,
  baterai_mah: BatteryCharging, baterai: BatteryCharging, os: Cog,
}
function tileIcon(key: string) { return tileIcons[key] ?? Layers }
const tileTints = [
  'bg-brand-50 text-brand-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-stone-100 text-stone-700',
]

function close() { emit('close') }
function edit() {
  if (props.product) emit('edit', props.product)
}

/* --- Manajemen fokus (pattern ConfirmHost) --- */
const panelRef = ref<HTMLElement | null>(null)
watch(() => props.product, async (p) => {
  if (!p) return
  await nextTick()
  panelRef.value?.focus()
})

/** Focus trap modal: Tab dikurung di dalam dialog (a11y), Escape menutup. */
function trapFocus(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key !== 'Tab' || !panelRef.value) return
  const focusables = panelRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusables.length) return
  const first = focusables[0] as HTMLElement
  const last = focusables[focusables.length - 1] as HTMLElement
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>

<style scoped>
.spec-modal-enter-active,
.spec-modal-leave-active { transition: opacity 0.13s ease; }
.spec-modal-enter-from,
.spec-modal-leave-to { opacity: 0; }
.spec-panel { transition: transform 0.13s ease; }
.spec-modal-enter-from .spec-panel,
.spec-modal-leave-to .spec-panel { transform: scale(0.97) translateY(4px); }

@media (prefers-reduced-motion: reduce) {
  .spec-modal-enter-active,
  .spec-modal-leave-active,
  .spec-panel { transition: none; }
}
</style>
