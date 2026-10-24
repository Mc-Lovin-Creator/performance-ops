# Hand-off to Emergent

This repo is laid out the way Emergent runs projects: `frontend/` on port 3000 (`yarn start`), `backend/` on port 8001 (`uvicorn server:app`), MongoDB from `MONGO_URL`, all API routes under `/api`.

## First run in Emergent

1. Import the GitHub repo `performance-lab-os`.
2. Backend environment: `MONGO_URL`, `DB_NAME` (Emergent provides these), plus `JWT_SECRET` and `FIELD_KEY` generated with `python -m core.admin gen-key`. Set `CORS_ORIGINS` to the frontend URL.
3. Frontend environment: `REACT_APP_BACKEND_URL` (Emergent provides it).
4. Create the first account from the backend shell: `python -m core.admin create-user <email> lead jp --p1`, then sign in and add the team from the API (`POST /api/users`, lead only).
5. `frontend/package.json` runs `python3 app/build.py` before start and build, so `public/index.html` always matches `app/src`.

## Instructions for the Emergent agent

- Edit the app in `app/src/`, never in `frontend/public/index.html` (it is generated).
- Keep the module order in `app/build.py`. New modules go into `ORDER`.
- Every new piece of saved state needs an entry in `backend/core/policy.py` (`user`, `team`, `clinic` or `p1`). `tests/static_checks.mjs` fails otherwise.
- Every new clinical claim needs a source in `SRC` (`app/src/norms.js`) and an evidence grade. Claims without a scientific source are not added.
- Run `npm test` before every commit.
- Do not add default passwords, demo codes or keys anywhere in code or `.env.example`.
- Wearable provider paths and field names live only in `backend/core/wearables.py`; change the fake in `backend/tests/test_wear.py` with them.
- Schedule `POST /api/wear/sync-all` daily (header `x-cron-key`) once a provider is connected.

## API

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | anyone | liveness |
| POST | /api/auth/login | anyone | email + password, returns a 12-hour token (10 tries per 5 min) |
| GET | /api/auth/me | signed in | user and the keys they may read |
| GET | /api/state | signed in | all state they may read |
| GET, PUT | /api/state/{key} | by policy | read or write one key; `{value, version}` with version checks |
| GET, POST | /api/users | lead | list or add users |
| PATCH | /api/users/{id} | lead | role, Player 1 flag, active, password |
| GET | /api/audit | lead, manager | audit log |
| GET, POST, DELETE | /api/wear/… | Player 1 clinicians, providers, scheduler | wearable connect, sync, push and ingest; see `docs/WEARABLES.md` |

## What is still to do

- Decide hosting that meets DoH and ADHICS for patient data (UAE region, encryption at rest, backups, access reviews).
- Move from whole-key state documents to per-record collections as volumes grow (the API already isolates this behind `core/store.py`).
- Calendar sync and reminders for bookings; PadelOps workload link.
- Wearables: register provider apps and re-check field names with a real test account (code, tests and UI are done).
