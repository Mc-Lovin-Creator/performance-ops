# Making a change (after stage 1)

The repo is the master copy. Emergent pulls from it. This keeps every version saved and reversible.

## The loop

1. **Change it in the repo.** Choose one:
   - **Ask Claude.** Claude edits `app/src/` or `backend/`, runs the tests and pushes to `performance-lab-os`.
   - **Small text fix yourself.** On github.com, open the file, choose the pencil icon, then commit to `performance-lab-os`.
2. **Wait for the green tick** on GitHub (Actions → CI). A red cross means don't pull it yet.
3. **Pull into Emergent.** Open the project and pull from GitHub, branch `performance-lab-os`, then restart the preview. Prompt:

   ```
   Read deploy/EMERGENT_RULES.md. Pull the latest commit from GitHub branch performance-lab-os, reinstall dependencies only if
   backend/requirements.txt or frontend/package.json changed, restart backend and frontend, and report the commit hash you are
   running and the result of GET /api/health. Change nothing else.
   ```

4. **Check:**
   - Run `python3 scripts/check_deploy.py --api <url> --stage 3 --email <you>`.
   - Click through the page you changed.
5. **Deploy** from Emergent once the preview looks right. Note the date and commit in `STATUS.md`.

## If Emergent's agent changed something

It must save to a branch named `emergent/<date>-<name>` (rule 9), never to `performance-lab-os`. Then:

- Ask Claude to review and merge it (Claude checks it against the tests and the privacy rules), or
- On GitHub, open a pull request from that branch into `performance-lab-os`, read the changed files and merge.

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
