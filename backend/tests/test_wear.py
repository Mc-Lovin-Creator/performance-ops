"""Wearable sync: every provider against a fake HTTP server (no network), plus the consent and role gates."""
import asyncio
import json
import os
import sys
import unittest
from datetime import date
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["PLOS_NO_AUTOAPP"] = "1"

import httpx  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from core import wearables as wr  # noqa: E402
from core.security import Keys, gen_field_key, hash_password  # noqa: E402
from core.store import MemoryStore  # noqa: E402
from server import create_app  # noqa: E402

PW = "correct horse battery"
ENV = {"OURA_CLIENT_ID": "oura-id", "OURA_CLIENT_SECRET": "oura-secret", "WHOOP_CLIENT_ID": "w-id", "WHOOP_CLIENT_SECRET": "w-sec",
       "POLAR_CLIENT_ID": "p-id", "POLAR_CLIENT_SECRET": "p-sec", "GARMIN_CLIENT_ID": "g-id", "GARMIN_CLIENT_SECRET": "g-sec",
       "GARMIN_PUSH_KEY": "g" * 30, "WEAR_CRON_KEY": "c" * 40, "PUBLIC_API_URL": "https://api.lab.test", "APP_URL": "https://app.lab.test"}
TODAY = date.today().isoformat()


class FakeProviders:
    """Answers like the providers do; records every request."""

    def __init__(self):
        self.calls = []
        self.whoop_fail_once = False

    def __call__(self, req: httpx.Request):
        u = str(req.url)
        self.calls.append((req.method, u))
        body = parse_qs(req.content.decode()) if req.method == "POST" and req.content and b"=" in req.content and not req.content.startswith(b"{") else {}
        if u.startswith("https://api.ouraring.com/oauth/token"):
            return httpx.Response(200, json={"access_token": "oura-at", "refresh_token": "oura-rt", "expires_in": 86400})
        if "/v2/usercollection/sleep" in u:
            nt = req.url.params.get("next_token")
            if not nt:
                return httpx.Response(200, json={"data": [{"day": TODAY, "type": "long_sleep", "total_sleep_duration": 27000, "average_hrv": 61.4, "lowest_heart_rate": 48}], "next_token": "p2"})
            return httpx.Response(200, json={"data": [{"day": TODAY, "type": "rest", "total_sleep_duration": 1800, "average_hrv": 30, "lowest_heart_rate": 60}], "next_token": None})
        if "/v2/usercollection/daily_readiness" in u:
            return httpx.Response(200, json={"data": [{"day": TODAY, "score": 82}], "next_token": None})
        if u.startswith("https://api.ouraring.com/oauth/revoke"):
            return httpx.Response(200)
        if u.startswith("https://api.prod.whoop.com/oauth/oauth2/token"):
            if body.get("grant_type") == ["refresh_token"]:
                return httpx.Response(200, json={"access_token": "whoop-at2", "refresh_token": "whoop-rt2", "expires_in": 3600})
            return httpx.Response(200, json={"access_token": "whoop-at", "refresh_token": "whoop-rt", "expires_in": 3600})
        if "/developer/v2/activity/sleep" in u:
            if self.whoop_fail_once and req.headers["authorization"] == "Bearer whoop-at":
                return httpx.Response(401)
            return httpx.Response(200, json={"records": [{"id": "s1", "end": f"{TODAY}T03:30:00.000Z", "timezone_offset": "+04:00", "nap": False, "score_state": "SCORED",
                                                          "score": {"stage_summary": {"total_light_sleep_time_milli": 12_600_000, "total_slow_wave_sleep_time_milli": 5_400_000, "total_rem_sleep_time_milli": 7_200_000}}}], "next_token": None})
        if "/developer/v2/recovery" in u:
            return httpx.Response(200, json={"records": [{"sleep_id": "s1", "score_state": "SCORED", "score": {"recovery_score": 71, "resting_heart_rate": 50, "hrv_rmssd_milli": 58.6}}]})
        if u.startswith("https://polarremote.com/v2/oauth2/token"):
            assert req.headers["authorization"].startswith("Basic ")
            return httpx.Response(200, json={"access_token": "polar-at", "token_type": "bearer", "x_user_id": 777})
        if u == "https://www.polaraccesslink.com/v3/users" and req.method == "POST":
            return httpx.Response(409)
        if u.endswith("/v3/users/nightly-recharge"):
            return httpx.Response(200, json={"recharges": [{"date": TODAY, "heart_rate_avg": 55, "heart_rate_variability_avg": 47}]})
        if u.endswith("/v3/users/sleep"):
            return httpx.Response(200, json={"nights": [{"date": TODAY, "light_sleep": 14400, "deep_sleep": 5400, "rem_sleep": 6300, "sleep_score": 80}]})
        if u.startswith("https://diauth.garmin.com"):
            assert body.get("code_verifier"), "Garmin token request must carry the PKCE verifier"
            return httpx.Response(200, json={"access_token": "garmin-at", "refresh_token": "garmin-rt", "expires_in": 86400})
        if u.endswith("/wellness-api/rest/user/id"):
            return httpx.Response(200, json={"userId": "g-user-1"})
        if "/wellness-api/rest/backfill/" in u:
            return httpx.Response(202)
        if req.method == "DELETE":
            return httpx.Response(204)
        return httpx.Response(404, json={"unexpected": u})


