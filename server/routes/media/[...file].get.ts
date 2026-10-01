import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

/** Sajikan file upload dari UPLOAD_DIR: /media/<file> (immutable, cacheable). */
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
}

export default defineEventHandler(async (event) => {
  const name = String(getRouterParam(event, 'file') || '')
  // Nama file dibuat server (uuid.ext) — tolak pola lain + traversal.
  if (!/^[0-9a-fA-F-]+\.[a-z]+$/.test(name) || name.includes('..')) {
    throw createError({ statusCode: 404, message: 'File tidak ditemukan', data: { detail: 'File tidak ditemukan' } })
  }
  const dir = resolve(String(useRuntimeConfig().uploadDir || '.data/uploads'))
  const path = join(dir, name)
  if (!path.startsWith(dir + sep)) {
    throw createError({ statusCode: 404, message: 'File tidak ditemukan', data: { detail: 'File tidak ditemukan' } })
  }
  try { await stat(path) }
  catch {
    throw createError({ statusCode: 404, message: 'File tidak ditemukan', data: { detail: 'File tidak ditemukan' } })
  }
  const ext = name.split('.').pop()!.toLowerCase()
  setHeader(event, 'Content-Type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(path))
})
