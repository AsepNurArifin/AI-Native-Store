import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startRuntime } from './helpers/storefront-runtime.mjs'
import { guestClient } from './helpers/guest-client.mjs'

test('Admin settings, account revocation and ordered product gallery', async t => {
  const runtime = await startRuntime()
  t.after(runtime.stop)
  const client = guestClient(runtime.origin)
  const login = await client.request('POST', '/auth/login', { email: 'owner@shaf.test', password: runtime.ownerPassword })
  assert.equal(login.status, 200, login.text)
  let headers = { Authorization: `Bearer ${login.data.access_token}` }
  const publicClient = guestClient(runtime.origin)

  await t.test('settings are owner-only, persist publicly and reject incomplete QRIS atomically', async () => {
    const before = await publicClient.request('GET', '/settings')
    const denied = await publicClient.request('PATCH', '/settings', { store_name: 'Tidak sah' })
    assert.equal(denied.status, 401, denied.text)
    const invalid = await client.request('PATCH', '/settings', { store_name: 'Tidak tersimpan', qris_merchant_name: '' }, { headers })
    assert.equal(invalid.status, 422, invalid.text)
    const unchanged = await publicClient.request('GET', '/settings')
    assert.deepEqual(unchanged.data, before.data)
    const payload = { store_name: 'Toko Uji Nusantara', owner_name: 'Pemilik Nusantara', qris_merchant_name: 'Merchant Nusantara', qris_image_url: 'https://example.test/qris.png' }
    const saved = await client.request('PATCH', '/settings', payload, { headers })
    assert.equal(saved.status, 200, saved.text)
    const visible = await publicClient.request('GET', '/settings')
    assert.deepEqual(visible.data, payload)
    assert.match(visible.headers.get('cache-control'), /no-store/)
  })

  await t.test('gallery order, cover change and clearing survive separate reads', async () => {
    const images = ['https://example.test/front.png', 'https://example.test/spec.png', 'https://example.test/back.png']
    const created = await client.request('POST', '/products', { name: 'Produk galeri', category: 'Aksesori', price: 10000, initial_stock: 2, image_urls: images }, { headers })
    assert.equal(created.status, 201, created.text)
    const id = created.data.id
    const catalog = await publicClient.request('GET', `/catalog/${id}`)
    assert.deepEqual(catalog.data.image_urls, images)
    assert.equal(catalog.data.image_url, images[0])
    const reordered = [images[2], images[0]]
    const changed = await client.request('PATCH', `/products/${id}`, { image_urls: reordered }, { headers })
    assert.equal(changed.status, 200, changed.text)
    const secondRead = await publicClient.request('GET', `/catalog/${id}`)
    assert.deepEqual(secondRead.data.image_urls, reordered)
    assert.equal(secondRead.data.image_url, images[2])
    const invalid = await client.request('PATCH', `/products/${id}`, { image_urls: ['javascript:alert(1)'] }, { headers })
    assert.equal(invalid.status, 422, invalid.text)
    assert.deepEqual((await publicClient.request('GET', `/catalog/${id}`)).data.image_urls, reordered)
    const cleared = await client.request('PATCH', `/products/${id}`, { image_urls: [] }, { headers })
    assert.equal(cleared.status, 200, cleared.text)
    const emptyRead = await publicClient.request('GET', `/catalog/${id}`)
    assert.deepEqual(emptyRead.data.image_urls, [])
    assert.equal(emptyRead.data.image_url, null)
  })

  await t.test('credential changes require old password and revoke already-used tokens', async () => {
    const warmed = await client.request('GET', '/auth/me', undefined, { headers })
    assert.equal(warmed.status, 200, warmed.text)
    const failed = await client.request('PATCH', '/auth/account', { email: 'changed@shaf.test', current_password: 'wrong-password' }, { headers })
    assert.equal(failed.status, 422, failed.text)
    assert.equal((await client.request('GET', '/auth/me', undefined, { headers })).data.email, 'owner@shaf.test')
    const newPassword = 'New-admin-test-password!'
    const changed = await client.request('PATCH', '/auth/account', { email: 'changed@shaf.test', current_password: runtime.ownerPassword, new_password: newPassword }, { headers })
    assert.equal(changed.status, 200, changed.text)
    const oldSession = await client.request('GET', '/auth/me', undefined, { headers })
    assert.equal(oldSession.status, 401, oldSession.text)
    headers = { Authorization: `Bearer ${changed.data.access_token}` }
    const newSession = await client.request('GET', '/auth/me', undefined, { headers })
    assert.equal(newSession.status, 200, newSession.text)
    assert.equal(newSession.data.email, 'changed@shaf.test')
    const oldLogin = await publicClient.request('POST', '/auth/login', { email: 'owner@shaf.test', password: runtime.ownerPassword })
    assert.equal(oldLogin.status, 401, oldLogin.text)
    const freshLogin = await publicClient.request('POST', '/auth/login', { email: 'CHANGED@SHAF.TEST', password: newPassword })
    assert.equal(freshLogin.status, 200, freshLogin.text)
    const row = (await runtime.sql`select email,password_hash,auth_version from users where id=${runtime.ownerId}`)[0]
    assert.equal(row.email, 'changed@shaf.test')
    assert.notEqual(row.password_hash, newPassword)
    assert.equal(row.auth_version, 1)
  })
})
