# Performance Ops: paste into Emergent

**We keep punching above our weight.**

Work down the page. Each step has one short "you do" line and, where needed, one block to copy into Emergent's chat.

- **Secrets:** you type them only into Emergent's **environment settings**, never into the chat.
- **Interactive version:** the [launch pad](https://claude.ai/artifact/XyLFv32Da3TUm6iFPy1p7X) has copy buttons and makes the keys in your browser (a copy is in [`launch-pad.html`](launch-pad.html)).
- **Detail for each stage:** [`stages/`](stages/)

---

## 1 · Make the keys

**You do:** open the [launch pad](https://claude.ai/artifact/XyLFv32Da3TUm6iFPy1p7X) and choose **Make keys**, or on a computer with the repo run `python3 scripts/gen_keys.py`. Save the three values in your password manager as "Performance Ops: staging".

## 2 · Import the repo

**You do:**
- In Emergent, start a new project by importing from GitHub: `Mc-Lovin-Creator/performance-ops`, branch `main`, project name **Performance Ops**.
- In the backend environment settings, add:
  - `JWT_SECRET`, `FIELD_KEY`, `SETUP_TOKEN` (from step 1)
  - `REQUIRE_2FA_P1` = `1`
  - `DB_NAME` = `performance_ops_staging`
  - `CORS_ORIGINS` = the preview URL. If you don't know it yet, add it after step 3 and restart.

## 3 · Install and run (stage 1)

```
Project: Performance Ops. Slogan: "We keep punching above our weight."
Read EMERGENT_START.md and deploy/EMERGENT_RULES.md first and follow them strictly. This repository is complete and tested; do not
rewrite, refactor or restyle anything, and do not change any file.
1. Install backend dependencies from backend/requirements.txt and frontend dependencies with yarn in frontend/.
2. Run the backend from backend/ with: uvicorn server:app --host 0.0.0.0 --port 8001
   and the frontend from frontend/ with: yarn start (port 3000). frontend/package.json runs python3 app/build.py first.
3. Report yes or no (never the value) for: MONGO_URL, DB_NAME, JWT_SECRET, FIELD_KEY, SETUP_TOKEN, CORS_ORIGINS (backend) and
   REACT_APP_BACKEND_URL (frontend). If one is missing, stop and tell me which.
4. Restart both services, then run:  python3 scripts/check_deploy.py --api http://localhost:8001 --stage 1
   and paste its full output. Also tell me the public preview URL and whether it shows the Performance Ops sign-in screen.
Do not create accounts, keys, passwords or test data.
```

**Done when:** the check says `PASSED` and the preview shows **Create the first lead account**.

## 4 · Create your lead account (stage 2)

**You do:**
1. Open the preview. The sign-in screen shows **Create the first lead account**.
2. Enter your `SETUP_TOKEN`, your work email and a new password of 12 or more characters.
3. **Then edit `SETUP_TOKEN` to `off`** in the project settings (there is no delete button; any value under 32 characters switches set-up off) and paste:

```
Read deploy/EMERGENT_RULES.md. I set SETUP_TOKEN to off in the project settings. Make backend/.env match (SETUP_TOKEN=off). Restart the backend only, then run
python3 scripts/check_deploy.py --api http://localhost:8001 --stage 1 and paste the output, and confirm that
GET /api/setup/status returns {"open": false}. Change nothing else.
```

## 5 · Two-step sign-in and the team

**You do:**
1. Sign in. The app asks you to turn on two-step sign-in: add the key to your authenticator app, enter the code, then sign in again.
2. Open **Account** (bottom-left badge), then **Team accounts**, then **Add a person**:
   - Olivia: physio, with Player 1 access
   - The physician: physician, with Player 1 access
   - Javi: coach, without Player 1 access
3. Give each person their temporary password **in person**. They change it under **Account**.

Nothing to paste.

## 6 · Deploy staging (stage 3)

**You do:**
1. Press **Deploy** in Emergent.
2. Set `CORS_ORIGINS` to the deployed address and paste:

```
Read deploy/EMERGENT_RULES.md. I updated CORS_ORIGINS to the deployed address. Restart the backend and run
python3 scripts/check_deploy.py --api <deployed address> --stage 1 and paste the output. Then tell me, from Emergent's plan and
documentation: is the database backed up, how often, how long backups are kept, and how to restore one. Change nothing else.
```

**Then:** write the backup answers in `deploy/STATUS.md` and run the walk-through in [`stages/3-staging.md`](stages/3-staging.md), with demo data only.

---

## Any time: pull the latest version

**You do:** wait for the green tick on GitHub (Actions), then paste:

```
Read deploy/EMERGENT_RULES.md. Pull the latest commit from GitHub branch main. Reinstall dependencies only if
backend/requirements.txt or frontend/package.json changed. Restart backend and frontend. Report the commit hash you are running and
paste the output of: python3 scripts/check_deploy.py --api http://localhost:8001 --stage 1
Change nothing else.
```

## Any time: go back to an earlier version

```
Read deploy/EMERGENT_RULES.md. Check out commit <commit hash or tag> from GitHub, restart backend and frontend, report the commit
hash and paste the output of: python3 scripts/check_deploy.py --api http://localhost:8001 --stage 1
Change nothing else. (The database is not rolled back; only the code.)
```

## Any time: Emergent's agent wants to change a file

```
Read deploy/EMERGENT_RULES.md. Before changing anything, list the files you want to change and why, and wait for my yes. Then make
only those changes, run npm test (or at least python3 app/build.py, node tests/static_checks.mjs and cd backend && python -m pytest -q),
and use Save to GitHub on a NEW branch named emergent/<yyyy-mm-dd>-<short-name>, never on main. Report the branch name.
```

**Then:** ask Claude to review and merge that branch.

## Later: wearables (stage 4)

**You do:**
1. Register each provider app.
2. Add `PUBLIC_API_URL`, `APP_URL`, the `<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET` values, and `WEAR_CRON_KEY` to the environment settings yourself. See [`stages/4-wearables.md`](stages/4-wearables.md).
3. Paste:

```
Read deploy/EMERGENT_RULES.md and docs/WEARABLES.md. Restart the backend. Report yes or no (never values) for OURA_CLIENT_ID,
WHOOP_CLIENT_ID, POLAR_CLIENT_ID, GARMIN_CLIENT_ID, PUBLIC_API_URL, APP_URL and WEAR_CRON_KEY. Then set up a daily scheduled job at
05:00 UTC that sends POST <PUBLIC_API_URL>/api/wear/sync-all with header x-cron-key read from the WEAR_CRON_KEY environment variable
at run time (never written into code or the job). If Emergent has no scheduler, say so and stop. Change no app files.
```
