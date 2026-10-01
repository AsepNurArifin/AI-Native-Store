import { randomUUID } from 'node:crypto'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import {
  conversationMessages, conversations, conversations as convTable, customers,
  inventoryTransactions, orderItems, orders, products, promotions
} from '../database/schema'
import { ACTION_TOOLS, ANALYST_TOOLS, ANALYST_SYSTEM, PRODUCT_TOOLS, SALES_SYSTEM, actionSystem, llmComplete } from './llm'
import { activePromotionFor, currentStock, ensureSeeded, num, stockSummary, withStock } from './business'
import { getSummary, putForConversation, getForConversation, popForConversation, type OrderSummary } from './summary'

// ---------- Tool executor (10 tools, tanpa mutasi berat) ----------
export async function toolCall(db: ReturnType<typeof getDb>, name: string, args: Record<string, unknown>): Promise<unknown> {
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 5)
  await ensureSeeded(db)
  if (name === 'search_products') {
    const q = String(args.query || '')
    const category = args.category ? String(args.category) : null
    const budgetMax = args.budget_max ? Number(args.budget_max) : null
    const limit = Math.min(Number(args.limit || 5), 20)
    let rows = await db.select().from(products).where(eq(products.status, 'ACTIVE')).limit(200)
    if (category) rows = rows.filter(r => r.category.toLowerCase() === category.toLowerCase())
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(needle) || JSON.stringify(r.specification).toLowerCase().includes(needle))
    }
    if (budgetMax) rows = rows.filter(r => num(r.price) <= budgetMax)
    if (args.stock_only) {
      const kept = []
      for (const r of rows) {
        const s = await currentStock(db, String(r.id))
        if (s > 0) kept.push(r)
      }
      rows = kept
    }
    const out = []
    for (const r of rows.slice(0, limit)) out.push(await withStock(db, r, lowDefault))
    return out
  }
  if (name === 'get_product') {
    const id = String(args.product_id || '')
    if (!isUuid(id)) return { error: 'NOT_FOUND' }
    const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
    if (!rows[0]) return { error: 'NOT_FOUND' }
    return await withStock(db, rows[0], lowDefault)
  }
  if (name === 'get_stock') {
    const id = String(args.product_id || '')
    if (!isUuid(id)) return { error: 'NOT_FOUND', product_id: id }
    const stock = await currentStock(db, id)
    return { product_id: id, current_stock: stock }
  }
  if (name === 'compare_products') {
    const ids = ((args.product_ids as string[]) || []).filter(isUuid)
    const out = []
    for (const id of ids.slice(0, 5)) {
      const rows = await db.select().from(products).where(eq(products.id, id as never)).limit(1)
      if (rows[0]) out.push(await withStock(db, rows[0], lowDefault))
    }
    return out
  }
  if (name === 'build_order_summary') {
    const items = (args.items as Array<{ product_id: string, quantity: number }>) || []
    if (!items.length || items.length > 50) return { error: 'INVALID_ITEMS', message: 'Items 1-50' }
    const lines: OrderSummary['items'] = []
    const errs: string[] = []
    let total = 0
    for (const it of items.slice(0, 50)) {
      if (!isUuid(it.product_id)) {
        errs.push(`Produk ${it.product_id} tidak ditemukan`)
        continue
      }
      const rows = await db.select().from(products).where(eq(products.id, it.product_id as never)).limit(1)
      const p = rows[0]
      if (!p) {
        errs.push(`Produk ${it.product_id} tidak ditemukan`)
        continue
      }
      if (p.status !== 'ACTIVE') {
        errs.push(`${p.name} tidak aktif`)
        continue
      }
      const stock = await currentStock(db, String(p.id))
      if (stock < it.quantity) {
        errs.push(`Stok ${p.name} hanya ${stock}`)
        continue
      }
      const promo = await activePromotionFor(db, String(p.id))
      let discount = 0
      if (promo) discount = Math.round((num(p.price) * num(promo.discountPercentage) / 100) * 100) / 100
      const unitEff = Math.max(num(p.price) - discount, 0)
      const lineTotal = Math.round(unitEff * it.quantity * 100) / 100
      total += lineTotal
      lines.push({ product_id: String(p.id), name: p.name, quantity: it.quantity, unit_price: num(p.price), discount, line_total: lineTotal })
    }
    if (!lines.length) return { error: 'NO_VALID_ITEMS', message: errs.slice(0, 5).join('; ') }
    const summary: OrderSummary = { summary_ref: randomUUID().replace(/-/g, ''), items: lines, total: Math.round(total * 100) / 100 }
    const { putSummary } = await import('./summary')
    putSummary(summary)
    return { summary, warnings: errs.slice(0, 5) }
  }
  if (name === 'analyze_sales') {
    const from = args.from_date ? new Date(String(args.from_date)) : new Date(Date.now() - 30 * 864e5)
    const to = args.to_date ? new Date(String(args.to_date)) : new Date()
    const groupBy = String(args.group_by || 'product')
    const top = Number(args.top || 10)
    const allOrders = await db.select().from(orders)
    const inRange = allOrders.filter(o => {
      const c = new Date(o.createdAt as unknown as string)
      return c >= from && c < to && (o.status === 'CONFIRMED' || o.status === 'COMPLETED')
    })
    const agg = new Map<string, { units: number, revenue: number }>()
    const names: Record<string, string> = {}
    for (const o of inRange) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
      for (const it of items) {
        let key = String(it.productId)
        if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
          const d = new Date(o.createdAt as unknown as string)
          key = groupBy === 'day' ? d.toISOString().slice(0, 10) : groupBy === 'month' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10)
        }
        else if (groupBy === 'channel') key = o.channelOrigin
        const cur = agg.get(key) || { units: 0, revenue: 0 }
        cur.units += it.quantity
        cur.revenue += num(it.lineTotal)
        agg.set(key, cur)
        if (groupBy === 'product' && !names[key]) {
          const pr = await db.select().from(products).where(eq(products.id, it.productId)).limit(1)
          if (pr[0]) names[key] = pr[0].name
        }
      }
    }
    let data = [...agg.entries()].map(([key, v]) => ({ key, units: v.units, revenue: Math.round(v.revenue * 100) / 100 }))
    data.sort((a, b) => b.units - a.units)
    if (groupBy === 'product') data = data.slice(0, top)
    return { period: { from: from.toISOString(), to: to.toISOString() }, group_by: groupBy, data, product_names: names }
  }
  if (name === 'analyze_inventory') {
    const threshold = Number(args.threshold_days ?? useRuntimeConfig().stockoutRiskDays ?? 7)
    const all = await db.select().from(products)
    const since = new Date(Date.now() - 30 * 864e5)
    const txs = await db.execute(sql`SELECT product_id, quantity FROM inventory_transactions WHERE movement = 'OUT' AND timestamp >= ${since.toISOString()}::timestamptz`)
    const sold = new Map<string, number>()
    const list = (txs as unknown as Array<{ product_id: string, quantity: number }>) ?? (txs as unknown as { rows?: Array<{ product_id: string, quantity: number }> })?.rows ?? []
    for (const t of list) sold.set(String(t.product_id), (sold.get(String(t.product_id)) || 0) + Number(t.quantity))
    const out = []
    for (const p of all) {
      const stock = await currentStock(db, String(p.id))
      const avg = (sold.get(String(p.id)) || 0) / 30
      const est = avg > 0 ? stock / avg : Number.POSITIVE_INFINITY
      out.push({
        product_id: String(p.id), name: p.name, category: p.category, current_stock: stock,
        avg_daily_sales_30d: Math.round(avg * 100) / 100,
        estimated_days_left: Number.isFinite(est) ? String(Math.round(est * 10) / 10) : 'N/A',
        stockout_risk: Number.isFinite(est) ? est <= threshold : false
      })
    }
    out.sort((a, b) => {
      const av = a.estimated_days_left === 'N/A' ? Infinity : Number(a.estimated_days_left)
      const bv = b.estimated_days_left === 'N/A' ? Infinity : Number(b.estimated_days_left)
      return av - bv
    })
    return { threshold_days: threshold, data: out }
  }
  if (name === 'channel_distribution') {
    const from = args.from_date ? new Date(String(args.from_date)) : new Date(Date.now() - 30 * 864e5)
    const to = args.to_date ? new Date(String(args.to_date)) : new Date()
    const allOrders = await db.select().from(orders)
    const inRange = allOrders.filter(o => {
      const c = new Date(o.createdAt as unknown as string)
      return c >= from && c < to
    })
    const by = new Map<string, number>()
    for (const o of inRange) by.set(o.channelOrigin, (by.get(o.channelOrigin) || 0) + 1)
    const total = inRange.length
    return {
      period: { from: from.toISOString(), to: to.toISOString() }, total_orders: total,
      by_channel: [...by.entries()].map(([channel, n]) => ({ channel, orders: n, percent: total ? Math.round((n / total) * 1000) / 10 : 0 }))
    }
  }
  if (name === 'create_promotion_draft') {
    return { draft: { action_type: 'CREATE_PROMOTION', payload: { product_id: args.product_id, discount_percentage: args.discount_percentage, start_date: args.start_date, end_date: args.end_date } } }
  }
  if (name === 'create_stock_adjustment_draft') {
    return { draft: { action_type: 'ADJUST_STOCK', payload: { product_id: args.product_id, movement: args.movement, quantity: args.quantity } } }
  }
  return { error: 'UNKNOWN_TOOL' }
}

