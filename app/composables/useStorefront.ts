import type { Ref } from 'vue'
import type { ProductOut } from '~/utils/api-types'
import { storefrontCategories } from '~/utils/storefront'

export function useStoreCategories() {
  const config = useRuntimeConfig()
  const base = (config.public.apiBase as string) || '/api/v1'
  const { getCachedData } = useCache()
  const { data, status, error, refresh } = useAsyncData('layout-categories', async () => {
    return storefrontCategories(await $fetch<string[]>(`${base}/catalog/categories`))
  }, { server: false, lazy: true, immediate: false, dedupe: 'defer', getCachedData, default: () => [] as string[] })
  const pending = computed(() => status.value === 'idle' || status.value === 'pending')
  return { data, status, pending, error, refresh }
}

/** One clock per page owner, shared by all product views and promo end dates. */
export function useStorefrontClock(products: Ref<ProductOut[]>, refresh: () => Promise<unknown>) {
  const route = useRoute()
  const initial = useState<number>(`storefront-time:${route.path}`, () => Date.now())
  const now = ref(initial.value)
  const mounted = ref(false)
  const refreshError = ref('')
  const expired = new Set<string>()
  let timer: ReturnType<typeof setInterval> | undefined
  let refreshFlight: Promise<void> | null = null

  async function refreshExpired() {
    if (refreshFlight) return refreshFlight
    refreshError.value = ''
    refreshFlight = (async () => {
      try { await refresh() }
      catch { refreshError.value = 'Promo telah berakhir, tetapi data terbaru belum bisa dimuat. Coba muat ulang.' }
      finally { refreshFlight = null }
    })()
    await refreshFlight
  }

  function tick() {
    now.value = Date.now()
    let changed = false
    for (const product of products.value) {
      const date = product.promotion?.end_date
      if (!date) continue
      const end = Date.parse(date)
      const key = `${product.id}:${date}`
      if (Number.isFinite(end) && end <= now.value && !expired.has(key)) {
        expired.add(key)
        changed = true
      }
    }
    if (changed) void refreshExpired()
  }

  onMounted(() => {
    mounted.value = true
    tick()
    timer = setInterval(tick, 1000)
  })
  onUnmounted(() => { clearInterval(timer) })
  return { now, mounted, refreshError, refreshExpired }
}
