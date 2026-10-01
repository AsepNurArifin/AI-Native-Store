export default defineNuxtRouteMiddleware((to, from) => {
  // Setelah area yang memutasi data (admin/chat/checkout), revalidate data
  // publik di background supaya stok/harga tidak basi di sesi ini.
  if (import.meta.client
    && /^\/(admin|chat|checkout)\b/.test(from.path)
    && !/^\/(admin|chat|checkout)\b/.test(to.path)) {
    void refreshNuxtData()
  }
})