def setup():
    store = MemoryStore()
    keys = Keys("x" * 40, gen_field_key())
    for email, role, person, p1 in [("jp@lab.test", "lead", "jp", True), ("physio2@lab.test", "physio", "physio2", False), ("javi@lab.test", "coach", "javi", False)]:
        asyncio.run(store.add_user({"email": email, "role": role, "person": person, "p1": p1, "password_hash": hash_password(PW)}))
    fake = FakeProviders()
    app = create_app(store, keys, http=httpx.AsyncClient(transport=httpx.MockTransport(fake)))
    return TestClient(app), store, keys, fake


def login(c, email):
    return {"Authorization": "Bearer " + c.post("/api/auth/login", json={"email": email, "password": PW}).json()["token"]}


def give_consent(c, h):
    r = c.put("/api/state/consent", json={"value": {"p1": {"wear": {"by": "jp", "at": TODAY}}}, "version": 0}, headers=h)
    assert r.status_code == 200, r.text


def connect(c, h, pid):
    r = c.post(f"/api/wear/{pid}/connect", headers=h)
    assert r.status_code == 200, r.text
    q = parse_qs(urlparse(r.json()["url"]).query)
    return q, c.get(f"/api/wear/{pid}/callback", params={"code": "abc", "state": q["state"][0]})


