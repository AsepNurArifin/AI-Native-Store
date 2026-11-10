<script setup lang="ts">
const route = useRoute()
useHead({ meta: [{ name: 'theme-color', content: '#091a2d' }] })
const { data: categories, pending, error, refresh } = await useStoreCategories()
const headerHeight = ref<number | null>(null)
onMounted(async () => {
  await nextTick()
  if (['#promo', '#katalog', '#cara-belanja'].includes(route.hash)) document.getElementById(route.hash.slice(1))?.scrollIntoView()
})
</script>

<template>
  <div class="storefront-shell" :style="headerHeight === null ? undefined : { '--store-header-height': `${headerHeight}px` }">
    <StoreHeader @height="headerHeight = $event" />
    <CategoryNav :categories="categories ?? []" :pending="pending" :error="!!error" @retry="refresh()" />
    <main class="store-container store-main"><slot /></main>
    <MarketplaceFooter :categories="categories ?? []" />
  </div>
</template>
