# Deploying Performance Ops to Emergent

**We keep punching above our weight.** Start here: [`../EMERGENT_START.md`](../EMERGENT_START.md). Every prompt to paste, in order: [`PASTE.md`](PASTE.md).

**The GitHub repo is the master copy. Emergent only runs it.** Every change is made here, in the repo, and then pulled into Emergent. Nothing is changed only inside Emergent, so you can always edit, review, roll back and move host without losing work.

- **Repo:** `github.com/Mc-Lovin-Creator/performance-ops`, branch **`main`**
- **Progress tracker:** [`STATUS.md`](STATUS.md). Tick each stage as you finish it.
- **How to make a change after go-live:** [`CHANGES.md`](CHANGES.md)
- **Rules for Emergent's agent** (every prompt below points to them): [`EMERGENT_RULES.md`](EMERGENT_RULES.md)

## The stages

Do them in order. Each stage has a guide with what you do, a prompt to paste into Emergent, a check and a git tag that marks the code version the stage was written for.

| # | Stage | You end with | Tag |
| --- | --- | --- | --- |
| 0 | [Prepare](stages/0-prepare.md) | GitHub linked to Emergent, keys made on your computer | `deploy-stage-0` |
| 1 | [Import and run](stages/1-import.md) | App and API running in Emergent's preview, sign-in screen showing | `deploy-stage-1` |
| 2 | [First accounts](stages/2-accounts.md) | Your lead account, two-step sign-in, Olivia and the physician added | `deploy-stage-2` |
| 3 | [Staging run-through](stages/3-staging.md) | Every page tried with demo data, backups on, team trained | `deploy-stage-3` |
| 4 | [Wearables](stages/4-wearables.md) | Player 1's device syncing daily (optional, when provider apps are approved) | `deploy-stage-4` |
| 4b | [Innovation scout](stages/4b-scout.md) | Grok scans the web and X daily for research, launches and drops, with a summary per domain (optional, public data only) | |
| 5 | [Hosting and domain](stages/5-hosting.md) | Approved UAE hosting decision, your own web address | `deploy-stage-5` |
| 6 | [Go-live](stages/6-go-live.md) | Real Player 1 data, after every gate is signed off | `deploy-stage-6` |

**Stages 1 to 4 use demo data only.** Real patient data waits for stage 6, after the hosting decision in stage 5 meets DoH Abu Dhabi rules (ADHICS). See `docs/HOSTING_UAE.md`.

## Checking a stage

From your computer, inside a copy of the repo:

```bash
python3 scripts/check_deploy.py --api https://<your-app-url> --stage 1
python3 scripts/check_deploy.py --api https://<your-app-url> --stage 2 --email <your email>   # asks for password and code at a hidden prompt
```

`PASSED` means the stage is done. `to do` lines are reminders for later stages.

## Secrets: the one rule

Keys and passwords are made on **your** computer (`scripts/gen_keys.py`) and typed into Emergent's environment settings by **you**.

- Never paste them into Emergent's chat, Claude's chat, GitHub, email or WhatsApp.
- Keep a copy in your password manager.
- `FIELD_KEY` encrypts clinical data. If it is lost, that data cannot be read.