// ---------- Sales agent (rule-based fallback + LLM tool loop) ----------
function extractBudget(text: string): number | null {
  const m = text.replace(/\./g, '').match(/(\d[\d\s]*)\s*(juta|jt|m|ribu|rb|k)?/i)
  if (!m) return null
  let n = Number(m[1].replace(/\s/g, ''))
  const unit = (m[2] || '').toLowerCase()
  if (unit.startsWith('juta') || unit === 'jt' || unit === 'm') n *= 1_000_000
  else if (unit.startsWith('ribu') || unit === 'rb' || unit === 'k') n *= 1000
  return n > 0 ? n : null
}

function detectCategory(text: string): string | null {
  const t = text.toLowerCase()
  if (/laptop|notebook|macbook|rog|ideapad|thinkpad/.test(t)) return 'Laptop'
  if (/hp|handphone|iphone|samsung|xiaomi|redmi|smartphone|android/.test(t)) return 'HP'
  if (/tablet|ipad|pad/.test(t)) return 'Tablet'
  if (/aksesori|aksesoris|mouse|keyboard|ssd|powerbank|airpods|charger|headset|tws/.test(t)) return 'Aksesoris'
  return null
}

const BUY_INTENT = /beli|mau|pesan|order|ambil|checkout|bungkus/i

