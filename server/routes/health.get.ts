export default defineEventHandler(async () => {
  try {
    const db = getDb()
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    return { status: 'ok' }
  }
  catch {
    throw createError({ statusCode: 503, message: 'degraded', data: { detail: 'database unreachable' } })
  }
})
