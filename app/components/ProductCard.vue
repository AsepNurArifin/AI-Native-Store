<script setup lang="ts">
import { MessageCircle, ShoppingCart, CheckCircle2, Zap } from '@lucide/vue'
import { formatIDR } from '~/utils/format'
import { effectivePrice, hasPromo, keySpecs } from '~/utils/product'
import type { ProductOut } from '~/utils/api-types'

const props = defineProps<{ product: ProductOut }>()

const finalPrice = computed(() => effectivePrice(props.product))
const promo = computed(() => hasPromo(props.product))
const soldOut = computed(() => props.product.current_stock <= 0)
const lowStock = computed(() => !soldOut.value && props.product.is_low_stock)

const specs = computed(() => keySpecs(props.product.specification, 3))
</script>

<template>
  <div class="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-700 hover:shadow-md max-[320px]:min-w-0 max-[320px]:[overflow-wrap:anywhere]">
    <!-- Gambar + Best Buy Savings Badge -->
    <NuxtLink :to="`/produk/${product.id}`" class="block" :aria-label="`Lihat ${product.name}`">
      <div class="relative overflow-hidden bg-white p-2">
        <ProductImage :image-url="product.image_url" :name="product.name" :category="product.category" />

        <!-- Best Buy Savings Tag (Red/Yellow Pill) -->
        <span
          v-if="promo"
          class="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-promo-600 px-2 py-0.5 text-[11px] font-black uppercase text-white shadow-xs"
        >
          <Zap class="h-3 w-3 fill-promo-400 text-promo-400" />
          HEMAT {{ Math.round(product.discount_percentage || 0) }}%
        </span>

        <span
          v-if="soldOut"
          class="absolute inset-x-0 bottom-0 bg-stone-900/80 py-1 text-center text-[11px] font-bold text-white backdrop-blur-xs"
        >
          Stok habis
        </span>
      </div>
    </NuxtLink>

    <div class="flex flex-1 flex-col p-2.5 sm:p-4">
      <!-- Kategori + badge promo (tanpa rating palsu) -->
      <div class="flex items-center justify-between gap-1 text-[11px] max-[320px]:flex-wrap">
        <span class="font-extrabold uppercase tracking-wider text-brand-700">{{ product.category }}</span>
        <span v-if="promo" class="font-extrabold text-promo-600">-{{ Math.round(product.discount_percentage || 0) }}%</span>
      </div>

      <!-- Judul Produk (Best Buy Format: 2 line clamp) -->
      <NuxtLink :to="`/produk/${product.id}`" class="mt-1.5 line-clamp-2 min-h-10 text-sm font-bold leading-snug text-stone-900 transition-colors group-hover:text-brand-700 max-[320px]:line-clamp-none">
        {{ product.name }}
      </NuxtLink>

      <!-- Spec Chips -->
      <div v-if="specs.length" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="spec in specs"
          :key="spec.key"
          class="inline-block max-w-full rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-700 [overflow-wrap:anywhere]"
        >
          {{ spec.label }} {{ spec.value }}
        </span>
      </div>

      <div class="mt-auto pt-3">
        <!-- Blok Harga Best Buy Style -->
        <div class="space-y-0.5">
          <p v-if="promo" class="text-[11px] font-semibold text-stone-400 line-through">
            {{ formatIDR(product.price) }}
          </p>
          <div class="flex items-baseline gap-1.5">
            <p class="font-display text-base font-black tabular-nums min-[400px]:text-lg sm:text-xl max-[320px]:min-w-0" :class="promo ? 'text-promo-600' : 'text-stone-900'">
              {{ formatIDR(finalPrice) }}
            </p>
          </div>
        </div>

        <!-- Ketersediaan stok -->
        <div class="mt-2 flex items-center gap-1.5 text-[11px] font-bold">
          <CheckCircle2 class="h-3.5 w-3.5 shrink-0" :class="soldOut ? 'text-stone-400' : 'text-emerald-600'" />
          <span :class="soldOut ? 'text-stone-400' : 'text-emerald-700'">
            <template v-if="soldOut">Stok habis</template>
            <template v-else-if="lowStock">Sisa {{ product.current_stock }} unit</template>
            <template v-else>Stok tersedia: {{ product.current_stock }} unit</template>
          </span>
        </div>

        <!-- Detail produk dan checkout atau pertanyaan stok -->
        <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Button size="sm" variant="outline" :to="`/produk/${product.id}`" :aria-label="`Lihat detail ${product.name}`" class="min-h-11 min-w-0 gap-1 border-stone-300 px-2 text-xs font-bold max-[320px]:h-auto max-[320px]:flex-wrap max-[320px]:whitespace-normal">
            Detail
          </Button>
          <Button
            :to="soldOut ? `/chat?tanya=${encodeURIComponent(`Kapan ${product.name} restock?`)}` : `/checkout?item=${product.id}`"
            :aria-label="soldOut ? `Tanya stok ${product.name}` : `Pesan ${product.name}`"
            size="sm"
            variant="ai"
            class="min-h-11 min-w-0 gap-1 px-2 text-xs max-[320px]:h-auto max-[320px]:flex-wrap max-[320px]:whitespace-normal"
          >
            <MessageCircle v-if="soldOut" class="h-3.5 w-3.5 fill-stone-950" />
            <ShoppingCart v-else class="h-3.5 w-3.5" />
            {{ soldOut ? 'Tanya' : 'Pesan' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
