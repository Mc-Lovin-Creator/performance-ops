"""Innovation scout: only cited links survive, feeds parse, results land in the team record, only the lead or the scheduler can run it."""
import asyncio
import datetime as dt
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["PLOS_NO_AUTOAPP"] = "1"

from core import scout as S  # noqa: E402
from core.store import MemoryStore  # noqa: E402

T = dt.date(2026, 10, 24)
GROK = {"output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({"summary": "One new band this week.", "items": [
    {"title": "WHOOP 5.1", "summary": "New sensor.", "why": "Better HRV.", "source": "WHOOP", "url": "https://www.whoop.com/news/5-1", "kind": "launch", "date": "2026-10-22"},
    {"title": "Invented", "summary": "x", "url": "https://not-cited.example/a"}]}),
    "annotations": [{"type": "url_citation", "url": "https://whoop.com/news/5-1/", "title": "1"}]}]}]}
RSS = '<rss><channel><item><title>New padel shoe</title><link>https://brand.example/shoe</link><pubDate>Thu, 22 Oct 2026 10:00:00 +0000</pubDate></item><item><title>Old</title><link>https://brand.example/old</link><pubDate>Thu, 01 Oct 2026 10:00:00 +0000</pubDate></item></channel></rss>'


class FakeResp:
    def __init__(self, code, body=None, text=""):
        self.status_code, self._b, self.text = code, body, text

    def json(self):
        return self._b


class FakeHttp:
    def __init__(self):
        self.posts = []

    async def post(self, url, json=None, headers=None, timeout=None):
        self.posts.append(json)
        return FakeResp(200, GROK)

    async def get(self, url, timeout=None, headers=None):
        return FakeResp(200, text=RSS)


class Parse(unittest.TestCase):
    def test_only_cited_links_kept(self):
        text, cited = S.parse_response(GROK)
        summary, items = S.extract_items(text, cited, "Wearables and hardware", T)
        self.assertEqual([i["title"] for i in items], ["WHOOP 5.1"])
        self.assertEqual(summary, "One new band this week.")

    def test_feed_recent_only(self):
        self.assertEqual([i["title"] for i in S.parse_feed(RSS, "Launches and drops", "Brand", T - dt.timedelta(days=7))], ["New padel shoe"])

    def test_entities_refused(self):
        self.assertEqual(S.parse_feed('<!DOCTYPE x [<!ENTITY a "aaaa">]><rss/>', "Padel", "x", T), [])

    def test_prompt_has_no_team_data(self):
        p = S.prompt_for("Padel", T)
        for word in ("Player 1", "patient", "@"):
            self.assertNotIn(word, p)


class Run(unittest.TestCase):
    def test_run_writes_team_record_and_dedupes(self):
        os.environ["XAI_API_KEY"] = "test-key"
        os.environ["SCOUT_FEEDS"] = "Launches and drops|Brand|https://brand.example/feed"
        try:
            store, http = MemoryStore(), FakeHttp()
            sc = S.Scout(store, http)
            r1 = asyncio.run(sc.run())
            self.assertEqual(len(http.posts), len(S.LANES))
            self.assertTrue(all(t["type"] in ("web_search", "x_search") for p in http.posts for t in p["tools"]))
            self.assertEqual(r1["added"], 2)   # one Grok item (same link every lane) + one feed item
            r2 = asyncio.run(sc.run())
            self.assertEqual(r2["added"], 0)
            doc = asyncio.run(store.get_state("shared", "scout"))
            self.assertEqual(sorted(v["via"] for v in doc["value"].values()), ["feed", "grok"])
            dg = asyncio.run(store.get_state("shared", "scoutdigest"))["value"]
            self.assertEqual(dg["lanes"]["Padel"]["summary"], "One new band this week.")
        finally:
            os.environ.pop("XAI_API_KEY", None)
            os.environ.pop("SCOUT_FEEDS", None)

    def test_off_without_key(self):
        os.environ.pop("XAI_API_KEY", None)
        http = FakeHttp()
        r = asyncio.run(S.Scout(MemoryStore(), http).run())
        self.assertEqual((http.posts, r["added"]), ([], 0))
