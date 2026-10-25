"""Time-based one-time codes (RFC 6238), as used by Google Authenticator, Microsoft Authenticator and 1Password."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
import time
from urllib.parse import quote


def new_secret() -> str:
    return base64.b32encode(os.urandom(20)).decode().rstrip("=")


def code_at(secret: str, t: float, step: int = 30, digits: int = 6) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    h = hmac.new(key, struct.pack(">Q", int(t // step)), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    n = (struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** digits
    return str(n).zfill(digits)


def verify(secret: str, code: str, now: float | None = None, window: int = 1) -> bool:
    return match_step(secret, code, now, window) is not None


def match_step(secret: str, code: str, now: float | None = None, window: int = 1) -> int | None:
    """The 30-second step the code belongs to, or None. Callers store the last used step so a code works only once."""
    now = now or time.time()
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return None
    for k in range(-window, window + 1):
        t = now + k * 30
        if hmac.compare_digest(code_at(secret, t), code):
            return int(t // 30)
    return None


def uri(secret: str, email: str, issuer: str = "Performance Lab OS") -> str:
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}&digits=6&period=30"
