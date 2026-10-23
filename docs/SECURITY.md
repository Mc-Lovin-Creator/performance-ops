# Security model

## Data classes (backend/core/policy.py)

| Class | Examples | Who reads | Stored |
| --- | --- | --- | --- |
| user | theme, filters, view state | the user only | plain, per user |
| team | bookings, duty calendar, ideas, messages, kit trials | all signed-in users; athletes may write messages and bookings only | plain |
| clinic | squad treatment updates, assessments, screening answers | lead, physio, physician | encrypted (Fernet) |
| p1 | Player 1 daily cover, injuries, sessions, tests, readiness | clinicians with the Player 1 flag (JP, Olivia, the physician) | encrypted (Fernet) |

Unknown keys are refused. A coach or manager can never be given the Player 1 flag.

## Accounts

- Passwords: scrypt with a per-user salt, minimum 12 characters; typed at a hidden prompt when created.
- Tokens: HS256 JWT, 12 hours, kept in the browser's session storage (gone when the tab closes).
- Sign-in attempts: 10 per 5 minutes per address and email.
- Deactivating a user ends access on their next request.

## Audit

Every sign-in (and failed sign-in), every write, every clinical read and every refused request is appended to `audit` with who, when, what and the IP.

## On the device

The app keeps a working copy in the browser for speed and offline use. Signing out clears it. Shared devices should sign out after use.

## Before real patient data

- Host in a UAE region that meets Abu Dhabi DoH and ADHICS requirements; record where data lives.
- Keep `FIELD_KEY` in a secret manager, not in files; rotate on staff changes.
- Daily encrypted backups with a tested restore.
- Add two-factor sign-in for clinicians.
- Data-processing terms with any AI provider; AI prompts stay free of names and patient details (enforced on the Ask page).
