# 30 to 90 day plan: status

| Item | Status | Where |
| --- | --- | --- |
| Focus: core loop up front, experiments under Labs | Done | `app.js` nav, `focus.js` |
| Calm design: motion switch (calm, balanced, cinematic) | Done | `focus.js`, `chapters.js`, `fun.js` |
| Load monitor wording (monitoring aid, not a prediction) | Done | `p1load.js`, `audit.js` |
| Record-level saving with per-entry versions | Done | `PATCH /api/state/{key}/records`, `sync.js` |
| Two-step sign-in (TOTP), required for Player 1 | Done | `core/totp.py`, `server.py`, `sync.js` |
| Consent per athlete | Done | `consent.js` |
| Licence decision documented | Done | `docs/LICENSES.md` |
| UAE hosting checklist | Done, needs a decision | `docs/HOSTING_UAE.md` |
| His own body moving (OpenCap .mot import) | Done, needs real captures | `opencap.js`, Anatomy lab → Motion |
| Wearables CSV import, session-RPE beside time-only load | Done | `wear.js`, Load page |
| Weekly story briefing (on-device, no AI) | Done | `pilot.js`, Player 1 dashboard |
| Pilot metrics page | Done (server metrics follow the audit log) | `pilot.js`, Admin → Pilot metrics |
| Hosting contract and data residency | **JP** | |
| OpenCap captures (two iPhones or OpenCap monocular) | **JP and Olivia** | |
| Oura / Polar / Apple accounts and exports | **JP** | |
| PadelOps workload link | **JP: API access needed** | |
| Pilot clinics (2 to 3), pricing per clinician seat | **JP** | |
| Move whole-key storage to per-collection records at scale | Emergent, after pilot | `core/store.py` |
