# Stage 4b: Innovation scout and Tech drops with Grok (optional, any time after stage 1)

**Goal:** every morning the Innovation inbox fills with the week's research, product launches and drops, with a short summary for each domain (longevity, recovery and rehab, wearables, padel and the rest). It uses public sources only.

How it works (code: `backend/core/scout.py`):
- **Grok searches the web and X.** It covers the last 7 days for each of nine domains, through xAI's server-side `web_search` and `x_search` tools.
- **Feeds you choose are read too.** These are brand newsrooms and YouTube channels, through their public RSS/Atom feeds. Nothing is scraped, and Instagram and TikTok are not read, because their terms forbid it.
- **Only cited links are kept.** An item survives only if its link is a source Grok actually cited, so no invented URLs get through.
- **No team data leaves the server.** The prompt is fixed text plus dates.
- **Nothing reaches athletes automatically.** Items arrive as "new" and a clinician pushes them to a group.

## You do

1. **Get an xAI API key** at console.x.ai. Set a monthly spend limit there.
   - Each run makes 9 searches.
   - Check the current price per call on xAI's pricing page before turning on the daily schedule.
2. **Make the scheduler key** on your computer:
   ```bash
   python3 scripts/gen_keys.py --scout
   ```
3. **Add these in Emergent's environment settings yourself.** Never paste them into chat.
   - `XAI_API_KEY`
   - `SCOUT_CRON_KEY`
   - Optional: `SCOUT_X_HANDLES`, for brand accounts to watch for drops, e.g. `WHOOP,ouraring,Hyperice,BullpadelOficial`.
   - Optional: `SCOUT_FEEDS`, using the format in `backend/.env.example`.
4. **Paste this prompt:**

```
Read deploy/EMERGENT_RULES.md. Restart the backend. Report whether XAI_API_KEY, SCOUT_CRON_KEY, SCOUT_X_HANDLES and
SCOUT_FEEDS exist (yes or no only, never the values). Then set up a scheduled job once a day at 01:45 UTC (05:45 Abu Dhabi):
  POST <PUBLIC_API_URL>/api/scout/run  with header  x-cron-key: <value of SCOUT_CRON_KEY from the environment>
reading the key from the environment at run time, never writing it into code or the job definition. If Emergent has no
scheduler, say so and stop. Change no app files.
```

   Then add two more scheduled jobs the same way, for **Tech drops**:
   - Daily at 02:00 UTC (06:00 Abu Dhabi): `POST <PUBLIC_API_URL>/api/drops/run?mode=daily`
   - Sundays at 02:30 UTC (06:30 Abu Dhabi): `POST <PUBLIC_API_URL>/api/drops/run?mode=weekly`

   Both use the same `x-cron-key` header.
   - **What it does:** each run covers 10 domains (wearables, recovery, sleep, training, footwear and apparel, rehab devices, nutrition and metabolic, mind and neurotech, diagnostics and longevity, racket and padel).
   - **Where it looks:** X, plus the public, indexed posts on Instagram, TikTok, YouTube, LinkedIn, Reddit and Threads, plus brand newsrooms, press, Product Hunt and Kickstarter.
   - **What it never does:** log into or scrape any account.
5. **Run it once** from the app: open **Innovation**, then **Run the scan now** (this button is for the lead only). It takes a few minutes.

## Check

- The Innovation page shows "Grok (grok-4.7) searches the web and X".
- Domain summaries appear for this week.
- Each item shows "found by Grok" or "from a feed", with a working link.
- The audit log has an "innovation scan" line with counts.

## Done when

- [ ] First scan finished with items in at least 5 domains
- [ ] Daily job scheduled
- [ ] Spend limit set on the xAI console
