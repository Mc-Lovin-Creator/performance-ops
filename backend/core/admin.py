"""Admin commands. Passwords are typed at a hidden prompt, never passed on the command line or stored in the repo.

  python -m core.admin gen-key                      print a new FIELD_KEY and JWT_SECRET
  python -m core.admin gen-key --wear               also print WEAR_CRON_KEY and GARMIN_PUSH_KEY
  python -m core.admin create-user EMAIL ROLE PERSON [--p1]
        ROLE: lead, physio, physician, coach, manager, athlete
        PERSON: the app's person id (jp, olivia, dr, javi, ...)
        --p1: may see Player 1 (only lead, physio or physician)
"""
from __future__ import annotations

import asyncio
import getpass
import os
import secrets
import sys

from core.policy import ROLES
from core.security import gen_field_key, hash_password


async def _create(email: str, role: str, person: str, p1: bool):
    from motor.motor_asyncio import AsyncIOMotorClient
    from core.store import MongoStore
    if role not in ROLES:
        sys.exit(f"role must be one of {', '.join(ROLES)}")
    pw = getpass.getpass("Password (12+ characters): ")
    if pw != getpass.getpass("Again: "):
        sys.exit("passwords differ")
    store = MongoStore(AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "performance_lab")])
    await store.init()
    u = await store.add_user({"email": email, "role": role, "person": person, "p1": p1 and role in ("lead", "physio", "physician"), "password_hash": hash_password(pw)})
    await store.audit({"who": "admin-cli", "action": "user created", "target": u["email"], "detail": f"role {role}"})
    print("created", u["email"], u["role"], "Player 1" if u["p1"] else "")


def main(argv: list[str]):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return
    if argv[0] == "gen-key":
        print("FIELD_KEY=" + gen_field_key())
        print("JWT_SECRET=" + secrets.token_urlsafe(48))
        if "--wear" in argv:
            print("WEAR_CRON_KEY=" + secrets.token_urlsafe(40))
            print("GARMIN_PUSH_KEY=" + secrets.token_urlsafe(32))
        return
    if argv[0] == "create-user" and len(argv) >= 4:
        from server import _load_env
        _load_env()
        asyncio.run(_create(argv[1], argv[2], argv[3], "--p1" in argv))
        return
    print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
