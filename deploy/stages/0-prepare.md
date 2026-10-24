# Stage 0: Prepare (about 20 minutes, on your computer)

**Goal:** Emergent can read the repo, and you hold the server keys. Nothing runs yet.

## You do

1. **Check the repo is healthy.** On GitHub, open `Mc-Lovin-Creator/threshold`, switch to branch **`performance-lab-os`**, then open **Actions**. The latest run should have a green tick. If it is red, ask Claude to fix it first.
2. **Link GitHub to Emergent.** In Emergent, open your profile, then GitHub, and connect. Allow access to `Mc-Lovin-Creator/threshold`.
3. **Get the repo on your computer.** You need it to run the key, set-up and check scripts.
   ```bash
   git clone -b performance-lab-os https://github.com/Mc-Lovin-Creator/threshold.git performance-lab-os
   cd performance-lab-os
   ```
   (Or on GitHub choose Code, then Download ZIP, and unzip it.)
4. **Make the server keys** on your computer:
   ```bash
   python3 scripts/gen_keys.py
   ```
   Save the three lines (`JWT_SECRET`, `FIELD_KEY`, `SETUP_TOKEN`) in your password manager as "Performance Ops: staging". **Do not paste them anywhere else.**
5. **Decide the names you will use:**
   - Emergent project: `Performance Ops` (staging: `performance-ops-staging`)
   - Your sign-in email: your work email
   - Your person id in the app: `jp`

## Done when

- [ ] Green tick on the latest CI run of `performance-lab-os`
- [ ] Emergent shows the `threshold` repo when importing
- [ ] Staging keys saved in your password manager

Then tick stage 0 in `deploy/STATUS.md`.
