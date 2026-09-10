"""Action Assistant — menerjemahkan instruksi Owner -> DRAFT AIAction (jalur 2, SRS §2.3)."""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_llm, model_for
from app.ai.prompts import ACTION_ASSISTANT_SYSTEM, ACTION_TOOLS
from app.ai.tools import ToolExecutor
from app.models import AIAction
from app.services.ai_action_service import AIActionService

logger = logging.getLogger(__name__)


class ActionAssistant:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = get_llm(model_for("reasoning"))
        self.tools = ToolExecutor(db)

    async def create_draft(self, instruction: str, requested_by: str) -> AIAction:
        """Instruksi -> (LLM) -> CREATE_PROMOTION_DRAFT -> simpan AIAction DRAFT."""
        resp = await self.llm.complete(
            system=ACTION_ASSISTANT_SYSTEM,
            messages=[{"role": "user", "content": instruction}],
            tools=ACTION_TOOLS,
        )
        draft_payload = None
        for tc in resp.tool_calls:
            result = await self.tools.call(tc.name, tc.arguments)
            if "draft" in result:
                draft_payload = result["draft"]
                break
        if not draft_payload:
            # fallback: LLM menjawab teks — coba parse JSON
            draft_payload = self._parse_json_fallback(resp.content, instruction)
        if not draft_payload:
            raise ValueError("Instruksi tidak bisa dipahami sebagai aksi. Jelaskan lebih detail (misal: 'buat promosi 10% untuk produk X').")

        action = await AIActionService.create_draft(
            self.db,
            requested_by=requested_by,
            action_type=draft_payload["action_type"],
            payload=draft_payload["payload"],
        )
        await self.db.commit()
        return action

    @staticmethod
    def _parse_json_fallback(content: str, instruction: str) -> dict | None:
        try:
            data = json.loads(content)
            return {"action_type": "CREATE_PROMOTION", "payload": data}
        except json.JSONDecodeError:
            return None
