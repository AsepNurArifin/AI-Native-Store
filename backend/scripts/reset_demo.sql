TRUNCATE TABLE
    order_items,
    orders,
    inventory_transactions,
    promotions,
    recommendations,
    conversation_messages,
    conversations,
    approvals,
    audit_logs,
    ai_actions,
    idempotency_keys,
    customers,
    products,
    users
RESTART IDENTITY CASCADE;
