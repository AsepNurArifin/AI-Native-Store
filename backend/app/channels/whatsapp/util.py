"""Utilitas WhatsApp — 24h customer service window (aturan platform Meta)."""

from datetime import datetime, timedelta


def check_24h_window(recipient_id: str, sessions: dict[str, str]) -> bool:
    """True jika dalam 24 jam sejak pesan terakhir pelanggan (boleh free-form reply).
    False jika di luar window — WAJIB template pesan.
    MVP: in-memory dict; F7: kolom last_inbound_at di tabel wa_sessions.
    """
    last = sessions.get(recipient_id)
    if last is None:
        return False
    try:
        last_dt = datetime.fromisoformat(last)
    except ValueError:
        return False
    return datetime.now() - last_dt < timedelta(hours=24)
