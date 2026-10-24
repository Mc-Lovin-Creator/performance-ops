# Stage 5: Hosting and domain (decision stage)

**Goal:** a written decision on where real patient data will live, and your own web address. This stage is mostly emails and approvals, not code.

## You do

1. **Ask Emergent in writing:**
   - Which country and cloud region the database, backups and logs are in.
   - Whether they sign a data-processing agreement.
   - Whether they hold any certification relevant to health data.

   Save the answer in `deploy/STATUS.md`.
2. **Compare with the rules.** Go through the checklist in `docs/HOSTING_UAE.md` with your compliance lead:
   - ADHICS
   - Federal Law No. 2 of 2019 (health data inside the UAE)
   - Decree-Law 45 of 2021
3. **Pick one path** and write it in STATUS.md:

   | Path | When |
   | --- | --- |
   | **A. Emergent production** | Only if Emergent confirms UAE data residency and signs the agreement your compliance lead requires |
   | **B. UAE cloud** (Azure UAE North or Central, AWS me-central-1, Oracle Abu Dhabi, Core42) | If Emergent cannot confirm UAE residency. Emergent stays your staging and build tool. The same repo runs on the UAE host, because the backend is plain Python with MongoDB, and Claude can write the deployment files for that host as its own stage. |

4. **Domain.** Choose an address such as `lab.<your-domain>` and point it at the chosen host. HTTPS is required.
5. **Production keys.**
   - Run `python3 scripts/gen_keys.py` again. Production gets **new** keys, never the staging ones.
   - Store them as "Performance Ops: production".

## Done when

- [ ] Written answer from Emergent on data location, filed
- [ ] Compliance lead signed off path A or B (name and date in STATUS.md)
- [ ] Domain chosen and DNS access confirmed
- [ ] Production keys made and stored
