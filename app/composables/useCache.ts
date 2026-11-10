import type { AsyncDataOptions, NuxtApp } from '#app'

/** Reuse data on navigation; explicit refreshes must still reach the API. */
export function useCache() {
  return {
    getCachedData: (key: string, nuxtApp: NuxtApp, context: Parameters<NonNullable<AsyncDataOptions<unknown>['getCachedData']>>[2]) => {
      if (context.cause !== 'initial') return undefined
      return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    }
  }
}
