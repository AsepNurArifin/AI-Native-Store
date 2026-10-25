/**
 * Sitemap dinamis: berisi URL storefront yang terindeks
 * (beranda, /chat, halaman rak kategori aktif, halaman produk aktif).
 * Admin dan /login sengaja tidak disertakan (lihat robots.txt).
 * `<lastmod>` membantu crawler memrioritaskan URL yang isinya berubah —
 * per produk memakai `products.updated_at`-nya sendiri, sedangkan beranda
 * dan rak memakai MAX(updated_at) seluruh produk sebagai proksi perubahan.
 * Hallmark stamp: sitemap-004
 */
import { eq, sql } from 'drizzle-orm'
import { products } from '../database/schema'
import { ensureSeeded } from '../utils/business'

export default defineEventHandler(async (event) => {
  const base = process.env.NUXT_PUBLIC_SITE_URL || getRequestURL(event).origin

  const paths = new Set<string>(['/', '/chat'])
  // lastmod per path; default = hari ini (sitemap setidaknya selalu segar).
  const lastmods = new Map<string, string>()
  const today = () => new Date().toISOString().slice(0, 10)

  try {
    // daftar kategori aktif (konvensi sama dengan /api/v1/catalog/categories)
    const db = getDb()
    await ensureSeeded(db)
    const active = await db
      .select({ id: products.id, category: products.category, updatedAt: products.updatedAt })
      .from(products)
      .where(eq(products.status, 'ACTIVE'))
    const cats = await db.execute(
      sql`SELECT DISTINCT category FROM products WHERE status = 'ACTIVE' ORDER BY category`,
    )
    const catRows = ((cats as unknown as Array<{ category: string }>)
      ?? (cats as unknown as { rows?: Array<{ category: string }> })?.rows) ?? []

    // Tanggal W3C date-only dari timestamp produk terbaru.
    let maxUpdated: Date | null = null
    const dateOnly = (d: unknown) => {
      const date = d instanceof Date ? d : new Date(String(d))
      return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
    }

    for (const p of active) {
      const path = `/produk/${p.id}`
      paths.add(path)
      const lm = dateOnly(p.updatedAt)
      if (lm) lastmods.set(path, lm)
      const u = p.updatedAt instanceof Date ? p.updatedAt : null
      if (u && (!maxUpdated || u > maxUpdated)) maxUpdated = u
    }
    const globalLm = maxUpdated ? maxUpdated.toISOString().slice(0, 10) : today()
    for (const c of catRows) lastmods.set(`/rak/${encodeURIComponent(c.category)}`, globalLm)
    lastmods.set('/', globalLm)
    lastmods.set('/chat', globalLm)
  }
  catch (err) {
    // DB belum siap: sitemap statis tetap valid (lastmod = hari ini)
    console.error('[sitemap]', err)
  }

  const urls = [...paths].map((path) => {
    const lm = lastmods.get(path) || today()
    return `  <url>
    <loc>${base}${path === '/' ? '/' : path}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.8'}</priority>
  </url>`
  }).join('\n')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=UTF-8' } },
  )
})
