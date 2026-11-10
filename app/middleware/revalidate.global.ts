export default defineNuxtRouteMiddleware((to, from) => {
  // Setelah area yang memutasi data (admin/chat/checkout), revalidate data
  // publik di background supaya stok/harga tidak basi di sesi ini.
  if (import.meta.client
    && /^\/(admin|chat|checkout)\b/.test(from.path)
    && !/^\/(admin|chat|checkout)\b/.test(to.path)) {
    const publicKeys = Object.keys(useNuxtApp().payload.data).filter(key =>
      key === 'layout-categories' || key === 'mkt-promos' || /^(mkt-catalog:|rak:|produk-|checkout-)/.test(key)
    )
    void refreshNuxtData(publicKeys)
  }
})
