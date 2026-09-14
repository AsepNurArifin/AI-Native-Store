/** Tipe TS mirror dari backend Pydantic schemas (sumber: backend/app/schemas/*.py). */

export interface UserOut {
  id: string
  name: string
  email: string
  role: 'OWNER' | string
  status: string
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserOut
}

export interface ProductOut {
  id: string
  name: string
  category: string
  specification: Record<string, unknown>
  price: number
  status: 'ACTIVE' | 'INACTIVE' | string
  low_stock_threshold: number | null
  current_stock: number
  is_low_stock: boolean
}

export interface PromotionOut {
  id: string
  product_id: string
  discount_percentage: number
  start_date: string
  end_date: string
  status: string
  created_at: string
}

export interface OrderItemOut {
  id: string
  product_id: string
  quantity: number
  price_at_order: number
  line_total: number
}

export interface OrderOut {
  id: string
  customer_id: string
  status: string
  conversation_id: string | null
  channel_origin: string
  total_amount: number
  promotion_snapshot: Record<string, unknown> | null
  fulfillment: FulfillmentInfo | null
  created_at: string
  completed_at: string | null
  cancelled_at: string | null
  items: OrderItemOut[]
}

export interface StockSummaryItem {
  product_id: string
  name: string
  category: string
  price: number
  current_stock: number
  low_stock_threshold: number | null
  is_low_stock: boolean
}

export interface InventoryTx {
  id: string
  product_id: string
  type: string
  movement: 'IN' | 'OUT' | string
  reference_type: string
  quantity: number
  reference_id: string | null
  actor_id: string | null
  timestamp: string
}

export interface CustomerOut {
  id: string
  channel: string
  identifier: string
  name: string
  contact: string | null
  registered_at: string
}

export interface CustomerDetail extends CustomerOut {
  orders: Array<{ id: string, status: string, total: number, created_at: string }>
}

export interface ConversationOut {
  id: string
  customer_id: string
  channel: string
  started_at: string
  last_activity_at: string
  ended_at: string | null
  outcome: string | null
}

export interface MessageOut {
  id: string
  sender: 'CUSTOMER' | 'AI' | string
  content: string
  message_type: string
  timestamp: string
}

export interface RecommendationOut {
  id: string
  product_id: string
  reason: string
  timestamp: string
}

export interface ConversationDetail extends ConversationOut {
  messages: MessageOut[]
  recommendations: RecommendationOut[]
}

export interface OrderSummaryItem {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  discount: number
  line_total: number
}

export interface OrderSummary {
  summary_ref: string
  items: OrderSummaryItem[]
  total: number
}

export interface ChatReply {
  reply: string
  products: ProductOut[]
  order_summary: OrderSummary | null
  needs_customer_info: boolean
}

export interface FulfillmentInfo {
  method: 'PICKUP' | 'DELIVERY'
  recipient?: string
  phone?: string
  address?: string
  notes?: string
}

export interface ConfirmOrderResponse {
  order_id: string
  status: string
  total: number
  items: Array<Record<string, unknown>>
  replayed: boolean
}

export interface AnalystResponse {
  answer: string
  data: Record<string, unknown>
  query_used: string | null
  disclaimer: string | null
}

export interface SalesAnalyticsRow {
  key: string
  units: number
  revenue: number
}

export interface SalesAnalytics {
  period: { from: string; to: string }
  group_by: string
  data: SalesAnalyticsRow[]
  product_names?: Record<string, string>
}

export interface InventoryRiskRow {
  product_id: string
  name: string
  category: string
  current_stock: number
  avg_daily_sales_30d: number
  estimated_days_left: string
  stockout_risk: boolean
}

export interface InventoryAnalytics {
  threshold_days: number
  data: InventoryRiskRow[]
}

export interface ChannelAnalytics {
  period: { from: string; to: string }
  total_orders: number
  by_channel: { channel: string; orders: number; percent: number }[]
}

export interface AIActionOut {
  id: string
  action_type: string
  payload: Record<string, unknown>
  status: string
  requested_by: string
  created_at: string
  decided_at: string | null
  executed_at: string | null
  result_target_id: string | null
  validation_failures: Record<string, unknown> | null
}

export interface AuditLogOut {
  id: string
  ai_action_id: string | null
  event: string
  actor_type: string
  actor_id: string | null
  detail: Record<string, unknown>
  timestamp: string
}

export interface ApiError {
  code: string
  message: string
}
