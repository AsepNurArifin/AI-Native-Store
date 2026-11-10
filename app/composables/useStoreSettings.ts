export interface StoreSettingsOut {
  store_name: string
  owner_name: string
  qris_merchant_name: string
  qris_image_url: string | null
}

export async function useStoreSettings() {
  const config = useRuntimeConfig()
  const base = String(config.public.apiBase || '/api/v1')
  const { data: settings, error, refresh } = await useAsyncData('store-settings', () => $fetch<StoreSettingsOut>(`${base}/settings`), {
    default: () => ({ store_name: 'Toko', owner_name: '', qris_merchant_name: '', qris_image_url: null })
  })
  return { settings, error, refresh }
}
