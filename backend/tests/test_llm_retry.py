"""Test retry LLM saat 429/503 — regresi demo 14/09.

Rate limit token Groq tier gratis (8k TPM) terjangkau oleh satu giliran chat
Sales Agent (~3-4 panggilan x ~1.7k token). Tanpa retry, satu 429 mematikan
giliran: fallback "layanan tidak tersedia", build_order_summary tidak pernah
dipanggil, tombol konfirmasi tidak muncul di SEMUA channel sekaligus.
"""

import httpx
import pytest

from app.ai.llm import OpenAILLMProvider
from app.core.config import settings


def _ok_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
    )


class SleepRecorder:
    """Pengganti asyncio.sleep yang mencatat delay (tanpa menunggu sungguhan)."""

    def __init__(self, monkeypatch):
        self.delays: list[float] = []
        monkeypatch.setattr("app.ai.llm.asyncio.sleep", self._sleep)

    async def _sleep(self, delay: float) -> None:
        self.delays.append(delay)


def _provider_with(handler) -> OpenAILLMProvider:
    """Provider dengan HTTP client yang di-mock penuh (hermetik, tanpa jaringan)."""
    p = OpenAILLMProvider(api_key="test-key", model="test-model", base_url="https://llm.test/v1")
    p._client = httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5)
    return p


async def test_retry_429_lalu_sukses(monkeypatch):
    """429 pertama -> tunggu -> 200. Giliran chat harus selamat."""
    monkeypatch.setattr(settings, "llm_max_retries", 2, raising=False)
    rec = SleepRecorder(monkeypatch)
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"retry-after": "2"}, json={"error": "rate"})
        return _ok_response()

    p = _provider_with(handler)
    resp = await p.complete(system="s", messages=[{"role": "user", "content": "hi"}])

    assert resp.content == "ok"
    assert len(calls) == 2
    assert rec.delays == [2.0]  # menghormati Retry-After


async def test_retry_backoff_tanpa_header(monkeypatch):
    """Tanpa header Retry-After: backoff eksponensial 1s, 2s."""
    monkeypatch.setattr(settings, "llm_max_retries", 2, raising=False)
    rec = SleepRecorder(monkeypatch)
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) <= 2:
            return httpx.Response(429, json={"error": "rate"})
        return _ok_response()

    p = _provider_with(handler)
    resp = await p.complete(system="s", messages=[{"role": "user", "content": "hi"}])

    assert resp.content == "ok"
    assert len(calls) == 3
    assert rec.delays == [1.0, 2.0]


async def test_retry_habis_naikkan_exception(monkeypatch):
    """Semua percobaan 429 -> HTTPStatusError (facade LLM menangkap -> fallback aman)."""
    monkeypatch.setattr(settings, "llm_max_retries", 1, raising=False)
    rec = SleepRecorder(monkeypatch)
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, headers={"retry-after": "1"}, json={"error": "rate"})

    p = _provider_with(handler)
    with pytest.raises(httpx.HTTPStatusError):
        await p.complete(system="s", messages=[{"role": "user", "content": "hi"}])
    assert len(calls) == 2  # 1 awal + 1 retry


async def test_tanpa_retry_sukses_langsung(monkeypatch):
    """200 di percobaan pertama: tidak ada sleep, tidak ada retry."""
    monkeypatch.setattr(settings, "llm_max_retries", 2, raising=False)
    rec = SleepRecorder(monkeypatch)
    calls = []

    def handler(request):
        calls.append(request)
        return _ok_response()

    p = _provider_with(handler)
    resp = await p.complete(system="s", messages=[{"role": "user", "content": "hi"}])

    assert resp.content == "ok"
    assert len(calls) == 1
    assert rec.delays == []


async def test_max_retry_delay_di_clamp():
    """Retry-After sangat besar (mis. 60s) di-clamp agar giliran tidak menggantung."""
    resp = httpx.Response(429, headers={"retry-after": "60"})
    assert OpenAILLMProvider._retry_delay(resp, 0) == OpenAILLMProvider.MAX_RETRY_DELAY


async def test_503_juga_diretry(monkeypatch):
    """Overload sementara (503) ikut diretry, bukan langsung gagal."""
    monkeypatch.setattr(settings, "llm_max_retries", 1, raising=False)
    rec = SleepRecorder(monkeypatch)
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503, json={"error": "overloaded"})
        return _ok_response()

    p = _provider_with(handler)
    resp = await p.complete(system="s", messages=[{"role": "user", "content": "hi"}])

    assert resp.content == "ok"
    assert len(calls) == 2
