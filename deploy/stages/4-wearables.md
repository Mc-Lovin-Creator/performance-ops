# Stage 4: Wearables (optional; when provider access is approved)

**Goal:** Player 1's own device syncs daily. Do this only for the device he actually wears. Full reference: `docs/WEARABLES.md`.

## You do

1. **Make the wearable keys** on your computer and store them in your password manager:
   ```bash
   python3 scripts/gen_keys.py --wear      # use only the WEAR_CRON_KEY and GARMIN_PUSH_KEY lines
   ```
2. **Register an app with the provider.** You do this on the provider's developer site, signed in as yourself:

   | Device | Where | Redirect URL to enter |
   | --- | --- | --- |
   | Oura | cloud.ouraring.com → API applications | `https://<api-url>/api/wear/oura/callback` |
   | WHOOP | developer.whoop.com | `https://<api-url>/api/wear/whoop/callback` |
   | Polar | admin.polaraccesslink.com | `https://<api-url>/api/wear/polar/callback` |
   | Garmin | Garmin Connect Developer Program (needs approval) | `https://<api-url>/api/wear/garmin/callback` |
   | Apple Health | Nothing to register; uses the Health Auto Export iPhone app | — |

3. **Add the environment variables** in Emergent yourself:
   - `PUBLIC_API_URL` and `APP_URL`
   - `<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET`
   - `WEAR_CRON_KEY` (and `GARMIN_PUSH_KEY` for Garmin)
4. **Paste this prompt:**

```
Read deploy/EMERGENT_RULES.md and docs/WEARABLES.md. Restart the backend. Report which of OURA_CLIENT_ID, WHOOP_CLIENT_ID,
POLAR_CLIENT_ID, GARMIN_CLIENT_ID, PUBLIC_API_URL, APP_URL and WEAR_CRON_KEY exist (yes or no only, never the values).
Then set up a scheduled job that runs once a day at 05:00 UTC (09:00 Abu Dhabi):
  POST <PUBLIC_API_URL>/api/wear/sync-all  with header  x-cron-key: <value of WEAR_CRON_KEY from the environment>
reading the key from the environment at run time, never writing it into code or the job definition. If Emergent has no
scheduler, say so and stop. Change no app files.
```

5. **Record consent.** In the app, open Player 1's record and tick **Wearable data sync** on the consent card, together with him.
6. **Connect his device.** On the Load page, under Live sync, choose **Connect**, then **Open sign-in**. Player 1 signs in to his own account on that screen or on his phone.
   - For Apple Health, choose **Create ingest link** and follow the three steps on his iPhone.
7. **Re-check field names with this first real sync (required).** Compare a few days on the Load page with what his device app shows. If a value is missing or wrong, send Claude the provider name and the dates. The fix is in one file.

## Check

```bash
python3 scripts/check_deploy.py --api https://<url> --stage 4 --email <you>
```

The check shows each provider as not set up, configured, or connected, with the last sync time.

## Done when

- [ ] Consent recorded
- [ ] His device shows connected with a recent sync
- [ ] Values match his device app for 3 days in a row
- [ ] The daily job ran at least once (the last sync time moves without anyone pressing Sync)

**While on staging (stages 1 to 4), wearable data is real personal data.** Connect his real account only if he agrees to that during the staging period. Otherwise, connect it after stage 6.
