<script setup lang="ts">
const route = useRoute()
const { settings, status: settingsStatus, refresh: refreshSettings } = useStoreSettings()
// One owner starts settings after the entire shell has hydrated.
onNuxtReady(() => {
  if (settingsStatus.value === 'idle') void refreshSettings({ cause: 'initial' })
})
useSeoMeta({ ogSiteName: () => settings.value.store_name })
const storefront = computed(() => route.meta.layout === 'default')
const operator = computed(() => route.meta.layout === 'admin' || route.path === '/login')
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <div :class="storefront ? 'storefront-feedback' : operator ? 'admin-feedback' : undefined" style="display: contents">
    <ToastHost />
    <ConfirmHost />
  </div>
</template>
