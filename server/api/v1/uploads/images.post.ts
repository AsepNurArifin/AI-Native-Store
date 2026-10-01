import { requireOwner } from '../../../utils/auth'
import { uploadProductImage } from '../../../utils/storage'

/** Upload file gambar produk (multipart, field "file") ke Supabase Storage. */
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.data?.length)
  if (!file) {
    throw createError({ statusCode: 422, message: 'File gambar wajib (field "file")', data: { detail: { code: 'VALIDATION', message: 'File gambar wajib (field "file")' } } })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 422, message: 'Ukuran gambar maksimal 2 MB', data: { detail: { code: 'VALIDATION', message: 'Ukuran gambar maksimal 2 MB' } } })
  }
  const image_url = await uploadProductImage(file.type || '', file.data)
  setResponseStatus(event, 201)
  return { image_url }
})
