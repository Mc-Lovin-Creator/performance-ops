# Stage 3: Staging run-through (one to two weeks, demo data only)

**Goal:** the team uses the staging app for real workflows with **made-up data**. You fix what is awkward, and prove backups and recovery work. Nothing real goes in.

## You do

1. **Deploy the staging app** from Emergent with its Deploy button, so it has a stable address rather than the preview. Update `CORS_ORIGINS` to that address and restart.
2. **Run the check:**
   ```bash
   python3 scripts/check_deploy.py --api https://<staging-url> --stage 3 --email <you>
   ```
3. **Walk-through.** Each clinician works through this once and notes anything awkward in `deploy/STATUS.md` under "Issues found":

   | # | Task |
   | --- | --- |
   | 1 | Player 1 dashboard: today's plan, weekly briefing, Learn today |
   | 2 | Daily log for a made-up day: court minutes, RPE, pain. Check it appears on a colleague's screen within a minute. |
   | 3 | Load page: guard, plan, CSV import of a made-up wearable file |
   | 4 | Records: consent card ticked by a clinician, then check the audit log |
   | 5 | Two people edit different days at the same time. Both edits are kept. |
   | 6 | Booking: create one, then try a clash. The clash is refused. |
   | 7 | Education hub and anatomy on an iPad and on a phone |
   | 8 | Coach account: sees load and availability, never clinical notes or Player 1 records |
   | 9 | Sign out on a shared computer. The data is cleared from that device. |

4. **Backups.** Ask Emergent support, or check your plan, for:
   - whether the database is backed up daily
   - how long backups are kept
   - how to restore

   Write the answers in `STATUS.md`. If there is no backup, stage 6 is blocked.
5. **Restore test:**
   - Ask the agent to export the staging database, delete one made-up record, then restore it.
   - Confirm the app still opens with the same `FIELD_KEY`. If not, the backup cannot be read, which you need to know now.
6. **Fix and repeat:**
   - Send the issues list to Claude. Changes go to the repo and are pulled with the loop in `deploy/CHANGES.md`.
   - Then tag the version you are happy with: `release-<date>`.

## Done when

- [ ] Stage 3 check PASSED on the deployed staging URL
- [ ] All nine walk-through tasks done by at least JP and Olivia
- [ ] Backup frequency, retention and restore written in STATUS.md, and the restore test passed
- [ ] Issues found are fixed in the repo, pulled, and tagged as a release
