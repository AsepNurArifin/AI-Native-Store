import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { startRuntime } from './helpers/storefront-runtime.mjs'
import { guestClient, orderBody, errorCode } from './helpers/guest-client.mjs'

test('Guest checkout atomicity and retained order lifecycle', async t => {
  const runtime = await startRuntime()
  t.after(runtime.stop)
  const { sql, origin, productIds } = runtime
  const owner = guestClient(origin)
  const login = await owner.request('POST', '/auth/login', { email: 'owner@shaf.test', password: runtime.ownerPassword })
  assert.equal(login.status, 200, login.text)
  const headers = { Authorization: `Bearer ${login.data.access_token}` }
  const stockOf = async id => Number((await sql`select current_stock from v_product_stock where product_id=${id}`)[0].current_stock)
  const storedOrder = async id => (await sql`select * from orders where id=${id}`)[0]
  const movements = async id => [...await sql`select product_id,type,movement,reference_type,quantity from inventory_transactions where reference_id=${id} order by timestamp,id`]
  const create = async (client, body) => {
    const response = await client.request('POST', '/orders', body)
    assert.equal(response.status, 200, response.text)
    assert.ok(response.data.order_id)
    return response.data
  }

  await t.test('guest checkout reserves unpaid stock and persists buyer, fulfillment and net line price', async () => {
    const client = guestClient(origin)
    const id = productIds[0]
    const body = orderBody(id, 2)
    const before = Date.now()
    const placed = await create(client, body)
    const after = Date.now()
    assert.equal(placed.status, 'CONFIRMED')
    assert.equal(placed.total, 34198200)
    assert.equal(placed.replayed, false)
    assert.deepEqual(placed.items, [{ product_id: id, quantity: 2 }])
    const expires = Date.parse(placed.expires_at)
    assert.ok(expires >= before + 120 * 60000 && expires <= after + 120 * 60000)
    assert.equal(await stockOf(id), 18)
    const order = await storedOrder(placed.order_id)
    assert.equal(order.payment_status, 'UNPAID')
    assert.equal(order.payment_method, 'CASH')
    assert.equal(order.payment_review, null)
    assert.equal(order.payment_review_note, null)
    assert.equal(order.delivery_status, null)
    assert.equal(order.shipped_at, null)
    assert.equal(order.delivered_at, null)
    assert.deepEqual({ name: order.buyer_name, contact: order.buyer_contact, phone: order.buyer_phone }, body.customer)
    assert.equal(order.paid_at, null)
    assert.equal(order.channel_origin, 'WEB')
    assert.equal(order.conversation_id, null)
    assert.deepEqual(order.fulfillment, { method: 'PICKUP' })
    assert.equal(order.expires_at.toISOString(), placed.expires_at)
    const customer = (await sql`select * from customers where id=${order.customer_id}`)[0]
    assert.equal(customer.name, body.customer.name)
    assert.equal(customer.contact, body.customer.contact)
    assert.equal(customer.identifier, `web:${client.cookies.get('shaf_sid')}`)
    assert.equal(customer.channel, 'WEB')
    const lines = await sql`select product_id,quantity,price_at_order,line_total from order_items where order_id=${placed.order_id}`
    assert.equal(lines.length, 1)
    assert.equal(lines[0].product_id, id)
    assert.equal(lines[0].quantity, 2)
    assert.equal(Number(lines[0].price_at_order), 17099100)
    assert.equal(Number(lines[0].line_total), placed.total)
    assert.equal(Number(order.promotion_snapshot[id].discount_percentage), 10)
    assert.deepEqual(await movements(placed.order_id), [{ product_id: id, type: 'OUT', movement: 'OUT', reference_type: 'ORDER', quantity: 2 }])
    for (const action of ['pay', 'complete', 'cancel', 'delivery']) {
      const denied = await client.request('POST', `/orders/${placed.order_id}/${action}`, {})
      assert.equal(denied.status, 401, denied.text)
    }
    assert.equal((await storedOrder(placed.order_id)).payment_status, 'UNPAID')
    assert.equal(await stockOf(id), 18)
  })

  await t.test('sequential and concurrent retries reuse one order without another stock reservation', async () => {
    const client = guestClient(origin)
    const id = productIds[6]
    const body = orderBody(id, 3)
    await client.request('GET', '/checkout/session')
    const results = await Promise.all([
      client.request('POST', '/orders', body),
      client.request('POST', '/orders', body)
    ])
    for (const result of results) assert.equal(result.status, 200, result.text)
    assert.equal(results[0].data.order_id, results[1].data.order_id)
    assert.deepEqual(results.map(result => result.data.replayed).sort(), [false, true])
    const original = results.find(result => !result.data.replayed).data
    const replay = await create(client, body)
    assert.deepEqual(replay, { ...original, replayed: true })
    assert.equal(await stockOf(id), 17)
    assert.equal((await sql`select id from orders where id=${original.order_id}`).length, 1)
    assert.equal((await sql`select id from orders where id in (select order_id from order_items where product_id=${id})`).length, 1)
    assert.equal((await sql`select id from order_items where order_id=${original.order_id}`).length, 1)
    assert.equal((await movements(original.order_id)).length, 1)
    const keys = await sql`select order_id from idempotency_keys where key=${body.idempotency_key}`
    assert.deepEqual([...keys], [{ order_id: original.order_id }])
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='ORDER_CREATED' and detail->>'order_id'=${original.order_id}`)[0].n), 1)
  })

  await t.test('independent guests competing for the final unit cannot oversell', async () => {
    const id = productIds[3]
    await sql`insert into inventory_transactions (product_id,type,movement,reference_type,quantity) values (${id},'OUT','OUT','MANUAL',19)`
    const bodies = [orderBody(id), orderBody(id)]
    const clients = [guestClient(origin), guestClient(origin)]
    const results = await Promise.all(clients.map((client, index) => client.request('POST', '/orders', bodies[index])))
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409], results.map(result => result.text).join('\n'))
    const rejected = results.find(result => result.status === 409)
    assert.equal(errorCode(rejected), 'INSUFFICIENT_STOCK')
    assert.equal(await stockOf(id), 0)
    assert.equal((await sql`select id from order_items where product_id=${id}`).length, 1)
    assert.equal((await sql`select id from inventory_transactions where product_id=${id} and reference_type='ORDER'`).length, 1)
    assert.equal((await sql`select key from idempotency_keys where key in (${bodies[0].idempotency_key},${bodies[1].idempotency_key})`).length, 1)
  })

  await t.test('direct checkout uses current product price, active discount and stock rather than catalog snapshots', async () => {
    const client = guestClient(origin)
    const id = productIds[1]
    await sql`update products set price=100 where id=${id}`
    await sql`update promotions set discount_percentage=10 where product_id=${id}`
    const catalog = await client.request('GET', `/catalog/${id}`)
    assert.equal(catalog.status, 200, catalog.text)
    assert.equal(catalog.data.discounted_price, 90)
    assert.equal(catalog.data.current_stock, 20)
    await sql`update products set price=120 where id=${id}`
    await sql`update promotions set discount_percentage=25 where product_id=${id}`
    const discountedBody = orderBody(id, 2)
    discountedBody.expected_total = catalog.data.discounted_price
    const discounted = await create(client, discountedBody)
    assert.equal(discounted.total, 180)
    const discountedOrder = await storedOrder(discounted.order_id)
    assert.equal(Number(discountedOrder.promotion_snapshot[id].price_before), 120)
    assert.equal(Number(discountedOrder.promotion_snapshot[id].discount_per_unit), 30)
    assert.equal(Number(discountedOrder.promotion_snapshot[id].discount_percentage), 25)
    await sql`update products set price=130 where id=${id}`
    await sql`update promotions set status='REJECTED' where product_id=${id}`
    const current = await create(client, orderBody(id, 2))
    assert.equal(current.total, 260)
    assert.equal((await storedOrder(current.order_id)).promotion_snapshot, null)
    const line = (await sql`select price_at_order,line_total from order_items where order_id=${current.order_id}`)[0]
    assert.equal(Number(line.price_at_order), 130)
    assert.equal(Number(line.line_total), 260)
    await sql`insert into inventory_transactions (product_id,type,movement,reference_type,quantity) values (${id},'OUT','OUT','MANUAL',16)`
    const body = orderBody(id)
    const soldOut = await client.request('POST', '/orders', body)
    assert.equal(soldOut.status, 409, soldOut.text)
    assert.equal(errorCode(soldOut), 'INSUFFICIENT_STOCK')
    assert.equal(await stockOf(id), 0)
    const replay = await create(client, discountedBody)
    assert.equal(replay.order_id, discounted.order_id)
    assert.equal(replay.total, 180)
    assert.equal(replay.replayed, true)
    assert.equal(await stockOf(id), 0)
    assert.equal((await sql`select key from idempotency_keys where key=${body.idempotency_key}`).length, 0)
    assert.equal((await sql`select id from order_items where product_id=${id}`).length, 2)
  })

  await t.test('expired promotions are ignored at checkout even before their status is refreshed', async () => {
    const id = productIds[2]
    await sql`update products set price=200 where id=${id}`
    await sql`update promotions set end_date=now()-interval '1 minute' where product_id=${id}`
    const placed = await create(guestClient(origin), orderBody(id, 2))
    assert.equal(placed.total, 400)
    assert.equal((await storedOrder(placed.order_id)).promotion_snapshot, null)
    assert.equal(await stockOf(id), 18)
  })

  await t.test('a later unavailable line rolls back earlier line, customer, inventory and idempotency writes', async () => {
    const client = guestClient(origin)
    const available = productIds[7], unavailable = productIds[8]
    await sql`update products set status='INACTIVE' where id=${unavailable}`
    const body = orderBody(available, 2)
    body.items.push({ product_id: unavailable, quantity: 1 })
    const before = (await sql`select (select count(*)::int from orders) as orders, (select count(*)::int from customers) as customers, (select count(*)::int from order_items) as items, (select count(*)::int from audit_logs) as audits`)[0]
    const result = await client.request('POST', '/orders', body)
    assert.equal(result.status, 409, result.text)
    assert.equal(errorCode(result), 'PRODUCT_INACTIVE')
    assert.equal(await stockOf(available), 20)
    assert.equal(await stockOf(unavailable), 20)
    assert.deepEqual((await sql`select (select count(*)::int from orders) as orders, (select count(*)::int from customers) as customers, (select count(*)::int from order_items) as items, (select count(*)::int from audit_logs) as audits`)[0], before)
    assert.equal((await sql`select id from inventory_transactions where product_id in (${available},${unavailable}) and reference_type='ORDER'`).length, 0)
    assert.equal((await sql`select key from idempotency_keys where key=${body.idempotency_key}`).length, 0)
    await sql`update products set status='ACTIVE' where id=${unavailable}`
    const retry = await create(client, body)
    assert.equal(retry.replayed, false)
    assert.equal(await stockOf(available), 18)
    assert.equal(await stockOf(unavailable), 19)
    assert.equal((await movements(retry.order_id)).length, 2)
  })

  await t.test('operator payment is idempotent, paid orders do not expire and completion never restocks', async () => {
    const id = productIds[4]
    const placed = await create(guestClient(origin), orderBody(id, 2))
    const orderId = placed.order_id
    const early = await owner.request('POST', `/orders/${orderId}/complete`, {}, { headers })
    assert.equal(early.status, 409, early.text)
    assert.equal(errorCode(early), 'NOT_PAID')
    assert.equal(await stockOf(id), 18)
    const paid = await owner.request('POST', `/orders/${orderId}/pay`, {}, { headers })
    assert.equal(paid.status, 200, paid.text)
    assert.equal(paid.data.payment_status, 'PAID')
    assert.ok(paid.data.paid_at)
    const paidAgain = await owner.request('POST', `/orders/${orderId}/pay`, {}, { headers })
    assert.equal(paidAgain.status, 200, paidAgain.text)
    assert.equal(paidAgain.data.paid_at, paid.data.paid_at)
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='ORDER_PAID' and detail->>'order_id'=${orderId}`)[0].n), 1)
    await sql`update orders set expires_at=now()-interval '1 minute' where id=${orderId}`
    const listing = await owner.request('GET', '/orders', undefined, { headers })
    assert.equal(listing.status, 200, listing.text)
    assert.equal((await storedOrder(orderId)).status, 'CONFIRMED')
    assert.equal(await stockOf(id), 18)
    const complete = await owner.request('POST', `/orders/${orderId}/complete`, {}, { headers })
    assert.equal(complete.status, 200, complete.text)
    assert.equal(complete.data.status, 'COMPLETED')
    assert.equal(complete.data.payment_status, 'PAID')
    for (const action of ['complete', 'cancel', 'pay']) {
      const rejected = await owner.request('POST', `/orders/${orderId}/${action}`, {}, { headers })
      assert.equal(rejected.status, 409, rejected.text)
      assert.equal(errorCode(rejected), 'INVALID_STATE')
    }
    assert.equal(await stockOf(id), 18)
    assert.equal((await movements(orderId)).length, 1)
  })

  await t.test('concurrent operator cancellation restores the reservation exactly once', async () => {
    const id = productIds[12]
    const placed = await create(guestClient(origin), orderBody(id, 2))
    assert.equal(await stockOf(id), 18)
    const results = await Promise.all([
      owner.request('POST', `/orders/${placed.order_id}/cancel`, {}, { headers }),
      owner.request('POST', `/orders/${placed.order_id}/cancel`, {}, { headers })
    ])
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409], results.map(result => result.text).join('\n'))
    assert.equal(errorCode(results.find(result => result.status === 409)), 'INVALID_STATE')
    const order = await storedOrder(placed.order_id)
    assert.equal(order.status, 'CANCELLED')
    assert.equal(order.payment_status, 'UNPAID')
    assert.ok(order.cancelled_at)
    assert.equal(await stockOf(id), 20)
    assert.deepEqual(await movements(placed.order_id), [
      { product_id: id, type: 'OUT', movement: 'OUT', reference_type: 'ORDER', quantity: 2 },
      { product_id: id, type: 'ADJUSTMENT', movement: 'IN', reference_type: 'CANCELLATION', quantity: 2 }
    ])
    const latePayment = await owner.request('POST', `/orders/${placed.order_id}/pay`, {}, { headers })
    assert.equal(latePayment.status, 409, latePayment.text)
    assert.equal(errorCode(latePayment), 'INVALID_STATE')
  })

  await t.test('cancelling a paid but uncompleted order preserves payment history and returns stock', async () => {
    const id = productIds[14]
    const placed = await create(guestClient(origin), orderBody(id, 2))
    const paid = await owner.request('POST', `/orders/${placed.order_id}/pay`, {}, { headers })
    assert.equal(paid.status, 200, paid.text)
    assert.equal(paid.data.payment_status, 'PAID')
    const cancelled = await owner.request('POST', `/orders/${placed.order_id}/cancel`, {}, { headers })
    assert.equal(cancelled.status, 200, cancelled.text)
    assert.equal(cancelled.data.status, 'CANCELLED')
    assert.equal(cancelled.data.payment_status, 'PAID')
    assert.equal(cancelled.data.paid_at, paid.data.paid_at)
    assert.equal(await stockOf(id), 20)
    assert.equal((await movements(placed.order_id)).length, 2)
    const listing = await owner.request('GET', '/orders', undefined, { headers })
    assert.equal(listing.status, 200, listing.text)
    assert.equal(await stockOf(id), 20)
  })

  await t.test('expired unpaid orders refuse payment and lazy expiry returns stock only once', async () => {
    const id = productIds[10]
    const placed = await create(guestClient(origin), orderBody(id, 3))
    assert.equal(await stockOf(id), 17)
    await sql`update orders set expires_at=now()-interval '1 minute' where id=${placed.order_id}`
    const latePayment = await owner.request('POST', `/orders/${placed.order_id}/pay`, {}, { headers })
    assert.equal(latePayment.status, 409, latePayment.text)
    assert.equal(errorCode(latePayment), 'ORDER_EXPIRED')
    assert.equal((await storedOrder(placed.order_id)).payment_status, 'UNPAID')
    assert.equal(await stockOf(id), 17)
    for (let i = 0; i < 2; i++) {
      const listing = await owner.request('GET', '/orders', undefined, { headers })
      assert.equal(listing.status, 200, listing.text)
      const expired = listing.data.find(order => order.id === placed.order_id)
      assert.equal(expired.status, 'CANCELLED')
      assert.equal(expired.payment_status, 'UNPAID')
      assert.equal(await stockOf(id), 20)
    }
    assert.equal((await movements(placed.order_id)).length, 2)
    assert.equal(Number((await sql`select count(*)::int as n from audit_logs where event='ORDER_CANCELLED' and detail->>'order_id'=${placed.order_id} and detail->>'reason'='expired_unpaid'`)[0].n), 1)
  })

  await t.test('guest identities stay stable while each purchase preserves its own buyer contact and phone', async () => {
    const a = guestClient(origin), b = guestClient(origin)
    const id = productIds[9]
    const firstBody = orderBody(id)
    firstBody.customer = { name: 'First Buyer', contact: 'first@example.test', phone: '081111111111' }
    const secondBody = orderBody(id)
    secondBody.customer = { name: 'Separate Buyer', contact: 'separate@example.test', phone: '082222222222' }
    const thirdBody = orderBody(id)
    thirdBody.customer = { name: 'Later Buyer', contact: 'later@example.test', phone: '083333333333' }
    const first = await create(a, firstBody)
    const second = await create(b, secondBody)
    const third = await create(a, thirdBody)
    const firstOrder = await storedOrder(first.order_id)
    const secondOrder = await storedOrder(second.order_id)
    const thirdOrder = await storedOrder(third.order_id)
    assert.notEqual(a.cookies.get('shaf_sid'), b.cookies.get('shaf_sid'))
    assert.notEqual(firstOrder.customer_id, secondOrder.customer_id)
    assert.equal(firstOrder.customer_id, thirdOrder.customer_id)
    assert.deepEqual({ name: firstOrder.buyer_name, contact: firstOrder.buyer_contact, phone: firstOrder.buyer_phone }, firstBody.customer)
    assert.deepEqual({ name: secondOrder.buyer_name, contact: secondOrder.buyer_contact, phone: secondOrder.buyer_phone }, secondBody.customer)
    assert.deepEqual({ name: thirdOrder.buyer_name, contact: thirdOrder.buyer_contact, phone: thirdOrder.buyer_phone }, thirdBody.customer)
    const listing = await owner.request('GET', '/orders', undefined, { headers })
    assert.equal(listing.status, 200, listing.text)
    for (const [placed, body] of [[first, firstBody], [second, secondBody], [third, thirdBody]]) {
      assert.deepEqual(listing.data.find(order => order.id === placed.order_id).buyer, body.customer)
    }
    const replay = await create(a, firstBody)
    assert.equal(replay.order_id, first.order_id)
    assert.equal(replay.replayed, true)
    const replayedOrder = await storedOrder(first.order_id)
    assert.deepEqual({ name: replayedOrder.buyer_name, contact: replayedOrder.buyer_contact, phone: replayedOrder.buyer_phone }, firstBody.customer)
    assert.equal(await stockOf(id), 17)
  })

  await t.test('restored chat confirmation retains price composition lock, expiry and replay semantics', async () => {
    const client = guestClient(origin)
    const customerId = randomUUID(), conversationId = randomUUID()
    const id = productIds[13]
    await sql`update products set price=100 where id=${id}`
    await sql`insert into promotions (product_id,discount_percentage,start_date,end_date,status) values (${id},10,now()-interval '1 day',now()+interval '2 days','ACTIVE')`
    await sql`insert into customers (id,channel,identifier,name) values (${customerId},'WEB',${`web:${randomUUID()}`},'Chat Guest')`
    await sql`insert into conversations (id,customer_id,channel,outcome) values (${conversationId},${customerId},'WEB','OPEN')`
    const ref = randomUUID().replaceAll('-', '')
    const summary = { summary_ref: ref, items: [{ product_id: id, name: 'Chat fixture', quantity: 2, unit_price: 100, discount_per_unit: 10, unit_effective: 90, line_total: 180 }], total: 180, channel: 'WEB' }
    await sql`insert into order_summaries (summary_ref,conversation_id,channel,payload,expires_at) values (${ref},${conversationId},'WEB',${sql.json(summary)},now()+interval '10 minutes')`
    await sql`update products set price=90 where id=${id}`
    await sql`update promotions set status='REJECTED' where product_id=${id}`
    const changed = await client.request('POST', `/chat/${conversationId}/confirm`, { order_summary_ref: ref })
    assert.equal(changed.status, 409, changed.text)
    assert.equal(errorCode(changed), 'PRICE_CHANGED')
    assert.equal(await stockOf(id), 20)
    assert.equal((await sql`select key from idempotency_keys where key=${`chat:${ref}`}`).length, 0)
    await sql`update products set price=100 where id=${id}`
    await sql`update promotions set status='ACTIVE' where product_id=${id}`
    await sql`update order_summaries set expires_at=now()-interval '1 minute' where summary_ref=${ref}`
    const expired = await client.request('POST', `/chat/${conversationId}/confirm`, { order_summary_ref: ref })
    assert.equal(expired.status, 410, expired.text)
    assert.equal(errorCode(expired), 'SUMMARY_EXPIRED')
    assert.equal(await stockOf(id), 20)
    await sql`update order_summaries set expires_at=now()+interval '10 minutes' where summary_ref=${ref}`
    const placed = await client.request('POST', `/chat/${conversationId}/confirm`, { order_summary_ref: ref, idempotency_key: randomUUID() })
    assert.equal(placed.status, 200, placed.text)
    assert.equal(placed.data.total, 180)
    assert.equal(placed.data.replayed, false)
    const replay = await client.request('POST', `/chat/${conversationId}/confirm`, { order_summary_ref: ref, idempotency_key: randomUUID() })
    assert.equal(replay.status, 200, replay.text)
    assert.equal(replay.data.order_id, placed.data.order_id)
    assert.equal(replay.data.replayed, true)
    assert.equal(await stockOf(id), 18)
    assert.equal((await storedOrder(placed.data.order_id)).payment_status, 'UNPAID')
    assert.equal((await storedOrder(placed.data.order_id)).payment_method, null)
    assert.equal((await storedOrder(placed.data.order_id)).payment_review, null)
    assert.equal((await sql`select outcome from conversations where id=${conversationId}`)[0].outcome, 'ORDERED')
    assert.equal((await movements(placed.data.order_id)).length, 1)
  })

  await t.test('Telegram secret and conversation ownership retain real guest order confirmation', async () => {
    const channelClient = guestClient(origin)
    const customerId = randomUUID(), conversationId = randomUUID()
    const ref = randomUUID().replaceAll('-', '')
    const id = productIds[16]
    const price = Number((await sql`select price from products where id=${id}`)[0].price)
    await sql`insert into customers (id,channel,identifier,name) values (${customerId},'TELEGRAM','912345678','Telegram Test')`
    await sql`insert into conversations (id,customer_id,channel,outcome) values (${conversationId},${customerId},'TELEGRAM','OPEN')`
    const summary = { summary_ref: ref, items: [{ product_id: id, name: 'Telegram fixture', quantity: 1, unit_price: price, discount_per_unit: 0, unit_effective: price, line_total: price }], total: price, channel: 'TELEGRAM' }
    await sql`insert into order_summaries (summary_ref,conversation_id,channel,payload,expires_at) values (${ref},${conversationId},'TELEGRAM',${sql.json(summary)},now()+interval '10 minutes')`
    const payload = { update_id: 20001, callback_query: { data: `CONFIRM:${ref}`, from: { id: 912345678 }, message: { chat: { id: 912345678 } } } }
    const denied = await channelClient.request('POST', '/webhooks/telegram', payload)
    assert.equal(denied.status, 401, denied.text)
    assert.equal(await stockOf(id), 20)
    const telegramHeaders = { 'X-Telegram-Bot-Api-Secret-Token': runtime.telegramSecret }
    const wrongOwner = await channelClient.request('POST', '/webhooks/telegram', {
      ...payload, update_id: 20000, callback_query: { ...payload.callback_query, from: { id: 912345679 }, message: { chat: { id: 912345679 } } }
    }, { headers: telegramHeaders })
    assert.equal(wrongOwner.status, 200, wrongOwner.text)
    assert.equal(wrongOwner.data.reply, 'mismatch')
    assert.equal((await sql`select id from orders where customer_id=${customerId}`).length, 0)
    assert.equal(await stockOf(id), 20)
    const result = await channelClient.request('POST', '/webhooks/telegram', payload, { headers: telegramHeaders })
    assert.equal(result.status, 200, result.text)
    assert.equal(result.data.reply, 'ordered')
    const orders = await sql`select * from orders where customer_id=${customerId}`
    assert.equal(orders.length, 1)
    assert.equal(orders[0].channel_origin, 'TELEGRAM')
    assert.equal(orders[0].payment_status, 'UNPAID')
    assert.equal(orders[0].payment_method, null)
    assert.equal(orders[0].payment_review, null)
    assert.equal(await stockOf(id), 19)
    assert.ok(runtime.telegramMessages.some(message => String(message.body.chat_id) === '912345678'))
    const replay = await channelClient.request('POST', '/webhooks/telegram', payload, { headers: telegramHeaders })
    assert.equal(replay.status, 200, replay.text)
    assert.equal(replay.data.status, 'duplicate')
    assert.equal(await stockOf(id), 19)
    assert.equal((await sql`select id from orders where customer_id=${customerId}`).length, 1)
    assert.equal((await movements(orders[0].id)).length, 1)
  })
})
