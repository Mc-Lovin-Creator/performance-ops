# Stage 6: Go-live with real data

**Goal:** the production app holds real Player 1 data, with every gate signed off. **Do not start until stages 2, 3 and 5 are done.**

## Gates (all required)

- [ ] Hosting path signed off by the compliance lead (stage 5)
- [ ] Daily encrypted backups with tested restore (stage 3)
- [ ] Every Player 1 clinician has two-step sign-in on (`check_deploy.py --stage 2` shows no `to do`)
- [ ] Signed consent forms filed, and consent recorded in the app for every athlete whose data goes in
- [ ] Incident contact and DoH notification route written in STATUS.md
- [ ] Security review or penetration test of the API booked or done
- [ ] Production keys are new (not staging) and stored in the password manager

## You do

1. **Set up production** on the chosen host:
   - Path A: a new Emergent project `performance-ops-production` with the same import as stage 1.
   - Path B: Claude's host-specific guide.

   Set the environment with the **production** keys, plus:
   - `REQUIRE_2FA_P1=1`
   - `CORS_ORIGINS=https://lab.<your-domain>`
   - `DB_NAME=performance_ops`
2. **Run stage 1 and stage 2 again** against production:
   - Production starts empty: there is no copy of staging data.
   - Create your lead account with a fresh `SETUP_TOKEN`, then delete it.
3. **Run the check:**
   ```bash
   python3 scripts/check_deploy.py --api https://lab.<your-domain> --stage 3 --email <you>
   ```
4. **Enter the first real records together** with Olivia. Check that the physician sees the daily update and the coach does not see clinical notes.
5. **Tag the release:** `release-<date>-go-live`. Write the date and commit in STATUS.md.
6. **First month:**
   - Review the audit log weekly (Admin, Audit).
   - Review Pilot metrics monthly.
   - Fix issues through the change loop (`deploy/CHANGES.md`) only.

## Never

- Copy the staging database into production.
- Reuse staging keys.
- Paste keys, passwords or patient details into any chat, including Emergent's agent and Claude.
- Edit production directly in Emergent without saving to GitHub.
