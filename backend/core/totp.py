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
    now = now or time.time()
    code = (code or "").strip().replace(" ", "")
    return any(hmac.compare_digest(code_at(secret, now + k * 30), code) for k in range(-window, window + 1))


def uri(secret: str, email: str, issuer: str = "Performance Lab OS") -> str:
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}&digits=6&period=30"
