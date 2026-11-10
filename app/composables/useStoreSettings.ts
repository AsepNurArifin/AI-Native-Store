export interface StoreSettingsOut {
  store_name: string
  owner_name: string
  qris_merchant_name: string
  qris_image_url: string | null
}

export function useStoreSettings() {
  const config = useRuntimeConfig()
  const base = String(config.public.apiBase || '/api/v1')
  const { getCachedData } = useCache()
  const { data: settings, status, error, refresh } = useAsyncData('store-settings', () => $fetch<StoreSettingsOut>(`${base}/settings`), {
    server: false,
    lazy: true,
    immediate: false,
    dedupe: 'defer',
    getCachedData,
    default: () => ({ store_name: 'Toko', owner_name: '', qris_merchant_name: '', qris_image_url: null })
  })
  const pending = computed(() => status.value === 'idle' || status.value === 'pending')
  return { settings, status, pending, error, refresh }
}
