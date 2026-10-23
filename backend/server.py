"""Performance Lab OS API.

ASGI app (Starlette, the framework FastAPI is built on); run with:  uvicorn server:app --host 0.0.0.0 --port 8001
All routes live under /api so the Emergent ingress can route them.

Environment (see .env.example): MONGO_URL, DB_NAME, JWT_SECRET, FIELD_KEY, CORS_ORIGINS
"""
from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict, deque
from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from core import bookings as bk
from core.policy import ENCRYPTED_SCOPES, KEYS, ROLES, Denied, User, can_read, can_write, readable_keys, scope_of, storage_scope_id
from core.security import Keys, hash_password, verify_password
from core.store import Conflict, MemoryStore, Store

log = logging.getLogger("plos")
MAX_VALUE_BYTES = 2_000_000
LOGIN_WINDOW, LOGIN_MAX = 300, 10


def _load_env():
    p = Path(__file__).parent / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def err(status: int, msg: str, **extra) -> JSONResponse:
    return JSONResponse(dict(error=msg, **extra), status_code=status)


def public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("id", "email", "role", "person", "p1", "active")}


class SecurityHeaders:
    """Plain ASGI middleware: adds safe headers to every API response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send2(msg):
            if msg["type"] == "http.response.start":
                msg.setdefault("headers", [])
                msg["headers"] += [(b"x-content-type-options", b"nosniff"), (b"cache-control", b"no-store"), (b"referrer-policy", b"no-referrer")]
            await send(msg)
        await self.app(scope, receive, send2)


def create_app(store: Store, keys: Keys, cors_origins: list[str] | None = None) -> Starlette:
    attempts: dict[str, deque] = defaultdict(deque)

    async def current_user(req: Request) -> User | None:
        h = req.headers.get("authorization", "")
        if not h.lower().startswith("bearer "):
            return None
        uid = keys.subject(h[7:].strip())
        if not uid:
            return None
        u = await store.user_by_id(uid)
        if not u or not u.get("active", True):
            return None
        return User(id=u["id"], email=u["email"], role=u["role"], person=u.get("person", ""), p1=bool(u.get("p1")))

    async def audit(user: User | None, action: str, target: str = "", detail: str = "", req: Request | None = None):
        await store.audit({"who": user.email if user else "anonymous", "role": user.role if user else "", "action": action, "target": target, "detail": detail,
                           "ip": req.client.host if req and req.client else ""})

    def needs_user(fn):
        async def wrapped(req: Request):
            u = await current_user(req)
            if not u:
                return err(401, "sign in required")
            return await fn(req, u)
        return wrapped

    async def health(req):
        return JSONResponse({"ok": True, "time": time.time()})

    async def login(req: Request):
        try:
            body = await req.json()
            email, password = str(body["email"]).strip().lower(), str(body["password"])
        except Exception:
            return err(400, "email and password required")
        bucket = attempts[(req.client.host if req.client else "") + "|" + email]
        now = time.time()
        while bucket and now - bucket[0] > LOGIN_WINDOW:
            bucket.popleft()
        if len(bucket) >= LOGIN_MAX:
            return err(429, "too many attempts, wait a few minutes")
        bucket.append(now)
        u = await store.user_by_email(email)
        if not u or not u.get("active", True) or not verify_password(password, u.get("password_hash", "")):
            await audit(None, "login failed", email, req=req)
            return err(401, "wrong email or password")
        bucket.clear()
        await audit(User(u["id"], u["email"], u["role"], u.get("person", ""), bool(u.get("p1"))), "login", req=req)
        return JSONResponse({"token": keys.issue(u["id"]), "user": public_user(u)})

    @needs_user
    async def me(req, user: User):
        return JSONResponse({"user": user.__dict__, "keys": readable_keys(user)})

    async def _read(user: User, key: str):
        doc = await store.get_state(storage_scope_id(user, key), key)
        if not doc:
            return None
        value = keys.open(doc["sealed"]) if "sealed" in doc else doc.get("value")
        return {"value": value, "version": doc["version"], "updated_by": doc.get("updated_by"), "updated_at": doc.get("updated_at")}

    @needs_user
    async def state_all(req, user: User):
        out = {}
        for k in readable_keys(user):
            d = await _read(user, k)
            if d:
                out[k] = d
        await audit(user, "read all state", detail=f"{len(out)} keys", req=req)
        return JSONResponse({"state": out})

    @needs_user
    async def state_one(req, user: User):
        key = req.path_params["key"]
        try:
            scope = scope_of(key)
        except Denied as e:
            return err(404, str(e))
        if req.method == "GET":
            if not can_read(user, key):
                await audit(user, "denied read", key, req=req)
                return err(403, "not permitted")
            d = await _read(user, key)
            if scope in ENCRYPTED_SCOPES:
                await audit(user, "read clinical", key, req=req)
            return JSONResponse(d or {"value": None, "version": 0})
        # PUT
        if not can_write(user, key):
            await audit(user, "denied write", key, req=req)
            return err(403, "not permitted")
        raw = await req.body()
        if len(raw) > MAX_VALUE_BYTES:
            return err(413, "value too large")
        try:
            body = json.loads(raw)
            value, base = body["value"], body.get("version")
        except Exception:
            return err(400, "body must be {value, version}")
        if key == "bookings":
            try:
                bk.validate(value)
            except bk.BookingClash as e:
                return err(409, str(e), reason="clash")
            except ValueError as e:
                return err(400, str(e))
        doc = {"updated_by": user.email}
        doc.update({"sealed": keys.seal(value)} if scope in ENCRYPTED_SCOPES else {"value": value})
        try:
            new = await store.put_state(storage_scope_id(user, key), key, doc, base)
        except Conflict as c:
            cur = await _read(user, key)
            return err(409, "changed by someone else", reason="version", current=cur)
        await audit(user, "write", key, detail=f"v{new['version']}, {len(raw)} bytes", req=req)
        return JSONResponse({"version": new["version"]})

    def lead_only(fn):
        async def wrapped(req, user: User):
            if user.role != "lead":
                return err(403, "lead only")
            return await fn(req, user)
        return needs_user(wrapped)

    @lead_only
    async def users(req, user: User):
        if req.method == "GET":
            return JSONResponse({"users": [public_user(u) for u in await store.list_users()]})
        try:
            b = await req.json()
            role = b["role"]
            assert role in ROLES, "unknown role"
            doc = {"email": str(b["email"]).strip().lower(), "role": role, "person": str(b.get("person", "")), "p1": bool(b.get("p1")) and role in ("lead", "physio", "physician"),
                   "password_hash": hash_password(str(b["password"]))}
            u = await store.add_user(doc)
        except (KeyError, AssertionError, ValueError) as e:
            return err(400, str(e) or "invalid user")
        await audit(user, "user created", u["email"], f"role {u['role']}, Player 1 {u['p1']}", req=req)
        return JSONResponse({"user": public_user(u)}, status_code=201)

    @lead_only
    async def user_one(req, user: User):
        uid = req.path_params["uid"]
        b = await req.json()
        fields = {}
        if "active" in b:
            fields["active"] = bool(b["active"])
        if "p1" in b:
            fields["p1"] = bool(b["p1"])
        if "role" in b:
            if b["role"] not in ROLES:
                return err(400, "unknown role")
            fields["role"] = b["role"]
        if "password" in b:
            fields["password_hash"] = hash_password(str(b["password"]))
        await store.update_user(uid, fields)
        await audit(user, "user changed", uid, ", ".join(k for k in fields if k != "password_hash") + (", password" if "password_hash" in fields else ""), req=req)
        return JSONResponse({"ok": True})

    @needs_user
    async def audit_log(req, user: User):
        if user.role not in ("lead", "manager"):
            return err(403, "not permitted")
        limit = max(1, min(500, int(req.query_params.get("limit", 100))))
        return JSONResponse({"audit": await store.audit_tail(limit)})

    routes = [
        Route("/api/health", health),
        Route("/api/auth/login", login, methods=["POST"]),
        Route("/api/auth/me", me),
        Route("/api/state", state_all),
        Route("/api/state/{key}", state_one, methods=["GET", "PUT"]),
        Route("/api/users", users, methods=["GET", "POST"]),
        Route("/api/users/{uid}", user_one, methods=["PATCH"]),
        Route("/api/audit", audit_log),
    ]
    mw = [Middleware(CORSMiddleware, allow_origins=cors_origins or [], allow_methods=["GET", "POST", "PUT", "PATCH"], allow_headers=["authorization", "content-type"])]
    mw.append(Middleware(SecurityHeaders))
    return Starlette(routes=routes, middleware=mw)


def build_from_env() -> Starlette:
    _load_env()
    keys = Keys.from_env()
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    if os.environ.get("MONGO_URL"):
        from motor.motor_asyncio import AsyncIOMotorClient
        from core.store import MongoStore
        store = MongoStore(AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "performance_lab")])
        app = create_app(store, keys, origins)
        app.add_event_handler("startup", store.init)
        return app
    log.warning("MONGO_URL not set: using in-memory store (data is lost on restart)")
    return create_app(MemoryStore(), keys, origins)


app = build_from_env() if os.environ.get("PLOS_NO_AUTOAPP") != "1" else None
