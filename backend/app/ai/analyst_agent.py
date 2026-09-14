"""Business Analyst Agent — FR-BA-01/02. Semua angka dari SQL (NFR-09/10)."""

import logging
import re
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_llm, model_for, tool_roundtrip_messages
from app.ai.prompts import ANALYST_AGENT_SYSTEM, ANALYST_TOOLS
from app.ai.tools import ToolExecutor
from app.schemas.chat import AnalystQueryResponse

logger = logging.getLogger(__name__)


class AnalystAgent:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = get_llm(model_for("reasoning"))
        self.tools = ToolExecutor(db)

    async def ask(self, question: str) -> AnalystQueryResponse:
        msg_history: list[dict] = [{"role": "user", "content": question}]
        data: dict = {}
        query_used: str | None = None

        for _ in range(3):
            resp = await self.llm.complete(system=ANALYST_AGENT_SYSTEM, messages=msg_history, tools=ANALYST_TOOLS)
            if not resp.tool_calls:
                break
            results = []
            for tc in resp.tool_calls:
                # normalisasi tanggal relatif (default: 30 hari terakhir)
                args = self._normalize_dates(tc.name, tc.arguments)
                result = await self.tools.call(tc.name, args)
                query_used = tc.name
                data = result
                results.append(result)
            msg_history.extend(tool_roundtrip_messages(resp, results))

        narration = await self._narrate(question, data, msg_history)
        # FR-BA-05 (§2.6): disclaimer khusus bila jawaban menyangkut data customer/
        # distribusi channel — lebih spesifik daripada disclaimer generik.
        if query_used == "channel_distribution":
            disclaimer = (
                "Dihasilkan AI dari data transaksi internal. Distribusi per channel "
                "bisa berbeda dari laporan resmi pihak ketiga; gunakan untuk acuan "
                "internal saja."
            )
        else:
            disclaimer = "Dihasilkan AI berdasarkan data toko. Angka dapat berbeda dari laporan resmi."
        return AnalystQueryResponse(answer=narration, data=data, query_used=query_used, disclaimer=disclaimer)

    def _normalize_dates(self, tool_name: str, args: dict) -> dict:
        if tool_name in ("analyze_sales", "channel_distribution") and "from_date" not in args:
            now = datetime.now()
            args["from_date"] = (now - timedelta(days=30)).isoformat()
            args["to_date"] = now.isoformat()
        return args

    async def _narrate(self, question: str, data: dict, history: list[dict]) -> str:
        if not data:
            return "Maaf, saya belum bisa menjawab pertanyaan itu dengan data yang tersedia saat ini."
        if "error" in data:
            return f"Tidak bisa menjawab: {data['error']}"
        try:
            resp = await self.llm.complete(
                system=ANALYST_AGENT_SYSTEM,
                messages=[*history, {"role": "user", "content": f"Jelaskan hasil berikut dalam bahasa Indonesia: {data}"}],
            )
            return resp.content or "Tidak ada narasi."
        except Exception as e:
            logger.warning("narration failed: %s", e)
            return f"Hasil kueri: {data}"
