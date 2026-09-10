"""In-memory Order Summary store (summary_ref -> OrderSummary), TTL 30 menit.

Alasan: summary bersifat ephemeral (preview sebelum konfirmasi, UC-02).
Idempotency key di tabel idempotency_keys menangani double-click, bukan store ini.
F7+ (opsional): pindah ke tabel order_summaries bila perlu ketahanan multi-instance.
"""

import threading
import time

from app.schemas.chat import OrderSummary

_TTL_SECONDS = 30 * 60
_store: dict[str, tuple[float, OrderSummary]] = {}
_lock = threading.Lock()


def put(summary: OrderSummary) -> None:
    with _lock:
        _store[summary.summary_ref] = (time.time(), summary)


def get(ref: str) -> OrderSummary | None:
    with _lock:
        item = _store.get(ref)
        if not item:
            return None
        created, summary = item
        if time.time() - created > _TTL_SECONDS:
            _store.pop(ref, None)
            return None
        return summary


def purge_expired() -> None:
    now = time.time()
    with _lock:
        expired = [k for k, (t, _) in _store.items() if now - t > _TTL_SECONDS]
        for k in expired:
            _store.pop(k, None)
