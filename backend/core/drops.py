"""Tech Drops agent: new health, wellness and performance technology releases (launches, pre-orders, collaborations,
limited drops, crowdfunding) found by Grok on the web and X, split into domains, with a daily brief and a weekly roundup.

Rules
- Public information only; the prompt is fixed text plus dates. No team or patient data is sent.
- An item is kept only if its link is one Grok actually cited.
- Product claims are recorded as the brand's claims, never as evidence. The team decides what is worth testing.
- Off until XAI_API_KEY is set. Runs on the scheduler (POST /api/drops/run?mode=daily|weekly, x-cron-key = SCOUT_CRON_KEY) or by the lead.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re

from .scout import XAI_URL, _norm, item_id, parse_response
from .store import Conflict

DOMAINS = {
    "Wearables and sensors": "rings, bands, watches, patches, smart clothing and sensors that track heart rate, HRV, sleep, temperature, movement or blood markers",
    "Recovery tech": "percussion, compression, heat, cold, light and electrical stimulation devices for recovery (for example Hyperice, Therabody, Normatec, Game Ready)",
    "Sleep tech": "smart mattresses, sleep trackers, temperature control, light and sound devices for sleep",
    "Training and gym tech": "smart strength and cardio equipment, force plates, velocity trackers, connected fitness and coaching apps",
    "Footwear and apparel tech": "performance shoes, court shoes, smart insoles, recovery footwear and technical apparel, including brand collaborations (for example Nike x Hyperice)",
    "Rehab and physio devices": "devices and software for physiotherapy and rehabilitation: dynamometers, biofeedback, EMS, shockwave, motion capture",
    "Nutrition and metabolic tech": "continuous glucose monitors, metabolic and lactate testing, smart hydration, food and supplement tech",
    "Mind and neurotech": "neurofeedback, breathing and stress devices, brain-stimulation and focus tech",
    "Diagnostics and longevity": "at-home testing, imaging, biomarker and longevity tech for consumers and clinics",
    "Racket and padel tech": "padel and racket-sport rackets, balls, sensors, court and coaching technology",
}
KINDS = ("launch", "preorder", "collab", "update", "crowdfunding", "limited drop")
MAX_PER_DOMAIN = 4
KEY, BRIEF_KEY = "drops", "dropsbrief"


def prompt_for(domain: str, today: dt.date, days: int) -> str:
    return (
        f"You track new health, wellness and performance technology for a padel performance and physiotherapy team. Today is {today.isoformat()}.\n"
        f"Domain: {domain} — {DOMAINS[domain]}.\n"
        f"Search the web and X for products released, announced, opened for pre-order, crowdfunded or dropped in the last {days} days. "
        "Cover every public channel: X (use x_search), and through web search the public posts on Instagram, TikTok, YouTube, LinkedIn, Reddit and Threads, "
        "plus brand sites, press releases, reputable tech and sport media, Product Hunt and Kickstarter. When a drop was announced on a social post, cite that post's own URL. "
        "Skip rumours, leaks without a source, "
        "affiliate listicles and anything you cannot cite.\n"
        f"Return at most {MAX_PER_DOMAIN} items and a two-sentence summary of the domain for this period, as JSON only:\n"
        '{"summary": "...", "items": [{"product": "...", "brand": "...", "what": "one plain sentence on what it is", '
        '"claims": "what the brand says it does, stated as the brand\'s claim", "why": "one sentence on why a padel performance and rehab team might care", '
        '"price": "as stated, or empty", "availability": "date and regions if stated, or empty", "kind": "launch|preorder|collab|update|crowdfunding|limited drop", '
        '"url": "the exact source URL you cited", "source": "publisher or account", "channel": "x|instagram|tiktok|youtube|linkedin|reddit|threads|web|press|producthunt|kickstarter", "date": "YYYY-MM-DD"}]}'
    )


def extract(text: str, cited: list[str], domain: str, today: dt.date) -> tuple[str, list[dict]]:
    m = re.search(r"\{[\s\S]*\}", re.sub(r"\[\[\d+\]\]\([^)]*\)", "", text))
    if not m:
        return "", []
    try:
        data = json.loads(m.group(0))
    except Exception:
        return "", []
    ok = {_norm(u) for u in cited}
    out = []
    for it in (data.get("items") or [])[:MAX_PER_DOMAIN]:
        url, product = str(it.get("url") or ""), str(it.get("product") or "").strip()
        if not product or not url.startswith("https://") or _norm(url) not in ok:
            continue
        kind = str(it.get("kind") or "launch").lower()
        out.append({"id": item_id(url, product), "product": product[:120], "brand": str(it.get("brand") or "")[:80], "what": str(it.get("what") or "")[:300],
                    "claims": str(it.get("claims") or "")[:300], "why": str(it.get("why") or "")[:300], "price": str(it.get("price") or "")[:60],
                    "availability": str(it.get("availability") or "")[:120], "kind": kind if kind in KINDS else "launch", "url": url[:500],
                    "source": str(it.get("source") or "")[:80], "channel": _channel(url, str(it.get("channel") or "")), "domain": domain, "date": str(it.get("date") or today.isoformat())[:10],
                    "status": "new", "at": dt.datetime.now(dt.timezone.utc).isoformat()})
    return str(data.get("summary") or "")[:600], out


CHANNELS = (("instagram.com", "instagram"), ("tiktok.com", "tiktok"), ("youtube.com", "youtube"), ("youtu.be", "youtube"), ("x.com", "x"), ("twitter.com", "x"),
            ("linkedin.com", "linkedin"), ("reddit.com", "reddit"), ("threads.net", "threads"), ("producthunt.com", "producthunt"), ("kickstarter.com", "kickstarter"))


def _channel(url: str, said: str) -> str:
    """Where the drop was seen, from the link itself (the model's label is only a fallback)."""
    u = url.lower()
    for host, ch in CHANNELS:
        if f"//{host}" in u or f".{host}" in u:
            return ch
    return said if said in ("press", "web") else "web"


class Drops:
    def __init__(self, store, http):
        self.store, self.http = store, http

    async def domain(self, domain: str, today: dt.date, days: int):
        key = os.environ.get("XAI_API_KEY", "")
        if not key:
            return "", []
        xs = {"type": "x_search", "from_date": (today - dt.timedelta(days=days)).isoformat(), "to_date": (today + dt.timedelta(days=1)).isoformat()}
        body = {"model": os.environ.get("XAI_MODEL", "grok-4.7"), "input": prompt_for(domain, today, days), "tools": [{"type": "web_search"}, xs], "store": False}
        r = await self.http.post(XAI_URL, json=body, headers={"authorization": "Bearer " + key}, timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f"xAI {r.status_code}")
        text, cited = parse_response(r.json())
        return extract(text, cited, domain, today)

    async def _put(self, key: str, fn):
        for _ in range(8):
            doc = await self.store.get_state("shared", key)
            cur = dict((doc or {}).get("value") or {})
            new, rv = fn(cur, dict((doc or {}).get("rv") or {}))
            try:
                await self.store.put_state("shared", key, {"value": new, "rv": rv, "updated_by": "drops"}, doc["version"] if doc else 0)
                return
            except Conflict:
                continue

    async def run(self, mode: str = "daily") -> dict:
        today = dt.datetime.now(dt.timezone.utc).date()
        days = 7 if mode == "weekly" else 2
        found, sums, errors = [], {}, []
        for d in DOMAINS:
            try:
                s, items = await self.domain(d, today, days)
                found += items
                if s:
                    sums[d] = {"summary": s, "n": len(items)}
            except Exception as e:
                errors.append(f"{d}: {e}")
        added = 0

        def merge(cur, rv):
            nonlocal added
            seen = {_norm(v.get("url", "")) for v in cur.values()}
            for it in found:
                if it["id"] in cur or _norm(it["url"]) in seen:
                    continue
                cur[it["id"]] = it
                rv[it["id"]] = 1
                seen.add(_norm(it["url"]))
                added += 1
            if len(cur) > 400:
                for k in sorted(cur, key=lambda k: cur[k].get("at", ""))[:len(cur) - 400]:
                    cur.pop(k)
                    rv.pop(k, None)
            return cur, rv
        await self._put(KEY, merge)
        brief = {"date": today.isoformat(), "days": days, "domains": sums, "count": len(found), "top": [i["id"] for i in found[:8]],
                 "grok": bool(os.environ.get("XAI_API_KEY")), "errors": errors[:10]}

        def setb(cur, rv):
            cur[mode] = brief
            return cur, rv
        await self._put(BRIEF_KEY, setb)
        return {"mode": mode, "added": added, "found": len(found), "domains": len(sums), "errors": errors[:10]}
