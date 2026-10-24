"""Wearable providers: OAuth, fetching and turning each provider's data into one daily row.

One row per calendar day, the same shape the app already uses for CSV imports:
    {"sleep": hours, "hrv": ms, "rhr": bpm, "score": 0-100 or provider scale, "src": "Oura"}

Providers
  oura    Oura API v2, OAuth 2 (personal access tokens were retired at the end of 2025)
  whoop   WHOOP developer API v2, OAuth 2 with the offline scope for refresh tokens
  polar   Polar AccessLink v3, OAuth 2; the user must be registered after the first token
  garmin  Garmin Health API, OAuth 2 with PKCE; data arrives by push (needs Connect Developer Program approval)
  apple   Apple Health has no cloud API: the Health Auto Export iPhone app posts JSON to our ingest URL

Endpoint paths and field names are kept in this file only, so a provider change is a one-file fix.
Check each against the provider's current reference before go-live (docs/WEARABLES.md lists the links).
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

FIELDS = ("sleep", "hrv", "rhr", "score")


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    auth_url: str
    token_url: str
    scope: str
    api: str
    token_auth: str = "body"        # "body": client id/secret in the form; "basic": HTTP Basic header
    pkce: bool = False
    refresh: bool = True
    env: str = ""                   # prefix for <ENV>_CLIENT_ID / <ENV>_CLIENT_SECRET
    extra_auth: dict = field(default_factory=dict)


PROVIDERS: dict[str, Provider] = {
    "oura": Provider("oura", "Oura", "https://cloud.ouraring.com/oauth/authorize", "https://api.ouraring.com/oauth/token",
                     "daily heartrate", "https://api.ouraring.com", env="OURA"),
    "whoop": Provider("whoop", "WHOOP", "https://api.prod.whoop.com/oauth/oauth2/auth", "https://api.prod.whoop.com/oauth/oauth2/token",
                      "offline read:recovery read:sleep read:cycles", "https://api.prod.whoop.com/developer", env="WHOOP"),
    "polar": Provider("polar", "Polar", "https://flow.polar.com/oauth2/authorization", "https://polarremote.com/v2/oauth2/token",
                      "accesslink.read_all", "https://www.polaraccesslink.com", token_auth="basic", refresh=False, env="POLAR"),
    "garmin": Provider("garmin", "Garmin", "https://connect.garmin.com/oauth2Confirm", "https://diauth.garmin.com/di-oauth2-service/oauth/token",
                       "", "https://apis.garmin.com", pkce=True, env="GARMIN"),
}
OAUTH_IDS = tuple(PROVIDERS)
ALL_IDS = OAUTH_IDS + ("apple",)
NAMES = {**{p.id: p.name for p in PROVIDERS.values()}, "apple": "Apple Health"}


def client_creds(p: Provider) -> tuple[str, str]:
    return os.environ.get(f"{p.env}_CLIENT_ID", ""), os.environ.get(f"{p.env}_CLIENT_SECRET", "")


def configured(pid: str) -> bool:
    if pid == "apple":
        return True
    cid, sec = client_creds(PROVIDERS[pid])
    return bool(cid and sec)


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def authorize_url(p: Provider, state: str, redirect_uri: str, challenge: str | None = None) -> str:
    cid, _ = client_creds(p)
    q = {"response_type": "code", "client_id": cid, "redirect_uri": redirect_uri, "state": state}
    if p.scope:
        q["scope"] = p.scope
    if p.pkce and challenge:
        q.update(code_challenge=challenge, code_challenge_method="S256")
    q.update(p.extra_auth)
    return p.auth_url + "?" + urlencode(q)


# ---------------------------------------------------------------- normalising

def _r(v, nd=0):
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return round(v, nd) if nd else int(round(v))


def _hours(seconds):
    return None if seconds is None else round(float(seconds) / 3600, 1)


def _row(src, sleep=None, hrv=None, rhr=None, score=None):
    return {"sleep": sleep, "hrv": hrv, "rhr": rhr, "score": score, "src": src}


def norm_oura(sleeps: list[dict], readiness: list[dict]) -> dict[str, dict]:
    """Oura: main sleep period per day (type long_sleep, else the longest), readiness score per day."""
    best: dict[str, dict] = {}
    for s in sleeps:
        d = s.get("day")
        if not d:
            continue
        cur = best.get(d)
        rank = (s.get("type") == "long_sleep", s.get("total_sleep_duration") or 0)
        if not cur or rank > (cur.get("type") == "long_sleep", cur.get("total_sleep_duration") or 0):
            best[d] = s
    out = {d: _row("Oura", _hours(s.get("total_sleep_duration")), _r(s.get("average_hrv")), _r(s.get("lowest_heart_rate"))) for d, s in best.items()}
    for r in readiness:
        d = r.get("day")
        if d and r.get("score") is not None:
            out.setdefault(d, _row("Oura"))["score"] = _r(r["score"])
    return out


def _local_day(ts: str | None, offset: str | None) -> str | None:
    if not ts:
        return None
    try:
        t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if offset:
            sign = -1 if offset.startswith("-") else 1
            hh, mm = offset.lstrip("+-").split(":")
            t = t.astimezone(timezone(sign * timedelta(hours=int(hh), minutes=int(mm))))
        return t.date().isoformat()
    except Exception:
        return ts[:10]


def norm_whoop(sleeps: list[dict], recoveries: list[dict]) -> dict[str, dict]:
    """WHOOP: the day is the local date the main sleep ended; recovery links to its sleep by sleep_id."""
    out: dict[str, dict] = {}
    day_of_sleep: dict[str, str] = {}
    for s in sleeps:
        if s.get("nap"):
            continue
        d = _local_day(s.get("end"), s.get("timezone_offset"))
        if not d:
            continue
        day_of_sleep[str(s.get("id"))] = d
        st = ((s.get("score") or {}).get("stage_summary") or {}) if s.get("score_state") == "SCORED" else {}
        ms = sum(st.get(k) or 0 for k in ("total_light_sleep_time_milli", "total_slow_wave_sleep_time_milli", "total_rem_sleep_time_milli"))
        if ms:
            out.setdefault(d, _row("WHOOP"))["sleep"] = round(ms / 3_600_000, 1)
    for r in recoveries:
        if r.get("score_state") != "SCORED":
            continue
        d = day_of_sleep.get(str(r.get("sleep_id"))) or _local_day(r.get("created_at"), None)
        sc = r.get("score") or {}
        row = out.setdefault(d, _row("WHOOP"))
        row.update(hrv=_r(sc.get("hrv_rmssd_milli")), rhr=_r(sc.get("resting_heart_rate")), score=_r(sc.get("recovery_score")))
    return out


def norm_polar(recharges: list[dict], nights: list[dict]) -> dict[str, dict]:
    """Polar: Nightly Recharge gives overnight HRV (RMSSD) and average night heart rate; sleep gives stage durations."""
    out: dict[str, dict] = {}
    for n in nights:
        d = n.get("date")
        if not d:
            continue
        secs = sum(n.get(k) or 0 for k in ("light_sleep", "deep_sleep", "rem_sleep"))
        out.setdefault(d, _row("Polar")).update(sleep=_hours(secs) if secs else None, score=_r(n.get("sleep_score")))
    for r in recharges:
        d = r.get("date")
        if not d:
            continue
        out.setdefault(d, _row("Polar")).update(hrv=_r(r.get("heart_rate_variability_avg")), rhr=_r(r.get("heart_rate_avg")))
    return out


def norm_garmin(payload: dict, user_id: str) -> dict[str, dict]:
    """Garmin push: dailies (resting heart rate), hrv (last-night average), sleeps (stage durations). Other users are ignored."""
    out: dict[str, dict] = {}
    mine = lambda xs: [x for x in xs or [] if str(x.get("userId")) == str(user_id)]  # noqa: E731
    for x in mine(payload.get("dailies")):
        if x.get("calendarDate"):
            out.setdefault(x["calendarDate"], _row("Garmin"))["rhr"] = _r(x.get("restingHeartRateInBeatsPerMinute"))
    for x in mine(payload.get("hrv")):
        if x.get("calendarDate"):
            out.setdefault(x["calendarDate"], _row("Garmin"))["hrv"] = _r(x.get("lastNightAvg"))
    for x in mine(payload.get("sleeps")):
        if not x.get("calendarDate"):
            continue
        secs = sum(x.get(k) or 0 for k in ("deepSleepDurationInSeconds", "lightSleepDurationInSeconds", "remSleepInSeconds")) or x.get("durationInSeconds")
        row = out.setdefault(x["calendarDate"], _row("Garmin"))
        row["sleep"] = _hours(secs)
        sc = ((x.get("overallSleepScore") or {}).get("value"))
        if sc is not None:
            row["score"] = _r(sc)
    return out


APPLE_METRICS = {"heart_rate_variability": "hrv", "heart_rate_variability_sdnn": "hrv", "resting_heart_rate": "rhr"}


def norm_apple(payload: dict) -> dict[str, dict]:
    """Health Auto Export (REST API automation, JSON): daily averages for HRV (SDNN on Apple Watch) and resting heart rate,
    total sleep in hours from sleep_analysis."""
    metrics = ((payload or {}).get("data") or {}).get("metrics") or []
    acc: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for m in metrics:
        name = str(m.get("name", "")).lower()
        for s in m.get("data") or []:
            d = str(s.get("date", ""))[:10]
            if len(d) != 10:
                continue
            if name in APPLE_METRICS and s.get("qty") is not None:
                acc[d][APPLE_METRICS[name]].append(float(s["qty"]))
            elif name == "sleep_analysis":
                hrs = s.get("totalSleep", s.get("asleep"))
                if hrs is not None:
                    acc[d]["sleep"].append(float(hrs))
    out = {}
    for d, f in acc.items():
        out[d] = _row("Apple Health", round(sum(f["sleep"]), 1) if f["sleep"] else None,
                      _r(sum(f["hrv"]) / len(f["hrv"])) if f["hrv"] else None, _r(sum(f["rhr"]) / len(f["rhr"])) if f["rhr"] else None)
    return out


def merge_days(current: dict, new: dict) -> tuple[dict, list[str]]:
    """Fill each day with the new non-empty values; a day typed or imported by hand keeps the fields the new source lacks."""
    cur = {d: dict(v) for d, v in (current or {}).items()}
    changed = []
    for d, row in new.items():
        if not isinstance(d, str) or len(d) != 10:
            continue
        before = cur.get(d, {})
        after = dict(before)
        for f in FIELDS:
            if row.get(f) is not None:
                after[f] = row[f]
        if any(row.get(f) is not None for f in FIELDS):
            after["src"] = row["src"]
        if after != before:
            cur[d] = after
            changed.append(d)
    return cur, sorted(changed)


# ---------------------------------------------------------------- talking to providers

class ProviderError(Exception):
    def __init__(self, msg: str, status: int = 0):
        super().__init__(msg)
        self.status = status


class WearClient:
    """All provider HTTP lives here. `http` is an httpx.AsyncClient (tests pass one with a MockTransport)."""

    def __init__(self, http):
        self.http = http

    async def _token(self, p: Provider, data: dict) -> dict:
        cid, sec = client_creds(p)
        headers = {"accept": "application/json"}
        if p.token_auth == "basic":
            headers["authorization"] = "Basic " + base64.b64encode(f"{cid}:{sec}".encode()).decode()
        else:
            data = dict(data, client_id=cid, client_secret=sec)
        r = await self.http.post(p.token_url, data=data, headers=headers)
        if r.status_code >= 400:
            raise ProviderError(f"{p.name} token request failed ({r.status_code})", r.status_code)
        t = r.json()
        return {"access": t["access_token"], "refresh": t.get("refresh_token"), "expires_at": time.time() + float(t.get("expires_in") or 10 * 365 * 86400),
                "user_id": str(t.get("x_user_id") or t.get("user_id") or "")}

    async def exchange(self, p: Provider, code: str, redirect_uri: str, verifier: str | None = None) -> dict:
        data = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}
        if verifier:
            data["code_verifier"] = verifier
        tok = await self._token(p, data)
        if p.id == "polar":
            await self._polar_register(tok)
        if p.id == "garmin":
            r = await self.http.get(p.api + "/wellness-api/rest/user/id", headers={"authorization": "Bearer " + tok["access"]})
            if r.status_code < 400:
                tok["user_id"] = str(r.json().get("userId", ""))
        return tok

    async def refresh(self, p: Provider, link: dict) -> dict:
        if not p.refresh or not link.get("refresh"):
            raise ProviderError(f"{p.name} needs to be connected again", 401)
        data = {"grant_type": "refresh_token", "refresh_token": link["refresh"]}
        if p.id == "whoop":
            data["scope"] = "offline"
        tok = await self._token(p, data)
        tok["user_id"] = link.get("user_id") or tok["user_id"]
        tok["refresh"] = tok["refresh"] or link["refresh"]
        return tok

    async def _polar_register(self, tok: dict):
        r = await self.http.post(PROVIDERS["polar"].api + "/v3/users", json={"member-id": "plos-" + hashlib.sha256(tok["user_id"].encode()).hexdigest()[:16]},
                                 headers={"authorization": "Bearer " + tok["access"], "accept": "application/json"})
        if r.status_code not in (200, 201, 204, 409):  # 409: already registered
            raise ProviderError(f"Polar registration failed ({r.status_code})", r.status_code)

    async def _get(self, p: Provider, link: dict, path: str, params: dict | None = None) -> dict:
        r = await self.http.get(p.api + path, params=params or {}, headers={"authorization": "Bearer " + link["access"], "accept": "application/json"})
        if r.status_code == 401:
            raise ProviderError("expired", 401)
        if r.status_code == 204:
            return {}
        if r.status_code == 429:
            raise ProviderError(f"{p.name} rate limit reached, try later", 429)
        if r.status_code >= 400:
            raise ProviderError(f"{p.name} returned {r.status_code} for {path}", r.status_code)
        return r.json()

    async def _paged(self, p, link, path, params, token_param="next_token", items="data"):
        rows, nxt = [], None
        for _ in range(40):
            q = dict(params)
            if nxt:
                q[token_param] = nxt
            j = await self._get(p, link, path, q)
            rows += j.get(items) or []
            nxt = j.get("next_token")
            if not nxt:
                break
        return rows

    async def fetch(self, pid: str, link: dict, days: int = 35, today: date | None = None) -> dict[str, dict]:
        """Returns normalised days. Garmin pushes its data, so a Garmin sync asks Garmin to re-send (backfill) instead."""
        p = PROVIDERS[pid]
        today = today or date.today()
        start = today - timedelta(days=days)
        if pid == "oura":
            q = {"start_date": start.isoformat(), "end_date": (today + timedelta(days=1)).isoformat()}
            return norm_oura(await self._paged(p, link, "/v2/usercollection/sleep", q), await self._paged(p, link, "/v2/usercollection/daily_readiness", q))
        if pid == "whoop":
            q = {"start": f"{start.isoformat()}T00:00:00.000Z", "end": f"{(today + timedelta(days=1)).isoformat()}T00:00:00.000Z", "limit": 25}
            sleeps = await self._paged(p, link, "/v2/activity/sleep", q, "nextToken", "records")
            recs = await self._paged(p, link, "/v2/recovery", q, "nextToken", "records")
            return norm_whoop(sleeps, recs)
        if pid == "polar":
            rech = (await self._get(p, link, "/v3/users/nightly-recharge")).get("recharges") or []
            nights = (await self._get(p, link, "/v3/users/sleep")).get("nights") or []
            keep = lambda xs: [x for x in xs if str(x.get("date", "")) >= start.isoformat()]  # noqa: E731
            return norm_polar(keep(rech), keep(nights))
        if pid == "garmin":
            t0 = int(datetime.combine(start, datetime.min.time(), timezone.utc).timestamp())
            for kind in ("dailies", "hrv", "sleeps"):
                for a in range(t0, int(time.time()), 30 * 86400):  # Garmin limits each backfill request to a range of days
                    r = await self.http.get(p.api + f"/wellness-api/rest/backfill/{kind}", params={"summaryStartTimeInSeconds": a, "summaryEndTimeInSeconds": min(a + 30 * 86400, int(time.time()))},
                                            headers={"authorization": "Bearer " + link["access"]})
                    if r.status_code == 401:
                        raise ProviderError("expired", 401)
                    if r.status_code not in (200, 202, 409):  # 409: a backfill for that range was already requested
                        raise ProviderError(f"Garmin backfill returned {r.status_code}", r.status_code)
            return {}
        raise ProviderError("unknown provider")

    async def revoke(self, pid: str, link: dict):
        """Best effort: tell the provider to drop the connection. Local tokens are deleted either way."""
        p = PROVIDERS[pid]
        h = {"authorization": "Bearer " + link.get("access", "")}
        try:
            if pid == "oura":
                await self.http.get("https://api.ouraring.com/oauth/revoke", params={"access_token": link.get("access", "")})
            elif pid == "whoop":
                await self.http.delete(p.api + "/v2/user/access", headers=h)
            elif pid == "polar" and link.get("user_id"):
                await self.http.delete(p.api + f"/v3/users/{link['user_id']}", headers=h)
            elif pid == "garmin":
                await self.http.delete(p.api + "/wellness-api/rest/user/registration", headers=h)
        except Exception:
            pass
