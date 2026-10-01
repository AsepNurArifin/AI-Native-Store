/**
 * robots.txt publik — storefront boleh diindeks, halaman internal tidak.
 * Sitemap dinamis dari katalog aktif: /sitemap.xml
 */
export default defineEventHandler((event) => {
  const siteUrl = (useRuntimeConfig().public.siteUrl as string) || 'http://localhost:3000'
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /login',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`
  ].join('\n')
})
