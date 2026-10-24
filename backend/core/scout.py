"""Innovation scout on the team server: Grok (xAI) searches the web and X for the last 7 days, lane by lane,
plus RSS/Atom feeds the team chooses (brand newsrooms, YouTube channels). Results land in the team `scout` record
for the Innovation inbox, with a one-paragraph summary per lane in `scoutdigest`.

Rules
- Public information only. No patient, athlete or team data is ever sent to xAI or any feed: the prompt is fixed text plus dates.
- An item is kept only if its link is one of the sources Grok actually cited (or the feed's own link), so no invented URLs.
- Nothing reaches athletes automatically: items arrive as "new" and a clinician decides who sees them.
- Off until XAI_API_KEY is set. Feeds work without it.
- Runs on the scheduler (POST /api/scout/run with x-cron-key = SCOUT_CRON_KEY) or by the lead from the app.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import xml.etree.ElementTree as ET

from .store import Conflict

LANES = ["Performance science", "Wearables and hardware", "Software and AI", "Apparel and footwear",
         "Nutrition and supplements", "Padel", "Longevity", "Recovery and rehab", "Launches and drops"]
LANE_BRIEF = {
    "Performance science": "new findings on strength, power, speed, conditioning and load monitoring in athletes",
    "Wearables and hardware": "new or updated wearables, sensors and testing hardware for athletes (WHOOP, Oura, Garmin, Polar, force plates, IMUs)",
    "Software and AI": "software and AI tools for sports performance, physiotherapy and athlete monitoring",
    "Apparel and footwear": "court shoes, padel footwear, compression and performance apparel",
    "Nutrition and supplements": "sports nutrition and supplement evidence and products (only claims backed by research or regulators)",
    "Padel": "padel tour news, padel injury research, padel equipment and coaching",
    "Longevity": "longevity and healthspan research relevant to active adults: VO2max, strength, sleep, metabolic health",
    "Recovery and rehab": "recovery modalities and rehabilitation research and products (tendon, ligament, foot and ankle, return to sport)",
    "Launches and drops": "product launches, release dates and limited drops from sports-tech, padel and performance brands announced in the last 7 days",
}
MAX_PER_LANE = 3
XAI_URL = "https://api.x.ai/v1/responses"
SCOUT_KEY, DIGEST_KEY = "scout", "scoutdigest"


def _today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def item_id(url: str, title: str) -> str:
    return "sc-" + hashlib.sha256((url or title).strip().lower().encode()).hexdigest()[:12]


def prompt_for(lane: str, today: dt.date) -> str:
    return (
        f"You are the innovation scout for a private padel performance and physiotherapy team in Abu Dhabi. Today is {today.isoformat()}.\n"
        f"Lane: {lane} — {LANE_BRIEF[lane]}.\n"
        "Search the web and X for items from the last 7 days. Prefer primary sources: journals, regulators, the brand's own site or account, "
        "reputable news. Skip rumours, affiliate listicles and anything you cannot cite.\n"
        f"Return at most {MAX_PER_LANE} items and a two-sentence summary of the lane this week, as JSON only, no prose around it:\n"
        '{"summary": "...", "items": [{"title": "...", "summary": "one or two plain sentences, only what the source says", '
        '"why": "one sentence on why it matters to a padel performance and rehab team", "source": "publisher or account", '
        '"url": "the exact source URL you cited", "kind": "research|launch|drop|news", "date": "YYYY-MM-DD"}]}'
    )


def parse_response(body: dict) -> tuple[str, list[str]]:
    """Text and the URLs Grok actually cited, from a /v1/responses reply."""
    text, cited = [], []
    for out in body.get("output") or []:
        if out.get("type") != "message":
            continue
        for c in out.get("content") or []:
            if c.get("type") == "output_text":
                text.append(c.get("text") or "")
                for a in c.get("annotations") or []:
                    if a.get("type") == "url_citation" and a.get("url"):
                        cited.append(a["url"])
    for u in body.get("citations") or []:
        cited.append(u if isinstance(u, str) else (u or {}).get("url", ""))
    return "\n".join(text), [u for u in cited if u]


def _norm(u: str) -> str:
    return re.sub(r"[?#].*$", "", (u or "").strip().lower()).rstrip("/").replace("://www.", "://")


def extract_items(text: str, cited: list[str], lane: str, today: dt.date) -> tuple[str, list[dict]]:
    m = re.search(r"\{[\s\S]*\}", re.sub(r"\[\[\d+\]\]\([^)]*\)", "", text))
    if not m:
        return "", []
    try:
        data = json.loads(m.group(0))
    except Exception:
        return "", []
    ok = {_norm(u) for u in cited}
    items = []
    for it in (data.get("items") or [])[:MAX_PER_LANE]:
        url, title = str(it.get("url") or ""), str(it.get("title") or "").strip()
        if not title or not url.startswith("https://") or _norm(url) not in ok:
            continue   # not a source Grok actually opened: drop it rather than risk an invented link
        items.append({"id": item_id(url, title), "title": title[:200], "summary": str(it.get("summary") or "")[:500],
                      "why": str(it.get("why") or "")[:300], "source": str(it.get("source") or "")[:80], "url": url[:500],
                      "kind": it.get("kind") if it.get("kind") in ("research", "launch", "drop", "news") else "news",
                      "lane": lane, "date": str(it.get("date") or today.isoformat())[:10], "via": "grok", "status": "new",
                      "at": dt.datetime.now(dt.timezone.utc).isoformat()})
    return str(data.get("summary") or "")[:600], items


def parse_feed(xml_text: str, lane: str, source: str, since: dt.date, limit: int = 5) -> list[dict]:
    """RSS 2.0 or Atom (YouTube channel feeds are Atom). Items newer than `since` only."""
    if len(xml_text) > 3_000_000 or "<!ENTITY" in xml_text:
        return []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    entries = root.findall(".//item") or root.findall(".//a:entry", ns)
    for e in entries:
        title = (e.findtext("title") or e.findtext("a:title", default="", namespaces=ns) or "").strip()
        link = e.findtext("link") or ""
        if not link:
            le = e.find("a:link", ns)
            link = le.get("href") if le is not None else ""
        when = e.findtext("pubDate") or e.findtext("a:published", default="", namespaces=ns) or e.findtext("a:updated", default="", namespaces=ns) or ""
        d = _date(when)
        if not title or not link.startswith("https://") or (d and d < since):
            continue
        desc = re.sub(r"<[^>]+>", " ", e.findtext("description") or e.findtext("{http://search.yahoo.com/mrss/}group/{http://search.yahoo.com/mrss/}description") or "")
        out.append({"id": item_id(link, title), "title": title[:200], "summary": re.sub(r"\s+", " ", desc).strip()[:400], "why": "",
                    "source": source[:80], "url": link[:500], "kind": "launch" if lane == "Launches and drops" else "news", "lane": lane,
                    "date": (d or _today()).isoformat(), "via": "feed", "status": "new", "at": dt.datetime.now(dt.timezone.utc).isoformat()})
        if len(out) >= limit:
            break
    return out


def _date(s: str) -> dt.date | None:
    s = (s or "").strip()
    for f in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            return dt.datetime.strptime(s, f).date()
        except ValueError:
            pass
    try:
        return dt.date.fromisoformat(s[:10])
    except ValueError:
        return None


def feeds_from_env() -> list[tuple[str, str, str]]:
    """SCOUT_FEEDS = one per line or ';'-separated: lane|source name|https://feed-url"""
    out = []
    for part in re.split(r"[;\n]", os.environ.get("SCOUT_FEEDS", "")):
        bits = [b.strip() for b in part.split("|")]
        if len(bits) == 3 and bits[0] in LANES and bits[2].startswith("https://"):
            out.append((bits[0], bits[1], bits[2]))
    return out[:40]


