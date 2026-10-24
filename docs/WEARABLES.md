# Wearable sync

Player 1's own device account is connected once by his clinician. After that, the server pulls daily summaries into his encrypted `wear` record. The Load page shows them against his own baseline.

**Data kept:** one row per day with sleep hours, HRV, resting heart rate and the provider's score.

**Data not kept:** raw heart-rate streams, GPS and workouts.

## How it works

| Provider | How data arrives | What you need |
| --- | --- | --- |
| Oura | OAuth 2, server pulls (`/v2/usercollection/sleep`, `daily_readiness`) | Oura API application. Personal access tokens were retired at the end of 2025, so OAuth is the only route. |
| WHOOP | OAuth 2 with `offline` scope, server pulls (`/v2/activity/sleep`, `/v2/recovery`) | WHOOP developer app. Development is limited to 10 members, so ask WHOOP for approval beyond that. |
| Polar | OAuth 2, server pulls AccessLink v3 (`nightly-recharge`, `sleep`, last 28 days) | Polar AccessLink client. The user is registered automatically after the first sign-in. |
| Garmin | OAuth 2 with PKCE. Garmin **pushes** data to us, and a sync asks Garmin to re-send (backfill). | Garmin Connect Developer Program approval (business application). |
| Apple Health | The **Health Auto Export** iPhone app posts JSON to our ingest URL. | The app on his iPhone, with a REST API automation. Apple has no cloud API. |

**Day boundaries:**
- WHOOP rows are dated by the local day his main sleep ended.
- Garmin, Oura and Polar use their own calendar day.
- When a source has no value for a field, the hand-entered or CSV value for that field is kept.

**What each value means:**
- **HRV:** Oura, WHOOP and Polar report RMSSD. Apple Watch reports SDNN. Compare a value only with the same source's baseline.
- **Resting heart rate:** Polar gives the average night heart rate, not the lowest. The app labels the source on every row.

## Rules the code keeps

- **Who can act:** only Player 1 clinicians (lead, physio or physician with the Player 1 flag) can connect, sync or disconnect. Two-step sign-in applies as for all Player 1 data.
- **Consent first:** nothing connects until his consent for **Wearable data sync** is recorded on his record. If the consent is removed, Apple and Garmin data is refused at the door.
- **Tokens:** provider tokens are encrypted with `FIELD_KEY` in a server-only document. The state API cannot return it and the browser never sees it. This is covered by tests.
- **Connect links:** a link is single-use, bound to one provider and expires in 24 hours. The clinician opens it on the lab device with Player 1, or copies it to his phone. The app sends him nothing.
- **Disconnecting:** this revokes access at the provider where the provider supports it. Days already synced stay in his clinical record.
- **Audit trail:** every connect, sync, push and disconnect is logged with who, which provider and how many days. Values are never logged.

## Set-up (per provider, about 15 minutes each)

1. Register an app with the provider. Set the **redirect URL** to `https://<api-host>/api/wear/<provider>/callback`, where provider is `oura`, `whoop`, `polar` or `garmin`.
2. Put the client ID and secret in the server's secret store (`backend/.env.example` lists every name), together with `PUBLIC_API_URL` and `APP_URL`.
3. Restart the API. The provider then shows **Connect** on the Load page.
4. **Garmin:** in the Garmin developer portal, set the push URL for dailies, HRV and sleeps to `https://<api-host>/api/wear/garmin/push?k=<GARMIN_PUSH_KEY>`.
5. **Daily sync:** schedule `POST https://<api-host>/api/wear/sync-all` with header `x-cron-key: <WEAR_CRON_KEY>`, for example at 09:00 Abu Dhabi time, after he has synced his ring or band in the morning.
6. **Apple Health:** on the Load page, choose **Create ingest link**. In Health Auto Export, set up a new REST API automation:
   - Metrics: Heart Rate Variability, Resting Heart Rate and Sleep Analysis.
   - JSON format, aggregated by day.
   - Paste the URL and header that the app shows once.

## API

| Method and path | Who | What |
| --- | --- | --- |
| `GET /api/wear` | Player 1 clinicians | Status per provider, consent and the ingest URL |
| `POST /api/wear/{provider}/connect` | Player 1 clinicians | Returns the provider sign-in link (24 h) |
| `GET /api/wear/{provider}/callback` | Provider redirect | Checks the sealed state, stores the tokens and runs the first sync |
| `POST /api/wear/{provider}/sync?days=35` | Player 1 clinicians | Pull now (Garmin: request backfill) |
| `DELETE /api/wear/{provider}` | Player 1 clinicians | Disconnect and revoke |
| `POST /api/wear/apple/token` | Player 1 clinicians | New ingest key, shown once; replaces the old one |
| `POST /api/wear/apple/ingest` | Health Auto Export | Bearer ingest key |
| `POST /api/wear/garmin/push?k=` | Garmin | Push receiver; ignores other Garmin users |
| `POST /api/wear/sync-all` | Scheduler | Header `x-cron-key` |

## Before go-live

The endpoint paths and field names live in one file, `backend/core/wearables.py`. They were checked against public documentation and field notes in October 2026. Re-check them against each provider's current reference with a real test account before the first real sync:

- Oura: https://cloud.ouraring.com/v2/docs
- WHOOP: https://developer.whoop.com/api
- Polar: https://www.polar.com/accesslink-api
- Garmin: https://developerportal.garmin.com (Health API)
- Health Auto Export: https://www.healthyapps.dev

The tests in `backend/tests/test_wear.py` use a fake of each provider, so a field-name change means updating the fake and the normaliser together.

**Provider terms:**
- WHOOP's terms prohibit selling or licensing API data and limit caching.
- Garmin and Polar require a privacy policy and user consent.

Keep the data inside the clinical record, and keep it out of any AI prompt. The Ask page already blocks clinical data from prompts.
