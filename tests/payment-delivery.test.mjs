import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { startRuntime } from './helpers/storefront-runtime.mjs'
import { guestClient, orderBody, errorCode } from './helpers/guest-client.mjs'
import { paymentForm, paymentProofPng, alternatePaymentProofPng, qrisOrderBody } from './helpers/payment-fixtures.mjs'

test('Guest QRIS evidence review and paid delivery lifecycle', async t => {
  const runtime = await startRuntime()
  t.after(runtime.stop)
  const { sql, origin, productIds } = runtime
  const owner = guestClient(origin)
  const login = await owner.request('POST', '/auth/login', { email: 'owner@shaf.test', password: runtime.ownerPassword })
  assert.equal(login.status, 200, login.text)
  const headers = { Authorization: `Bearer ${login.data.access_token}` }
  const stockOf = async id => Number((await sql`select current_stock from v_product_stock where product_id=${id}`)[0].current_stock)
  const storedOrder = async id => (await sql`select * from orders where id=${id}`)[0]
  const listing = async () => {
    const result = await owner.request('GET', '/orders', undefined, { headers })
    assert.equal(result.status, 200, result.text)
    return result.data
  }
  const state = async () => (await sql`
    select (select count(*)::int from orders) as orders,
      (select count(*)::int from customers) as customers,
      (select count(*)::int from order_items) as items,
      (select count(*)::int from inventory_transactions) as inventory,
      (select count(*)::int from idempotency_keys) as keys,
      (select count(*)::int from order_payment_proofs) as proofs,
      (select count(*)::int from audit_logs) as audits
  `)[0]
  const create = async (client, body, proof = paymentProofPng) => {
    const result = await client.request('POST', '/orders', paymentForm(body, proof))
    assert.equal(result.status, 200, result.text)
    assert.ok(result.data.order_id)
    return result.data
  }
  const reject = async (method, path, body, status, code, options = {}) => {
    const result = await owner.request(method, path, body, { ...options, headers: { ...headers, ...options.headers } })
    assert.equal(result.status, status, result.text)
    assert.equal(errorCode(result), code, result.text)
    return result
  }

  await t.test('missing, spoofed, malformed and oversized evidence never write an order or reserve stock', async () => {
    const id = productIds[0]
    const client = guestClient(origin)
    const before = await state()
    const valid = qrisOrderBody(id, 17099100)
    const missingTotal = { ...valid }
    delete missingTotal.expected_total
    const cashDelivery = orderBody(id)
    cashDelivery.fulfillment = { method: 'DELIVERY', address: 'Jalan Test 1, Bandung' }
    const oversized = Buffer.concat([paymentProofPng, Buffer.alloc(2 * 1024 * 1024 + 1 - paymentProofPng.length)])
    const cases = [
      ['QRIS JSON without proof', valid, 'PAYMENT_PROOF_REQUIRED'],
      ['QRIS multipart without proof', paymentForm(valid, null), 'PAYMENT_PROOF_REQUIRED'],
      ['plain text claiming PNG', paymentForm(valid, Buffer.from('not an image')), 'INVALID_PAYMENT_PROOF'],
      ['unsupported SVG', paymentForm(valid, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { type: 'image/svg+xml', filename: 'proof.svg' }), 'INVALID_PAYMENT_PROOF'],
      ['PNG claiming JPEG', paymentForm(valid, paymentProofPng, { type: 'image/jpeg', filename: 'proof.jpg' }), 'INVALID_PAYMENT_PROOF'],
      ['PNG signature without complete image', paymentForm(valid, paymentProofPng.subarray(0, 24)), 'INVALID_PAYMENT_PROOF'],
      ['PNG over two MiB', paymentForm(valid, oversized), 'PAYMENT_PROOF_TOO_LARGE'],
      ['QRIS without expected total', paymentForm(missingTotal), 'EXPECTED_TOTAL_REQUIRED'],
      ['CASH delivery', cashDelivery, 'INVALID_PAYMENT_METHOD'],
      ['CASH with uploaded proof', paymentForm(orderBody(id)), 'INVALID_PAYMENT_METHOD']
    ]
    for (const [name, body, code] of cases) {
      const result = await guestClient(origin).request('POST', '/orders', body)
      assert.equal(result.status, 422, `${name}: ${result.text}`)
      assert.equal(errorCode(result), code, `${name}: ${result.text}`)
      assert.deepEqual(await state(), before, name)
      assert.equal(await stockOf(id), 20, name)
    }
    const placed = await create(client, valid)
    assert.equal(placed.replayed, false)
    assert.equal(await stockOf(id), 19)
    assert.equal((await sql`select order_id from order_payment_proofs where order_id=${placed.order_id}`).length, 1)
  })

  await t.test('transactional expected total mismatch rolls back all writes and allows corrected retry', async () => {
    const client = guestClient(origin)
    const firstId = productIds[1], secondId = productIds[2]
    await sql`update products set price=100 where id in (${firstId},${secondId})`
    await sql`update promotions set status='REJECTED' where product_id in (${firstId},${secondId})`
    const body = qrisOrderBody(firstId, 300, 2)
    body.items.push({ product_id: secondId, quantity: 1 })
    // The guest's catalog total becomes stale before the transactional reservation.
    await sql`update products set price=120 where id=${secondId}`
    const before = await state()
    const mismatch = await client.request('POST', '/orders', paymentForm(body))
    assert.equal(mismatch.status, 409, mismatch.text)
    assert.equal(errorCode(mismatch), 'PRICE_CHANGED')
    assert.deepEqual(await state(), before)
    assert.equal(await stockOf(firstId), 20)
    assert.equal(await stockOf(secondId), 20)
    assert.equal((await sql`select key from idempotency_keys where key=${body.idempotency_key}`).length, 0)
    body.expected_total = 320
    const placed = await create(client, body)
    assert.equal(placed.total, 320)
    assert.equal(placed.replayed, false)
    assert.equal(await stockOf(firstId), 18)
    assert.equal(await stockOf(secondId), 19)
    assert.equal((await sql`select id from order_items where order_id=${placed.order_id}`).length, 2)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${placed.order_id}`).length, 2)
    assert.equal((await sql`select order_id from order_payment_proofs where order_id=${placed.order_id}`).length, 1)
  })

  await t.test('concurrent QRIS retry retains one proof and reservation even after a later price change', async () => {
    const id = productIds[6]
    const client = guestClient(origin)
    const body = qrisOrderBody(id, 18999000, 1)
    await client.request('GET', '/checkout/session')
    const results = await Promise.all([
      client.request('POST', '/orders', paymentForm(body)),
      client.request('POST', '/orders', paymentForm(body))
    ])
    for (const result of results) assert.equal(result.status, 200, result.text)
    assert.equal(results[0].data.order_id, results[1].data.order_id)
    assert.deepEqual(results.map(result => result.data.replayed).sort(), [false, true])
    const original = results.find(result => !result.data.replayed).data
    const originalProof = (await sql`select mime,size,data,submitted_at from order_payment_proofs where order_id=${original.order_id}`)[0]
    assert.equal(originalProof.mime, 'image/png')
    assert.equal(originalProof.size, paymentProofPng.length)
    assert.deepEqual(Buffer.from(originalProof.data), paymentProofPng)
    await sql`update products set price=123 where id=${id}`
    await sql`update idempotency_keys set created_at=now()-interval '2 days' where key=${body.idempotency_key}`
    await listing()
    const replay = await create(client, body)
    assert.deepEqual(replay, { ...original, replayed: true })
    assert.deepEqual((await sql`select mime,size,data,submitted_at from order_payment_proofs where order_id=${original.order_id}`)[0], originalProof)
    assert.equal(await stockOf(id), 19)
    assert.equal((await sql`select id from orders where id in (select order_id from order_items where product_id=${id})`).length, 1)
    assert.equal((await sql`select order_id from order_payment_proofs where order_id=${original.order_id}`).length, 1)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${original.order_id}`).length, 1)
    assert.equal((await sql`select key from idempotency_keys where key=${body.idempotency_key}`).length, 1)
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='ORDER_CREATED' and detail->>'order_id'=${original.order_id}`)[0].n), 1)
    const beforeCollision = await state()
    const changedBody = { ...body, customer: { ...body.customer, phone: '085555555555' } }
    const changedRequest = await client.request('POST', '/orders', paymentForm(changedBody))
    assert.equal(changedRequest.status, 409, changedRequest.text)
    assert.equal(errorCode(changedRequest), 'IDEMPOTENCY_CONFLICT')
    const changedEvidence = await client.request('POST', '/orders', paymentForm(body, alternatePaymentProofPng))
    assert.equal(changedEvidence.status, 409, changedEvidence.text)
    assert.equal(errorCode(changedEvidence), 'IDEMPOTENCY_CONFLICT')
    const otherGuest = await guestClient(origin).request('POST', '/orders', paymentForm(body))
    assert.equal(otherGuest.status, 409, otherGuest.text)
    assert.equal(errorCode(otherGuest), 'IDEMPOTENCY_CONFLICT')
    assert.deepEqual(await state(), beforeCollision)
    assert.equal(await stockOf(id), 19)
  })

  await t.test('proof stays private to owner JWT and metadata exposes neither bytes nor a public URL', async () => {
    const buyer = guestClient(origin)
    const stranger = guestClient(origin)
    const body = qrisOrderBody(productIds[7], 21999000)
    body.customer = { name: 'Private Proof Buyer', contact: 'private@example.test', phone: '084444444444' }
    const placed = await create(buyer, body)
    const path = `/orders/${placed.order_id}/payment-proof`
    for (const client of [buyer, stranger]) {
      const denied = await client.request('GET', path)
      assert.equal(denied.status, 401, denied.text)
      assert.notDeepEqual(denied.bytes, paymentProofPng)
    }
    const invalidToken = await stranger.request('GET', path, undefined, { headers: { Authorization: 'Bearer invalid-token' } })
    assert.equal(invalidToken.status, 401, invalidToken.text)
    const staff = guestClient(origin)
    const staffPassword = 'Staff-test-only-password!'
    await sql`insert into users (id,name,email,password_hash,role,status) values (${randomUUID()},'Test Staff','staff@shaf.test',${await bcrypt.hash(staffPassword, 10)},'STAFF','ACTIVE')`
    const staffLogin = await staff.request('POST', '/auth/login', { email: 'staff@shaf.test', password: staffPassword })
    assert.equal(staffLogin.status, 200, staffLogin.text)
    const staffDenied = await staff.request('GET', path, undefined, { headers: { Authorization: `Bearer ${staffLogin.data.access_token}` } })
    assert.equal(staffDenied.status, 403, staffDenied.text)
    assert.equal(errorCode(staffDenied), 'FORBIDDEN')
    assert.notDeepEqual(staffDenied.bytes, paymentProofPng)
    const proof = await owner.request('GET', path, undefined, { headers })
    assert.equal(proof.status, 200, proof.text)
    assert.equal(proof.headers.get('content-type'), 'image/png')
    assert.match(proof.headers.get('cache-control'), /(?:^|[,\s])no-store(?:$|[,\s])/)
    assert.deepEqual(proof.bytes, paymentProofPng)
    const exposed = (await listing()).find(order => order.id === placed.order_id)
    assert.deepEqual(exposed.buyer, body.customer)
    assert.deepEqual(Object.keys(exposed.payment_proof).sort(), ['mime', 'size', 'submitted_at'])
    assert.equal(exposed.payment_proof.mime, 'image/png')
    assert.equal(exposed.payment_proof.size, paymentProofPng.length)
    assert.ok(Number.isFinite(Date.parse(exposed.payment_proof.submitted_at)))
    assert.equal(JSON.stringify(exposed).includes(paymentProofPng.toString('base64')), false)
    const cash = await buyer.request('POST', '/orders', orderBody(productIds[8]))
    assert.equal(cash.status, 200, cash.text)
    await reject('GET', `/orders/${cash.data.order_id}/payment-proof`, undefined, 404, 'PAYMENT_PROOF_NOT_FOUND')
    await reject('GET', `/orders/${randomUUID()}/payment-proof`, undefined, 404, 'PAYMENT_PROOF_NOT_FOUND')
  })

  await t.test('QRIS remains unpaid under manual review until owner verifies it and never auto-expires', async () => {
    const id = productIds[9]
    const placed = await create(guestClient(origin), qrisOrderBody(id, 3499000, 1))
    assert.equal(placed.expires_at, null)
    const pending = await storedOrder(placed.order_id)
    assert.equal(pending.status, 'CONFIRMED')
    assert.equal(pending.payment_method, 'QRIS')
    assert.equal(pending.payment_status, 'UNPAID')
    assert.equal(pending.payment_review, 'PENDING')
    assert.equal(pending.payment_review_note, null)
    assert.equal(pending.paid_at, null)
    assert.equal(pending.expires_at, null)
    assert.equal(await stockOf(id), 19)
    // Even an old deadline must not turn manual evidence review into stock release.
    await sql`update orders set expires_at=now()-interval '1 day' where id=${placed.order_id}`
    for (let i = 0; i < 2; i++) {
      const listed = (await listing()).find(order => order.id === placed.order_id)
      assert.equal(listed.status, 'CONFIRMED')
      assert.equal(listed.payment_status, 'UNPAID')
      assert.equal(listed.payment_review, 'PENDING')
      assert.equal(listed.paid_at, null)
      assert.equal(await stockOf(id), 19)
    }
    const paid = await owner.request('POST', `/orders/${placed.order_id}/pay`, {}, { headers })
    assert.equal(paid.status, 200, paid.text)
    assert.equal(paid.data.payment_status, 'PAID')
    assert.equal(paid.data.payment_review, 'VERIFIED')
    assert.ok(Number.isFinite(Date.parse(paid.data.paid_at)))
    assert.equal(paid.data.expires_at, null)
    const again = await owner.request('POST', `/orders/${placed.order_id}/pay`, {}, { headers })
    assert.equal(again.status, 200, again.text)
    assert.equal(again.data.paid_at, paid.data.paid_at)
    assert.equal(again.data.payment_review, 'VERIFIED')
    const persisted = await storedOrder(placed.order_id)
    assert.equal(persisted.payment_review, 'VERIFIED')
    assert.equal(persisted.payment_status, 'PAID')
    assert.equal(persisted.paid_at.toISOString(), paid.data.paid_at)
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='ORDER_PAID' and detail->>'order_id'=${placed.order_id}`)[0].n), 1)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${placed.order_id}`).length, 1)
  })

  await t.test('paid delivery advances one step at a time with stable shipment timestamps and no cancellation restock', async () => {
    const id = productIds[10]
    const buyer = guestClient(origin)
    const body = qrisOrderBody(id, 7998000, 2)
    body.fulfillment = { method: 'DELIVERY', recipient: 'Penerima Test', phone: '081234567890', address: 'Jalan Test 1, Bandung' }
    const placed = await create(buyer, body)
    const orderId = placed.order_id
    const pending = (await listing()).find(order => order.id === orderId)
    assert.equal(pending.delivery_status, 'NOT_SHIPPED')
    assert.equal(pending.shipped_at, null)
    assert.equal(pending.delivered_at, null)
    assert.deepEqual(pending.fulfillment, body.fulfillment)
    const denied = await buyer.request('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' })
    assert.equal(denied.status, 401, denied.text)
    await reject('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, 409, 'NOT_PAID')
    assert.equal((await storedOrder(orderId)).delivery_status, 'NOT_SHIPPED')
    assert.equal((await storedOrder(orderId)).shipped_at, null)
    assert.equal((await storedOrder(orderId)).delivered_at, null)
    assert.equal(await stockOf(id), 18)
    const paid = await owner.request('POST', `/orders/${orderId}/pay`, {}, { headers })
    assert.equal(paid.status, 200, paid.text)
    assert.equal(paid.data.payment_review, 'VERIFIED')
    await sql`update orders set payment_review='PENDING' where id=${orderId}`
    await reject('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, 409, 'NOT_PAID')
    assert.equal((await storedOrder(orderId)).delivery_status, 'NOT_SHIPPED')
    await sql`update orders set payment_review='VERIFIED' where id=${orderId}`
    await reject('POST', `/orders/${orderId}/delivery`, { status: 'DELIVERED' }, 409, 'INVALID_STATE')
    await reject('POST', `/orders/${orderId}/complete`, {}, 409, 'DELIVERY_NOT_DELIVERED')
    const beforeShipping = Date.now()
    const shippingResults = await Promise.all([
      owner.request('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, { headers }),
      owner.request('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, { headers })
    ])
    const afterShipping = Date.now()
    for (const result of shippingResults) {
      assert.equal(result.status, 200, result.text)
      assert.equal(result.data.delivery_status, 'SHIPPING')
      assert.equal(result.data.delivered_at, null)
    }
    const shipping = shippingResults[0].data
    assert.equal(shippingResults[1].data.shipped_at, shipping.shipped_at)
    assert.ok(Date.parse(shipping.shipped_at) >= beforeShipping && Date.parse(shipping.shipped_at) <= afterShipping)
    const shippingAgain = await owner.request('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, { headers })
    assert.equal(shippingAgain.status, 200, shippingAgain.text)
    assert.equal(shippingAgain.data.shipped_at, shipping.shipped_at)
    await reject('POST', `/orders/${orderId}/complete`, {}, 409, 'DELIVERY_NOT_DELIVERED')
    await reject('POST', `/orders/${orderId}/cancel`, { reason: 'Do not restock shipped goods' }, 409, 'SHIPMENT_STARTED')
    assert.equal(await stockOf(id), 18)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${orderId}`).length, 1)
    const beforeDelivery = Date.now()
    const delivered = await owner.request('POST', `/orders/${orderId}/delivery`, { status: 'DELIVERED' }, { headers })
    const afterDelivery = Date.now()
    assert.equal(delivered.status, 200, delivered.text)
    assert.equal(delivered.data.delivery_status, 'DELIVERED')
    assert.equal(delivered.data.shipped_at, shipping.shipped_at)
    assert.ok(Date.parse(delivered.data.delivered_at) >= beforeDelivery && Date.parse(delivered.data.delivered_at) <= afterDelivery)
    const deliveredAgain = await owner.request('POST', `/orders/${orderId}/delivery`, { status: 'DELIVERED' }, { headers })
    assert.equal(deliveredAgain.status, 200, deliveredAgain.text)
    assert.equal(deliveredAgain.data.shipped_at, delivered.data.shipped_at)
    assert.equal(deliveredAgain.data.delivered_at, delivered.data.delivered_at)
    await reject('POST', `/orders/${orderId}/delivery`, { status: 'SHIPPING' }, 409, 'INVALID_STATE')
    await reject('POST', `/orders/${orderId}/cancel`, {}, 409, 'SHIPMENT_STARTED')
    const persisted = await storedOrder(orderId)
    assert.equal(persisted.status, 'CONFIRMED')
    assert.equal(persisted.delivery_status, 'DELIVERED')
    assert.equal(persisted.shipped_at.toISOString(), shipping.shipped_at)
    assert.equal(persisted.delivered_at.toISOString(), delivered.data.delivered_at)
    assert.equal(await stockOf(id), 18)
    const completed = await owner.request('POST', `/orders/${orderId}/complete`, {}, { headers })
    assert.equal(completed.status, 200, completed.text)
    assert.equal(completed.data.status, 'COMPLETED')
    assert.equal(completed.data.delivery_status, 'DELIVERED')
    assert.equal(completed.data.shipped_at, shipping.shipped_at)
    assert.equal(completed.data.delivered_at, delivered.data.delivered_at)
    assert.equal(await stockOf(id), 18)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${orderId}`).length, 1)
    const completedReplay = await owner.request('POST', `/orders/${orderId}/delivery`, { status: 'DELIVERED' }, { headers })
    assert.equal(completedReplay.status, 200, completedReplay.text)
    assert.equal(completedReplay.data.delivered_at, delivered.data.delivered_at)
    await reject('POST', `/orders/${orderId}/cancel`, {}, 409, 'INVALID_STATE')
    const pickup = await create(guestClient(origin), qrisOrderBody(productIds[11], 249000))
    const pickupPaid = await owner.request('POST', `/orders/${pickup.order_id}/pay`, {}, { headers })
    assert.equal(pickupPaid.status, 200, pickupPaid.text)
    await reject('POST', `/orders/${pickup.order_id}/delivery`, { status: 'SHIPPING' }, 409, 'INVALID_STATE')
  })

  await t.test('rejecting pending proof persists operator reason and returns reserved stock exactly once', async () => {
    const id = productIds[12]
    const placed = await create(guestClient(origin), qrisOrderBody(id, 37998000, 2))
    const reason = 'Bukti transfer tidak cocok dengan nominal pesanan'
    const cancelled = await owner.request('POST', `/orders/${placed.order_id}/cancel`, { reason }, { headers })
    assert.equal(cancelled.status, 200, cancelled.text)
    assert.equal(cancelled.data.status, 'CANCELLED')
    assert.equal(cancelled.data.payment_status, 'UNPAID')
    assert.equal(cancelled.data.payment_review, 'REJECTED')
    assert.equal(cancelled.data.payment_review_note, reason)
    assert.equal(cancelled.data.paid_at, null)
    const persisted = await storedOrder(placed.order_id)
    assert.equal(persisted.payment_review, 'REJECTED')
    assert.equal(persisted.payment_review_note, reason)
    assert.equal(await stockOf(id), 20)
    const exposed = (await listing()).find(order => order.id === placed.order_id)
    assert.equal(exposed.payment_review_note, reason)
    assert.equal(exposed.payment_review, 'REJECTED')
    assert.equal(exposed.payment_proof.size, paymentProofPng.length)
    assert.equal((await sql`select id from inventory_transactions where reference_id=${placed.order_id} and reference_type='CANCELLATION'`).length, 1)
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='REVIEW_REJECTED' and detail->>'order_id'=${placed.order_id}`)[0].n), 1)
    const proof = await owner.request('GET', `/orders/${placed.order_id}/payment-proof`, undefined, { headers })
    assert.equal(proof.status, 200, proof.text)
    assert.deepEqual(proof.bytes, paymentProofPng)
    await reject('POST', `/orders/${placed.order_id}/cancel`, { reason: 'Replacement reason must not overwrite' }, 409, 'INVALID_STATE')
    await reject('POST', `/orders/${placed.order_id}/pay`, {}, 409, 'INVALID_STATE')
    assert.equal((await storedOrder(placed.order_id)).payment_review_note, reason)
    assert.equal(await stockOf(id), 20)
    const noReason = await create(guestClient(origin), qrisOrderBody(productIds[13], 21999000))
    await reject('POST', `/orders/${noReason.order_id}/cancel`, {}, 422, 'VALIDATION')
    const stillPending = await storedOrder(noReason.order_id)
    assert.equal(stillPending.status, 'CONFIRMED')
    assert.equal(stillPending.payment_review, 'PENDING')
    assert.equal(stillPending.payment_review_note, null)
  })
})
