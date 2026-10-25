"""API tests against the in-memory store. Run from backend/:  python -m pytest -q   (or python -m unittest)"""
import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["PLOS_NO_AUTOAPP"] = "1"

from starlette.testclient import TestClient  # noqa: E402

from core import bookings as bk  # noqa: E402
from core.policy import KEYS, User, can_read, can_write  # noqa: E402
from core.security import Keys, gen_field_key, hash_password, verify_password  # noqa: E402
from core.store import MemoryStore  # noqa: E402
from server import create_app  # noqa: E402

PW = "correct horse battery"


def setup_app():
    store = MemoryStore()
    keys = Keys("x" * 40, gen_field_key())
    people = [("jp@lab.test", "lead", "jp", True), ("olivia@lab.test", "physio", "olivia", True), ("dr@lab.test", "physician", "dr", True),
              ("physio2@lab.test", "physio", "physio2", False), ("javi@lab.test", "coach", "javi", False), ("ops@lab.test", "manager", "ops", False), ("p1@lab.test", "athlete", "p1", False)]
    for email, role, person, p1 in people:
        asyncio.run(store.add_user({"email": email, "role": role, "person": person, "p1": p1, "password_hash": hash_password(PW)}))
    return TestClient(create_app(store, keys)), store, keys


def login(c, email):
    r = c.post("/api/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


class Security(unittest.TestCase):
    def test_password_hash(self):
        h = hash_password(PW)
        self.assertTrue(verify_password(PW, h))
        self.assertFalse(verify_password(PW + "x", h))
        with self.assertRaises(ValueError):
            hash_password("short")

    def test_keys_required(self):
        with self.assertRaises(RuntimeError):
            Keys("short", gen_field_key())
        with self.assertRaises(RuntimeError):
            Keys("x" * 40, None)

    def test_seal_roundtrip(self):
        k = Keys("x" * 40, gen_field_key())
        v = {"pain": 3, "note": "spring ligament"}
        s = k.seal(v)
        self.assertNotIn("spring", s)
        self.assertEqual(k.open(s), v)

    def test_every_key_classified(self):
        self.assertTrue(all(s in ("user", "team", "clinic", "p1") for s in KEYS.values()))


class Policy(unittest.TestCase):
    def test_player1_only_for_flagged_clinicians(self):
        jp, p2, coach = User("1", "jp", "lead", "jp", True), User("2", "p2", "physio", "physio2", False), User("3", "c", "coach", "javi", False)
        self.assertTrue(can_read(jp, "daily"))
        self.assertFalse(can_read(p2, "daily"))
        self.assertFalse(can_read(coach, "daily"))
        self.assertFalse(can_read(User("4", "x", "coach", "x", True), "daily"))  # flag alone is not enough

    def test_athlete_writes(self):
        a = User("5", "a", "athlete", "p1")
        self.assertTrue(can_write(a, "msgs"))
        self.assertFalse(can_write(a, "events"))
        self.assertFalse(can_read(a, "updates"))


class Bookings(unittest.TestCase):
    def test_clash(self):
        ok = [{"id": "a", "evt": "tx", "who": "jp", "day": "2026-11-02", "start": 540}, {"id": "b", "evt": "tx", "who": "jp", "day": "2026-11-02", "start": 600}]
        bk.validate(ok)  # 9:00 + 45 + 10 = 9:55, next at 10:00
        with self.assertRaises(bk.BookingClash):
            bk.validate(ok + [{"id": "c", "evt": "p7", "who": "jp", "day": "2026-11-02", "start": 580}])
        bk.validate(ok + [{"id": "d", "evt": "tx", "who": "olivia", "day": "2026-11-02", "start": 540}])


class Api(unittest.TestCase):
    def setUp(self):
        self.c, self.store, self.keys = setup_app()

    def test_health_and_auth_required(self):
        self.assertEqual(self.c.get("/api/health").status_code, 200)
        self.assertEqual(self.c.get("/api/state").status_code, 401)
        self.assertEqual(self.c.get("/api/state", headers={"Authorization": "Bearer nonsense"}).status_code, 401)

    def test_wrong_password_and_rate_limit(self):
        for _ in range(10):
            self.assertEqual(self.c.post("/api/auth/login", json={"email": "jp@lab.test", "password": "nope nope nope"}).status_code, 401)
        self.assertEqual(self.c.post("/api/auth/login", json={"email": "jp@lab.test", "password": PW}).status_code, 429)

    def test_player1_write_read_encrypted_and_audited(self):
        h = login(self.c, "jp@lab.test")
        r = self.c.put("/api/state/daily", headers=h, json={"value": {"2026-10-23": {"pain": 2}}, "version": 0})
        self.assertEqual(r.status_code, 200, r.text)
        raw = self.store.state[("shared", "daily")]
        self.assertIn("sealed", raw)
        self.assertNotIn("value", raw)
        self.assertEqual(self.c.get("/api/state/daily", headers=login(self.c, "olivia@lab.test")).json()["value"], {"2026-10-23": {"pain": 2}})
        for who in ("physio2@lab.test", "javi@lab.test", "ops@lab.test", "p1@lab.test"):
            self.assertEqual(self.c.get("/api/state/daily", headers=login(self.c, who)).status_code, 403, who)
        actions = [e["action"] for e in self.store.log]
        self.assertIn("write", actions)
        self.assertIn("read clinical", actions)
        self.assertIn("denied read", actions)

    def test_version_conflict(self):
        h = login(self.c, "jp@lab.test")
        self.assertEqual(self.c.put("/api/state/ideas", headers=h, json={"value": [1], "version": 0}).json()["version"], 1)
        r = self.c.put("/api/state/ideas", headers=login(self.c, "olivia@lab.test"), json={"value": [2], "version": 0})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["current"]["value"], [1])

    def test_unknown_key_refused(self):
        self.assertEqual(self.c.put("/api/state/anything", headers=login(self.c, "jp@lab.test"), json={"value": 1}).status_code, 404)

    def test_user_scope_is_private(self):
        a, b = login(self.c, "jp@lab.test"), login(self.c, "olivia@lab.test")
        self.c.put("/api/state/theme", headers=a, json={"value": "dark"})
        self.assertEqual(self.c.get("/api/state/theme", headers=b).json()["value"], None)
        self.assertEqual(self.c.get("/api/state/theme", headers=a).json()["value"], "dark")

    def test_booking_clash_rejected(self):
        h = login(self.c, "olivia@lab.test")
        bad = [{"id": "a", "evt": "assess", "who": "jp", "day": "2026-11-02", "start": 540}, {"id": "b", "evt": "tx", "who": "jp", "day": "2026-11-02", "start": 570}]
        self.assertEqual(self.c.put("/api/state/bookings", headers=h, json={"value": bad}).status_code, 409)

    def test_state_all_respects_roles(self):
        jp = login(self.c, "jp@lab.test")
        self.c.put("/api/state/daily", headers=jp, json={"value": {"x": 1}})
        self.c.put("/api/state/msgs", headers=jp, json={"value": {"m": 1}})
        coach = self.c.get("/api/state", headers=login(self.c, "javi@lab.test")).json()["state"]
        self.assertIn("msgs", coach)
        self.assertNotIn("daily", coach)

    def test_users_lead_only(self):
        self.assertEqual(self.c.get("/api/users", headers=login(self.c, "olivia@lab.test")).status_code, 403)
        r = self.c.post("/api/users", headers=login(self.c, "jp@lab.test"), json={"email": "new@lab.test", "role": "coach", "person": "pablo", "p1": True, "password": PW})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertFalse(r.json()["user"]["p1"])  # coaches never get Player 1

    def test_deactivated_user_locked_out(self):
        h = login(self.c, "javi@lab.test")
        uid = next(u["id"] for u in self.store.users.values() if u["email"] == "javi@lab.test")
        self.c.patch(f"/api/users/{uid}", headers=login(self.c, "jp@lab.test"), json={"active": False})
        self.assertEqual(self.c.get("/api/state", headers=h).status_code, 401)

    def test_audit_visibility(self):
        self.assertEqual(self.c.get("/api/audit", headers=login(self.c, "javi@lab.test")).status_code, 403)
        self.assertEqual(self.c.get("/api/audit", headers=login(self.c, "ops@lab.test")).status_code, 200)


