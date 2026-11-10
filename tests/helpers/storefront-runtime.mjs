import { spawn, execFileSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { createServer as createHttpServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { paymentProofPng } from './payment-fixtures.mjs'

const root = resolve(import.meta.dirname, '../..')
const docker = (...args) => {
  try { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch (error) { throw new Error(`Docker ${args[0]} failed: ${String(error.stderr || 'Docker unavailable')}`) }
}
const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolvePort(port)) })
})
const pause = ms => new Promise(r => setTimeout(r, ms))
export async function startRuntime(mode = 'development', options = {}) {
  if (!['development', 'build', 'production'].includes(mode)) throw new Error(`Unknown runtime mode: ${mode}`)
  const run = randomUUID().replaceAll('-', '')
  const container = `shaf-test-${run}`
  const database = `shaf_test_${run}`
  const password = randomBytes(24).toString('hex')
  const temporary = await mkdtemp(join(tmpdir(), 'shaf-test-'))
  let sql, child, telegramSink, stopped = false
  const telegramMessages = []
  const stop = async () => {
    if (stopped) return
    stopped = true
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolveExit => child.once('exit', resolveExit))
      if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }) } catch {} }
      else child.kill('SIGTERM')
      await Promise.race([exited, pause(5000)])
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
        await exited
      }
    }
    try {
      await sql?.end({ timeout: 5 })
    } finally {
      try {
        if (telegramSink?.listening) await new Promise(resolveClose => telegramSink.close(resolveClose))
      } finally {
        try { docker('rm', '-f', container) } catch {}
        await rm(temporary, { recursive: true, force: true })
      }
    }
  }
  try {
    docker('run', '--detach', '--rm', '--name', container, '--label', `shaf.test.owner=${run}`, '-e', `POSTGRES_PASSWORD=${password}`, '-e', `POSTGRES_DB=${database}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine')
    const mapped = JSON.parse(docker('inspect', container))[0].NetworkSettings.Ports['5432/tcp'][0]
    const dbPort = Number(mapped.HostPort)
    const url = `postgresql://postgres:${password}@127.0.0.1:${dbPort}/${database}`
    if (!database.startsWith('shaf_test_') || mapped.HostIp !== '127.0.0.1') throw new Error('Unsafe test database target')
    sql = postgres(url, { max: 1, prepare: false, connect_timeout: 2 })
    let ready = false
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await sql`select 1`; ready = true; break } catch { await pause(500) }
    }
    if (!ready) throw new Error('Disposable PostgreSQL failed to start')
    for (const file of (await readdir(join(root, 'server/database/migrations'))).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
      await sql.unsafe(await readFile(join(root, 'server/database/migrations', file), 'utf8'))
    }
    const ownerId = '10000000-0000-4000-8000-000000000001'
    const ownerPassword = 'Shaf-test-only-password!'
    await sql`insert into users (id,name,email,password_hash,role,status) values (${ownerId},'Test Owner','owner@shaf.test',${await bcrypt.hash(ownerPassword, 10)},'OWNER','ACTIVE')`
    const names = [
      ['iPhone 15 Pro 128GB', 'Smartphone', 'Apple', 18999000],
      ['Samsung Galaxy S24 Ultra 256GB', 'Smartphone', 'Samsung', 21999000],
      ['iPad Air M2 128GB', 'Tablet', 'Apple', 10999000],
      ['AirPods Pro 2 USB-C', 'Audio', 'Apple', 3499000],
      ['Apple Watch SE 2', 'Wearable', 'Apple', 3999000],
      ['Casing Spigen iPhone', 'Aksesori', 'Spigen', 249000]
    ]
    const productIds = []
    for (let i = 0; i < 22; i++) {
      const [name, category, brand, price] = names[i % names.length]
      const id = `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
      productIds.push(id)
      await sql`insert into products (id,name,category,specification,price,status,image_urls) values (${id},${i < 6 ? name : `${name} — Pilihan ${i + 1}`},${category},${sql.json({ brand, storage_gb: 128 })},${price},'ACTIVE',${sql.json([])})`
      if (i !== 5) await sql`insert into inventory_transactions (product_id,type,movement,reference_type,quantity,actor_id) values (${id},'IN','IN','MANUAL',20,${ownerId})`
      if (i < 3) await sql`insert into promotions (id,product_id,discount_percentage,start_date,end_date,status) values (${`30000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`},${id},${10 + i * 5},now()-interval '1 day',now()+interval '2 days','ACTIVE')`
    }
    const port = await freePort()
    telegramSink = createHttpServer(async (request, response) => {
      if (request.method === 'GET' && request.url === '/qris.png') {
        response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
        response.end(paymentProofPng)
        return
      }
      let body = ''
      for await (const chunk of request) body += chunk
      telegramMessages.push({ path: request.url, body: JSON.parse(body || '{}') })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }))
    })
    await new Promise(resolveListen => telegramSink.listen(0, '127.0.0.1', resolveListen))
    const telegramOrigin = `http://127.0.0.1:${telegramSink.address().port}`
    const qrisImageUrl = options.qrisImageUrl === '' ? null : `${telegramOrigin}/qris.png`
    await sql`update store_settings set qris_image_url=${qrisImageUrl}, qris_merchant_name='Isolated Test Merchant' where id=1`
    const telegramSecret = randomBytes(24).toString('hex')
    const origin = `http://127.0.0.1:${port}`
    const secret = randomBytes(32).toString('hex')
    const envFile = join(temporary, 'runtime.env')
    const values = {
      APP_ENV: 'development', NUXT_APP_ENV: 'development', DEBUG: 'true', NUXT_DEBUG: 'true',
      DATABASE_URL: url, NUXT_DATABASE_URL: url, JWT_SECRET_KEY: secret, NUXT_JWT_SECRET: secret,
      ORDER_TTL_MINUTES: '120', NUXT_ORDER_TTL_MINUTES: '120', IDEMPOTENCY_TTL_MINUTES: '30', NUXT_IDEMPOTENCY_TTL_MINUTES: '30',
      SEED_ON_STARTUP: 'false', NUXT_SEED_ON_STARTUP: 'false', LLM_PROVIDER: 'mock', NUXT_LLM_PROVIDER: 'mock',
      TELEGRAM_PROVIDER: 'bot', NUXT_TELEGRAM_PROVIDER: 'bot', TELEGRAM_BOT_TOKEN: 'isolated-test-token', NUXT_TELEGRAM_BOT_TOKEN: 'isolated-test-token',
      TELEGRAM_API_BASE: telegramOrigin, NUXT_TELEGRAM_API_BASE: telegramOrigin, TELEGRAM_WEBHOOK_SECRET: telegramSecret, NUXT_TELEGRAM_WEBHOOK_SECRET: telegramSecret,
      NUXT_PUBLIC_SITE_URL: origin, NUXT_PUBLIC_API_BASE: '/api/v1',
      NUXT_BUILD_DIR: join(temporary, 'nuxt')
    }
    if (options.storageOrigin) Object.assign(values, {
      SUPABASE_URL: options.storageOrigin, NUXT_SUPABASE_URL: options.storageOrigin,
      SUPABASE_SERVICE_ROLE_KEY: 'isolated-storage-test-key', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'isolated-storage-test-key'
    })
    if (mode === 'production') Object.assign(values, {
      APP_ENV: 'production', NUXT_APP_ENV: 'production', DEBUG: 'false', NUXT_DEBUG: 'false',
      LLM_PROVIDER: 'groq', NUXT_LLM_PROVIDER: 'groq', TELEGRAM_PROVIDER: 'bot', NUXT_TELEGRAM_PROVIDER: 'bot',
      NUXT_PUBLIC_SITE_URL: origin.replace('http:', 'https:')
    })
    await writeFile(envFile, Object.entries(values).map(([k,v]) => `${k}=${v}`).join('\n'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(NUXT_|DATABASE_URL|JWT_|GROQ_|OPENROUTER_|LLM_|TELEGRAM_|SUPABASE_|SEED_|QRIS_|VERCEL|APP_ENV|DEBUG)/.test(key)))
    Object.assign(env, values, { NODE_ENV: mode === 'production' ? 'production' : 'development', HOST: '127.0.0.1', PORT: String(port), NUXT_TELEMETRY_DISABLED: '1' })
    const args = mode === 'development'
      ? [join(root, 'node_modules/nuxt/bin/nuxt.mjs'), 'dev', '--dotenv', envFile, '--host', '127.0.0.1', '--port', String(port)]
      : mode === 'build'
        ? [join(root, 'node_modules/nuxt/bin/nuxt.mjs'), 'build', '--dotenv', envFile]
        : [join(root, '.output/server/index.mjs')]
    child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', chunk => process.stdout.write(chunk))
    child.stderr.on('data', chunk => process.stderr.write(chunk))
    if (mode === 'build') {
      const code = await new Promise((r, reject) => { child.once('error', reject); child.once('exit', r) })
      if (code !== 0) throw new Error(`Build failed: ${code}`)
    } else {
      let listening = false
      for (let i = 0; i < 180; i++) {
        if (child.exitCode !== null) throw new Error(`Runtime exited: ${child.exitCode}`)
        try { const response = await fetch(`${origin}/api/v1/catalog/categories`, { signal: AbortSignal.timeout(3000) }); if (response.ok) { listening = true; break } } catch {}
        await pause(500)
      }
      if (!listening) throw new Error('Runtime did not become ready')
    }
    console.log(`SHAF_TEST_READY ${JSON.stringify({ mode, origin, database, dbPort, container, ownerEmail: 'owner@shaf.test' })}`)
    return { origin, sql, stop, ownerId, ownerPassword, productIds, envFile, env, container, telegramMessages, telegramSecret, qrisImageUrl }
  } catch (error) { await stop(); throw error }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2] || 'development'
  const runtime = await startRuntime(mode)
  if (mode === 'build') await runtime.stop()
  else {
    const shutdown = async () => { await runtime.stop(); process.exit(0) }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
    process.stdin.resume()
    process.stdin.on('data', input => { if (input.toString().trim() === 'stop' || input.includes(3)) void shutdown() })
    const keepAlive = setInterval(() => {}, 60000)
    process.once('exit', () => clearInterval(keepAlive))
  }
}
