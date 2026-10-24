# Stage 2: First accounts (about 30 minutes)

**Goal:** you sign in as lead with two-step sign-in, and Olivia and the physician have accounts. No one else has Player 1 access.

## You do

1. **Create your lead account.** Open the preview: while the server has no accounts and `SETUP_TOKEN` is set, the sign-in screen shows **Create the first lead account**. Enter the `SETUP_TOKEN`, your work email and a new password (12+ characters). This works once. (From a terminal instead: `python3 scripts/first_lead.py --api <url> --email <you>`.)
2. **Close the set-up door.** In Emergent's backend environment, **delete `SETUP_TOKEN`** and ask the agent to restart the backend:
   ```
   Read deploy/EMERGENT_RULES.md. Restart the backend only and report GET /api/health. Change nothing else.
   ```
3. **Sign in** on the preview with your email and password.
4. **Turn on two-step sign-in.** The app asks for it straight away because you have Player 1 access.
   - In your authenticator app (Google Authenticator, Microsoft Authenticator or 1Password), add an account, choose "enter a setup key", and type the key shown.
   - Enter the 6-digit code. You are signed out once; sign in again with the code.
5. **Add the team.** Open **Account** (bottom-left badge), then **Team accounts**, then **Add a person**:

   | Person | Role | Player 1 access |
   | --- | --- | --- |
   | Olivia | physio | yes |
   | Team physician | physician | yes |
   | Coach (Javi) | coach | no |
   | Others | as needed | no |

   - Type a temporary password (12+ characters) for each and give it to them **in person**, never by message.
   - They sign in, change it under **Account**, and (Player 1 clinicians) turn on two-step sign-in.

## Check

```bash
python3 scripts/check_deploy.py --api https://<your-preview-url> --stage 2 --email <your work email>
```

- **PASSED** means: you are lead, you have the Player 1 flag, two-step sign-in is on, and the audit log is recording.
- A `to do` line remains until every Player 1 clinician has two-step sign-in on.

## Done when

- [ ] Stage 2 check PASSED
- [ ] `SETUP_TOKEN` removed. The sign-in screen no longer offers "Create the first lead account".
- [ ] Olivia and the physician signed in, changed their password and turned on two-step sign-in
- [ ] Coach account cannot open Player 1 pages (sign in as the coach once to see this)
