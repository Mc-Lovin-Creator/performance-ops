# Stage 1: Import and run (about 30 minutes)

**Goal:** the API and the app run in Emergent's preview and show the sign-in screen. There are no accounts yet, and the data is demo only.

## You do

1. In Emergent, start a new project by **importing from GitHub**: repo `Mc-Lovin-Creator/performance-ops`, branch **`main`**.
2. Open the project's **environment variables** for the backend (often under Settings, Environment, or Deployment, Secrets) and add **yourself**:

   | Name | Value |
   | --- | --- |
   | `JWT_SECRET` | from your password manager |
   | `FIELD_KEY` | from your password manager |
   | `SETUP_TOKEN` | from your password manager |
   | `REQUIRE_2FA_P1` | `1` |
   | `CORS_ORIGINS` | the preview URL Emergent gives the app, e.g. `https://performance-lab-staging.preview.emergentagent.com` |
   | `DB_NAME` | `performance_ops_staging` |

   `MONGO_URL` and the frontend's `REACT_APP_BACKEND_URL` are normally filled in by Emergent. If not, the agent will say so.
3. Paste this prompt into Emergent's chat:

```
Read deploy/EMERGENT_RULES.md and deploy/stages/1-import.md first and follow them strictly.
This repository is complete and tested; do not rewrite or refactor anything.
Task:
1. Install backend dependencies from backend/requirements.txt and frontend dependencies with yarn in frontend/.
2. Make sure the backend runs from backend/ with: uvicorn server:app --host 0.0.0.0 --port 8001
   and the frontend runs from frontend/ with: yarn start (port 3000). frontend/package.json already runs python3 app/build.py first.
3. Check that MONGO_URL, DB_NAME, JWT_SECRET, FIELD_KEY and CORS_ORIGINS exist in the backend environment and REACT_APP_BACKEND_URL
   in the frontend environment. Report only whether each exists, never the value. If one is missing, stop and tell me which.
4. Restart both services and report: the first 20 lines of the backend log, the result of GET /api/health, and whether the
   preview shows the "Sign in" screen.
Do not create accounts, keys, passwords or test data. Do not change any file. If you believe a file must change, explain why and
wait for me.
```

4. If the agent reports `JWT_SECRET must be set` or `FIELD_KEY must be set`, the variable is missing or was not saved. Add it and ask the agent to restart.

## Check (from your computer)

```bash
python3 scripts/check_deploy.py --api https://<your-preview-url> --stage 1
```

It should print `PASSED` with 6 checks: health, security headers, sign-in required twice, CORS locked, and unknown account refused.

## Done when

- [ ] `check_deploy.py --stage 1` prints PASSED
- [ ] The preview shows the dark **Sign in** screen
- [ ] Emergent changed no files (the agent said so, or there is nothing to save to GitHub)

## If something goes wrong

| What you see | Likely cause |
| --- | --- |
| Blank page, or the sign-in screen does not appear | `REACT_APP_BACKEND_URL` is missing, so the page has no backend. Check the frontend environment. |
| `Cannot reach the server` on sign-in | `CORS_ORIGINS` does not exactly match the preview URL (`https://`, no trailing slash) |
| Backend crash mentioning `motor` or `cryptography` | Dependencies not installed. Ask the agent to rerun step 1. |
| `MONGO_URL not set: using in-memory store` in the log | The database is not connected, so data is lost on restart. Ask Emergent support how to attach MongoDB to the project. |
