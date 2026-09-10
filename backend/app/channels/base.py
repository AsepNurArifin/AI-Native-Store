"""Channel Adapter pattern — BR-09: Sales Agent inti channel-agnostic.

Semua channel (WEB / WHATSAPP) dinormalisasi ke InboundMessage yang sama.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class InboundMessage:
    channel: str  # WEB | WHATSAPP
    sender_id: str  # identifier unik di channel (WA: phone number)
    content: str
    message_id: str | None = None  # id idempotensi dari channel
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class OutboundMessage:
    channel: str
    recipient_id: str
    content: str
    interactive: dict | None = None  # interactive buttons payload (WA)