/**
 * Sales agent: tanya-jawab produk/stok.
 * `allowOrder: false` (channel WEB) -> chat murni konsultasi; niat beli diarahkan
 * ke checkout langsung (tombol Pesan/Beli), tidak ada ringkasan pesanan otomatis.
 */
export async function salesHandleMessage(db: ReturnType<typeof getDb>, conversationId: string, content: string, opts: { allowOrder?: boolean } = {}) {
  const allowOrder = opts.allowOrder !== false
  const lowDefault = Number(useRuntimeConfig().lowStockDefault ?? 5)
  await ensureSeeded(db)
  // Simpan pesan customer
  await db.insert(conversationMessages).values({ conversationId: conversationId as never, sender: 'CUSTOMER', content, messageType: 'TEXT' })
  await db.update(convTable).set({ lastActivityAt: new Date() as never, outcome: 'OPEN' }).where(eq(convTable.id, conversationId as never))
  const history = await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, conversationId as never)).orderBy(desc(conversationMessages.timestamp)).limit(12)

  // Coba LLM tool loop (max 3 iterasi)
  const provider = String(useRuntimeConfig().llmProvider || process.env.LLM_PROVIDER || 'mock')
  let summary: OrderSummary | null = null
  let productsOut: Awaited<ReturnType<typeof withStock>>[] = []
  let replyText = ''

  if (provider !== 'mock') {
    try {
      // Chat web: tanya-jawab saja — instruksi tambahan menonaktifkan penawaran order.
      const webQaOnly = '\nMode chat web: hanya tanya-jawab. Pembelian dilakukan lewat checkout langsung (tombol Pesan / Beli sekarang di halaman produk). Jangan pernah menawarkan ringkasan pesanan atau tombol konfirmasi; arahkan user ke tombol Pesan / Beli sekarang.'
      const messages = [
        { role: 'system', content: allowOrder ? SALES_SYSTEM : SALES_SYSTEM + webQaOnly },
        ...[...history].reverse().slice(-8).map(m => ({ role: m.sender === 'CUSTOMER' ? 'user' : 'assistant', content: String(m.content) })),
        { role: 'user', content }
      ]
      let lastResults: Array<{ id: string, result: unknown }> = []
      for (let i = 0; i < 3; i++) {
        const tools = allowOrder ? PRODUCT_TOOLS : PRODUCT_TOOLS.filter(t => t.name !== 'build_order_summary')
        const r = await llmComplete('sales', messages, tools)
        for (const tc of r.toolCalls) {
          const result = await toolCall(db, tc.name, tc.arguments)
          lastResults.push({ id: tc.id, result })
          if (allowOrder && tc.name === 'build_order_summary' && (result as { summary?: OrderSummary })?.summary) {
            summary = (result as { summary: OrderSummary }).summary
          }
          if (tc.name === 'search_products' && Array.isArray(result)) {
            productsOut = (result as typeof productsOut).slice(0, 5)
          }
        }
        if (!r.toolCalls.length) {
          replyText = r.text || ''
          break
        }
        messages.push({ role: 'assistant', content: r.text || '(tool calls)' })
        for (const lr of lastResults) messages.push({ role: 'user', content: `Tool ${lr.id}: ${JSON.stringify(lr.result).slice(0, 4000)}` })
        lastResults = []
        if (r.text && summary) {
          replyText = r.text
          break
        }
      }
    }
    catch {
      // jatuh ke rule-based
    }
  }

  // Rule-based fallback (mock / LLM gagal)
  if (!replyText) {
    const budget = extractBudget(content)
    const category = detectCategory(content)
    const qtyMatch = content.match(/(\d+)\s*(unit|pcs|buah|ekor)?/i)
    const all = await db.select().from(products).where(eq(products.status, 'ACTIVE')).limit(200)
    let cands = all
    if (category) cands = cands.filter(p => p.category.toLowerCase() === category.toLowerCase())
    const needle = content.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/berapa|stok|ada|yang|untuk|dengan|budget|juta|ribu|rp|harga/.test(w))
    const scored = cands.map(p => {
      const hay = `${p.name} ${p.category} ${JSON.stringify(p.specification)}`.toLowerCase()
      let score = 0
      for (const w of needle) if (hay.includes(w)) score += 2
      if (budget && num(p.price) <= budget) score += 3
      return { p, score }
    }).sort((a, b) => b.score - a.score)
    let picked = scored.filter(s => s.score > 0).slice(0, 3).map(s => s.p)
    if (!picked.length) picked = cands.slice(0, 3)
    // filter budget keras bila disebut
    if (budget) {
      const within = picked.filter(p => num(p.price) <= budget)
      if (within.length) picked = within
    }
    for (const p of picked) productsOut.push(await withStock(db, p, lowDefault))

    // Ringkasan pesanan otomatis hanya untuk channel yang mengizinkan order (Telegram).
    const buyIntent = BUY_INTENT.test(content)
    if (allowOrder && buyIntent && picked.length) {
      const qty = qtyMatch ? Math.max(1, Math.min(10, Number(qtyMatch[1]))) : 1
      const res = await toolCall(db, 'build_order_summary', { items: picked.slice(0, 3).map(p => ({ product_id: String(p.id), quantity: qty })) }) as { summary?: OrderSummary }
      if (res.summary) summary = res.summary
    }
    if (productsOut.length === 0) {
      replyText = 'Maaf, saya tidak menemukan produk yang cocok. Bisa sebutkan gadget dan budgetnya? Contoh: "Laptop untuk desain budget 15 juta".'
    }
    else {
      const lines = productsOut.map(p => `- **${p.name}** — Rp${num(p.price).toLocaleString('id-ID')} (stok: ${p.current_stock})`)
      replyText = `Berikut rekomendasi yang tersedia saat ini:\n\n${lines.join('\n')}`
      if (summary) replyText += `\n\nSaya sudah buatkan **ringkasan pesanan** di bawah. Cek lalu tekan **Konfirmasi pesanan** bila sudah sesuai.`
      else if (allowOrder) replyText += `\n\nBalas "mau produk ini" / "beli" untuk saya buatkan ringkasan pesanan.`
    }
  }

  // Anti-halusinasi: klaim ringkasan tanpa summary -> koreksi
  if (allowOrder && /ringkasan pesanan|total.*pesanan|tagihan/i.test(replyText) && !summary) {
    const reused = getForConversation(conversationId)
    if (reused) summary = reused
  }
  // Koreksi LLM pasif: intent beli jelas + produk ditemukan tapi model tidak
  // memanggil build_order_summary -> bangun otomatis (bukan dari teks bebas).
  if (allowOrder && !summary && productsOut.length > 0 && BUY_INTENT.test(content)) {
    const res = await toolCall(db, 'build_order_summary', { items: productsOut.slice(0, 3).map(p => ({ product_id: String(p.id), quantity: 1 })) }) as { summary?: OrderSummary }
    if (res.summary) {
      summary = res.summary
      replyText += `\n\nSaya sudah buatkan **ringkasan pesanan** di bawah. Cek lalu tekan **Konfirmasi pesanan** bila sudah sesuai.`
    }
  }
  // WEB: chat hanya tanya-jawab -> niat beli diarahkan ke checkout langsung.
  if (!allowOrder && BUY_INTENT.test(content) && !/tombol \*\*Pesan\*\*|Beli sekarang/.test(replyText)) {
    replyText += `\n\nUntuk **pesan langsung**, tekan tombol **Pesan** di kartu produk atau **Beli sekarang** di halaman produk — checkout tanpa lewat chat. Chat ini untuk tanya stok, spesifikasi, dan rekomendasi.`
  }
  if (summary) putForConversation(conversationId, summary)

  await db.insert(conversationMessages).values({ conversationId: conversationId as never, sender: 'AI', content: replyText, messageType: 'TEXT' })
  // Simpan rekomendasi (maks 3)
  for (const p of productsOut.slice(0, 3)) {
    await db.insert((await import('../database/schema')).recommendations).values({
      conversationId: conversationId as never, productId: p.id as never, reason: 'Rekomendasi sales agent'
    })
  }
  return { reply: replyText, products: productsOut.slice(0, 5), order_summary: summary, needs_customer_info: !!summary }
}

