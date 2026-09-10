from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import utcnow
from app.db.session import get_session
from app.models import Product
from app.schemas.chat import (
    AnalystQueryRequest,
    AnalystQueryResponse,
    ChatMessageRequest,
    ChatReply,
    ChatStartRequest,
    ChatStartResponse,
)
from app.services.conversation_service import ConversationService
from app.ai.sales_agent import SalesAgent
from app.ai.analyst_agent import AnalystAgent

router = APIRouter(prefix="/chat", tags=["chat"])

# public chat — no JWT (customer-facing, FR-SMS-07)


@router.post("/start", response_model=ChatStartResponse)
async def start_chat(body: ChatStartRequest, db: AsyncSession = Depends(get_session)):
    """FR-SMS-07 — start a WEB conversation (lazy identity from customer_ref)."""
    channel = body.channel or "WEB"
    customer_ref = body.customer_ref or f"guest|{utcnow().timestamp()}"
    name, _, contact = customer_ref.partition("|")
    customer = await ConversationService.ensure_customer(
        db, channel=channel, identifier=customer_ref, name=name or "Tamu", contact=contact or None
    )
    conv = await ConversationService.create(db, customer, channel)
    await db.commit()
    return ChatStartResponse(conversation_id=str(conv.id), customer_id=str(customer.id), channel=channel)


@router.post("/{conversation_id}/messages", response_model=ChatReply)
async def send_message(conversation_id: str, body: ChatMessageRequest, db: AsyncSession = Depends(get_session)):
    """FR-SMS-08 — customer message -> SalesAgent -> AI reply + optional order summary."""
    conv = await ConversationService.get(db, conversation_id)
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Percakapan tidak ditemukan")
    if conv.channel != "WEB":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Percakapan bukan channel WEB")

    agent = SalesAgent(db)
    reply = await agent.handle_message(
        conversation_id=conversation_id,
        sender="CUSTOMER",
        content=body.content,
        channel="WEB",
    )
    await db.commit()
    return reply


@router.post("/analyst/ask", response_model=AnalystQueryResponse)
async def ask_analyst(body: AnalystQueryRequest, db: AsyncSession = Depends(get_session)):
    """FR-BA-02 — natural language question -> structured query -> SQL -> narration."""
    agent = AnalystAgent(db)
    result = await agent.ask(body.question)
    return result
