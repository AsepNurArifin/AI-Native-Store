import sharp from 'sharp'
import { getRequestHeader, readMultipartFormData, type H3Event, type MultiPartData } from 'h3'
import { apiError, OrderError } from './errors'

export const MAX_PROOF_BYTES = 2 * 1024 * 1024
const MAX_BODY_BYTES = MAX_PROOF_BYTES + 64 * 1024
const MAX_INPUT_BYTES = 32 * 1024

export interface PaymentProofInput {
  data: Buffer
  mime: string
}

/** Count bytes as they arrive, including chunked requests and web-adapter streams. */
export async function readBoundedCheckoutBody(event: H3Event): Promise<Buffer> {
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (declared > MAX_BODY_BYTES) apiError(413, 'PAYLOAD_TOO_LARGE', 'Badan permintaan terlalu besar.')
  const req = event.node.req as typeof event.node.req & { rawBody?: Buffer | string, body?: Buffer | string }
  const source = event._requestBody || event.web?.request?.body || req.rawBody || req.body || req
  const chunks: Buffer[] = []
  let size = 0
  const add = (value: Uint8Array | string) => {
    const chunk = typeof value === 'string' ? Buffer.from(value) : Buffer.isBuffer(value) ? value : Buffer.from(value)
    size += chunk.length
    if (size > MAX_BODY_BYTES) apiError(413, 'PAYLOAD_TOO_LARGE', 'Badan permintaan terlalu besar.')
    chunks.push(chunk)
  }
  if (typeof source === 'string' || source instanceof Uint8Array) add(source)
  else if (source instanceof ReadableStream) {
    const reader = source.getReader()
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) break
        add(result.value)
      }
    }
    catch (error) {
      await reader.cancel().catch(() => {})
      throw error
    }
    finally { reader.releaseLock() }
  }
  else if (Symbol.asyncIterator in source) {
    // Keep the socket writable on limit rejection so H3 can send HTTP 413.
    const stream = source as typeof req
    try {
      for await (const chunk of stream.iterator({ destroyOnReturn: false })) add(chunk)
    }
    catch (error) {
      stream.resume()
      throw error
    }
  }
  else apiError(422, 'VALIDATION', 'Badan permintaan tidak valid.')
  return chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, size)
}

export async function readCheckoutInput(event: H3Event): Promise<{ input: Record<string, unknown>, proof?: MultiPartData }> {
  const raw = await readBoundedCheckoutBody(event)
  const contentType = getRequestHeader(event, 'content-type') || ''
  let text: string
  let proof: MultiPartData | undefined
  if (/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    const boundary = contentType.match(/\bboundary=(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean)
    if (!boundary || boundary.length > 200) apiError(422, 'VALIDATION', 'Boundary multipart tidak valid.')
    const opening = Buffer.from(`--${boundary}\r\n`)
    const ending = Buffer.from(`\r\n--${boundary}--`)
    const complete = raw.subarray(-ending.length).equals(ending) || raw.subarray(-ending.length - 2).equals(Buffer.concat([ending, Buffer.from('\r\n')]))
    if (!raw.subarray(0, opening.length).equals(opening) || !complete) apiError(422, 'VALIDATION', 'Multipart tidak lengkap atau boundary tidak valid.')
    // H3 reads the already bounded buffer; never let its unbounded reader own the stream.
    event._requestBody = raw as unknown as NonNullable<H3Event['_requestBody']>
    event.node.req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`
    if (event._headers) event._headers.set('content-type', `multipart/form-data; boundary=${boundary}`)
    const parts = await readMultipartFormData(event)
    const inputs = parts?.filter(part => part.name === 'input') ?? []
    const proofs = parts?.filter(part => part.name === 'proof') ?? []
    if (inputs.length !== 1 || inputs[0]!.filename || inputs[0]!.data.length > MAX_INPUT_BYTES || proofs.length > 1 || parts?.some(part => part.name !== 'input' && part.name !== 'proof')) {
      apiError(422, 'VALIDATION', 'Multipart wajib memuat satu input JSON dan maksimal satu proof.')
    }
    text = inputs[0]!.data.toString('utf8')
    proof = proofs[0]
  }
  else {
    if (!/^application\/json(?:;|$)/i.test(contentType)) apiError(422, 'VALIDATION', 'Gunakan application/json atau multipart/form-data.')
    if (raw.length > MAX_INPUT_BYTES) apiError(413, 'PAYLOAD_TOO_LARGE', 'Input pesanan terlalu besar.')
    text = raw.toString('utf8')
  }
  let input: unknown
  try { input = JSON.parse(text) }
  catch { apiError(422, 'VALIDATION', 'input harus berupa JSON yang valid.') }
  if (!input || typeof input !== 'object' || Array.isArray(input)) apiError(422, 'VALIDATION', 'input harus berupa objek JSON.')
  return { input: input as Record<string, unknown>, proof }
}

/** Signature + full pixel decode; metadata/signature-only checks accept truncated files. */
export async function validatePaymentProof(proof: PaymentProofInput): Promise<void> {
  const data = proof.data
  if (!data.length) throw new OrderError('PAYMENT_PROOF_REQUIRED', 'Bukti pembayaran QRIS wajib diunggah.')
  if (data.length > MAX_PROOF_BYTES) throw new OrderError('PAYMENT_PROOF_TOO_LARGE', 'Ukuran bukti pembayaran maksimal 2 MiB.')
  const detected = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
    ? 'image/jpeg'
    : data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp' : null
  if (!detected || detected !== proof.mime) throw new OrderError('INVALID_PAYMENT_PROOF', 'Bukti harus berupa gambar JPG, PNG, atau WebP yang valid.')
  try {
    const image = sharp(data, { failOn: 'warning', limitInputPixels: 20_000_000 })
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1 || metadata.format !== detected.slice(6)) throw new Error('Invalid image format, dimensions, or animation')
    // Force all pixels to decode without retaining a second full-size image buffer.
    await image.stats()
  }
  catch {
    throw new OrderError('INVALID_PAYMENT_PROOF', 'Bukti pembayaran rusak atau bukan gambar JPG, PNG, atau WebP yang valid (maksimal 20 megapiksel).')
  }
}
