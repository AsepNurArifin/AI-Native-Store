import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startRuntime } from './helpers/storefront-runtime.mjs'
import { guestClient, orderBody, errorCode } from './helpers/guest-client.mjs'
import { paymentForm, paymentProofPng, qrisOrderBody } from './helpers/payment-fixtures.mjs'

test('Production guest checkout, secure guest identity and public SSR privacy', async t => {
  const runtime = await startRuntime('production')
  t.after(runtime.stop)
  const { origin, sql, productIds } = runtime
  const guest = guestClient(origin)
  const productId = productIds[0]
  const body = orderBody(productId)
  body.customer = { name: 'Private Production Guest', contact: 'production@example.test', phone: '089998887776' }
  const response = await guest.request('POST', '/orders', body, {
    headers: { Origin: origin.replace('http:', 'https:') }
  })
  assert.equal(response.status, 200, response.text)
  assert.equal(response.data.status, 'CONFIRMED')
  assert.equal(response.data.total, 17099100)
  assert.equal(response.data.replayed, false)
  assert.ok(Date.parse(response.data.expires_at) > Date.now())
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('shaf_sid='))
  assert.ok(cookie)
  assert.match(cookie, /;\s*Secure/i)
  assert.match(cookie, /;\s*HttpOnly/i)
  assert.match(cookie, /;\s*SameSite=Lax/i)
  const order = (await sql`select payment_status,payment_method,channel_origin from orders where id=${response.data.order_id}`)[0]
  assert.equal(order.payment_status, 'UNPAID')
  assert.equal(order.payment_method, 'CASH')
  assert.equal(order.channel_origin, 'WEB')
  assert.equal(Number((await sql`select current_stock from v_product_stock where product_id=${productId}`)[0].current_stock), 19)
  const cookieHeader = cookie.split(';')[0]
  for (const path of ['/', '/rak/Smartphone', `/produk/${productId}`, '/checkout']) {
    const page = await fetch(`${origin}${path}`, { headers: { Cookie: cookieHeader } })
    const html = await page.text()
    assert.equal(page.status, 200, `${path}: ${html}`)
    assert.match(page.headers.get('content-type'), /text\/html/)
    assert.equal(html.includes(body.customer.name), false, path)
    assert.equal(html.includes(body.customer.contact), false, path)
    assert.equal(html.includes(body.customer.phone), false, path)
    assert.equal(html.includes(response.data.order_id), false, path)
    if (path === `/produk/${productId}`) assert.match(html, /iPhone 15 Pro 128GB/)
  }
  const privateOrders = await guest.request('GET', '/orders')
  assert.equal(privateOrders.status, 401, privateOrders.text)
  const devOrderPath = await guest.request('POST', '/dev/mock-tg', { from: 'test', text: 'CONFIRM:untrusted' })
  assert.equal(devOrderPath.status, 404, devOrderPath.text)
  const unsignedWebhook = await guest.request('POST', '/webhooks/telegram', { update_id: 1 })
  assert.equal(unsignedWebhook.status, 401, unsignedWebhook.text)
  assert.equal(Number((await sql`select count(*)::int as n from orders`)[0].n), 1)
  const qr = await fetch(runtime.qrisImageUrl)
  assert.equal(qr.status, 200)
  assert.equal(qr.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await qr.arrayBuffer()), paymentProofPng)
  const qrisBody = qrisOrderBody(productIds[1], 18699150)
  qrisBody.fulfillment = { method: 'DELIVERY', recipient: 'Penerima Production', phone: '081234567890', address: 'Jalan Test 1, Bandung' }
  const qris = await guest.request('POST', '/orders', paymentForm(qrisBody), {
    headers: { Origin: origin.replace('http:', 'https:') }
  })
  assert.equal(qris.status, 200, qris.text)
  assert.equal(qris.data.expires_at, null)
  const qrisOrder = (await sql`select payment_method,payment_status,payment_review,expires_at from orders where id=${qris.data.order_id}`)[0]
  assert.deepEqual(qrisOrder, { payment_method: 'QRIS', payment_status: 'UNPAID', payment_review: 'PENDING', expires_at: null })
  const proofDenied = await guest.request('GET', `/orders/${qris.data.order_id}/payment-proof`)
  assert.equal(proofDenied.status, 401, proofDenied.text)
  const owner = guestClient(origin)
  const login = await owner.request('POST', '/auth/login', { email: 'owner@shaf.test', password: runtime.ownerPassword }, {
    headers: { Origin: origin.replace('http:', 'https:') }
  })
  assert.equal(login.status, 200, login.text)
  const proof = await owner.request('GET', `/orders/${qris.data.order_id}/payment-proof`, undefined, {
    headers: { Authorization: `Bearer ${login.data.access_token}` }
  })
  assert.equal(proof.status, 200, proof.text)
  assert.match(proof.headers.get('cache-control'), /(?:^|[,\s])no-store(?:$|[,\s])/)
  assert.deepEqual(proof.bytes, paymentProofPng)
  assert.equal(Number((await sql`select count(*)::int as n from orders`)[0].n), 2)
  // Manual HTTP forwarding inspects Secure attributes, not an HTTPS browser cookie roundtrip.
})

test('Production QRIS fails closed without a configured QR image and preserves CASH pickup', async t => {
  const runtime = await startRuntime('production', { qrisImageUrl: '' })
  t.after(runtime.stop)
  const { sql, origin, productIds } = runtime
  const guest = guestClient(origin)
  const options = { headers: { Origin: origin.replace('http:', 'https:') } }
  const body = qrisOrderBody(productIds[0], 17099100)
  const result = await guest.request('POST', '/orders', paymentForm(body), options)
  assert.equal(result.status, 503, result.text)
  assert.equal(errorCode(result), 'QRIS_UNAVAILABLE')
  assert.equal(Number((await sql`select count(*)::int as n from orders`)[0].n), 0)
  assert.equal(Number((await sql`select count(*)::int as n from customers`)[0].n), 0)
  assert.equal((await sql`select key from idempotency_keys where key=${body.idempotency_key}`).length, 0)
  assert.equal(Number((await sql`select count(*)::int as n from order_payment_proofs`)[0].n), 0)
  assert.equal(Number((await sql`select count(*)::int as n from order_items`)[0].n), 0)
  assert.equal(Number((await sql`select count(*)::int as n from inventory_transactions where reference_type='ORDER'`)[0].n), 0)
  assert.equal(Number((await sql`select current_stock from v_product_stock where product_id=${productIds[0]}`)[0].current_stock), 20)
  const cash = await guest.request('POST', '/orders', orderBody(productIds[0]), options)
  assert.equal(cash.status, 200, cash.text)
  assert.ok(Date.parse(cash.data.expires_at) > Date.now())
})