// ---------- Analyst ----------
export async function analystAsk(db: ReturnType<typeof getDb>, question: string) {
  await ensureSeeded(db)
  const provider = String(useRuntimeConfig().llmProvider || 'mock')
  const q = question.toLowerCase()
  let data: unknown = null
  let queryUsed: string | null = null
  let disclaimer: string | null = null
  if (/channel|kanal|web|telegram|whatsapp/.test(q)) {
    data = await toolCall(db, 'channel_distribution', {})
    queryUsed = 'channel_distribution'
    disclaimer = 'Data lintas channel belum ter-unifikasi per identitas customer (MVP): satu orang di dua channel dihitung terpisah.'
  }
  else if (/stok|stock|inventory|risiko|risk|habis|menipis/.test(q)) {
    data = await toolCall(db, 'analyze_inventory', {})
    queryUsed = 'analyze_inventory'
  }
  else {
    data = await toolCall(db, 'analyze_sales', { group_by: 'product', top: 10 })
    queryUsed = 'analyze_sales'
  }
  let answer = ''
  if (provider !== 'mock') {
    try {
      const r = await llmComplete('analyst', [
        { role: 'system', content: ANALYST_SYSTEM },
        { role: 'user', content: `${question}\n\nData: ${JSON.stringify(data).slice(0, 6000)}` }
      ], [])
      answer = r.text || ''
    }
    catch { /* fallback */ }
  }
  if (!answer) {
    if (queryUsed === 'channel_distribution') {
      const d = data as { total_orders: number, by_channel: Array<{ channel: string, orders: number, percent: number }> }
      answer = `**Ringkasan channel**\n\nTotal order: **${d.total_orders}**\n\n${d.by_channel.map(c => `- ${c.channel}: ${c.orders} (${c.percent}%)`).join('\n') || '- Belum ada data'}`
    }
    else if (queryUsed === 'analyze_inventory') {
      const d = data as { threshold_days: number, data: Array<{ name: string, current_stock: number, estimated_days_left: string, stockout_risk: boolean }> }
      const risky = d.data.filter(r => r.stockout_risk).slice(0, 10)
      answer = `**Risiko stok (threshold ${d.threshold_days} hari)**\n\n${risky.length ? risky.map(r => `- **${r.name}**: ${r.current_stock} unit, sisa ~${r.estimated_days_left} hari`).join('\n') : 'Tidak ada produk berisiko dalam 30 hari terakhir.'}`
    }
    else {
      const d = data as { data: Array<{ key: string, units: number, revenue: number }>, product_names?: Record<string, string> }
      answer = `**Ringkasan penjualan (30 hari)**\n\n${d.data.slice(0, 10).map(r => `- ${(d.product_names || {})[r.key] || r.key}: ${r.units} unit, Rp${r.revenue.toLocaleString('id-ID')}`).join('\n') || '- Belum ada penjualan.'}`
    }
  }
  return { answer, data, query_used: queryUsed, disclaimer }
}

