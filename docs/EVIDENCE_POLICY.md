# Evidence policy

Gold standard: ACSM position stands (2026 resistance stand, 2011 exercise prescription stand, 2015 screening), NCAA interassociation and CSCCa/NSCA conditioning safety, and the primary literature cited in `app/src/norms.js`.

Grades shown on every teaching card:

- **A** guideline, meta-analysis or consistent randomised trials
- **B** single trials, cohorts or strong human mechanistic data
- **C** emerging work or expert consensus, labelled as such

Rules:

1. A claim without a scientific source is not added, however popular it is on social media.
2. Numbers keep their context (for example, the soleus push-up glucose result is for ~3 hours of seated contractions in a lab study).
3. Where later trials changed the picture, the card says so (for example, isometrics for tendon pain).
4. The evidence audit page (`audit.js`) lists every test, prescription and protocol with its standard and status.
5. `tests/static_checks.mjs` fails the build if a card cites a source that does not exist.
