from fastapi import APIRouter

from app.api.routes import (
    ai_actions,
    analytics,
    audit,
    auth,
    chat,
    chat_confirm,
    conversations,
    customers,
    dev,
    health,
    inventory,
    orders,
    products,
    promotions,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(orders.router)
api_router.include_router(promotions.router)
api_router.include_router(customers.router)
api_router.include_router(conversations.router)
api_router.include_router(analytics.router)
api_router.include_router(ai_actions.router)
api_router.include_router(audit.router)
api_router.include_router(chat.router)
api_router.include_router(chat_confirm.router)
api_router.include_router(webhooks.router)
api_router.include_router(dev.router)
api_router.include_router(health.router)
