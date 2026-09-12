"""Rate limiting in-memory sederhana (sliding window) — P5 / Fase 2 PLAN_PRODUCT_LAUNCH.

Dirancang untuk melindungi endpoint publik demo (chat, webhook)
dari spam/abuse tanpa menambah dependensi eksternal (Redis dsb.).

Batas desain (disadari, cocok untuk demo single-instance):
- State per-proses: reset saat restart, tidak dibagi antar worker/instance.
- Window disimpan per-key (default: IP klien dari X-Forwarded-For / peer).
- Housekeeping ringan: bucket berumur > 1 hari dibuang saat sweep berkala.

Produksi multi-instance nanti: ganti backend-nya ke Redis (antarmuka
dependency ini tetap, tinggal swap implementasi).
"""

import time
from collections import deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

# key -> deque[timestamp monotonik] (dict biasa + setdefault: mudah di-swap
# saat test dengan monkeypatch)
_buckets: dict[str, deque[float]] = {}
_last_sweep = 0.0
_SWEEP_INTERVAL = 3600.0  # 1 jam
_BUCKET_TTL = 86400.0  # 1 hari


def _client_key(request: Request) -> str:
    """Prioritas X-Forwarded-For (proxy Vercel/Railway), fallback peer host."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _sweep(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    stale = [k for k, q in _buckets.items() if not q or now - q[-1] > _BUCKET_TTL]
    for k in stale:
        del _buckets[k]


def rate_limit(max_requests: int, window_seconds: int):
    """Dependency factory: batas `max_requests` per `window_seconds` per klien.

    Terlampaui -> 429 dengan header Retry-After (detik sampai slot bebas).

    Penggunaan:
        @router.post("", dependencies=[Depends(rate_limit(5, 60))])
    """

    async def _check(request: Request) -> None:
        if not settings.rate_limit_enabled:
            # Dimatikan eksplisit (default-nya pytest mematikan via conftest;
            # test rate-limit mengaktifkannya kembali per-test).
            return
        now = time.monotonic()
        _sweep(now)
        key = _client_key(request)
        bucket = _buckets.setdefault(key, deque())
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            retry_after = int(bucket[0] + window_seconds - now) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Terlalu banyak permintaan. Coba lagi nanti.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)

    return _check
