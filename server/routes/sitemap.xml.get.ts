/**
 * Sitemap dinamis: berisi URL storefront yang terindeks
 * (beranda, /chat, halaman rak kategori aktif, halaman produk aktif).
 * Admin dan /login sengaja tidak disertakan (lihat robots.txt).
 * Hallmark stamp: sitemap-004
 */
import { eq, sql } from 'drizzle-orm'
import { products } from '../database/schema'
import { ensureSeeded } from '../utils/business'

export default defineEventHandler(async (event) => {
  const base = process.env.NUXT_PUBLIC_SITE_URL || getRequestURL(event).origin

  const paths = new Set<string>(['/', '/chat'])

  try {
    // daftar kategori aktif (konvensi sama dengan /api/v1/catalog/categories)
    const db = getDb()
    await ensureSeeded(db)
    const active = await db
      .select({ id: products.id, category: products.category })
      .from(products)
      .where(eq(products.status, 'ACTIVE'))
    const cats = await db.execute(
      sql`SELECT DISTINCT category FROM products WHERE status = 'ACTIVE' ORDER BY category`,
    )
    const catRows = ((cats as unknown as Array<{ category: string }>)
      ?? (cats as unknown as { rows?: Array<{ category: string }> })?.rows) ?? []

    for (const c of catRows) paths.add(`/rak/${encodeURIComponent(c.category)}`)
    for (const p of active) paths.add(`/produk/${p.id}`)
  }
  catch (err) {
    // DB belum siap: sitemap statis tetap valid
    console.error('[sitemap]', err)
  }

  const urls = [...paths].map(path => `  <url>
    <loc>${base}${path === '/' ? '/' : path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=UTF-8' } },
  )
})
