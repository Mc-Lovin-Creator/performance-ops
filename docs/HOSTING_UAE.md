# Hosting for real patient data (Abu Dhabi)

This is a checklist, not legal advice. Confirm every item with the Department of Health Abu Dhabi (DoH) and your compliance lead before go-live.

## Rules to meet

- **DoH Abu Dhabi Healthcare Information and Cyber Security Standard (ADHICS)**: applies to licensed healthcare entities in Abu Dhabi and their suppliers. Expect asset registers, access control, logging, incident response, backups and supplier assessments.
- **UAE Federal Law No. 2 of 2019 (health data and ICT in health fields)**: health data stored and processed inside the UAE unless an exception is approved.
- **UAE Federal Decree-Law No. 45 of 2021 (personal data protection)**: consent, purpose limitation, data subject rights.

## Hosting options to price (UAE regions)

| Option | Notes |
| --- | --- |
| Microsoft Azure UAE North (Dubai) / UAE Central (Abu Dhabi) | Mature compliance documentation; MongoDB via Atlas on Azure or Cosmos DB for MongoDB. |
| AWS Middle East (UAE) region, me-central-1 | MongoDB Atlas available on AWS UAE; check service list. |
| Oracle Cloud Abu Dhabi and Dubai regions | Option if the employer already uses Oracle. |
| Core42 / G42 sovereign cloud | Abu Dhabi-based; ask about ADHICS attestations. |
| Emergent hosting | Check where Emergent runs workloads before any real patient data; use it for staging with demo data until confirmed. |

## Checklist before the first real record

- [ ] Data residency confirmed in writing (database, backups, logs) inside the UAE
- [ ] `FIELD_KEY` and `JWT_SECRET` in a managed secret store; rotation plan
- [ ] Encrypted daily backups, 30-day retention, restore tested
- [ ] Two-step sign-in on for all clinicians (`REQUIRE_2FA_P1=1` is the default)
- [ ] Consent recorded for every athlete in the app, signed forms filed
- [ ] Audit log reviewed weekly by the lead (Pilot metrics and Audit pages)
- [ ] AI tools: no clinical data in prompts (already enforced); data-processing terms signed before that ever changes
- [ ] Incident response contact and DoH notification route written down
- [ ] Penetration test or security review of the API
- [ ] Wearables: provider apps registered, client secrets and `WEAR_CRON_KEY` / `GARMIN_PUSH_KEY` in the secret store, field names re-checked with a test account (`docs/WEARABLES.md`); provider data-processing terms filed
