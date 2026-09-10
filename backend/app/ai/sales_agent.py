"""Sales Agent — channel-agnostic inti percakapan (BR-09).

Pipeline: terima InboundMessage -> jalankan LLM dengan tool calling (PRODUCT_TOOLS)
-> jalankan tool -> LLM narasi -> simpan ConversationMessage + Recommendation -> balas.
create_order TIDAK pernah dipanggil dari sini (hanya via event CONFIRM, UC-02 E5).
"""

import logging
from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_llm, model_for
from app.ai.prompts import PRODUCT_TOOLS, SALES_AGENT_SYSTEM
from app.ai.tools import ToolExecutor
from app.schemas.catalog import ProductOut
from app.schemas.chat import ChatReply, OrderSummary
from app.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


class SalesAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = get_llm(model_for("fast"))
        self.tools = ToolExecutor(db)

    async def handle_message(
        self, *, conversation_id: str, sender: str, content: str, channel: str
    ) -> ChatReply:
        # simpan pesan customer
        await ConversationService.add_message(
            self.db, conversation_id, sender=sender, content=content, message_type="TEXT"
        )

        # ambil konteks 12 pesan terakhir (P3)
        conv, messages, _ = await ConversationService.detail(self.db, conversation_id)
        if not conv:
            return ChatReply(reply="Percakapan tidak ditemukan.")
        history = [
            {"role": "user" if m.sender == "CUSTOMER" else "assistant", "content": m.content}
            for m in messages[-12:]
        ]
        if history and history[-1]["role"] != "user":
            history[-1] = {"role": "user", "content": content}

        # LLM loop dengan tool calling (maks 3 iterasi)
        msg_history = list(history)
        final_content = ""
        tool_result_data: dict[str, Any] = {}
        for _ in range(3):
            resp = await self.llm.complete(system=SALES_AGENT_SYSTEM, messages=msg_history, tools=PRODUCT_TOOLS)
            if not resp.tool_calls:
                logger.info("sales conv=%s: iterasi tanpa tool call", conversation_id)
                final_content = resp.content or "Mohon maaf, saya belum bisa menjawab. Coba sebutkan nama produk."
                break
            for tc in resp.tool_calls:
                logger.info("sales conv=%s: tool=%s args=%s", conversation_id, tc.name, tc.arguments)
                result = await self.tools.call(tc.name, tc.arguments)
                tool_result_data[tc.name] = result
                msg_history.append({"role": "assistant", "content": f"tool: {tc.name}"})
                msg_history.append({"role": "user", "content": f"hasil tool {tc.name}: {result}"})
        else:
            resp = await self.llm.complete(system=SALES_AGENT_SYSTEM, messages=msg_history)
            final_content = resp.content or final_content

        # simpan balasan AI
        await ConversationService.add_message(
            self.db, conversation_id, sender="AI", content=final_content, message_type="TEXT"
        )

        # simpan rekomendasi produk (FR-SA-01/03)
        search = tool_result_data.get("search_products", {}).get("items", [])
        for item in search[:3]:
            await ConversationService.add_recommendation(
                self.db, conversation_id, item["id"], f"Direkomendasikan dari pencarian '{content[:60]}'"
            )

        # ekstrak order summary bila tool build_order_summary dipanggil
        order_summary = None
        os_result = tool_result_data.get("build_order_summary")
        if os_result and "summary" in os_result:
            order_summary = OrderSummary.model_validate(os_result["summary"])

        # produk untuk kartu tampilan (dict LENGKAP sesuai ProductOut — response
        # ChatReply divalidasi pydantic; item tak valid dilewati agar satu item
        # aneh tidak me-500-kan seluruh chat)
        products = []
        for i in search[:5]:
            try:
                products.append(ProductOut.model_validate(i).model_dump())
            except ValidationError:
                logger.warning("Item pencarian tidak valid, dilewati: %r", i.get("id"))
        return ChatReply(reply=final_content, products=products, order_summary=order_summary)
