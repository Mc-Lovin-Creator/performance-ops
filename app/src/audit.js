/* ---------- Evidence audit (v43): every test, prescription and protocol in the app, checked against ACSM, NCAA/NSCA and the primary literature ---------- */
const AUDIT_V = { ok: ['Meets the standard', 'c-ok'], fixed: ['Corrected in this version', 'c-health'], practice: ['Team practice, labelled', 'c-load'], weak: ['Low evidence, labelled', 'c-warn'] };
const AUDIT = [
  ['Player 1', [
    ['Return plan: 8 weekly minute caps, one variable at a time', 'Graded return; court minutes and high-risk minutes never rise in the same week', 'practice', ['gabbett', 'bourdon'], 'Caps are the team\'s plan; the principle of gradual, single-variable progression is supported.'],
    ['Load = court minutes only', 'Session-RPE × minutes is the validated internal load; minutes alone are external load', 'practice', ['halson', 'bourdon'], 'Time-only is your current decision. RPE is still recorded so session-RPE load can be switched on.'],
    ['Threshold guard: acute:chronic ratio 1.10 and 1.25', 'Monitoring aid only', 'ok', ['impel', 'gabbett'], 'Shown with the caveat; never used alone to clear or stop him.'],
    ['Risk forecast (Threshold engine)', 'Window of raised risk, not a prediction', 'ok', ['impel', 'gabbett'], 'Labelled as such on the panel.'],
    ['Testing standards and population levels', 'McKay 2022 tiers; FRIEND, Dodds, Bohannon; pro padel cohorts', 'fixed', ['mckay', 'friend', 'dodds', 'pradas'], 'Invented elite bands removed in v30; age 40 to 49 added in v31.'],
    ['Prescription, elite', 'ACSM 2026 resistance stand; taper meta-analysis; padel physiology', 'fixed', ['currier', 'bosquet', 'mellado'], 'Updated from the retired 2009 ACSM stand to the 2026 stand.'],
    ['Pre-participation screening', 'ACSM 2015 algorithm', 'fixed', ['riebe'], 'Retired risk-factor count replaced in v30.'],
    ['7-minute protocol', 'Short daily dose; red light and NMES are adjuncts', 'weak', ['garber'], 'The loading and teaching parts are sound; red light and Compex have weak evidence and are labelled as add-ons.'],
    ['Soft tissue and manual therapy', 'Short-term symptom relief, not a replacement for loading', 'practice', [], 'Logged, never used to justify more load.']]],
  ['Prescription by population (Classify and prescribe)', [
    ['Sedentary resistance: was 40 to 60% 1RM, 1 to 3 sets of 10 to 15', '60 to 70% 1RM, 8 to 12 reps, 2 to 3 sets; 40 to 50% if very deconditioned', 'fixed', ['garber', 'currier']],
    ['Trained resistance: was 67 to 85% 1RM, 3 to 5 sets of 6 to 12 citing ACSM 2009', '80% 1RM or more for strength; about 10 sets per muscle per week for size; failure not needed', 'fixed', ['currier']],
    ['Competitive resistance: 75 to 95% 1RM, 4 to 6 sets', 'Strength 80% 1RM or more; power 30 to 70% 1RM fast; velocity loss 10 to 20%', 'fixed', ['currier', 'pareja']],
    ['Elite cardio: was 6 to 12 sessions, 400 to 600 min a week, polarised', 'That is an endurance-athlete model; padel is intermittent', 'fixed', ['mellado', 'seiler'], 'Replaced with court-specific repeated high-intensity work.'],
    ['Cardio intensity bands', 'ACSM: moderate 40 to 59% HRR (64 to 76% HRmax); vigorous 60 to 89% HRR (77 to 95%)', 'fixed', ['garber']],
    ['Five heart-rate zones', 'Coaching convention, not an ACSM table', 'practice', ['seiler', 'tanaka'], 'Now labelled as a convention, with ACSM bands alongside.'],
    ['Maximum heart rate estimate', 'Tanaka 208 − 0.7 × age', 'ok', ['tanaka']],
    ['Deload every 4th week', 'No fixed rule in ACSM or NSCA', 'practice', [], 'Kept as a team default you can change.']]],
  ['Conditioning safety (NCAA and NSCA)', [
    ['Return after 2 or more weeks off, illness or injury', 'Volume 50%, then 70, 80, 90% of the highest on file over 2 to 4 weeks; work:rest 1:4 then 1:3, then at least 1:2', 'fixed', ['nsca19', 'ncaa19'], 'Added as transition rules on the Return plan and each athlete\'s load.'],
    ['Plyometrics after a break', 'About 70 foot contacts per session in week 1, about 100 in week 2', 'fixed', ['nsca19']],
    ['Resistance sessions after a break', 'No more than 3 sessions in week 1 and 4 in week 2', 'fixed', ['nsca19']],
    ['Conditioning as punishment', 'Never; every session documented, monitored and shared with medical staff', 'fixed', ['ncaa19', 'casa12'], 'Stated in the elite prescription and the daily update.'],
    ['Heat (Abu Dhabi)', 'Acclimatise over 7 to 10 days; cold-water immersion ready for exertional heat stroke', 'fixed', ['ncaa19'], 'Added to the safety card.']]],
  ['Squad rehab protocols (padel)', [
    ['Lateral elbow: isometrics 5 × 45 s', 'Isometrics may ease pain short term; later trials show no advantage over slow isotonic loading', 'practice', ['rio', 'coombes'], 'Dose borrowed from patellar tendinopathy; kept as an option, not a rule.'],
    ['Lateral elbow: was "3 × 15 at 3-1-3 tempo"', 'Progressive heavy slow resistance (15RM to 6RM, 3 s up, 3 s down, 3 days a week)', 'fixed', ['coombes', 'beyer', 'kongsgaard'], 'HSR evidence is from Achilles and patellar trials; applied to the elbow by extrapolation.'],
    ['Ankle sprain: was "brace for 6 weeks"', 'Brace or tape for sport for up to 12 months to cut re-sprains; exercise therapy', 'fixed', ['vuurberg']],
    ['ACL return: 90% limb symmetry, 9 months, psychological readiness', 'Delaware-Oslo decision rules', 'ok', ['grindem']],
    ['Rotator cuff and lumbar stages', 'Consistent with current practice; stage timings are team estimates', 'practice', []]]],
  ['Recovery station and sensory track', [
    ['Stretch holds: was 30 s once', '10 to 30 s holds repeated to about 60 s per muscle', 'fixed', ['garber']],
    ['Ice-compression and slow breathing', 'Short-term comfort and calming; does not speed tissue repair', 'weak', [], 'Kept for adherence and comfort, labelled as such.'],
    ['Sensory surfaces', 'Plausible for proprioception; little direct trial evidence', 'weak', []]]],
  ['Principles of training (Education hub)', [
    ['Progressive overload', 'Load, volume, frequency and range of motion drive adaptation', 'ok', ['currier', 'garber']],
    ['Specificity', 'Train the quality you need: strength, power, or repeated sprints', 'ok', ['currier']],
    ['Individualisation and readiness', 'Monitor fatigue and adjust', 'ok', ['halson', 'bourdon']],
    ['Reversibility', 'Adaptations fade within weeks of stopping', 'ok', ['mujika']],
    ['Periodisation', 'Block or undulating; models matter less than total volume and intensity', 'ok', ['issurin', 'currier']],
    ['Taper', 'Volume down 41 to 60% for about 2 weeks; intensity kept', 'ok', ['bosquet']]]]
];
function auditCounts() { const all = AUDIT.flatMap(([, r]) => r); return Object.fromEntries(Object.keys(AUDIT_V).map(k => [k, all.filter(r => r[2] === k).length])); }
function pageAudit() {
  const n = auditCounts(), total = Object.values(n).reduce((a, b) => a + b, 0);
  return `<div class="sec-head"><div><span class="eyebrow">Evidence audit · ACSM 2026 and 12th edition · NCAA and NSCA · primary literature</span><h1 style="font-size:34px;letter-spacing:-.6px">Every test and prescription, checked</h1></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi"><span class="eyebrow">Items checked</span><b>${total}</b></div>${Object.entries(AUDIT_V).map(([k, [l]]) => `<div class="kpi"><span class="eyebrow">${l}</span><b>${n[k]}</b></div>`).join('')}</div>
  ${AUDIT.map(([g, rows]) => `<section class="panel"><div class="sec-head"><h2>${esc(g)}</h2></div><div class="aud">${rows.map(([what, std, v, src, note]) => `<div class="aud-r"><div><b>${esc(what)}</b><span>${esc(std)}</span>${note ? `<em>${esc(note)}</em>` : ''}</div><div class="aud-s"><span class="chip ${AUDIT_V[v][1]}">${AUDIT_V[v][0]}</span>${src.map(k => SRC[k] ? `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].cite.split(/\. (?=[A-Z])/)[0].slice(0, 60))} ${esc((SRC[k].cite.match(/(19|20)\d\d/) || [''])[0])}</a>` : '').join('')}</div></div>`).join('')}</div></section>`).join('')}
  <p class="muted" style="font-size:12.5px">NCAA publishes safety standards for conditioning (with NATA, NSCA, CSCCa and others), not physiological norms; those come from ACSM, the registries and sport-specific studies.</p>`;
}
/* transition rules card: shown on the Return plan and each athlete's load */
function transitionCard() {
  return `<section class="panel"><div class="sec-head"><div><span class="eyebrow">NCAA and NSCA · after 2 or more weeks off, illness, injury or a new coach</span><h2>Transition rules</h2></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week back</th><th>Conditioning volume</th><th>Work : rest</th><th>Plyometric contacts</th><th>Lifting sessions</th></tr></thead><tbody>
    <tr><td><b>1</b></td><td class="num">50% of the highest on file</td><td class="num">1:4 or more</td><td class="num">about 70</td><td class="num">3 or fewer</td></tr>
    <tr><td><b>2</b></td><td class="num">70%</td><td class="num">1:3 or more</td><td class="num">about 100</td><td class="num">4 or fewer</td></tr>
    <tr><td><b>3</b></td><td class="num">80%</td><td class="num">1:2 or more</td><td class="num">progress</td><td class="num">normal</td></tr>
    <tr><td><b>4</b></td><td class="num">90%</td><td class="num">1:2 or more</td><td class="num">progress</td><td class="num">normal</td></tr></tbody></table></div>
    <p class="muted" style="font-size:12.5px;margin:0">Returning athletes with a familiar coach can use the 2-week version (50%, 70%). Heat: acclimatise over 7 to 10 days and keep cold-water immersion ready. Conditioning is never punishment. <a href="${SRC.nsca19.url}" target="_blank" rel="noopener">CSCCa and NSCA 2019</a> · <a href="${SRC.ncaa19.url}" target="_blank" rel="noopener">NCAA interassociation 2019</a></p></section>`;
}