class Scout:
    def __init__(self, store, http):
        self.store, self.http = store, http

    async def grok_lane(self, lane: str, today: dt.date) -> tuple[str, list[dict]]:
        key = os.environ.get("XAI_API_KEY", "")
        if not key:
            return "", []
        handles = [h.strip().lstrip("@") for h in os.environ.get("SCOUT_X_HANDLES", "").split(",") if h.strip()][:20]
        xs = {"type": "x_search", "from_date": (today - dt.timedelta(days=7)).isoformat(), "to_date": (today + dt.timedelta(days=1)).isoformat()}
        if handles and lane == "Launches and drops":
            xs["allowed_x_handles"] = handles
        body = {"model": os.environ.get("XAI_MODEL", "grok-4.7"), "input": prompt_for(lane, today), "tools": [{"type": "web_search"}, xs], "store": False}
        r = await self.http.post(XAI_URL, json=body, headers={"authorization": "Bearer " + key}, timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f"xAI {r.status_code}")
        text, cited = parse_response(r.json())
        return extract_items(text, cited, lane, today)

    async def save(self, items: list[dict], digest: dict) -> int:
        added = 0
        for _ in range(8):
            doc = await self.store.get_state("shared", SCOUT_KEY)
            cur = dict((doc or {}).get("value") or {})
            rv = dict((doc or {}).get("rv") or {})
            seen = {_norm(v.get("url", "")) for v in cur.values()}
            added = 0
            for it in items:
                if it["id"] in cur or _norm(it["url"]) in seen:
                    continue
                cur[it["id"]] = it
                rv[it["id"]] = 1
                seen.add(_norm(it["url"]))
                added += 1
            # keep the newest 300
            if len(cur) > 300:
                for k in sorted(cur, key=lambda k: cur[k].get("at", ""))[:len(cur) - 300]:
                    cur.pop(k)
                    rv.pop(k, None)
            try:
                await self.store.put_state("shared", SCOUT_KEY, {"value": cur, "rv": rv, "updated_by": "scout"}, doc["version"] if doc else 0)
                break
            except Conflict:
                continue
        for _ in range(8):
            d = await self.store.get_state("shared", DIGEST_KEY)
            try:
                await self.store.put_state("shared", DIGEST_KEY, {"value": digest, "updated_by": "scout"}, d["version"] if d else 0)
                break
            except Conflict:
                continue
        return added

    async def run(self) -> dict:
        today = _today()
        items, lanes, errors = [], {}, []
        for lane in LANES:
            try:
                summary, found = await self.grok_lane(lane, today)
                items += found
                if summary:
                    lanes[lane] = {"summary": summary, "n": len(found)}
            except Exception as e:   # one lane failing must not stop the others
                errors.append(f"{lane}: {e}")
        for lane, source, url in feeds_from_env():
            try:
                r = await self.http.get(url, timeout=20, headers={"user-agent": "PerformanceOps-scout/1.0"})
                if r.status_code == 200:
                    items += parse_feed(r.text, lane, source, today - dt.timedelta(days=7))
            except Exception as e:
                errors.append(f"feed {source}: {e}")
        digest = {"date": today.isoformat(), "lanes": lanes, "grok": bool(os.environ.get("XAI_API_KEY")), "feeds": len(feeds_from_env()), "errors": errors[:10]}
        added = await self.save(items, digest)
        return {"added": added, "found": len(items), "lanes": len(lanes), "errors": errors[:10]}