class Normalise(unittest.TestCase):
    def test_oura_picks_main_sleep(self):
        d = wr.norm_oura([{"day": "2026-10-20", "type": "rest", "total_sleep_duration": 1200, "average_hrv": 20},
                          {"day": "2026-10-20", "type": "long_sleep", "total_sleep_duration": 25200, "average_hrv": 63.2, "lowest_heart_rate": 47}],
                         [{"day": "2026-10-20", "score": 79}])
        self.assertEqual(d["2026-10-20"], {"sleep": 7.0, "hrv": 63, "rhr": 47, "score": 79, "src": "Oura"})

    def test_whoop_day_is_local_wake_date(self):
        d = wr.norm_whoop([{"id": "a", "end": "2026-10-20T22:30:00Z", "timezone_offset": "+04:00", "score_state": "SCORED",
                            "score": {"stage_summary": {"total_light_sleep_time_milli": 3_600_000}}}],
                          [{"sleep_id": "a", "score_state": "SCORED", "score": {"recovery_score": 66, "resting_heart_rate": 51, "hrv_rmssd_milli": 55.5}}])
        self.assertIn("2026-10-21", d)   # 22:30 UTC is 02:30 next day in Abu Dhabi
        self.assertEqual(d["2026-10-21"]["hrv"], 56)

    def test_whoop_unscored_ignored(self):
        self.assertEqual(wr.norm_whoop([], [{"sleep_id": "x", "score_state": "PENDING_SCORE"}]), {})

    def test_garmin_only_his_user(self):
        p = {"dailies": [{"userId": "me", "calendarDate": "2026-10-20", "restingHeartRateInBeatsPerMinute": 49}, {"userId": "other", "calendarDate": "2026-10-20", "restingHeartRateInBeatsPerMinute": 70}],
             "hrv": [{"userId": "me", "calendarDate": "2026-10-20", "lastNightAvg": 58}],
             "sleeps": [{"userId": "me", "calendarDate": "2026-10-20", "deepSleepDurationInSeconds": 3600, "lightSleepDurationInSeconds": 14400, "remSleepInSeconds": 7200}]}
        self.assertEqual(wr.norm_garmin(p, "me")["2026-10-20"], {"sleep": 7.0, "hrv": 58, "rhr": 49, "score": None, "src": "Garmin"})

    def test_apple_daily_average(self):
        p = {"data": {"metrics": [{"name": "heart_rate_variability", "units": "ms", "data": [{"date": "2026-10-20 07:00:00 +0400", "qty": 50}, {"date": "2026-10-20 12:00:00 +0400", "qty": 60}]},
                                  {"name": "resting_heart_rate", "data": [{"date": "2026-10-20 00:00:00 +0400", "qty": 52}]},
                                  {"name": "sleep_analysis", "data": [{"date": "2026-10-20 00:00:00 +0400", "totalSleep": 7.25}]}]}}
        self.assertEqual(wr.norm_apple(p)["2026-10-20"], {"sleep": 7.2, "hrv": 55, "rhr": 52, "score": None, "src": "Apple Health"})

    def test_merge_keeps_hand_entered_fields(self):
        merged, changed = wr.merge_days({"2026-10-20": {"sleep": 6.5, "hrv": None, "rhr": None, "score": None, "src": "CSV"}},
                                        {"2026-10-20": {"sleep": None, "hrv": 60, "rhr": 48, "score": None, "src": "Oura"}, "2026-10-21": {"sleep": None, "hrv": None, "rhr": None, "score": None, "src": "Oura"}})
        self.assertEqual(merged["2026-10-20"]["sleep"], 6.5)
        self.assertEqual(merged["2026-10-20"]["hrv"], 60)
        self.assertEqual(changed, ["2026-10-20"])   # an empty day is not written


class Gates(unittest.TestCase):
    def setUp(self):
        os.environ.update(ENV)
        self.c, self.store, self.keys, self.fake = setup()
        self.jp = login(self.c, "jp@lab.test")

    def test_only_player1_clinicians(self):
        self.assertEqual(self.c.get("/api/wear").status_code, 401)
        self.assertEqual(self.c.get("/api/wear", headers=login(self.c, "javi@lab.test")).status_code, 403)
        self.assertEqual(self.c.get("/api/wear", headers=login(self.c, "physio2@lab.test")).status_code, 403)
        r = self.c.get("/api/wear", headers=self.jp)
        self.assertEqual(r.status_code, 200)
        self.assertEqual({p["id"] for p in r.json()["providers"]}, {"oura", "whoop", "polar", "garmin", "apple"})

    def test_consent_required(self):
        r = self.c.post("/api/wear/oura/connect", headers=self.jp)
        self.assertEqual((r.status_code, r.json()["reason"]), (409, "consent"))
        self.assertEqual(self.c.post("/api/wear/apple/token", headers=self.jp).status_code, 409)

    def test_not_configured(self):
        os.environ.pop("WHOOP_CLIENT_ID")
        give_consent(self.c, self.jp)
        r = self.c.post("/api/wear/whoop/connect", headers=self.jp)
        self.assertEqual((r.status_code, r.json()["reason"]), (503, "not_configured"))

    def test_bad_or_expired_state(self):
        give_consent(self.c, self.jp)
        r = self.c.get("/api/wear/oura/callback", params={"code": "x", "state": "forged"})
        self.assertIn("Link expired", r.text)
        st = self.keys.seal({"u": "x", "p": "oura", "exp": 0})
        self.assertIn("Link expired", self.c.get("/api/wear/oura/callback", params={"code": "x", "state": st}).text)
        q, _ = connect(self.c, self.jp, "oura")
        self.assertIn("Link expired", self.c.get("/api/wear/whoop/callback", params={"code": "x", "state": q["state"][0]}).text)  # state is bound to its provider

    def test_2fa_gate(self):
        c2 = TestClient(create_app(self.store, self.keys, require_2fa_p1=True, http=httpx.AsyncClient(transport=httpx.MockTransport(self.fake))))
        r = c2.get("/api/wear", headers=login(c2, "jp@lab.test"))
        self.assertEqual(r.json().get("reason"), "2fa_required")


