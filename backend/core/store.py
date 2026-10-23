"""Storage behind one small interface, so the API and tests do not care whether it is MongoDB or memory.

state:    {scope, key, value | sealed, version, updated_by, updated_at}
users:    {id, email, role, person, p1, password_hash, active}
audit:    append-only {at, who, action, target, detail}
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Protocol


class Conflict(Exception):
    def __init__(self, current: dict | None):
        super().__init__("version conflict")
        self.current = current


class Store(Protocol):
    async def get_state(self, scope: str, key: str) -> dict | None: ...
    async def put_state(self, scope: str, key: str, doc: dict, base_version: int | None) -> dict: ...
    async def user_by_email(self, email: str) -> dict | None: ...
    async def user_by_id(self, uid: str) -> dict | None: ...
    async def add_user(self, doc: dict) -> dict: ...
    async def list_users(self) -> list[dict]: ...
    async def update_user(self, uid: str, fields: dict) -> None: ...
    async def audit(self, entry: dict) -> None: ...
    async def audit_tail(self, limit: int) -> list[dict]: ...


def _now() -> float:
    return time.time()


class MemoryStore:
    def __init__(self):
        self.state: dict[tuple[str, str], dict] = {}
        self.users: dict[str, dict] = {}
        self.log: list[dict] = []

    async def get_state(self, scope, key):
        d = self.state.get((scope, key))
        return dict(d) if d else None

    async def put_state(self, scope, key, doc, base_version):
        cur = self.state.get((scope, key))
        cur_v = cur["version"] if cur else 0
        if base_version is not None and base_version != cur_v:
            raise Conflict(dict(cur) if cur else None)
        new = dict(doc, scope=scope, key=key, version=cur_v + 1, updated_at=_now())
        self.state[(scope, key)] = new
        return dict(new)

    async def user_by_email(self, email):
        return next((dict(u) for u in self.users.values() if u["email"] == email.lower()), None)

    async def user_by_id(self, uid):
        u = self.users.get(uid)
        return dict(u) if u else None

    async def add_user(self, doc):
        if await self.user_by_email(doc["email"]):
            raise ValueError("email already registered")
        u = dict(doc, id=doc.get("id") or uuid.uuid4().hex, email=doc["email"].lower(), active=True)
        self.users[u["id"]] = u
        return dict(u)

    async def list_users(self):
        return [dict(u) for u in self.users.values()]

    async def update_user(self, uid, fields):
        if uid in self.users:
            self.users[uid].update(fields)

    async def audit(self, entry):
        self.log.append(dict(entry, at=entry.get("at", _now())))

    async def audit_tail(self, limit):
        return [dict(e) for e in self.log[-limit:]][::-1]


class MongoStore:
    """MongoDB via motor. Versioned writes use a conditional update so two clinicians cannot overwrite each other silently."""

    def __init__(self, db: Any):
        self.db = db

    async def init(self):
        await self.db.state.create_index([("scope", 1), ("key", 1)], unique=True)
        await self.db.users.create_index("email", unique=True)
        await self.db.users.create_index("id", unique=True)
        await self.db.audit.create_index([("at", -1)])

    async def get_state(self, scope, key):
        return await self.db.state.find_one({"scope": scope, "key": key}, {"_id": 0})

    async def put_state(self, scope, key, doc, base_version):
        cur = await self.get_state(scope, key)
        cur_v = cur["version"] if cur else 0
        if base_version is not None and base_version != cur_v:
            raise Conflict(cur)
        new = dict(doc, scope=scope, key=key, version=cur_v + 1, updated_at=_now())
        if cur:
            res = await self.db.state.replace_one({"scope": scope, "key": key, "version": cur_v}, new)
            if res.matched_count == 0:
                raise Conflict(await self.get_state(scope, key))
        else:
            try:
                await self.db.state.insert_one(dict(new))
            except Exception:  # duplicate key: someone created it first
                raise Conflict(await self.get_state(scope, key))
        return new

    async def user_by_email(self, email):
        return await self.db.users.find_one({"email": email.lower()}, {"_id": 0})

    async def user_by_id(self, uid):
        return await self.db.users.find_one({"id": uid}, {"_id": 0})

    async def add_user(self, doc):
        u = dict(doc, id=doc.get("id") or uuid.uuid4().hex, email=doc["email"].lower(), active=True)
        await self.db.users.insert_one(dict(u))
        return u

    async def list_users(self):
        return [u async for u in self.db.users.find({}, {"_id": 0})]

    async def update_user(self, uid, fields):
        await self.db.users.update_one({"id": uid}, {"$set": fields})

    async def audit(self, entry):
        await self.db.audit.insert_one(dict(entry, at=entry.get("at", _now())))

    async def audit_tail(self, limit):
        return [e async for e in self.db.audit.find({}, {"_id": 0}).sort("at", -1).limit(limit)]
