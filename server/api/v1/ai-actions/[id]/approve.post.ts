import { eq } from 'drizzle-orm'
import { aiActions, approvals, products, promotions } from '../../../../database/schema'
import { requireOwner } from '../../../../utils/auth'
import { checkOverlap, currentStock, ensureSeeded, logAudit, recordTx } from '../../../../utils/business'
import { isUuid } from '../../../../utils/errors'

async function validateCreatePromotion(db: ReturnType<typeof getDb>, payload: Record<string, unknown>): Promise<string[]> {
  const fails: string[] = []
  const pid = String(payload.product_id || '')
  if (!isUuid(pid)) return ['PRODUCT_NOT_FOUND']
  const rows = await db.select().from(products).where(eq(products.id, pid as never)).limit(1)
  if (!rows[0]) fails.push('PRODUCT_NOT_FOUND')
  else if (rows[0].status !== 'ACTIVE') fails.push('PRODUCT_INACTIVE')
  const start = payload.start_date ? new Date(String(payload.start_date)) : null
  const end = payload.end_date ? new Date(String(payload.end_date)) : null
  if (!start || !end || !(end > start)) fails.push('INVALID_DATE_RANGE')
  const d = Number(payload.discount_percentage)
  const maxD = Number(useRuntimeConfig().maxDiscountPercent ?? 50)
  if (!(d > 0 && d <= maxD)) fails.push('INVALID_DISCOUNT')
  if (fails.length === 0 && await checkOverlap(db, pid, start!, end!)) fails.push('PROMO_OVERLAP')
  return fails
}

export default defineEventHandler(async (event) => {
  const owner = await requireOwner(event)
  const db = getDb()
  await ensureSeeded(db)
  const id = String(getRouterParam(event, 'id') || '')
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })

  return await db.transaction(async (tx) => {
    const tdb = tx as unknown as ReturnType<typeof getDb>
    const rows = await tdb.select().from(aiActions).where(eq(aiActions.id, id as never)).limit(1)
    const a = rows[0]
    if (!a) throw createError({ statusCode: 404, message: 'AI Action tidak ditemukan', data: { detail: 'AI Action tidak ditemukan' } })
    if (a.status !== 'DRAFT') {
      throw createError({ statusCode: 409, message: `Aksi berstatus ${a.status}`, data: { detail: { code: 'INVALID_STATE', message: `Aksi berstatus ${a.status}` } } })
    }
    const now = new Date()
    await tdb.update(aiActions).set({ status: 'APPROVED', decidedAt: now as never }).where(eq(aiActions.id, id as never))
    await tdb.insert(approvals).values({ aiActionId: id as never, actorId: owner.id as never, decision: 'APPROVED' })
    await logAudit(tdb, 'APPROVED', 'USER', { actorId: owner.id, aiActionId: id })
    const payload = (a.payload || {}) as Record<string, unknown>

    if (a.actionType === 'CREATE_PROMOTION') {
      const fails = await validateCreatePromotion(tdb, payload)
      if (fails.length) {
        await tdb.update(aiActions).set({ status: 'APPROVED_VALIDATION_FAILED', validationFailures: { failures: fails } as never }).where(eq(aiActions.id, id as never))
        await logAudit(tdb, 'VALIDATION_FAILED', 'USER', { actorId: owner.id, aiActionId: id, detail: { failures: fails } })
        return { ai_action_id: id, status: 'APPROVED_VALIDATION_FAILED', result_target_id: null, validation_failures: { failures: fails } }
      }
      const ins = await tdb.insert(promotions).values({
        productId: String(payload.product_id) as never,
        discountPercentage: String(payload.discount_percentage) as never,
        startDate: new Date(String(payload.start_date)) as never,
        endDate: new Date(String(payload.end_date)) as never,
        status: 'ACTIVE'
      }).returning({ id: promotions.id })
      const targetId = String(ins[0].id)
      await tdb.update(aiActions).set({ status: 'EXECUTED', executedAt: new Date() as never, resultTargetId: targetId }).where(eq(aiActions.id, id as never))
      await logAudit(tdb, 'EXECUTED', 'USER', { actorId: owner.id, aiActionId: id, detail: { result_target_id: targetId } })
      return { ai_action_id: id, status: 'EXECUTED', result_target_id: targetId, validation_failures: null }
    }
    if (a.actionType === 'ADJUST_STOCK') {
      const pid = String(payload.product_id || '')
      const movement = String(payload.movement || '')
      const qty = Number(payload.quantity)
      const fails: string[] = []
      const pr = isUuid(pid) ? (await tdb.select().from(products).where(eq(products.id, pid as never)).limit(1))[0] : undefined
      if (!pr || pr.status !== 'ACTIVE') fails.push('PRODUCT_INACTIVE')
      if (!['IN', 'OUT'].includes(movement)) fails.push('INVALID_MOVEMENT')
      if (!Number.isInteger(qty) || qty <= 0) fails.push('INVALID_QTY')
      if (movement === 'OUT' && pr) {
        const stock = await currentStock(tdb, pid)
        if (stock < qty) fails.push('INSUFFICIENT_STOCK')
      }
      if (fails.length) {
        await tdb.update(aiActions).set({ status: 'APPROVED_VALIDATION_FAILED', validationFailures: { failures: fails } as never }).where(eq(aiActions.id, id as never))
        await logAudit(tdb, 'VALIDATION_FAILED', 'USER', { actorId: owner.id, aiActionId: id, detail: { failures: fails } })
        return { ai_action_id: id, status: 'APPROVED_VALIDATION_FAILED', result_target_id: null, validation_failures: { failures: fails } }
      }
      await recordTx(tdb, { productId: pid, type: 'ADJUSTMENT', movement: movement as 'IN' | 'OUT', referenceType: 'MANUAL', quantity: qty, referenceId: id, actorId: owner.id })
      await tdb.update(aiActions).set({ status: 'EXECUTED', executedAt: new Date() as never, resultTargetId: pid }).where(eq(aiActions.id, id as never))
      await logAudit(tdb, 'EXECUTED', 'USER', { actorId: owner.id, aiActionId: id, detail: { product_id: pid, movement, quantity: qty } })
      return { ai_action_id: id, status: 'EXECUTED', result_target_id: pid, validation_failures: null }
    }
    await tdb.update(aiActions).set({ status: 'APPROVED_VALIDATION_FAILED', validationFailures: { failures: ['UNSUPPORTED_ACTION'] } as never }).where(eq(aiActions.id, id as never))
    await logAudit(tdb, 'VALIDATION_FAILED', 'USER', { actorId: owner.id, aiActionId: id, detail: { failures: ['UNSUPPORTED_ACTION'] } })
    return { ai_action_id: id, status: 'APPROVED_VALIDATION_FAILED', result_target_id: null, validation_failures: { failures: ['UNSUPPORTED_ACTION'] } }
  })
})
