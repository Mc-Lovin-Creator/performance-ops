#!/usr/bin/env python3
"""Check a running Performance Lab OS deployment, stage by stage. Python standard library only, so it runs anywhere
(your laptop, the Emergent shell). It never stores or prints passwords, codes or tokens.

  python3 scripts/check_deploy.py --api https://<your-app>.emergent.host --stage 1
  python3 scripts/check_deploy.py --api https://... --stage 2 --email jp@...     (asks for the password and code at a hidden prompt)

Stage 1  services up: health, security headers, sign-in required, CORS locked
Stage 2  signs in: role, Player 1 flag, two-step sign-in, audit log visible
Stage 3  data round trip: writes and reads back a harmless preference, Player 1 data needs two-step sign-in
Stage 4  wearables: provider status, which are configured, consent recorded
Each stage also runs the checks of the stages before it.
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys
import time
import urllib.error
import urllib.request

OK, FAIL, WARN = "ok  ", "FAIL", "warn"
results: list[tuple[str, str]] = []


def say(state, msg):
    results.append((state, msg))
    print(state, msg)


def call(api, method, path, body=None, token=None, headers=None):
    h = {"content-type": "application/json", **(headers or {})}
    if token:
        h["authorization"] = "Bearer " + token
    req = urllib.request.Request(api + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            return r.status, dict(r.headers), (json.loads(raw) if raw[:1] in (b"{", b"[") else raw.decode(errors="replace"))
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, dict(e.headers), json.loads(raw)
        except Exception:
            return e.code, dict(e.headers), raw.decode(errors="replace")
    except Exception as e:
        return 0, {}, str(e)


def stage1(api):
    s, h, b = call(api, "GET", "/api/health")
    say(OK if s == 200 and isinstance(b, dict) and b.get("ok") else FAIL, f"API health ({s})")
    if s != 200:
        say(FAIL, "backend not reachable: check the backend log in Emergent (JWT_SECRET and FIELD_KEY set?)")
        return False
    low = {k.lower(): v for k, v in h.items()}
    say(OK if low.get("x-content-type-options") == "nosniff" and "no-store" in low.get("cache-control", "") else FAIL, "security headers on API responses")
    s, _, _ = call(api, "GET", "/api/state")
    say(OK if s == 401 else FAIL, f"data needs sign-in ({s})")
    s, _, _ = call(api, "GET", "/api/wear")
    say(OK if s == 401 else FAIL, f"wearables need sign-in ({s})")
    s, h, _ = call(api, "GET", "/api/health", headers={"origin": "https://not-your-site.example"})
    allowed = {k.lower(): v for k, v in h.items()}.get("access-control-allow-origin", "")
    say(OK if allowed in ("", None) else FAIL, "other websites cannot call the API (CORS)")
    s, _, b = call(api, "POST", "/api/auth/login", {"email": "nobody@example.invalid", "password": "not-a-real-password"})
    say(OK if s == 401 else FAIL, f"unknown account refused ({s})")
    return True


def sign_in(api, email):
    pw = getpass.getpass(f"Password for {email} (hidden): ")
    s, _, b = call(api, "POST", "/api/auth/login", {"email": email, "password": pw})
    if s == 401 and isinstance(b, dict) and b.get("need_code"):
        code = getpass.getpass("6-digit code from your authenticator app (hidden): ")
        s, _, b = call(api, "POST", "/api/auth/login", {"email": email, "password": pw, "code": code})
    del pw
    if s != 200:
        say(FAIL, f"sign-in ({s}): {b.get('error') if isinstance(b, dict) else b}")
        return None, None
    say(OK, "signed in")
    return b["token"], b["user"]


def stage2(api, token, user):
    say(OK if user.get("role") == "lead" else WARN, f"role is {user.get('role')} (the first account should be lead)")
    say(OK if user.get("p1") else WARN, "Player 1 access flag" + ("" if user.get("p1") else " is off for this account"))
    say(OK if user.get("totp") else WARN, "two-step sign-in is on" if user.get("totp") else "two-step sign-in is OFF: turn it on before Player 1 data (stage 2, step 4)")
    s, _, b = call(api, "GET", "/api/users", token=token)
    if s == 200:
        n = len(b.get("users", []))
        say(OK, f"{n} account{'s' if n != 1 else ''} on the server")
        no2fa = [u["email"] for u in b["users"] if u.get("p1") and not u.get("totp")]
        say(OK if not no2fa else WARN, "every Player 1 clinician has two-step sign-in" if not no2fa else f"{len(no2fa)} Player 1 account(s) without two-step sign-in yet")
    s, _, b = call(api, "GET", "/api/audit?limit=5", token=token)
    say(OK if s == 200 and b.get("audit") else FAIL, "audit log is recording")


def stage3(api, token, user):
    s, _, b = call(api, "GET", "/api/state/theme", token=token)
    v = b.get("version", 0) if isinstance(b, dict) else 0
    mark = {"theme": (b or {}).get("value") if isinstance(b, dict) else None}
    s2, _, b2 = call(api, "PUT", "/api/state/theme", {"value": mark["theme"] if mark["theme"] is not None else "light", "version": v}, token=token)
    say(OK if s2 == 200 else FAIL, f"save and version check work ({s2})")
    s, _, b = call(api, "GET", "/api/state/daily", token=token)
    if user.get("p1") and not user.get("totp"):
        say(OK if s == 403 else FAIL, "Player 1 data stays closed until two-step sign-in is on" if s == 403 else "Player 1 data opened WITHOUT two-step sign-in: set REQUIRE_2FA_P1=1 in the backend environment and restart")
    elif user.get("p1"):
        say(OK if s == 200 else FAIL, f"Player 1 data opens for you ({s})")
    s, _, b = call(api, "GET", "/api/state/wearlinks", token=token)
    say(OK if s == 404 else FAIL, "server-only documents cannot be read through the API")


def stage4(api, token):
    s, _, b = call(api, "GET", "/api/wear", token=token)
    if s != 200:
        say(FAIL, f"wearable status ({s}): {b.get('error') if isinstance(b, dict) else b}")
        return
    say(OK if b.get("consent") else WARN, "Player 1 consent for wearable sync recorded" if b.get("consent") else "consent for wearable sync not recorded yet (Player 1 record → consent card)")
    for p in b["providers"]:
        st = "connected" if p["connected"] else "configured, not connected" if p["configured"] else "not set up"
        extra = f", last sync {time.strftime('%d %b %H:%M', time.localtime(p['last_sync']))}" if p.get("last_sync") else ""
        say(OK if p["configured"] or p["id"] == "apple" else WARN, f"{p['name']}: {st}{extra}{' · ' + p['last_error'] if p.get('last_error') else ''}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", required=True, help="backend URL, e.g. https://your-app.emergent.host (no trailing slash)")
    ap.add_argument("--stage", type=int, default=1, choices=[1, 2, 3, 4])
    ap.add_argument("--email", help="your account email (stages 2 to 4)")
    a = ap.parse_args()
    api = a.api.rstrip("/")
    print(f"Checking {api}, stage {a.stage}\n")
    if stage1(api) and a.stage >= 2:
        if not a.email:
            sys.exit("stage 2 and above need --email")
        token, user = sign_in(api, a.email)
        if token:
            stage2(api, token, user)
            if a.stage >= 3:
                stage3(api, token, user)
            if a.stage >= 4:
                stage4(api, token)
    fails = sum(1 for s, _ in results if s == FAIL)
    warns = sum(1 for s, _ in results if s == WARN)
    print(f"\n{'PASSED' if not fails else 'NOT PASSED'}: {len(results) - fails - warns} ok, {warns} to do, {fails} failed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
