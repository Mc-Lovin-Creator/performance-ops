# Performance Ops

**We keep punching above our weight.**

This is the starting file for Emergent. The GitHub repo is the master copy: every change is made in the repo and pulled into Emergent, never only inside Emergent.

- Repo: `Mc-Lovin-Creator/threshold`, branch `performance-lab-os`
- Emergent project name: **Performance Ops** (staging first: `performance-ops-staging`)
- **Every prompt to paste, in order:** [`deploy/PASTE.md`](deploy/PASTE.md)
- Step-by-step stages, from first import to go-live: [`deploy/README.md`](deploy/README.md)
- Rules for Emergent's agent: [`deploy/EMERGENT_RULES.md`](deploy/EMERGENT_RULES.md)
- Progress: [`deploy/STATUS.md`](deploy/STATUS.md)

## Before you paste the prompt

1. Make the keys: on the launch pad page choose **Make keys** (runs in your browser only), or on a computer with the repo run `python3 scripts/gen_keys.py`. Save them in your password manager as "Performance Ops: staging".
2. In Emergent, import the repo, branch `performance-lab-os`. Name the project **Performance Ops**.
3. In the project's backend environment settings, type these in yourself:

   | Variable | Value |
   | --- | --- |
   | `JWT_SECRET` | from the key output |
   | `FIELD_KEY` | from the key output |
   | `SETUP_TOKEN` | from the key output |
   | `REQUIRE_2FA_P1` | `1` |
   | `DB_NAME` | `performance_ops_staging` |
   | `CORS_ORIGINS` | the preview URL |

   Never paste these values into the chat.

## Paste this into Emergent's chat

```
Project: Performance Ops. Slogan: "We keep punching above our weight."
Read EMERGENT_START.md, deploy/EMERGENT_RULES.md and deploy/stages/1-import.md first and follow them strictly.
This repository is complete and tested; do not rewrite, refactor or restyle anything.
Task (stage 1):
1. Install backend dependencies from backend/requirements.txt and frontend dependencies with yarn in frontend/.
2. Run the backend from backend/ with: uvicorn server:app --host 0.0.0.0 --port 8001
   and the frontend from frontend/ with: yarn start (port 3000). frontend/package.json already runs python3 app/build.py first.
3. Check that MONGO_URL, DB_NAME, JWT_SECRET, FIELD_KEY, SETUP_TOKEN and CORS_ORIGINS exist in the backend environment and
   REACT_APP_BACKEND_URL in the frontend environment. Report only yes or no for each, never a value. If one is missing, stop and say which.
4. Restart both services, run:  python3 scripts/check_deploy.py --api http://localhost:8001 --stage 1
   and paste its full output. Tell me the public preview URL and whether it shows the Performance Ops sign-in screen.
Do not create accounts, keys, passwords or test data. Do not change any file. If you think a file must change, explain why and wait.
If anything is ever changed, use Save to GitHub on a new branch named emergent/<yyyy-mm-dd>-<short-name>, never performance-lab-os.
```

## Then

When the agent's check says **PASSED**, open the preview. It shows **Create the first lead account**: enter your `SETUP_TOKEN`, your email and a new password. Then continue at step 4 of [`deploy/PASTE.md`](deploy/PASTE.md).
