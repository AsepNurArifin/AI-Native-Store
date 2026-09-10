from app.schemas.auth import LoginRequest, LoginResponse, UserOut
from app.schemas.catalog import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    PromotionCreate,
    PromotionOut,
    PromotionUpdate,
)
from app.schemas.inventory import (
    AdjustmentCreate,
    InventoryTransactionOut,
    StockSummaryItem,
)
from app.schemas.order import (
    ConfirmOrderRequest,
    ConfirmOrderResponse,
    OrderItemOut,
    OrderOut,
)
from app.schemas.customer import (
    ConversationDetail,
    ConversationOut,
    CustomerDetail,
    CustomerOut,
    MessageOut,
    RecommendationOut,
)
from app.schemas.ai import AIActionOut, ApproveResponse, AuditLogOut, DraftRequest, RejectRequest
from app.schemas.chat import (
    AnalystQueryRequest,
    AnalystQueryResponse,
    ChatMessageRequest,
    ChatReply,
    ChatStartRequest,
    ChatStartResponse,
    OrderSummary,
    OrderSummaryItem,
)
from app.schemas.common import ApiError, PageResult

__all__ = [
    "LoginRequest",
    "LoginResponse",
    "UserOut",
    "ProductCreate",
    "ProductOut",
    "ProductUpdate",
    "PromotionCreate",
    "PromotionOut",
    "PromotionUpdate",
    "AdjustmentCreate",
    "InventoryTransactionOut",
    "StockSummaryItem",
    "ConfirmOrderRequest",
    "ConfirmOrderResponse",
    "OrderItemOut",
    "OrderOut",
    "ConversationDetail",
    "ConversationOut",
    "CustomerDetail",
    "CustomerOut",
    "MessageOut",
    "RecommendationOut",
    "AIActionOut",
    "ApproveResponse",
    "AuditLogOut",
    "DraftRequest",
    "RejectRequest",
    "AnalystQueryRequest",
    "AnalystQueryResponse",
    "ChatMessageRequest",
    "ChatReply",
    "ChatStartRequest",
    "ChatStartResponse",
    "OrderSummary",
    "OrderSummaryItem",
    "ApiError",
    "PageResult",
]
