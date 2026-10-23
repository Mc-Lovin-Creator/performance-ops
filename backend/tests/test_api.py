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


if __name__ == "__main__":
    unittest.main()
