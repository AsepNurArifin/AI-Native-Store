import { loadEnvFile, stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import bcryptPkg from 'bcryptjs'
import postgres from 'postgres'

const { genSalt, hash } = bcryptPkg

async function createAdmin() {
  if (process.argv.length !== 2) throw new Error('Jangan gunakan argumen akun. Jalankan npm run admin:create dan isi pertanyaan interaktif.')
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Gunakan terminal interaktif agar kata sandi dapat dimasukkan tanpa ditampilkan.')
  const configuredDatabaseUrl = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL
  try {
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('File .env tidak dapat dibaca.')
  }
  const databaseUrl = configuredDatabaseUrl || process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Isi DATABASE_URL atau NUXT_DATABASE_URL di .env sebelum membuat admin.')

  let muted = false
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) stdout.write(chunk, encoding)
      callback()
    }
  })
  output.columns = stdout.columns
  const controller = new AbortController()
  const rl = createInterface({ input: stdin, output, terminal: true, historySize: 0 })
  rl.on('SIGINT', () => controller.abort())
  rl.on('close', () => controller.abort())

  async function question(label, hidden = false) {
    muted = false
    const answer = rl.question(label, { signal: controller.signal })
    muted = hidden
    try {
      return await answer
    }
    finally {
      if (hidden) stdout.write('\n')
      muted = false
    }
  }

  let email
  let name
  let password
  let confirmation
  try {
    stdout.write('Buat akun pemilik toko\nKata sandi tidak akan ditampilkan atau disimpan sebagai teks.\n\n')
    email = (await question('Email admin: ')).trim().toLowerCase()
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Alamat email tidak valid, maksimal 255 karakter.')
    name = (await question('Nama admin: ')).trim()
    if (!name || name.length > 100) throw new Error('Nama admin wajib diisi, maksimal 100 karakter.')
    password = await question('Kata sandi (minimal 12 karakter, maksimal 72 byte UTF-8): ', true)
    if (Array.from(password).length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Kata sandi minimal 12 karakter dan maksimal 72 byte UTF-8.')
    confirmation = await question('Ulangi kata sandi: ', true)
    if (password !== confirmation) throw new Error('Konfirmasi kata sandi tidak sama.')
  }
  finally {
    rl.close()
    output.destroy()
  }

  let passwordHash
  try {
    passwordHash = await hash(password, await genSalt(10))
  }
  finally {
    password = undefined
    confirmation = undefined
  }
  const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 10 })
  try {
    await sql.begin(async (tx) => {
      // Lock yang sama dengan PATCH /auth/account; akun lama tidak diubah.
      await tx`SELECT pg_advisory_xact_lock(72702)`
      const duplicate = await tx`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`
      if (duplicate.length) throw new Error('Email sudah digunakan. Akun lama tetap dipertahankan; gunakan email lain.')
      await tx`INSERT INTO users (name, email, password_hash, role, status, auth_version) VALUES (${name}, ${email}, ${passwordHash}, 'OWNER', 'ACTIVE', 0)`
    })
    stdout.write('\nAdmin berhasil dibuat. Gunakan email dan kata sandi yang baru Anda masukkan untuk masuk.\n')
  }
  catch (error) {
    if (error.code === '23505') throw new Error('Email sudah digunakan. Akun lama tetap dipertahankan.')
    if (error.code === '42703' || error.code === '42P01') throw new Error('Skema database belum lengkap. Terapkan seluruh migrasi, termasuk 0009_admin_credentials.sql.')
    if (error.code) throw new Error('Tidak dapat membuat admin di database. Periksa koneksi dan migrasi database.')
    throw error
  }
  finally {
    passwordHash = undefined
    await sql.end({ timeout: 5 })
  }
}

try {
  await createAdmin()
}
catch (error) {
  if (error.name === 'AbortError') {
    console.error('\nPembuatan admin dibatalkan.')
  }
  else {
    console.error(`Gagal: ${error.message}`)
  }
  process.exitCode = 1
}
