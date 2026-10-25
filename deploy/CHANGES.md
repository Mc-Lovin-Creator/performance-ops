# Making a change (after stage 1)

The repo is the master copy. Emergent pulls from it. This keeps every version saved and reversible.

## The loop

1. **Change it in the repo.** Choose one:
   - **Ask Claude.** Claude edits `app/src/` or `backend/`, runs the tests and pushes to `main`.
   - **Small text fix yourself.** On github.com, open the file, choose the pencil icon, then commit to `main`.
2. **Wait for the green tick** on GitHub (Actions → CI). A red cross means don't pull it yet.
3. **Pull into Emergent.** Open the project and pull from GitHub, branch `main`, then restart the preview. Prompt:

   ```
   Read deploy/EMERGENT_RULES.md. Pull the latest commit from GitHub branch main, reinstall dependencies only if
   backend/requirements.txt or frontend/package.json changed, restart backend and frontend, and report the commit hash you are
   running and the result of GET /api/health. Change nothing else.
   ```

4. **Check:**
   - Run `python3 scripts/check_deploy.py --api <url> --stage 3 --email <you>`.
   - Click through the page you changed.
5. **Deploy** from Emergent once the preview looks right. Note the date and commit in `STATUS.md`.

## If Emergent's agent changed something

It must save to a branch named `emergent/<date>-<name>` (rule 9), never to `main`. Then:

- Ask Claude to review and merge it (Claude checks it against the tests and the privacy rules), or
- On GitHub, open a pull request from that branch into `main`, read the changed files and merge.

Never leave a change only inside Emergent. If it is not in GitHub, it will be lost the next time you pull.

## Going back to an earlier version

Each release has a tag such as `release-2026-11-02`, and each stage has `deploy-stage-N`. Prompt:

```
Read deploy/EMERGENT_RULES.md. Check out tag <tag name> from GitHub, restart backend and frontend, report the commit hash and
GET /api/health. Change nothing else.
```

Data in the database is not rolled back by this. Only the code is.

## Releases

When a set of changes is live and checked, tag it, so there is always a known-good version to return to:

```bash
git tag release-$(date +%F) && git push origin --tags
```

(or ask Claude to do it)

## 2026-10-24 (afternoon)
- Anatomy: teaching cards for the whole body (all 724 musculoskeletal structures, plus vessels, nerves, organs, brain and eye).
- Anatomy: breathing (quiet or deep: diaphragm descends, ribs widen, abdomen moves out), clearer fascicles, six upper-body and neck lessons, six new close-ups.
- Records: safe PDF reader (read on the device, no AI, only the checked summary is saved encrypted, the file is not kept).
- Records: the vault now saves to the team server (it was browser memory only); Player 1 has a separate vault and passphrase.
- Fix: every click in the app was redrawing the page and could wipe what someone was typing.
- Innovation scout on the server: Grok on the web and X, plus chosen feeds, with domain summaries (stage 4b, optional).

## 2026-10-25
- Audit: on the team server the app shows only real records. All demo clinical content (Player 1's diagnosis, tests, daily cover, 42 days of generated load and symptoms, the invented squad) is gone there; empty states say what to record first.
- No check-in today reads as Modify, never Ready. The load ratio is shown only after 14 logged days in the last 28. Yesterday's symptoms never carry over.
- Treatment updates need the treatment actually given and a pain score; every record gets a real timestamp.
- Security: sessions end when a password, two-step setting or access changes; each two-step code works once; changing an authenticator needs the password and a current code; per-account login limit; no account enumeration; clinical data kept for the open tab only; 15-minute idle sign-out for Player 1 clinicians; pdf.js pinned by hash; content-security policy and HSTS.
- The return plan's start date and today's symptom check-in now sync (they were refused by the server before).
- Removed: chapter title cards, confetti, streak and mission rewards, holographic morph, hologram look, assemble/deconstruct. "Activation heat" is now "length change (not EMG)", and the lab states the model's limits.
- New: Knowledge, the team's second brain (staff only, encrypted, refuses patient identifiers), and "Where every bot is" on the Agents page.
