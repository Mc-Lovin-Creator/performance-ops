"""Performance Lab OS API.

ASGI app (Starlette, the framework FastAPI is built on); run with:  uvicorn server:app --host 0.0.0.0 --port 8001
All routes live under /api so the Emergent ingress can route them.

Environment (see .env.example): MONGO_URL, DB_NAME, JWT_SECRET, FIELD_KEY, CORS_ORIGINS, and the wearable keys (docs/WEARABLES.md)
"""
from __future__ import annotations

import hmac
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
from core.policy import CLINICAL_ROLES, ENCRYPTED_SCOPES, KEYS, ROLES, Denied, User, can_read, can_write, readable_keys, scope_of, storage_scope_id
from core.security import Keys, hash_password, verify_password
from core.store import Conflict, MemoryStore, Store
from core import totp
from core.wear_routes import make_routes as wear_routes
from core.scout import Scout, LANES as SCOUT_LANES, feeds_from_env

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
    d = {k: u.get(k) for k in ("id", "email", "role", "person", "p1", "active")}
    d["totp"] = bool(u.get("totp_on"))
    return d


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


def create_app(store: Store, keys: Keys, cors_origins: list[str] | None = None, require_2fa_p1: bool = False, http=None) -> Starlette:
    if http is None:
        import httpx
        http = httpx.AsyncClient(timeout=20)
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
        return User(id=u["id"], email=u["email"], role=u["role"], person=u.get("person", ""), p1=bool(u.get("p1")), totp=bool(u.get("totp_on")))

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
        if u.get("totp_on"):
            code = str(body.get("code") or "")
            if not code:
                return err(401, "enter the 6-digit code from your authenticator app", need_code=True)
            if not totp.verify(keys.open(u["totp_secret"]), code):
                await audit(None, "login failed (code)", email, req=req)
                return err(401, "wrong code", need_code=True)
        bucket.clear()
        await audit(User(u["id"], u["email"], u["role"], u.get("person", ""), bool(u.get("p1"))), "login", req=req)
        pu = public_user(u)
        pu["needs_2fa"] = bool(require_2fa_p1 and u.get("p1") and not u.get("totp_on"))
        return JSONResponse({"token": keys.issue(u["id"]), "user": pu})

    @needs_user
    async def me(req, user: User):
        return JSONResponse({"user": user.__dict__, "keys": readable_keys(user)})

    async def _read(user: User, key: str):
        doc = await store.get_state(storage_scope_id(user, key), key)
        if not doc:
            return None
        value = keys.open(doc["sealed"]) if "sealed" in doc else doc.get("value")
        return {"value": value, "version": doc["version"], "rv": doc.get("rv") or {}, "updated_by": doc.get("updated_by"), "updated_at": doc.get("updated_at")}

    @needs_user
    async def state_all(req, user: User):
        out = {}
        for k in readable_keys(user):
            if require_2fa_p1 and scope_of(k) == "p1" and not user.totp:
                continue
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
        if scope == "p1" and require_2fa_p1 and not user.totp:
            return err(403, "turn on two-step sign-in to open Player 1 data", reason="2fa_required")
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

    def _as_records(value):
        """A map {id: item} or a list of items with ids becomes (kind, records, order)."""
        if isinstance(value, dict):
            return "map", dict(value), list(value.keys())
        if isinstance(value, list) and all(isinstance(x, dict) and "id" in x for x in value):
            return "list", {str(x["id"]): x for x in value}, [str(x["id"]) for x in value]
        return None, None, None

    @needs_user
    async def state_records(req, user: User):
        """Record-level merge: only the entries the client changed are applied, so two clinicians
        editing different days or notes never overwrite each other."""
        key = req.path_params["key"]
        try:
            scope = scope_of(key)
        except Denied as e:
            return err(404, str(e))
        if scope == "p1" and require_2fa_p1 and not user.totp:
            return err(403, "turn on two-step sign-in to open Player 1 data", reason="2fa_required")
        if not can_write(user, key):
            await audit(user, "denied write", key, req=req)
            return err(403, "not permitted")
        raw = await req.body()
        if len(raw) > MAX_VALUE_BYTES:
            return err(413, "value too large")
        try:
            body = json.loads(raw)
            changes, base, kind_hint = dict(body["changes"]), dict(body.get("base") or {}), body.get("kind")
        except Exception:
            return err(400, "body must be {changes, base, kind}")
        sid = storage_scope_id(user, key)
        for _ in range(5):
            doc = await store.get_state(sid, key)
            cur = (keys.open(doc["sealed"]) if "sealed" in doc else doc.get("value")) if doc else ({} if kind_hint == "map" else [])
            kind, recs, order = _as_records(cur if cur is not None else ({} if kind_hint == "map" else []))
            if kind is None:
                return err(409, "this key cannot be merged by record", reason="shape")
            rv = dict((doc or {}).get("rv") or {})
            conflicts = {}
            for rid, val in changes.items():
                if int(base.get(rid, 0)) != int(rv.get(rid, 0)) and recs.get(rid) != val:
                    conflicts[rid] = recs.get(rid)
                    continue
                if val is None:
                    recs.pop(rid, None)
                    order = [o for o in order if o != rid]
                else:
                    if rid not in recs:
                        order.append(rid)
                    recs[rid] = val
                rv[rid] = int(rv.get(rid, 0)) + 1
            merged = {k: recs[k] for k in order if k in recs} if kind == "map" else [recs[k] for k in order if k in recs]
            if key == "bookings":
                try:
                    bk.validate(merged)
                except bk.BookingClash as e:
                    return err(409, str(e), reason="clash")
                except ValueError as e:
                    return err(400, str(e))
            new_doc = {"updated_by": user.email, "rv": rv}
            new_doc.update({"sealed": keys.seal(merged)} if scope in ENCRYPTED_SCOPES else {"value": merged})
            try:
                new = await store.put_state(sid, key, new_doc, doc["version"] if doc else 0)
            except Conflict:
                continue
            await audit(user, "write records", key, f"v{new['version']}, {len(changes) - len(conflicts)} changed, {len(conflicts)} conflicts", req=req)
            return JSONResponse({"version": new["version"], "rv": rv, "conflicts": conflicts, "value": merged})
        return err(503, "busy, try again")

    @needs_user
    async def twofa_setup(req, user: User):
        secret = totp.new_secret()
        await store.update_user(user.id, {"totp_pending": keys.seal(secret)})
        await audit(user, "2fa setup started", req=req)
        return JSONResponse({"secret": secret, "uri": totp.uri(secret, user.email)})

    @needs_user
    async def twofa_enable(req, user: User):
        u = await store.user_by_id(user.id)
        try:
            code = str((await req.json())["code"])
            secret = keys.open(u["totp_pending"])
        except Exception:
            return err(400, "start setup first")
        if not totp.verify(secret, code):
            return err(400, "that code did not match; check the time on your phone")
        await store.update_user(user.id, {"totp_secret": keys.seal(secret), "totp_on": True, "totp_pending": None})
        await audit(user, "2fa enabled", req=req)
        return JSONResponse({"ok": True})

    def lead_only(fn):
        async def wrapped(req, user: User):
            if user.role != "lead":
                return err(403, "lead only")
            return await fn(req, user)
        return needs_user(wrapped)

    async def first_lead(req: Request):
        """One-time set-up: creates the first lead account, only while the server has no accounts and only with
        the SETUP_TOKEN from the environment. Remove SETUP_TOKEN once used (the route then answers 404)."""
        tok = os.environ.get("SETUP_TOKEN", "")
        if len(tok) < 32 or await store.list_users():
            return err(404, "not found")
        try:
            b = await req.json()
            if not hmac.compare_digest(tok, str(b.get("setup_token", ""))):
                await audit(None, "first-lead refused", req=req)
                return err(403, "wrong set-up key")
            doc = {"email": str(b["email"]).strip().lower(), "role": "lead", "person": str(b.get("person") or "jp"), "p1": True,
                   "password_hash": hash_password(str(b["password"]))}
        except ValueError as e:
            return err(400, str(e))
        except Exception:
            return err(400, "email, password and setup_token required")
        u = await store.add_user(doc)
        await audit(None, "first lead created", u["email"], "remove SETUP_TOKEN now", req=req)
        return JSONResponse({"user": public_user(u)}, status_code=201)

    async def setup_status(req: Request):
        """Tells the sign-in screen whether to offer 'create the first lead account' (no accounts yet and SETUP_TOKEN set)."""
        tok = os.environ.get("SETUP_TOKEN", "")
        return JSONResponse({"open": len(tok) >= 32 and not await store.list_users()})

    @needs_user
    async def change_password(req, user: User):
        try:
            b = await req.json()
            u = await store.user_by_id(user.id)
            if not verify_password(str(b["old"]), u.get("password_hash", "")):
                await audit(user, "password change refused", req=req)
                return err(403, "current password is wrong")
            await store.update_user(user.id, {"password_hash": hash_password(str(b["new"]))})
        except ValueError as e:
            return err(400, str(e))
        except Exception:
            return err(400, "old and new password required")
        await audit(user, "password changed", req=req)
        return JSONResponse({"ok": True})

    @lead_only
    async def users(req, user: User):
        if req.method == "GET":
            return JSONResponse({"users": [public_user(u) for u in await store.list_users()]})
        try:
            b = await req.json()
            role = b["role"]
            assert role in ROLES, "unknown role"
            doc = {"email": str(b["email"]).strip().lower(), "role": role, "person": str(b.get("person", "")), "p1": bool(b.get("p1")) and role in CLINICAL_ROLES,
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
            target = await store.user_by_id(uid) or {}
            if bool(b["p1"]) and b.get("role", target.get("role")) not in CLINICAL_ROLES:
                return err(400, "Player 1 access is for clinicians only (lead, biokineticist, physio, physician)")
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

    scout = Scout(store, http)

    async def scout_run(req: Request):
        """Scheduler (x-cron-key = SCOUT_CRON_KEY) or the lead from the app. Public sources only, see core/scout.py."""
        ck = os.environ.get("SCOUT_CRON_KEY", "")
        if len(ck) >= 32 and hmac.compare_digest(ck, req.headers.get("x-cron-key", "")):
            who = None
        else:
            who = await current_user(req)
            if not who:
                return err(401, "sign in required")
            if who.role != "lead":
                return err(403, "lead only")
        r = await scout.run()
        await audit(who, "innovation scan", "scout", f"{r['added']} new of {r['found']} found, {r['lanes']} lanes, {len(r['errors'])} errors", req=req)
        return JSONResponse(r)

    @needs_user
    async def scout_status(req, user: User):
        return JSONResponse({"grok": bool(os.environ.get("XAI_API_KEY")), "model": os.environ.get("XAI_MODEL", "grok-4.7"),
                             "feeds": len(feeds_from_env()), "lanes": SCOUT_LANES, "scheduled": len(os.environ.get("SCOUT_CRON_KEY", "")) >= 32})

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
        Route("/api/auth/password", change_password, methods=["POST"]),
        Route("/api/setup/first-lead", first_lead, methods=["POST"]),
        Route("/api/setup/status", setup_status),
        Route("/api/auth/2fa/setup", twofa_setup, methods=["POST"]),
        Route("/api/auth/2fa/enable", twofa_enable, methods=["POST"]),
        Route("/api/state", state_all),
        Route("/api/state/{key}", state_one, methods=["GET", "PUT"]),
        Route("/api/state/{key}/records", state_records, methods=["PATCH"]),
        Route("/api/users", users, methods=["GET", "POST"]),
        Route("/api/users/{uid}", user_one, methods=["PATCH"]),
        Route("/api/audit", audit_log),
        Route("/api/scout/run", scout_run, methods=["POST"]),
        Route("/api/scout/status", scout_status),
    ] + wear_routes(store, keys, http, current_user, require_2fa_p1)
    mw = [Middleware(CORSMiddleware, allow_origins=cors_origins or [], allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["authorization", "content-type"])]
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
        app = create_app(store, keys, origins, os.environ.get("REQUIRE_2FA_P1", "1") == "1")
        app.add_event_handler("startup", store.init)
        return app
    log.warning("MONGO_URL not set: using in-memory store (data is lost on restart)")
    return create_app(MemoryStore(), keys, origins, os.environ.get("REQUIRE_2FA_P1", "1") == "1")


app = build_from_env() if os.environ.get("PLOS_NO_AUTOAPP") != "1" else None
