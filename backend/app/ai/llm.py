"""LLM provider abstraction — SRS §11.

Default provider = "mock" (rule-based). Sistem tetap bisa demo/test offline tanpa API key.
Providers: mock | openai | google (gemini) | groq (OpenAI-compatible, semua Qwen)
Semua akses LLM lewat kelas ini (NFR-06: LLM tidak pernah query DB langsung).
"""

import json
import logging
import re
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMToolCall:
    def __init__(self, name: str, arguments: dict):
        self.name = name
        self.arguments = arguments


class LLMResponse:
    def __init__(self, content: str, tool_calls: list[LLMToolCall] | None = None):
        self.content = content
        self.tool_calls = tool_calls or []


class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(self, *, system: str, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        """messages: [{"role": "system"|"user"|"assistant", "content": str}]"""


class MockLLMProvider(BaseLLMProvider):
    """Rule-based fallback. Digunakan untuk: dev, CI, demo offline, dan sebagai
    baseline uji (NFR-07 benchmark)."""

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        last = messages[-1]["content"] if messages else ""
        return LLMResponse(content=self._mock_reply(last, system))

    def _mock_reply(self, text: str, system: str) -> str:
        t = text.lower()
        if "halo" in t or "hai" in t or "hi" in t or "pagi" in t or "siang" in t or "malam" in t:
            return "Halo! 👋 Saya asisten toko. Mau cari produk apa? Sebutkan produk atau kategori, atau ketik 'daftar produk'."
        if "daftar produk" in t or "katalog" in t or "list" in t:
            return "Berikut daftar produk yang tersedia:\n• Lihat katalog lengkap di menu Produk.\nKetik nama/kategori produk untuk detail, atau 'promo' untuk promosi aktif."
        if "promo" in t or "diskon" in t:
            return "Promo aktif saat ini: cek bagian Promosi di katalog. Mau saya carikan produk tertentu?"
        if "terima kasih" in t or "makasih" in t or "thanks" in t:
            return "Sama-sama! 😊 Ada lagi yang bisa saya bantu?"
        if "order" in t or "pesan" in t or "beli" in t:
            return "Siap! Untuk memesan, pilih produk dari hasil pencarian lalu tekan tombol konfirmasi. Saya akan buat ringkasan pesanan untuk Anda."
        return "Maaf, saya belum memahami permintaan itu. Coba sebutkan nama produk atau kategori yang ingin dicari, atau ketik 'daftar produk'."


class OpenAILLMProvider(BaseLLMProvider):
    """Chat Completions dengan tool calling (OpenAI-compatible)."""

    def __init__(self, api_key: str | None = None, model: str | None = None, base_url: str | None = None):
        import httpx

        self._client = httpx.AsyncClient(timeout=30)
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model
        self.base_url = (base_url or settings.llm_base_url).rstrip("/")

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        body = {
            "model": self.model,
            "temperature": settings.llm_temperature,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        resp = await self._client.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=body,
        )
        resp.raise_for_status()
        msg = resp.json()["choices"][0]["message"]
        tool_calls = []
        for tc in msg.get("tool_calls") or []:
            try:
                args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(LLMToolCall(tc["function"]["name"], args))
        return LLMResponse(content=msg.get("content") or "", tool_calls=tool_calls)


class GeminiLLMProvider(BaseLLMProvider):
    """Gemini (Google) dengan function calling."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        import httpx

        self._client = httpx.AsyncClient(timeout=30)
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": m["role"].replace("system", "user"), "parts": [{"text": m["content"]}]} for m in messages],
        }
        if tools:
            body["tools"] = [{"function_declarations": [self._to_gemini_tool(t) for t in tools]}]
        resp = await self._client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()
        try:
            content = data["candidates"][0]["content"]["parts"][0].get("text", "")
        except (KeyError, IndexError):
            content = ""
        tool_calls = []
        try:
            for p in data["candidates"][0]["content"]["parts"]:
                if "functionCall" in p:
                    name = p["functionCall"]["name"]
                    args = {k: v for k, v in p["functionCall"]["args"].items()}
                    tool_calls.append(LLMToolCall(name, args))
        except (KeyError, IndexError):
            pass
        return LLMResponse(content=content, tool_calls=tool_calls)

    @staticmethod
    def _to_gemini_tool(t: dict) -> dict:
        params = t.get("function", {}).get("parameters", {})
        return {
            "name": t["function"]["name"],
            "description": t["function"]["description"],
            "parameters": params,
        }


GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class LLM:
    """Facade — pilih provider dari env LLM_PROVIDER."""

    def __init__(self, model: str | None = None):
        self.provider: BaseLLMProvider = self._build(model)

    def _build(self, model: str | None = None) -> BaseLLMProvider:
        provider = (settings.llm_provider or "mock").lower()
        if provider == "openai":
            return OpenAILLMProvider(model=model)
        if provider == "google":
            return GeminiLLMProvider()
        if provider == "groq":
            return OpenAILLMProvider(
                api_key=settings.groq_api_key or settings.llm_api_key,
                model=model or settings.groq_model_fast,
                base_url=GROQ_BASE_URL,
            )
        if provider == "mock":
            return MockLLMProvider()
        raise ValueError(f"LLM_PROVIDER tidak dikenal: {provider}")

    async def complete(self, *, system: str, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        try:
            return await self.provider.complete(system=system, messages=messages, tools=tools)
        except Exception as e:  # graceful degradation (NFR-12)
            logger.warning("LLM call failed (%s) — safe unavailable response", type(e).__name__)
            return LLMResponse(
                "Layanan AI sementara tidak tersedia. Silakan coba lagi sebentar. "
                "Tidak ada pesanan atau perubahan data toko yang dibuat otomatis dari pesan ini."
            )


def model_for(role: str) -> str | None:
    """Model eksplisit per peran agen ("fast" | "reasoning").

    Hanya berlaku bila LLM_PROVIDER=groq (Sales→FAST, Analyst+Action→REASONING).
    Provider lain mengembalikan None = perilaku default masing-masing (tidak dirouting).
    """
    if (settings.llm_provider or "mock").lower() != "groq":
        return None
    if role == "reasoning":
        return settings.groq_model_reasoning or settings.groq_model_fast or None
    return settings.groq_model_fast or None


_llm_instances: dict[tuple[str, str], LLM] = {}


def get_llm(model: str | None = None) -> LLM:
    """Facade singleton per (provider, model) — aman dipakai 3 agen berbagi."""
    key = ((settings.llm_provider or "mock").lower(), model or "")
    if key not in _llm_instances:
        _llm_instances[key] = LLM(model=model)
    return _llm_instances[key]
