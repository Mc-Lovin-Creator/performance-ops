"""Server-side check for the booking list: no clinician double-booked, buffers respected.
Mirrors the client rules (adapted from Cal.com's slot logic, MIT)."""
from __future__ import annotations

EVENT_LEN = {"assess": (60, 15), "tx": (45, 10), "p7": (7, 3), "recov": (20, 5), "test": (90, 15), "doc": (30, 10)}


class BookingClash(ValueError):
    pass


def validate(bookings: list[dict]) -> None:
    if not isinstance(bookings, list):
        raise ValueError("bookings must be a list")
    spans: dict[tuple[str, str], list[tuple[int, int, str]]] = {}
    for b in bookings:
        for f in ("id", "evt", "who", "day", "start"):
            if f not in b:
                raise ValueError(f"booking missing {f}")
        if b["evt"] not in EVENT_LEN:
            raise ValueError(f"unknown session type {b['evt']}")
        mins, buf = EVENT_LEN[b["evt"]]
        s = int(b["start"])
        if not 0 <= s < 24 * 60:
            raise ValueError("start must be minutes from midnight")
        spans.setdefault((b["who"], b["day"]), []).append((s, s + mins + buf, b["id"]))
    for (who, day), items in spans.items():
        items.sort()
        for (a0, a1, ida), (b0, _b1, idb) in zip(items, items[1:]):
            if b0 < a1:
                raise BookingClash(f"{who} is double-booked on {day} ({ida} and {idb})")
