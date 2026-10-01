import { randomUUID } from 'node:crypto'

/**
 * Supabase Storage via REST (tanpa @supabase/supabase-js — cukup 2 endpoint).
 * Bucket publik 'product-images': upload service_role, sajikan via CDN Supabase.
 */
const BUCKET = 'product-images'
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

function storageConfig(): { url: string, key: string } {
  const url = String(useRuntimeConfig().supabaseUrl || '').replace(/\/+$/, '')
  const key = String(useRuntimeConfig().supabaseServiceRoleKey || '')
  if (!url || !key) {
    throw createError({
      statusCode: 503,
      message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset',
      data: { detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di .env' }
    })
  }
  return { url, key }
}

/** Upload buffer gambar ke bucket publik, return URL publiknya. */
export async function uploadProductImage(mime: string, data: Uint8Array): Promise<string> {
  const ext = EXT_BY_MIME[mime]
  if (!ext) {
    throw createError({ statusCode: 422, message: 'Format gambar harus JPG/PNG/WebP/GIF', data: { detail: { code: 'VALIDATION', message: 'Format gambar harus JPG/PNG/WebP/GIF' } } })
  }
  const { url, key } = storageConfig()
  const path = `${randomUUID()}.${ext}`
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': mime,
      'x-upsert': 'false',
      'cache-control': '31536000'
    },
    body: data
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw createError({
      statusCode: 502,
      message: 'Gagal mengunggah ke Supabase Storage',
      data: { detail: `Upload ke bucket ${BUCKET} gagal (${res.status}): ${detail.slice(0, 300)}` }
    })
  }
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}
