"""Passwords, tokens and field encryption.

Passwords: scrypt (stdlib), per-user salt, constant-time compare.
Tokens:    short-lived HS256 JWTs; the secret must come from the environment.
Fields:    clinical values are encrypted at rest with Fernet (AES-128-CBC + HMAC-SHA256).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

import jwt
from cryptography.fernet import Fernet, InvalidToken

SCRYPT = dict(n=2 ** 15, r=8, p=1, maxmem=64 * 1024 * 1024, dklen=32)
TOKEN_TTL = 12 * 3600


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("password must be at least 12 characters")
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        kind, salt_b64, dk_b64 = stored.split("$")
        if kind != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), **SCRYPT)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except Exception:
        return False


class Keys:
    """Holds the token secret and the field key, both from the environment."""

    def __init__(self, jwt_secret: str | None, field_key: str | None):
        if not jwt_secret or len(jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set and at least 32 characters")
        if not field_key:
            raise RuntimeError("FIELD_KEY must be set (generate with: python -m core.admin gen-key)")
        self.jwt_secret = jwt_secret
        self.fernet = Fernet(field_key.encode())

    @classmethod
    def from_env(cls) -> "Keys":
        return cls(os.environ.get("JWT_SECRET"), os.environ.get("FIELD_KEY"))

    # tokens
    def issue(self, user_id: str, now: float | None = None) -> str:
        now = now or time.time()
        return jwt.encode({"sub": user_id, "iat": int(now), "exp": int(now + TOKEN_TTL)}, self.jwt_secret, algorithm="HS256")

    def subject(self, token: str) -> str | None:
        try:
            return jwt.decode(token, self.jwt_secret, algorithms=["HS256"])["sub"]
        except jwt.PyJWTError:
            return None

    # fields
    def seal(self, value) -> str:
        return self.fernet.encrypt(json.dumps(value, separators=(",", ":")).encode()).decode()

    def open(self, token: str):
        try:
            return json.loads(self.fernet.decrypt(token.encode()))
        except InvalidToken as e:
            raise ValueError("cannot decrypt field (wrong FIELD_KEY?)") from e


def gen_field_key() -> str:
    return Fernet.generate_key().decode()
