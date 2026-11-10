import { randomUUID } from 'node:crypto'

let nextClient = 1

export function guestClient(origin) {
  const cookies = new Map()
  // Each client represents an independent loopback guest behind a proxy.
  const forwardedIp = `192.0.2.${nextClient++}`
  async function request(method, path, body, options = {}) {
    const headers = { Origin: origin, 'X-Forwarded-For': forwardedIp, ...options.headers }
    const multipart = body instanceof FormData
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
    if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ')
    Object.assign(headers, options.headers)
    const response = await fetch(`${origin}/api/v1${path}`, {
      method, headers, redirect: 'manual',
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body)
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]
      const index = pair.indexOf('=')
      const key = pair.slice(0, index), value = pair.slice(index + 1)
      if (value) cookies.set(key, value)
      else cookies.delete(key)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    const text = bytes.toString('utf8')
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: response.status, data, headers: response.headers, text, bytes }
  }
  return { request, cookies }
}

export function orderBody(productId, quantity = 1) {
  return {
    items: [{ product_id: productId, quantity }],
    customer: { name: 'Pelanggan Test', contact: 'pelanggan@example.test', phone: '081234567890' },
    fulfillment: { method: 'PICKUP' },
    payment: { method: 'CASH' },
    idempotency_key: randomUUID()
  }
}

export function errorCode(response) {
  return response.data?.data?.detail?.code || response.data?.detail?.code
}
