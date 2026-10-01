// LLM client — port backend/app/ai/llm.py (mock default, Groq/OpenRouter/OpenAI/Google via fetch).
export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LlmToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface LlmResult {
  text: string
  toolCalls: LlmToolCall[]
}

export function llmConfig() {
  const c = useRuntimeConfig()
  return {
    provider: (c.llmProvider as string) || process.env.LLM_PROVIDER || 'mock',
    apiKey: (c.llmApiKey as string) || process.env.LLM_API_KEY || '',
    groqKey: (c.groqApiKey as string) || process.env.GROQ_API_KEY || '',
    groqFast: (c.groqModelFast as string) || process.env.GROQ_MODEL_FAST || 'qwen/qwen3-32b',
    groqReasoning: (c.groqModelReasoning as string) || process.env.GROQ_MODEL_REASONING || 'qwen/qwen3-32b',
    orKey: (c.openrouterApiKey as string) || process.env.OPENROUTER_API_KEY || '',
    orFast: (c.openrouterModelFast as string) || process.env.OPENROUTER_MODEL_FAST || 'qwen/qwen3-32b:free',
    orReasoning: (c.openrouterModelReasoning as string) || process.env.OPENROUTER_MODEL_REASONING || 'qwen/qwen3-32b:free',
    timeoutSeconds: Number(c.llmTimeoutSeconds ?? process.env.LLM_TIMEOUT_SECONDS ?? 20),
    maxRetries: Number(c.llmMaxRetries ?? process.env.LLM_MAX_RETRIES ?? 2)
  }
}

export function modelFor(role: 'sales' | 'analyst' | 'action'): string {
  const c = useRuntimeConfig()
  const cfg = llmConfig()
  if (role === 'sales') return (c.llmModelSales as string) || process.env.LLM_MODEL_SALES || (cfg.provider === 'openrouter' ? cfg.orFast : cfg.groqFast)
  if (role === 'analyst') return (c.llmModelAnalyst as string) || process.env.LLM_MODEL_ANALYST || (cfg.provider === 'openrouter' ? cfg.orReasoning : cfg.groqReasoning)
  return (c.llmModelAction as string) || process.env.LLM_MODEL_ACTION || (cfg.provider === 'openrouter' ? cfg.orReasoning : cfg.groqReasoning)
}

async function openAiCompatibleComplete(baseUrl: string, apiKey: string, model: string, messages: unknown[], tools: ToolDef[], timeoutS: number, maxRetries: number): Promise<LlmResult> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutS * 1000)
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
          tool_choice: 'auto',
          temperature: 0.2
        })
      })
      clearTimeout(t)
      if (res.status === 429 || res.status === 503) {
        const wait = Math.min(2 ** attempt * 1000, 15000)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
      const json = await res.json() as { choices?: Array<{ message?: { content?: string, tool_calls?: Array<{ id: string, function: { name: string, arguments: string } }> } }> }
      const msg = json.choices?.[0]?.message
      const calls: LlmToolCall[] = (msg?.tool_calls || []).map(tc => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        }
        catch {
          args = {}
        }
        return { id: tc.id, name: tc.function.name, arguments: args }
      })
      return { text: msg?.content || '', toolCalls: calls }
    }
    catch (e) {
      clearTimeout(t)
      lastErr = e
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.min(2 ** attempt * 1000, 15000)))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('LLM unavailable')
}

