"""Wearable sync routes. Player 1 only: his clinicians connect his device account, the server pulls daily summaries
into the encrypted Player 1 `wear` record, and every connection, sync and disconnection is audited.

Rules
- Only Player 1 clinicians (lead, physio, physician with the Player 1 flag) can connect, sync or disconnect.
- Nothing is connected until the clinician has recorded Player 1's consent for wearable sync (consent item "wear").
- Provider tokens are encrypted with FIELD_KEY in a server-only document that the state API can never return.
- Only daily summaries are stored (sleep hours, HRV, resting heart rate, provider score), not raw streams.
- Values never go into logs or the audit trail; the audit records who, which provider and how many days.
"""
from __future__ import annotations

import hashlib
import hmac
import html
import json
import os
import secrets
import time

from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Route

from .policy import CLINICAL_ROLES
from .store import Conflict
from . import wearables as wr

LINKS_SCOPE, LINKS_KEY = "server", "wearlinks"
P1_ID = "p1"
MAX_INGEST = 2_000_000
STATE_TTL = 24 * 3600   # a connect link stays valid for a day, so it can be opened on Player 1's own phone


def _err(status, msg, **extra):
    return JSONResponse(dict(error=msg, **extra), status_code=status)


def make_routes(store, keys, http, current_user, require_2fa_p1: bool):
    client = wr.WearClient(http)

    async def sys_audit(who: str, action: str, target: str = "", detail: str = "", req: Request | None = None):
        await store.audit({"who": who, "role": "", "action": action, "target": target, "detail": detail, "ip": req.client.host if req and req.client else ""})

    # ---------------- storage
    async def links_read() -> tuple[dict, int]:
        d = await store.get_state(LINKS_SCOPE, LINKS_KEY)
        return (keys.open(d["sealed"]), d["version"]) if d else ({}, 0)

    async def links_update(fn):
        for _ in range(8):
            cur, ver = await links_read()
            new = fn(dict(cur))
            try:
                await store.put_state(LINKS_SCOPE, LINKS_KEY, {"sealed": keys.seal(new), "updated_by": "wear"}, ver)
                return new
            except Conflict:
                continue
        raise RuntimeError("busy")

    async def write_wear(days: dict, who: str) -> list[str]:
        if not days:
            return []
        for _ in range(8):
            doc = await store.get_state("shared", "wear")
            cur = keys.open(doc["sealed"]) if doc else {}
            merged, changed = wr.merge_days(cur if isinstance(cur, dict) else {}, days)
            if not changed:
                return []
            rv = dict((doc or {}).get("rv") or {})
            for d in changed:
                rv[d] = int(rv.get(d, 0)) + 1
            try:
                await store.put_state("shared", "wear", {"sealed": keys.seal(merged), "rv": rv, "updated_by": who}, doc["version"] if doc else 0)
                return changed
            except Conflict:
                continue
        raise RuntimeError("busy")

    async def has_consent() -> bool:
        d = await store.get_state("shared", "consent")
        if not d:
            return False
        c = keys.open(d["sealed"]) if "sealed" in d else d.get("value")
        return bool(((c or {}).get(P1_ID) or {}).get("wear"))

    def base_url(req: Request) -> str:
        return (os.environ.get("PUBLIC_API_URL") or str(req.base_url)).rstrip("/")

    def redirect_uri(req: Request, pid: str) -> str:
        return f"{base_url(req)}/api/wear/{pid}/callback"

    # ---------------- guards
    def p1_clinician(fn):
        async def wrapped(req: Request):
            u = await current_user(req)
            if not u:
                return _err(401, "sign in required")
            if not (u.p1 and u.role in CLINICAL_ROLES):
                return _err(403, "only Player 1 clinicians manage his wearables")
            if require_2fa_p1 and not u.totp:
                return _err(403, "turn on two-step sign-in to open Player 1 data", reason="2fa_required")
            return await fn(req, u)
        return wrapped

    def provider_arg(req: Request, oauth_only=True):
        pid = req.path_params.get("pid", "")
        ok = pid in (wr.OAUTH_IDS if oauth_only else wr.ALL_IDS)
        return pid if ok else None

    # ---------------- sync core
    async def sync_one(pid: str, who: str, days: int = 35) -> dict:
        links, _ = await links_read()
        link = links.get(pid)
        if not link:
            raise wr.ProviderError(f"{wr.NAMES[pid]} is not connected", 404)
        p = wr.PROVIDERS[pid]

        async def refreshed():
            tok = await client.refresh(p, link)
            link.update(tok)
            await links_update(lambda L: {**L, pid: {**L.get(pid, {}), **tok}})

        try:
            if link.get("expires_at", 0) - 120 < time.time() and p.refresh:
                await refreshed()
            try:
                got = await client.fetch(pid, link, days)
            except wr.ProviderError as e:
                if e.status != 401:
                    raise
                await refreshed()
                got = await client.fetch(pid, link, days)
            changed = await write_wear(got, who)
            stamp = {"last_sync": time.time(), "last_error": "", "last_days": len(got)}
            await links_update(lambda L: {**L, pid: {**L.get(pid, {}), **stamp}} if pid in L else L)
            return {"provider": pid, "days": len(got), "changed": len(changed), "pending": pid == "garmin"}
        except wr.ProviderError as e:
            await links_update(lambda L: {**L, pid: {**L.get(pid, {}), "last_error": str(e), "last_error_at": time.time()}} if pid in L else L)
            raise

    # ---------------- routes
    @p1_clinician
    async def status(req, user):
        links, _ = await links_read()
        out = []
        for pid in wr.ALL_IDS:
            L = links.get(pid) or {}
            out.append({"id": pid, "name": wr.NAMES[pid], "configured": wr.configured(pid), "connected": bool(L), "by": L.get("by", ""), "at": L.get("at"),
                        "last_sync": L.get("last_sync"), "last_error": L.get("last_error", ""), "last_days": L.get("last_days"), "push": pid in ("garmin", "apple")})
        return JSONResponse({"providers": out, "consent": await has_consent(), "ingest_url": f"{base_url(req)}/api/wear/apple/ingest"})

    @p1_clinician
    async def connect(req, user):
        pid = provider_arg(req)
        if not pid:
            return _err(404, "unknown provider")
        if not wr.configured(pid):
            p = wr.PROVIDERS[pid]
            return _err(503, f"{p.name} is not set up on the server yet: add {p.env}_CLIENT_ID and {p.env}_CLIENT_SECRET", reason="not_configured")
        if not await has_consent():
            return _err(409, "record Player 1's consent for wearable sync first", reason="consent")
        p = wr.PROVIDERS[pid]
        verifier, challenge = wr.pkce_pair() if p.pkce else (None, None)
        state = keys.seal({"u": user.id, "p": pid, "v": verifier, "exp": time.time() + STATE_TTL, "n": secrets.token_hex(8)})
        await sys_audit(user.email, "wearable connect link created", pid, req=req)
        return JSONResponse({"url": wr.authorize_url(p, state, redirect_uri(req, pid), challenge), "expires_in": STATE_TTL})

    def page(title: str, msg: str, ok: bool):
        app_url = os.environ.get("APP_URL", "")
        back = f'<p><a href="{html.escape(app_url)}/?wear=1#loadlab">Back to Performance Lab</a></p>' if app_url else "<p>You can close this tab.</p>"
        return HTMLResponse(f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title>
<body style="font:16px system-ui,sans-serif;background:#0b0d12;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="max-width:420px;text-align:center"><h1 style="color:{'#22c55e' if ok else '#f97316'}">{html.escape(title)}</h1><p>{html.escape(msg)}</p>{back}</div>""", status_code=200 if ok else 400)

    async def callback(req: Request):
        pid = provider_arg(req)
        q = req.query_params
        if not pid:
            return page("Unknown device", "This link is not for a supported device.", False)
        if q.get("error"):
            return page("Not connected", "The device account did not give permission. Nothing was stored.", False)
        try:
            st = keys.open(q.get("state", ""))
            assert st.get("p") == pid and st.get("exp", 0) > time.time()
        except Exception:
            return page("Link expired", "Ask the clinician for a new connect link.", False)
        u = await store.user_by_id(st["u"])
        if not u or not u.get("active", True) or not u.get("p1") or u.get("role") not in CLINICAL_ROLES:
            return page("Not allowed", "The clinician who created this link no longer has Player 1 access.", False)
        if not await has_consent():
            return page("Consent needed", "Player 1's consent for wearable sync is not recorded.", False)
        p = wr.PROVIDERS[pid]
        try:
            tok = await client.exchange(p, q.get("code", ""), redirect_uri(req, pid), st.get("v"))
        except wr.ProviderError as e:
            await sys_audit(u["email"], "wearable connect failed", pid, str(e), req)
            return page("Not connected", f"{p.name} did not accept the sign-in. Try again with a new link.", False)
        await links_update(lambda L: {**L, pid: dict(tok, by=u["email"], at=time.time())})
        await sys_audit(u["email"], "wearable connected", pid, req=req)
        msg = f"{p.name} is connected for Player 1."
        try:
            r = await sync_one(pid, f"sync:{pid}")
            msg += " Garmin will send his data in the next minutes." if r["pending"] else f" {r['days']} days loaded."
        except Exception:
            msg += " The first sync will run shortly."
        return page("Connected", msg, True)

    @p1_clinician
    async def sync(req, user):
        pid = provider_arg(req)
        if not pid:
            return _err(404, "unknown provider")
        try:
            r = await sync_one(pid, user.email, max(1, min(90, int(req.query_params.get("days", 35)))))
        except wr.ProviderError as e:
            await sys_audit(user.email, "wearable sync failed", pid, str(e), req)
            return _err(404 if e.status == 404 else 502, str(e), reason="reconnect" if e.status == 401 else "provider")
        await sys_audit(user.email, "wearable sync", pid, f"{r['days']} days, {r['changed']} changed", req)
        return JSONResponse(r)

    @p1_clinician
    async def disconnect(req, user):
        pid = provider_arg(req, oauth_only=False)
        if not pid:
            return _err(404, "unknown provider")
        links, _ = await links_read()
        if pid in wr.OAUTH_IDS and links.get(pid):
            await client.revoke(pid, links[pid])
        await links_update(lambda L: {k: v for k, v in L.items() if k != pid})
        await sys_audit(user.email, "wearable disconnected", pid, "days already synced stay in his record", req)
        return JSONResponse({"ok": True})

    @p1_clinician
    async def apple_token(req, user):
        if not await has_consent():
            return _err(409, "record Player 1's consent for wearable sync first", reason="consent")
        tok = secrets.token_urlsafe(32)
        await links_update(lambda L: {**L, "apple": {"hash": hashlib.sha256(tok.encode()).hexdigest(), "by": user.email, "at": time.time()}})
        await sys_audit(user.email, "Apple Health ingest token created", "apple", "previous token replaced", req)
        return JSONResponse({"url": f"{base_url(req)}/api/wear/apple/ingest", "header": "Authorization", "value": "Bearer " + tok,
                             "note": "Shown once. Paste into Health Auto Export → Automations → REST API → Headers."})

    async def apple_ingest(req: Request):
        h = req.headers.get("authorization", "")
        links, _ = await links_read()
        want = (links.get("apple") or {}).get("hash", "")
        got = hashlib.sha256(h[7:].strip().encode()).hexdigest() if h.lower().startswith("bearer ") else ""
        if not want or not got or not hmac.compare_digest(want, got):
            return _err(401, "invalid ingest token")
        if not await has_consent():
            return _err(409, "consent withdrawn", reason="consent")
        raw = await req.body()
        if len(raw) > MAX_INGEST:
            return _err(413, "too large: export daily summaries, not raw samples")
        try:
            days = wr.norm_apple(json.loads(raw))
        except Exception:
            return _err(400, "expected Health Auto Export JSON")
        changed = await write_wear(days, "sync:apple")
        await links_update(lambda L: {**L, "apple": {**L.get("apple", {}), "last_sync": time.time(), "last_days": len(days), "last_error": ""}} if "apple" in L else L)
        await sys_audit("sync:apple", "wearable ingest", "apple", f"{len(days)} days, {len(changed)} changed", req)
        return JSONResponse({"days": len(days), "changed": len(changed)})

    async def garmin_push(req: Request):
        key = os.environ.get("GARMIN_PUSH_KEY", "")
        if len(key) < 24 or not hmac.compare_digest(key, req.query_params.get("k", "")):
            return _err(404, "not found")
        links, _ = await links_read()
        g = links.get("garmin")
        raw = await req.body()
        if not g or len(raw) > MAX_INGEST or not await has_consent():
            return JSONResponse({"ok": True})   # acknowledge so Garmin does not retry; nothing stored
        try:
            days = wr.norm_garmin(json.loads(raw), g.get("user_id", ""))
        except Exception:
            return JSONResponse({"ok": True})
        changed = await write_wear(days, "sync:garmin")
        if days:
            await links_update(lambda L: {**L, "garmin": {**L.get("garmin", {}), "last_sync": time.time(), "last_days": len(days), "last_error": ""}} if "garmin" in L else L)
            await sys_audit("sync:garmin", "wearable push", "garmin", f"{len(days)} days, {len(changed)} changed", req)
        return JSONResponse({"ok": True})

    async def sync_all(req: Request):
        key = os.environ.get("WEAR_CRON_KEY", "")
        if len(key) < 32 or not hmac.compare_digest(key, req.headers.get("x-cron-key", "")):
            return _err(404, "not found")
        links, _ = await links_read()
        out = []
        for pid in wr.OAUTH_IDS:
            if pid == "garmin" or pid not in links:
                continue
            try:
                r = await sync_one(pid, f"sync:{pid}", 7)
                out.append(r)
                await sys_audit("sync:scheduled", "wearable sync", pid, f"{r['days']} days, {r['changed']} changed", req)
            except Exception as e:
                out.append({"provider": pid, "error": str(e)})
                await sys_audit("sync:scheduled", "wearable sync failed", pid, str(e), req)
        return JSONResponse({"results": out})

    return [
        Route("/api/wear", status),
        Route("/api/wear/sync-all", sync_all, methods=["POST"]),
        Route("/api/wear/apple/token", apple_token, methods=["POST"]),
        Route("/api/wear/apple/ingest", apple_ingest, methods=["POST"]),
        Route("/api/wear/garmin/push", garmin_push, methods=["POST"]),
        Route("/api/wear/{pid}/connect", connect, methods=["POST"]),
        Route("/api/wear/{pid}/callback", callback),
        Route("/api/wear/{pid}/sync", sync, methods=["POST"]),
        Route("/api/wear/{pid}", disconnect, methods=["DELETE"]),
    ]
