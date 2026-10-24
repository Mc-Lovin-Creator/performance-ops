"""Who may read and write which piece of app state.

Every key the app stores is listed here. Unknown keys are refused, so nothing can be
stored on the server that has not been classified first.

Scopes
  user    private to the signed-in user (preferences, view state)
  team    shared with the team
  clinic  clinical, shared with clinicians; encrypted at rest
  p1      Player 1 clinical; only users with the Player 1 flag; encrypted at rest
"""
from __future__ import annotations

from dataclasses import dataclass

ROLES = ("lead", "biokineticist", "physio", "physician", "coach", "manager", "athlete")
CLINICAL_ROLES = {"lead", "biokineticist", "physio", "physician"}
STAFF_ROLES = {"lead", "biokineticist", "physio", "physician", "coach", "manager"}

KEYS: dict[str, str] = {
    # per-user preferences and view state
    "theme": "user", "popf": "user", "motion": "user", "rpmode": "user", "lab": "user",
    "me": "user", "priv": "user", "lastStaff": "user", "nprof": "user", "fx": "user", "labsOpen": "user",
    # team
    "bookings": "team", "events": "team", "group": "team", "ideas": "team", "msgs": "team",
    "mtier": "team", "scout": "team", "scoutdigest": "team", "rstation": "team", "sqcap": "team", "sqmin": "team", "tracklog": "team", "trials": "team",
    # clinical (squad)
    "updates": "clinic", "assess": "clinic", "cl": "clinic", "consent": "clinic",
    # records vault: already AES-256-GCM ciphertext from the browser; the server encrypts it again at rest
    "vmeta": "clinic", "emr_patients": "clinic", "emr": "clinic", "vaudit": "clinic",
    # Player 1 clinical
    "daily": "p1", "p1inj": "p1", "p1sess": "p1", "p1test": "p1", "p1share": "p1",
    "p1shown": "p1", "p1vis": "p1", "rdy": "p1", "normv": "p1", "wear": "p1",
    "p1vmeta": "p1", "p1emr_patients": "p1", "p1emr": "p1", "p1vaudit": "p1",
}

# team keys an athlete may write (everything else in team is staff-only)
ATHLETE_TEAM_WRITE = {"msgs", "bookings"}
ENCRYPTED_SCOPES = {"clinic", "p1"}


@dataclass(frozen=True)
class User:
    id: str
    email: str
    role: str
    person: str
    p1: bool = False
    totp: bool = False


class Denied(Exception):
    pass


def scope_of(key: str) -> str:
    try:
        return KEYS[key]
    except KeyError:
        raise Denied(f"unknown key: {key}") from None


def can_read(user: User, key: str) -> bool:
    s = scope_of(key)
    if s == "user":
        return True
    if s == "team":
        return True
    if s == "clinic":
        return user.role in CLINICAL_ROLES
    if s == "p1":
        return user.p1 and user.role in CLINICAL_ROLES
    return False


def can_write(user: User, key: str) -> bool:
    s = scope_of(key)
    if s == "user":
        return True
    if s == "team":
        return user.role in STAFF_ROLES or key in ATHLETE_TEAM_WRITE
    return can_read(user, key)


def readable_keys(user: User) -> list[str]:
    return [k for k in KEYS if can_read(user, k)]


def storage_scope_id(user: User, key: str) -> str:
    """Documents are stored per user for user-scoped keys, shared otherwise."""
    return f"user:{user.id}" if scope_of(key) == "user" else "shared"