class Records(unittest.TestCase):
    def setUp(self):
        self.c, self.store, self.keys = setup_app()

    def test_two_clinicians_different_days_both_kept(self):
        jp, ol = login(self.c, "jp@lab.test"), login(self.c, "olivia@lab.test")
        r1 = self.c.patch("/api/state/daily/records", headers=jp, json={"kind": "map", "changes": {"2026-10-22": {"pain": 2}}, "base": {}})
        self.assertEqual(r1.status_code, 200, r1.text)
        r2 = self.c.patch("/api/state/daily/records", headers=ol, json={"kind": "map", "changes": {"2026-10-23": {"pain": 1}}, "base": {}})
        self.assertEqual(set(r2.json()["value"]), {"2026-10-22", "2026-10-23"})
        self.assertIn("sealed", self.store.state[("shared", "daily")])

    def test_same_record_conflict_reported(self):
        jp, ol = login(self.c, "jp@lab.test"), login(self.c, "olivia@lab.test")
        self.c.patch("/api/state/daily/records", headers=jp, json={"kind": "map", "changes": {"d1": {"pain": 2}}, "base": {}})
        r = self.c.patch("/api/state/daily/records", headers=ol, json={"kind": "map", "changes": {"d1": {"pain": 5}}, "base": {}})
        self.assertEqual(r.json()["conflicts"], {"d1": {"pain": 2}})
        ok = self.c.patch("/api/state/daily/records", headers=ol, json={"kind": "map", "changes": {"d1": {"pain": 5}}, "base": {"d1": 1}})
        self.assertEqual(ok.json()["value"]["d1"], {"pain": 5})

    def test_records_vault_keys(self):
        """The vault's ciphertext syncs record by record; coaches cannot read it and Player 1's vault needs the Player 1 flag."""
        self.assertFalse(can_read(User("3", "c", "coach", "javi", False), "emr"))
        self.assertTrue(can_read(User("2", "p2", "physio", "physio2", False), "emr"))
        self.assertFalse(can_read(User("2", "p2", "physio", "physio2", False), "p1emr"))
        h = login(self.c, "olivia@lab.test")
        r = self.c.patch("/api/state/emr/records", headers=h, json={"kind": "map", "changes": {"r1": {"pid": "PT-AAAA", "kind": "doc", "iv": "x", "ct": "y"}}, "base": {}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("sealed", self.store.state[("shared", "emr")])

    def test_scout_run_lead_only(self):
        os.environ.pop("XAI_API_KEY", None)
        self.assertEqual(self.c.post("/api/scout/run", headers=login(self.c, "javi@lab.test")).status_code, 403)
        self.assertEqual(self.c.post("/api/scout/run").status_code, 401)
        r = self.c.post("/api/scout/run", headers=login(self.c, "jp@lab.test"))
        self.assertEqual((r.status_code, r.json()["added"]), (200, 0))
        self.assertFalse(self.c.get("/api/scout/status", headers=login(self.c, "jp@lab.test")).json()["grok"])

    def test_list_records_and_delete(self):
        h = login(self.c, "olivia@lab.test")
        self.c.patch("/api/state/assess/records", headers=h, json={"kind": "list", "changes": {"a": {"id": "a", "x": 1}, "b": {"id": "b", "x": 2}}, "base": {}})
        r = self.c.patch("/api/state/assess/records", headers=h, json={"kind": "list", "changes": {"a": None}, "base": {"a": 1}})
        self.assertEqual(r.json()["value"], [{"id": "b", "x": 2}])

    def test_coach_cannot_patch_player1(self):
        self.assertEqual(self.c.patch("/api/state/daily/records", headers=login(self.c, "javi@lab.test"), json={"kind": "map", "changes": {"x": 1}}).status_code, 403)


class TwoStep(unittest.TestCase):
    def test_totp_flow_and_player1_gate(self):
        from core import totp
        store = MemoryStore(); keys = Keys("y" * 40, gen_field_key())
        asyncio.run(store.add_user({"email": "jp@lab.test", "role": "lead", "person": "jp", "p1": True, "password_hash": hash_password(PW)}))
        c = TestClient(create_app(store, keys, require_2fa_p1=True))
        h = login(c, "jp@lab.test")
        r = c.get("/api/state/daily", headers=h)
        self.assertEqual(r.json().get("reason"), "2fa_required")
        secret = c.post("/api/auth/2fa/setup", headers=h).json()["secret"]
        self.assertEqual(c.post("/api/auth/2fa/enable", headers=h, json={"code": "000000" if totp.code_at(secret, __import__('time').time()) != "000000" else "111111"}).status_code, 400)
        self.assertEqual(c.post("/api/auth/2fa/enable", headers=h, json={"code": totp.code_at(secret, __import__('time').time())}).status_code, 200)
        self.assertTrue(c.post("/api/auth/login", json={"email": "jp@lab.test", "password": PW}).json().get("need_code"))
        now = __import__('time').time()
        self.assertEqual(c.get("/api/auth/me", headers=h).status_code, 401)   # turning on two-step ends older sessions
        r = c.post("/api/auth/login", json={"email": "jp@lab.test", "password": PW, "code": totp.code_at(secret, now)})
        self.assertEqual(r.status_code, 401)   # the code used to turn it on cannot be reused
        r = c.post("/api/auth/login", json={"email": "jp@lab.test", "password": PW, "code": totp.code_at(secret, now + 30)})
        self.assertEqual(r.status_code, 200)
        h2 = {"Authorization": "Bearer " + r.json()["token"]}
        self.assertEqual(c.get("/api/state/daily", headers=h2).status_code, 200)
        self.assertEqual(c.post("/api/auth/login", json={"email": "jp@lab.test", "password": PW, "code": totp.code_at(secret, now + 30)}).status_code, 401)   # once only
        # a session alone cannot re-bind the authenticator
        self.assertEqual(c.post("/api/auth/2fa/setup", headers=h2).json().get("reason"), "reauth")

    def test_password_change_ends_other_sessions(self):
        store = MemoryStore(); keys = Keys("y" * 40, gen_field_key())
        asyncio.run(store.add_user({"email": "ol@lab.test", "role": "physio", "person": "olivia", "p1": False, "password_hash": hash_password(PW)}))
        c = TestClient(create_app(store, keys))
        h1, h2 = login(c, "ol@lab.test"), login(c, "ol@lab.test")
        r = c.post("/api/auth/password", headers=h1, json={"old": PW, "new": PW + " new"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c.get("/api/auth/me", headers=h2).status_code, 401)
        self.assertEqual(c.get("/api/auth/me", headers={"Authorization": "Bearer " + r.json()["token"]}).status_code, 200)

    def test_rfc6238_vector(self):
        from core import totp
        secret = __import__('base64').b32encode(b"12345678901234567890").decode()
        self.assertEqual(totp.code_at(secret, 59, digits=8), "94287082")


if __name__ == "__main__":
    unittest.main()


class FirstRunAndPasswords(unittest.TestCase):
    def test_first_lead_only_once_and_only_with_key(self):
        store, keys = MemoryStore(), Keys("x" * 40, gen_field_key())
        c = TestClient(create_app(store, keys))
        os.environ.pop("SETUP_TOKEN", None)
        body = {"email": "lead@lab.test", "password": PW, "setup_token": "s" * 40}
        self.assertEqual(c.post("/api/setup/first-lead", json=body).status_code, 404)   # no key set: route is off
        self.assertFalse(c.get("/api/setup/status").json()["open"])
        os.environ["SETUP_TOKEN"] = "s" * 40
        try:
            self.assertTrue(c.get("/api/setup/status").json()["open"])
            self.assertEqual(c.post("/api/setup/first-lead", json=dict(body, setup_token="t" * 40)).status_code, 403)
            self.assertEqual(c.post("/api/setup/first-lead", json=dict(body, password="short")).status_code, 400)
            r = c.post("/api/setup/first-lead", json=body)
            self.assertEqual(r.status_code, 201)
            self.assertEqual((r.json()["user"]["role"], r.json()["user"]["p1"]), ("lead", True))
            self.assertEqual(c.post("/api/setup/first-lead", json=dict(body, email="second@lab.test")).status_code, 404)  # never again
            self.assertFalse(c.get("/api/setup/status").json()["open"])
            login(c, "lead@lab.test")
        finally:
            os.environ.pop("SETUP_TOKEN", None)

    def test_change_own_password(self):
        c, store, keys = setup_app()
        h = login(c, "javi@lab.test")
        self.assertEqual(c.post("/api/auth/password", json={"old": "wrong one entirely", "new": "another long password"}, headers=h).status_code, 403)
        self.assertEqual(c.post("/api/auth/password", json={"old": PW, "new": "short"}, headers=h).status_code, 400)
        self.assertEqual(c.post("/api/auth/password", json={"old": PW, "new": "another long password"}, headers=h).status_code, 200)
        self.assertEqual(c.post("/api/auth/login", json={"email": "javi@lab.test", "password": PW}).status_code, 401)
        self.assertEqual(c.post("/api/auth/login", json={"email": "javi@lab.test", "password": "another long password"}).status_code, 200)


class Biokineticist(unittest.TestCase):
    def test_biokineticist_is_a_clinical_role(self):
        bk_user = User("b", "olivia@lab.test", "biokineticist", "olivia", p1=True)
        self.assertTrue(can_read(bk_user, "daily"))
        self.assertTrue(can_read(bk_user, "assess"))
        self.assertTrue(can_write(bk_user, "daily"))

    def test_lead_adds_biokineticist_with_player1_and_cannot_give_coach_player1(self):
        c, store, keys = setup_app()
        h = login(c, "jp@lab.test")
        r = c.post("/api/users", headers=h, json={"email": "liv@lab.test", "role": "biokineticist", "person": "olivia", "p1": True, "password": PW})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["user"]["p1"])
        liv = login(c, "liv@lab.test")
        self.assertEqual(c.put("/api/state/daily", headers=liv, json={"value": {"d": 1}, "version": 0}).status_code, 200)
        coach = next(u for u in asyncio.run(store.list_users()) if u["role"] == "coach")
        self.assertEqual(c.patch(f"/api/users/{coach['id']}", headers=h, json={"p1": True}).status_code, 400)
