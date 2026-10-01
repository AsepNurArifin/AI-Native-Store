import { randomUUID } from 'node:crypto'
import { integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// Mirror backend/app/models/*.py — jangan rename kolom tanpa migrasi.
// DB Supabase eksisting dibuat via SQLAlchemy client-side defaults (tanpa
// server default), jadi semua default di sini juga client-side ($defaultFn),
// persis seperti perilaku backend Python (uuid4 / utcnow di aplikasi).

const uuidPk = () => uuid('id').primaryKey().$defaultFn(() => randomUUID())
const nowColumn = (name: string) => timestamp(name, { withTimezone: true }).notNull().$defaultFn(() => new Date())

export const users = pgTable('users', {
  id: uuidPk(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 10 }).notNull().default('OWNER'),
  status: varchar('status', { length: 10 }).notNull().default('ACTIVE'),
  createdAt: nowColumn('created_at')
})

export const customers = pgTable('customers', {
  id: uuidPk(),
  channel: varchar('channel', { length: 10 }).notNull(),
  identifier: varchar('identifier', { length: 150 }).notNull(),
  name: varchar('name', { length: 100 }),
  contact: varchar('contact', { length: 100 }),
  registeredAt: nowColumn('registered_at')
})

export const products = pgTable('products', {
  id: uuidPk(),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  specification: jsonb('specification').notNull().default({}),
  price: numeric('price', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status', { length: 10 }).notNull().default('ACTIVE'),
  lowStockThreshold: integer('low_stock_threshold'),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: nowColumn('created_at'),
  updatedAt: nowColumn('updated_at')
})

export const promotions = pgTable('promotions', {
  id: uuidPk(),
  productId: uuid('product_id').notNull(),
  discountPercentage: numeric('discount_percentage', { precision: 5, scale: 2 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 12 }).notNull().default('DRAFT'),
  createdAt: nowColumn('created_at')
})

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuidPk(),
  productId: uuid('product_id').notNull(),
  type: varchar('type', { length: 12 }).notNull().default('IN'),
  movement: varchar('movement', { length: 3 }).notNull(),
  referenceType: varchar('reference_type', { length: 12 }).notNull().default('MANUAL'),
  quantity: integer('quantity').notNull(),
  referenceId: uuid('reference_id'),
  actorId: uuid('actor_id'),
  timestamp: nowColumn('timestamp')
})

export const orders = pgTable('orders', {
  id: uuidPk(),
  customerId: uuid('customer_id').notNull(),
  status: varchar('status', { length: 12 }).notNull().default('CONFIRMED'),
  conversationId: uuid('conversation_id'),
  channelOrigin: varchar('channel_origin', { length: 10 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  promotionSnapshot: jsonb('promotion_snapshot'),
  fulfillment: jsonb('fulfillment'),
  createdAt: nowColumn('created_at'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true })
})

export const orderItems = pgTable('order_items', {
  id: uuidPk(),
  orderId: uuid('order_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  priceAtOrder: numeric('price_at_order', { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull()
})

export const conversations = pgTable('conversations', {
  id: uuidPk(),
  customerId: uuid('customer_id').notNull(),
  channel: varchar('channel', { length: 10 }).notNull(),
  startedAt: nowColumn('started_at'),
  lastActivityAt: nowColumn('last_activity_at'),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  outcome: varchar('outcome', { length: 20 })
})

export const conversationMessages = pgTable('conversation_messages', {
  id: uuidPk(),
  conversationId: uuid('conversation_id').notNull(),
  sender: varchar('sender', { length: 10 }).notNull(),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 12 }).notNull().default('TEXT'),
  rawPayload: jsonb('raw_payload'),
  timestamp: nowColumn('timestamp')
})

export const recommendations = pgTable('recommendations', {
  id: uuidPk(),
  conversationId: uuid('conversation_id').notNull(),
  productId: uuid('product_id').notNull(),
  reason: text('reason').notNull(),
  timestamp: nowColumn('timestamp')
})

export const aiActions = pgTable('ai_actions', {
  id: uuidPk(),
  actionType: varchar('action_type', { length: 30 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 28 }).notNull().default('DRAFT'),
  requestedBy: uuid('requested_by').notNull(),
  createdAt: nowColumn('created_at'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  resultTargetId: varchar('result_target_id', { length: 64 }),
  validationFailures: jsonb('validation_failures')
})

export const approvals = pgTable('approvals', {
  id: uuidPk(),
  aiActionId: uuid('ai_action_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  decision: varchar('decision', { length: 10 }).notNull(),
  note: text('note'),
  timestamp: nowColumn('timestamp')
})

export const auditLogs = pgTable('audit_logs', {
  id: uuidPk(),
  aiActionId: uuid('ai_action_id'),
  event: varchar('event', { length: 20 }).notNull(),
  actorType: varchar('actor_type', { length: 10 }).notNull(),
  actorId: uuid('actor_id'),
  detail: jsonb('detail').notNull().default({}),
  timestamp: nowColumn('timestamp')
})

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 64 }).primaryKey(),
  orderId: uuid('order_id'),
  createdAt: nowColumn('created_at')
})
