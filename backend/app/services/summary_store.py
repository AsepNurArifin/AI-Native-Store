"""In-memory Order Summary store (summary_ref -> OrderSummary), TTL 30 menit.

Dua indeks:
- per-ref        : summary_ref -> OrderSummary (dipakai endpoint confirm, UC-02 E5).
- per-conversation: conversation_id -> summary_ref — agar tombol konfirmasi bisa
  dirender ULANG pada giliran berikutnya (mis. pelanggan membalas "confirm order"
  secara verbal, atau LLM lupa memanggil build_order_summary lagi). Tanpa ini,
  tombol hanya muncul sekali dan tersesat di riwayat chat Telegram.

Alasan in-memory: summary bersifat ephemeral (preview sebelum konfirmasi, UC-02).
Idempotency key di tabel idempotency_keys menangani double-click, bukan store ini.
F7+ (opsional): pindah ke tabel order_summaries bila perlu ketahanan multi-instance.
"""

import threading
import time

from app.schemas.chat import OrderSummary

_TTL_SECONDS = 30 * 60
_store: dict[str, tuple[float, OrderSummary]] = {}
_conv_index: dict[str, tuple[float, str]] = {}  # conversation_id -> (ts, summary_ref)
_lock = threading.RLock()


def _get_nolock(ref: str) -> OrderSummary | None:
    """Lookup per-ref TANPA lock — pemanggil harus sudah memegang _lock."""
    item = _store.get(ref)
    if not item:
        return None
    created, summary = item
    if time.time() - created > _TTL_SECONDS:
        _store.pop(ref, None)
        return None
    return summary


def put(summary: OrderSummary) -> None:
    with _lock:
        _store[summary.summary_ref] = (time.time(), summary)


def get(ref: str) -> OrderSummary | None:
    with _lock:
        return _get_nolock(ref)


def put_for_conversation(conversation_id: str, summary: OrderSummary) -> None:
    """Catat summary terakhir sebuah sesi — dasar render ulang tombol konfirmasi."""
    with _lock:
        _conv_index[conversation_id] = (time.time(), summary.summary_ref)


def get_for_conversation(conversation_id: str) -> OrderSummary | None:
    """Summary aktif terakhir sesi ini (atau None bila belum ada/kedaluwarsa)."""
    with _lock:
        item = _conv_index.get(conversation_id)
        if not item:
            return None
        created, ref = item
        if time.time() - created > _TTL_SECONDS:
            _conv_index.pop(conversation_id, None)
            return None
        return _get_nolock(ref)


def pop_for_conversation(conversation_id: str) -> None:
    """Lepas indeks sesi (setelah order dibuat/dibatalkan) — tombol tidak
    dikirim ulang untuk summary yang sudah dikonsumsi."""
    with _lock:
        _conv_index.pop(conversation_id, None)


def purge_expired() -> None:
    now = time.time()
    with _lock:
        for ref in [k for k, (t, _) in _store.items() if now - t > _TTL_SECONDS]:
            _store.pop(ref, None)
        for cid in [k for k, (t, _) in _conv_index.items() if now - t > _TTL_SECONDS]:
            _conv_index.pop(cid, None)