export async function llmComplete(role: 'sales' | 'analyst' | 'action', messages: Array<{ role: string, content: string }>, tools: ToolDef[]): Promise<LlmResult> {
  const cfg = llmConfig()
  if (cfg.provider === 'mock') return { text: '', toolCalls: [] }
  try {
    if (cfg.provider === 'groq') {
      const key = cfg.groqKey || cfg.apiKey
      if (!key) throw new Error('no key')
      return await openAiCompatibleComplete('https://api.groq.com/openai/v1', key, modelFor(role), messages, tools, cfg.timeoutSeconds, cfg.maxRetries)
    }
    if (cfg.provider === 'openrouter') {
      const key = cfg.orKey || cfg.apiKey
      if (!key) throw new Error('no key')
      return await openAiCompatibleComplete('https://openrouter.ai/api/v1', key, modelFor(role), messages, tools, cfg.timeoutSeconds, cfg.maxRetries)
    }
    if (cfg.provider === 'openai') {
      if (!cfg.apiKey) throw new Error('no key')
      return await openAiCompatibleComplete('https://api.openai.com/v1', cfg.apiKey, modelFor(role) || 'gpt-4o-mini', messages, tools, cfg.timeoutSeconds, cfg.maxRetries)
    }
    if (cfg.provider === 'google') {
      // Gemini via OpenAI-compatible tidak tersedia — fallback graceful
      throw new Error('google provider gunakan mock fallback')
    }
    return { text: '', toolCalls: [] }
  }
  catch {
    // Graceful degradation — jangan buat order/perubahan (NFR-06)
    return { text: 'Maaf, layanan AI sedang tidak tersedia. Silakan ulangi atau hubungi admin toko. Tidak ada order/perubahan yang dibuat.', toolCalls: [] }
  }
}

export const PRODUCT_TOOLS: ToolDef[] = [
  { name: 'search_products', description: 'Cari produk aktif di katalog', parameters: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, budget_max: { type: 'number' }, stock_only: { type: 'boolean' }, limit: { type: 'number' } } } },
  { name: 'get_stock', description: 'Cek stok produk', parameters: { type: 'object', properties: { product_id: { type: 'string' } }, required: ['product_id'] } },
  { name: 'compare_products', description: 'Bandingkan beberapa produk', parameters: { type: 'object', properties: { product_ids: { type: 'array', items: { type: 'string' } } }, required: ['product_ids'] } },
  { name: 'build_order_summary', description: 'Buat ringkasan pesanan (belum order)', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'string' }, quantity: { type: 'number' } } } } }, required: ['items'] } }
]

export const ANALYST_TOOLS: ToolDef[] = [
  { name: 'analyze_sales', description: 'Analisis penjualan', parameters: { type: 'object', properties: { from_date: { type: 'string' }, to_date: { type: 'string' }, group_by: { type: 'string' }, top: { type: 'number' } } } },
  { name: 'analyze_inventory', description: 'Risiko stok', parameters: { type: 'object', properties: { threshold_days: { type: 'number' } } } },
  { name: 'channel_distribution', description: 'Distribusi channel', parameters: { type: 'object', properties: { from_date: { type: 'string' }, to_date: { type: 'string' } } } }
]

export const ACTION_TOOLS: ToolDef[] = [
  { name: 'search_products', description: 'Cari produk untuk draft', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'create_promotion_draft', description: 'Draft promo JSON', parameters: { type: 'object', properties: { product_id: { type: 'string' }, discount_percentage: { type: 'number' }, start_date: { type: 'string' }, end_date: { type: 'string' } }, required: ['product_id', 'discount_percentage', 'start_date', 'end_date'] } },
  { name: 'create_stock_adjustment_draft', description: 'Draft penyesuaian stok JSON', parameters: { type: 'object', properties: { product_id: { type: 'string' }, movement: { type: 'string' }, quantity: { type: 'number' } }, required: ['product_id', 'movement', 'quantity'] } }
]

export const SALES_SYSTEM = `Kamu asisten toko elektronik. Aturan: hanya jawab dari hasil tool; maks 3 rekomendasi; wajib panggil build_order_summary sebelum menyebut angka total; jangan sebut tombol kecuali summary ada; order hanya via tombol konfirmasi; teks bebas bukan konfirmasi; selalu search_products dulu; pecah filter (category/budget/RAM/storage/brand/processor/gpu); stock_only=true untuk pembelian; jawab Markdown GFM bahasa Indonesia.`
export const ANALYST_SYSTEM = `Kamu analis bisnis. Angka hanya dari hasil tool; format kesimpulan, angka, saran; rupiah; default 30 hari; tabel GFM bahasa Indonesia.`
export function actionSystem(): string {
  const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
  return `Kamu asisten aksi Owner. Hari ini ${today} (WIB). Hasilkan SATU aksi JSON DRAFT (CREATE_PROMOTION atau ADJUST_STOCK). UUID produk dari tool. Tanggal format ISO WIB.`
}