// ---------- Action assistant ----------
export async function actionCreateDraft(db: ReturnType<typeof getDb>, instruction: string, requestedBy: string) {
  await ensureSeeded(db)
  const provider = String(useRuntimeConfig().llmProvider || 'mock')
  let draft: { action_type: string, payload: Record<string, unknown> } | null = null
  if (provider !== 'mock') {
    try {
      const messages = [{ role: 'system', content: actionSystem() }, { role: 'user', content: instruction }]
      for (let i = 0; i < 3; i++) {
        const r = await llmComplete('action', messages, ACTION_TOOLS)
        for (const tc of r.toolCalls) {
          const result = await toolCall(db, tc.name, tc.arguments) as { draft?: typeof draft }
          if (result?.draft) draft = result.draft
          messages.push({ role: 'user', content: `Tool ${tc.name}: ${JSON.stringify(result).slice(0, 4000)}` })
        }
        if (draft) break
        if (r.text) {
          try {
            const m = r.text.match(/\{[\s\S]*\}/)
            if (m) {
              const parsed = JSON.parse(m[0]) as { action_type?: string, payload?: Record<string, unknown> }
              if (parsed.action_type && parsed.payload) {
                draft = { action_type: parsed.action_type, payload: parsed.payload }
                break
              }
            }
          }
          catch { /* lanjut */ }
        }
        if (!r.toolCalls.length) break
      }
    }
    catch { /* fallback */ }
  }
  if (!draft) {
    // Parser rule-based: "diskon/promo X% <nama produk> <tanggal>" atau "tambah/kurang stok"
    const t = instruction.toLowerCase()
    const discMatch = instruction.match(/(\d+(?:[.,]\d+)?)\s*%/)
    const all = await db.select().from(products).where(eq(products.status, 'ACTIVE')).limit(200)
    const found = all.find(p => t.includes(p.name.toLowerCase().split(' ').slice(0, 2).join(' ')) || t.includes(p.name.toLowerCase()))
      || all.find(p => instruction.split(/\s+/).some(w => w.length > 3 && p.name.toLowerCase().includes(w.toLowerCase())))
    if (/diskon|promo|promosi/.test(t) && discMatch && found) {
      const pct = Number(discMatch[1].replace(',', '.'))
      const now = new Date()
      const end = new Date(now.getTime() + 14 * 864e5)
      draft = { action_type: 'CREATE_PROMOTION', payload: { product_id: String(found.id), discount_percentage: pct, start_date: now.toISOString(), end_date: end.toISOString() } }
    }
    else {
      const qtyM = instruction.match(/(\d+)\s*(unit|pcs|buah)?/)
      const move = /tambah|masuk|restock|tambahin/.test(t) ? 'IN' : /kurang|keluar|koreksi/.test(t) ? 'OUT' : null
      if (move && qtyM && found) {
        draft = { action_type: 'ADJUST_STOCK', payload: { product_id: String(found.id), movement: move, quantity: Number(qtyM[1]) } }
      }
    }
  }
  if (!draft) throw new Error('Instruksi tidak dapat dipahami. Contoh: "Buatkan promo diskon 10% untuk iPhone 15 Pro selama 2 minggu" atau "Tambah stok 20 unit untuk AirPods Pro 2".')
  const { aiActions } = await import('../database/schema')
  const { logAudit } = await import('./business')
  // Samakan backend: kolom payload hanya berisi inner payload, action_type di kolom sendiri.
  // Bila LLM mengembalikan draft bersarang {action_type, payload}, unpack satu level.
  let actionType = draft.action_type
  let payload = draft.payload as Record<string, unknown>
  if (payload && typeof payload === 'object' && 'payload' in (payload as Record<string, unknown>) && 'action_type' in (payload as Record<string, unknown>)) {
    const nested = payload as unknown as { action_type: string, payload: Record<string, unknown> }
    actionType = nested.action_type || actionType
    payload = nested.payload
  }
  // Resolve product_id nama -> UUID bila LLM memberi nama, bukan UUID.
  if (payload && typeof payload.product_id === 'string' && !isUuid(payload.product_id)) {
    const resolved = await resolveProductId(db, String(payload.product_id))
    if (!resolved) throw new Error(`Produk "${payload.product_id}" tidak ditemukan di katalog. Sebutkan nama produk yang ada.`)
    payload = { ...payload, product_id: resolved }
  }
  const ins = await db.insert(aiActions).values({ actionType, payload: payload as never, status: 'DRAFT', requestedBy: requestedBy as never }).returning()
  await logAudit(db, 'CREATED', 'AI_SYSTEM', { aiActionId: String(ins[0].id), detail: { action_type: actionType } })
  return ins[0]
}

function isUuid(v: unknown): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

async function resolveProductId(db: ReturnType<typeof getDb>, hint: string): Promise<string | null> {
  const { products } = await import('../database/schema')
  const { eq } = await import('drizzle-orm')
  if (isUuid(hint)) {
    const rows = await db.select({ id: products.id }).from(products).where(eq(products.id, hint as never)).limit(1)
    return rows[0] ? String(rows[0].id) : null
  }
  const all = await db.select().from(products).limit(300)
  const h = hint.toLowerCase()
  const exact = all.find(p => p.name.toLowerCase() === h)
  if (exact) return String(exact.id)
  const words = h.split(/\s+/).filter(w => w.length > 2)
  const scored = all
    .map(p => ({ p, score: words.filter(w => p.name.toLowerCase().includes(w)).length }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0] ? String(scored[0].p.id) : null
}