class Flows(unittest.TestCase):
    def setUp(self):
        os.environ.update(ENV)
        self.c, self.store, self.keys, self.fake = setup()
        self.jp = login(self.c, "jp@lab.test")
        give_consent(self.c, self.jp)

    def wear(self):
        return self.c.get("/api/state/wear", headers=self.jp).json()["value"] or {}

    def test_oura_connect_sync_and_secrets_stay_server_side(self):
        q, r = connect(self.c, self.jp, "oura")
        self.assertEqual(q["client_id"], ["oura-id"])
        self.assertEqual(q["redirect_uri"], ["https://api.lab.test/api/wear/oura/callback"])
        self.assertIn("Connected", r.text)
        self.assertIn("https://app.lab.test/?wear=1#loadlab", r.text)
        self.assertEqual(self.wear()[TODAY], {"sleep": 7.5, "hrv": 61, "rhr": 48, "score": 82, "src": "Oura"})
        self.assertTrue(any("next_token=p2" in u for _, u in self.fake.calls), "should follow next_token")
        # tokens never leave the server
        self.assertEqual(self.c.get("/api/state/wearlinks", headers=self.jp).status_code, 404)
        everything = json.dumps(self.c.get("/api/state", headers=self.jp).json()) + json.dumps(self.c.get("/api/wear", headers=self.jp).json())
        self.assertNotIn("oura-at", everything)
        self.assertNotIn("oura-rt", everything)
        raw = json.dumps(self.store.state[("server", "wearlinks")])
        self.assertNotIn("oura-at", raw)   # encrypted at rest
        st = {p["id"]: p for p in self.c.get("/api/wear", headers=self.jp).json()["providers"]}
        self.assertTrue(st["oura"]["connected"])
        self.assertEqual(st["oura"]["last_days"], 1)
        entries = self.c.get("/api/audit", headers=self.jp).json()["audit"]
        self.assertIn("wearable connected", [e["action"] for e in entries])
        text = " ".join(f"{e['action']} {e['target']} {e['detail']}" for e in entries)
        for v in ("61", "48", "7.5", "82"):   # no measured values in the audit trail
            self.assertNotIn(v, text)

    def test_whoop_refreshes_on_401(self):
        self.fake.whoop_fail_once = True
        _, r = connect(self.c, self.jp, "whoop")
        self.assertIn("Connected", r.text)
        self.assertEqual(self.wear()[TODAY]["rhr"], 50)
        self.assertEqual(self.wear()[TODAY]["sleep"], 7.0)
        self.assertTrue(any("oauth2/token" in u for m, u in self.fake.calls[2:]), "refresh after 401")

    def test_polar_basic_auth_and_register(self):
        _, r = connect(self.c, self.jp, "polar")
        self.assertIn("Connected", r.text)
        self.assertIn(("POST", "https://www.polaraccesslink.com/v3/users"), self.fake.calls)
        self.assertEqual(self.wear()[TODAY], {"sleep": 7.2, "hrv": 47, "rhr": 55, "score": 80, "src": "Polar"})

    def test_garmin_pkce_backfill_and_push(self):
        q, r = connect(self.c, self.jp, "garmin")
        self.assertEqual(q["code_challenge_method"], ["S256"])
        self.assertIn("Garmin will send", r.text)
        self.assertTrue(any("/backfill/hrv" in u for _, u in self.fake.calls))
        push = {"hrv": [{"userId": "g-user-1", "calendarDate": TODAY, "lastNightAvg": 57}, {"userId": "stranger", "calendarDate": TODAY, "lastNightAvg": 99}]}
        self.assertEqual(self.c.post("/api/wear/garmin/push", params={"k": "wrong"}, json=push).status_code, 404)
        self.assertEqual(self.c.post("/api/wear/garmin/push", params={"k": ENV["GARMIN_PUSH_KEY"]}, json=push).status_code, 200)
        self.assertEqual(self.wear()[TODAY]["hrv"], 57)

    def test_apple_ingest(self):
        t = self.c.post("/api/wear/apple/token", headers=self.jp).json()
        body = {"data": {"metrics": [{"name": "resting_heart_rate", "data": [{"date": f"{TODAY} 00:00:00 +0400", "qty": 51}]}]}}
        self.assertEqual(self.c.post("/api/wear/apple/ingest", json=body, headers={"authorization": "Bearer nope"}).status_code, 401)
        r = self.c.post("/api/wear/apple/ingest", json=body, headers={"authorization": t["value"]})
        self.assertEqual(r.json(), {"days": 1, "changed": 1})
        self.assertEqual(self.wear()[TODAY]["src"], "Apple Health")
        # a new token replaces the old one
        self.c.post("/api/wear/apple/token", headers=self.jp)
        self.assertEqual(self.c.post("/api/wear/apple/ingest", json=body, headers={"authorization": t["value"]}).status_code, 401)

    def test_consent_withdrawn_stops_ingest(self):
        t = self.c.post("/api/wear/apple/token", headers=self.jp).json()
        cur = self.c.get("/api/state/consent", headers=self.jp).json()
        self.c.put("/api/state/consent", json={"value": {"p1": {}}, "version": cur["version"]}, headers=self.jp)
        r = self.c.post("/api/wear/apple/ingest", json={"data": {"metrics": []}}, headers={"authorization": t["value"]})
        self.assertEqual(r.status_code, 409)

    def test_manual_sync_scheduled_sync_and_disconnect(self):
        connect(self.c, self.jp, "oura")
        self.assertEqual(self.c.post("/api/wear/oura/sync", headers=self.jp).json()["changed"], 0)   # nothing new
        self.assertEqual(self.c.post("/api/wear/sync-all").status_code, 404)
        r = self.c.post("/api/wear/sync-all", headers={"x-cron-key": ENV["WEAR_CRON_KEY"]})
        self.assertEqual(r.json()["results"][0]["provider"], "oura")
        self.assertEqual(self.c.delete("/api/wear/oura", headers=self.jp).json(), {"ok": True})
        self.assertTrue(any("oauth/revoke" in u for _, u in self.fake.calls))
        self.assertEqual(self.c.post("/api/wear/oura/sync", headers=self.jp).status_code, 404)
        self.assertIn(TODAY, self.wear())   # synced days stay in his record

    def test_sync_keeps_colleague_edits(self):
        connect(self.c, self.jp, "oura")
        cur = self.c.get("/api/state/wear", headers=self.jp).json()
        r = self.c.patch("/api/state/wear/records", headers=self.jp, json={"kind": "map", "changes": {"2026-01-01": {"sleep": 8, "src": "CSV"}}, "base": {"2026-01-01": 0}})
        self.assertEqual(r.status_code, 200)
        self.c.post("/api/wear/oura/sync", headers=self.jp)
        self.assertEqual(self.wear()["2026-01-01"]["sleep"], 8)
        self.assertGreater(self.c.get("/api/state/wear", headers=self.jp).json()["version"], cur["version"])


if __name__ == "__main__":
    unittest.main()
