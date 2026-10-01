import { requireOwner } from '../../../utils/auth'
import { ensureSeeded } from '../../../utils/business'
import { toolCall } from '../../../utils/agents'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const q = getQuery(event)
  const path = event.path || ''
  if (path.includes('/inventory')) {
    return await toolCall(db, 'analyze_inventory', { threshold_days: q.threshold_days ? Number(q.threshold_days) : undefined })
  }
  if (path.includes('/channels')) {
    return await toolCall(db, 'channel_distribution', { from_date: q.from_date, to_date: q.to_date })
  }
  // sales
  const from = q.from_date ? String(q.from_date) : undefined
  const to = q.to_date ? String(q.to_date) : undefined
  if (from && to && new Date(to) <= new Date(from)) {
    throw createError({ statusCode: 422, message: 'to_date harus setelah from_date', data: { detail: { code: 'VALIDATION', message: 'to_date harus setelah from_date' } } })
  }
  return await toolCall(db, 'analyze_sales', {
    from_date: from, to_date: to,
    group_by: q.group_by ? String(q.group_by) : 'product',
    top: q.top ? Number(q.top) : 10
  })
})
