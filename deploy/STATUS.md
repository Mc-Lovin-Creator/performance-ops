# Deployment status

Edit this file as you go (on GitHub: pencil icon, then commit to `main`). One line per stage. Never write keys or passwords here.

| Stage | Status | Date | Commit or tag | Notes |
| --- | --- | --- | --- | --- |
| 0 Prepare | done | 2026-10-24 | 3653d68 | Repo moved to performance-ops; keys made |
| 1 Import and run | done | 2026-10-24 | b34e690 | Emergent project "punchline-ops"; stage 1 check PASSED |
| 2 First accounts | in progress | 2026-10-24 | | Lead account made, two-step on, SETUP_TOKEN edited to off; team still to add |
| 3 Staging run-through | in progress | 2026-10-24 | | Backup answers recorded; publish costs about 50 credits a month; region not documented |
| 4 Wearables (optional) | not started | | deploy-stage-4 | |
| 5 Hosting and domain | not started | | deploy-stage-5 | |
| 6 Go-live | blocked until 2, 3 and 5 are done | | deploy-stage-6 | |

## Environments

| | Staging | Production |
| --- | --- | --- |
| Emergent project or host | punchline-ops (Emergent) | |
| App URL | https://e10fc9b4-ceae-41a4-b1e7-eff3ad775b77.preview.emergentagent.com (preview) | |
| API URL | same address, /api | |
| Database name | performance_ops_staging | performance_ops |
| Keys stored as (password manager entry) | Performance Ops: staging | Performance Ops: production |

## Backups (stage 3)

(From Emergent's support assistant, 2026-10-24; not yet confirmed in writing.)
- Frequency: hourly, daily, weekly, monthly, yearly snapshots on Emergent's managed MongoDB (Atlas) for the published app
- Kept for: hourly and daily 7 days; weekly 4 weeks; monthly 12 months; yearly 1 year; point-in-time restore within 7 days
- How to restore: email support@emergent.sh with the job ID (not self-service)
- Region and cloud provider: NOT documented. Ask support@emergent.sh in writing (stage 5)
- Restore test passed on:

## Hosting decision (stage 5)

- Emergent's written answer on data location (date, where filed):
- Path chosen (A Emergent or B UAE cloud):
- Signed off by, date:

## Incident contact (stage 6)

- First contact:
- DoH notification route:

## Issues found (stage 3 onwards)

| Date | Page | What happened | Fixed in |
| --- | --- | --- | --- |
| | | | |

## Releases

| Tag | Date | What changed |
| --- | --- | --- |
| | | |
