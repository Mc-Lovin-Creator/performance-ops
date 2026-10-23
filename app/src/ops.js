/* ---------- v30: kit and product trials (Player 1), recovery station and sensory track (squad), build status (admin) ---------- */
const OPS_DAY = d => { const x = new Date(TODAY); x.setDate(x.getDate() - d); return ISO(x); };
const TESTERS = ['jp', 'olivia', 'javi'];
let TRIALS = store.get('trials') || [
  { id: 't1', product: 'Compression sleeves', cat: 'Recovery', status: 'Testing', note: 'Elbow and forearm, post-session', t: { jp: { days: 5, v: 'Pass' }, olivia: { days: 4, v: 'Pass' }, javi: { days: 2, v: '' } } },
  { id: 't2', product: 'Nike recovery flip-flops', cat: 'Footwear', status: 'Testing', note: 'Off-court only; check arch support against his foot plan', t: { jp: { days: 3, v: 'Mixed' }, olivia: { days: 3, v: 'Pass' }, javi: { days: 0, v: '' } } },
  { id: 't3', product: 'Insoles', cat: 'Footwear', status: 'Testing', note: 'Must be cleared by JP and Olivia before he wears them on court', t: { jp: { days: 0, v: '' }, olivia: { days: 0, v: '' }, javi: { days: 0, v: '' } } }
];
const SUPPLIERS = [{ name: 'Mueller Sports Medicine', what: 'Taping', contact: 'Brian Mulcahy, International Consultant, South Europe', status: 'To contact' }];
const saveTrials = () => store.set('trials', TRIALS);
function pageP1Kit() {
  const g = p1Gate(); if (g) return g;
  const nm = id => (PEOPLE.find(p => p.id === id) || {}).name || id;
  const ready = t => TESTERS.every(k => t.t[k] && t.t[k].v === 'Pass');
  return p1Head('p1kit', 'Kit and product trials', 'tested on staff first, cleared before Player 1 wears it') + `
  <section class="panel"><div class="sec-head"><div><h2>Trials</h2><span class="muted" style="font-size:13px">JP, Olivia and Javi wear it first. Clearing for Player 1 unlocks only when all three pass.</span></div></div>
    <div class="kit-grid">${TRIALS.map(t => `<article class="kit${t.status === 'Cleared for Player 1' ? ' ok' : t.status === 'Rejected' ? ' no' : ''}"><header><span class="eyebrow">${esc(t.cat)}</span><b>${esc(t.product)}</b><span class="chip plain ${t.status === 'Cleared for Player 1' ? 'c-ok' : t.status === 'Rejected' ? 'c-warn' : 'c-load'}">${esc(t.status)}</span></header>
      <p class="muted" style="margin:0;font-size:13px">${esc(t.note)}</p>
      <div class="kit-t">${TESTERS.map(k => { const r = t.t[k] || { days: 0, v: '' }; return `<div><b>${esc(nm(k))}</b><label>Days<input type="number" min="0" value="${r.days}" data-kit="${t.id}|${k}|days" aria-label="${esc(nm(k))} days worn"></label><select data-kit="${t.id}|${k}|v" aria-label="${esc(nm(k))} verdict">${['', 'Pass', 'Mixed', 'Fail'].map(o => `<option${o === r.v ? ' selected' : ''} value="${o}">${o || 'No verdict'}</option>`).join('')}</select></div>`; }).join('')}</div>
      <div class="row" style="gap:8px"><button class="btn primary" data-kitact="clear|${t.id}" ${ready(t) && t.status !== 'Cleared for Player 1' ? '' : 'disabled'}>Clear for Player 1</button><button class="btn" data-kitact="reject|${t.id}">Reject</button><button class="btn" data-kitact="reset|${t.id}">Back to testing</button></div></article>`).join('')}</div>
    <form class="row kit-add" data-kitform="1" style="gap:8px;flex-wrap:wrap;margin-top:14px"><input name="product" placeholder="Product to trial" required aria-label="Product"><input name="cat" placeholder="Category" aria-label="Category"><input name="note" placeholder="What to check" aria-label="Note" style="flex:1;min-width:200px"><button class="btn">Add trial</button></form></section>
  <section class="panel"><div class="sec-head"><h2>Suppliers</h2></div><div class="rows">${SUPPLIERS.map(s => `<div class="row"><span class="grow"><b>${esc(s.name)}</b> · ${esc(s.what)}<br><span class="muted" style="font-size:13px">${esc(s.contact)}</span></span><span class="chip plain c-load">${esc(s.status)}</span></div>`).join('')}</div></section>`;
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || t.dataset.kit === undefined) return; const [id, k, f] = t.dataset.kit.split('|'); const tr = TRIALS.find(x => x.id === id); tr.t[k] = tr.t[k] || { days: 0, v: '' }; tr.t[k][f] = f === 'days' ? +t.value : t.value; saveTrials(); audit('Product trial updated', tr.product); keepRender(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-kitact]'); if (!b) return; const [a, id] = b.dataset.kitact.split('|'); const tr = TRIALS.find(x => x.id === id); tr.status = a === 'clear' ? 'Cleared for Player 1' : a === 'reject' ? 'Rejected' : 'Testing'; saveTrials(); audit('Product trial ' + tr.status, tr.product); keepRender(); });
document.addEventListener('submit', e => { const f = e.target; if (!f.dataset || !f.dataset.kitform) return; e.preventDefault(); const d = Object.fromEntries(new FormData(f)); TRIALS.push({ id: 't' + Date.now(), product: d.product, cat: d.cat || 'Kit', note: d.note || '', status: 'Testing', t: {} }); saveTrials(); keepRender(); });

/* recovery station: 5 stations, daily, adherence tracked; kept separate from rehab */
const STATIONS = [['A', 'Ice-compression sleeve and slow breathing', 'Up to 10 min seated, sleeve on elbow or wrist; breathe at 6 breaths a minute, finish with a few cyclic sighs to calm the nervous system'], ['1', 'Forearm and wrist', '2 × 30 s holds each side (about 60 s per muscle, ACSM)'], ['2', 'Shoulder and upper back', '2 × 30 s holds each side (about 60 s per muscle, ACSM)'], ['3', 'Lower back and hips', '2 × 30 s holds each side · your back-stretch example still to add'], ['4', 'Thighs', '2 × 30 s holds each side (about 60 s per muscle, ACSM)'], ['5', 'Calves and feet', '2 × 30 s holds each side (about 60 s per muscle, ACSM)']];
let RSTAT = store.get('rstation') || (() => { const o = {}; for (let d = 1; d < 7; d++) { const k = OPS_DAY(d); o[k] = {}; ATH.forEach((a, i) => { if ((i * 7 + d * 3) % 5 !== 0) o[k][a.id] = true; }); } return o; })();
/* sensory track: 9 surfaces on the inner dark-blue lane, ~160 m loop, ~2 min */
const SURFACES = [[1, 'Fine sand', 'walk'], [2, 'Smooth pebbles', 'walk'], [3, 'Acupressure mat', 'walk'], [4, 'Natural texture', 'walk'], [6, 'Terrasensa plates', 'walk'], [7, 'Airex pad', 'stop'], [8, 'Sand', 'walk'], [9, 'Cobblestone', 'walk'], [10, 'Terrasensa plate', 'walk']];
let TRACKLOG = store.get('tracklog') || [];
function pageRecovery() {
  const days = [6, 5, 4, 3, 2, 1, 0].map(OPS_DAY), vis = ATH.filter(seesAthlete);
  const adh = a => Math.round(days.filter(d => (RSTAT[d] || {})[a.id]).length / days.length * 100);
  const squad = vis.length ? Math.round(vis.reduce((s, a) => s + adh(a), 0) / vis.length) : 0, today = days[6], todayN = vis.filter(a => (RSTAT[today] || {})[a.id]).length;
  return `<div class="sec-head"><div><span class="eyebrow">Squad · daily, straight after padel · separate from rehab and injury management</span><h1 style="font-size:34px;letter-spacing:-.6px">Recovery station and sensory track</h1></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><div class="kpi"><span class="eyebrow">Squad adherence, 7 days</span><b>${squad}%</b><small>attended days ÷ 7</small></div><div class="kpi"><span class="eyebrow">Through the station today</span><b>${todayN} of ${vis.length}</b><small>tap a cell to log</small></div><div class="kpi"><span class="eyebrow">Sensory laps logged</span><b>${TRACKLOG.reduce((s, l) => s + l.laps, 0)}</b><small>about 2 min a lap</small></div></div>
  <section class="panel"><div class="sec-head"><div><h2>Phase A, then five stretch stations</h2><span class="muted" style="font-size:13px">Full flow, or a 10-minute express version. Recurring soreness goes to the injury manager, not the station.</span></div></div><ol class="st-list">${STATIONS.map(([n, t, d]) => `<li><b>${n}</b><span><b>${esc(t)}</b><br><span class="muted">${esc(d)}</span></span></li>`).join('')}</ol></section>
  <section class="panel"><div class="sec-head"><div><h2>Attendance</h2><span class="muted" style="font-size:13px">One tick per athlete per day</span></div></div><div class="tbl-wrap"><table class="tbl rs-grid"><thead><tr><th>Athlete</th>${days.map(d => `<th>${new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</th>`).join('')}<th>7-day</th></tr></thead><tbody>${vis.map(a => `<tr><td><b>${esc(aName(a))}</b></td>${days.map(d => `<td><button class="rs-c${(RSTAT[d] || {})[a.id] ? ' on' : ''}" data-rs="${d}|${a.id}" aria-pressed="${!!(RSTAT[d] || {})[a.id]}" aria-label="${esc(aName(a))} ${d}"></button></td>`).join('')}<td class="num"><b>${adh(a)}%</b></td></tr>`).join('')}</tbody></table></div></section>
  <section class="panel"><div class="sec-head"><div><h2>Sensory track</h2><span class="muted" style="font-size:13px">Inner dark-blue lane · about 160 m · 9 surfaces (roller and vibration plate removed; original numbers kept)</span></div></div>
    <div class="sf-grid">${SURFACES.map(([n, s, k]) => `<span class="sf ${k}"><b>${n}</b>${esc(s)}<em>${k === 'stop' ? 'Stop pad' : 'Walk over'}</em></span>`).join('')}</div>
    <form class="row" data-trackform="1" style="gap:8px;flex-wrap:wrap;margin-top:14px"><select name="who" aria-label="Athlete">${vis.map(a => `<option value="${a.id}">${esc(aName(a))}</option>`).join('')}</select><input name="laps" type="number" min="1" value="3" aria-label="Laps" style="width:80px"><input name="note" placeholder="Note (barefoot, pain, balance)" aria-label="Note" style="flex:1;min-width:200px"><button class="btn">Log laps</button></form>
    <div class="rows" style="margin-top:10px">${TRACKLOG.slice(-6).reverse().map(l => `<div class="row"><span class="grow"><b>${esc(aName(ATH.find(a => a.id === l.who) || { name: l.who }))}</b> · ${l.laps} laps<br><span class="muted" style="font-size:13px">${esc(l.note || '')}</span></span><span class="muted">${esc(l.d)}</span></div>`).join('') || '<span class="muted">No laps logged yet.</span>'}</div></section>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rs]'); if (!b) return; const [d, id] = b.dataset.rs.split('|'); RSTAT[d] = RSTAT[d] || {}; RSTAT[d][id] = !RSTAT[d][id]; store.set('rstation', RSTAT); keepRender(); });
document.addEventListener('submit', e => { const f = e.target; if (!f.dataset || !f.dataset.trackform) return; e.preventDefault(); const d = Object.fromEntries(new FormData(f)); TRACKLOG.push({ who: d.who, laps: +d.laps || 1, note: d.note, d: OPS_DAY(0) }); store.set('tracklog', TRACKLOG); keepRender(); });

/* build status: every requirement discussed, with an honest state */
const BUILD = [
  ['Player 1', [
    ['Dashboard, duty calendar, return plan with dates that auto-adjust', 'built', 'player1'], ['Load (court minutes only) and threshold guard', 'built', 'loadlab'], ['Daily cover: check-in, warm-up, court time, observation, other training, soft tissue, protocol, update to the physician', 'built', 'p1tx'],
    ['Encrypted records (AES-256), injuries, testing', 'built', 'p1rec'], ['Prescription and testing standards with verified sources and evidence grades', 'built', 'p1rx'], ['Education, anatomy, private chat, one-click "show Player 1"', 'built', 'p1edu'],
    ['Kit and product trials (sleeves, flip-flops, insoles) tested on staff first', 'built', 'p1kit'], ['7-minute protocol: one focused dose a day (modality, stimulation, loading technique or principle), with the spring ligament example', 'built', 'p1tx'], ['Next return block after 19 Sep, and which plan is right where the two differ', 'waiting', 'return'],
    ['Wearables into load: Whoop, Garmin, Polar, Suunto', 'later', null], ['PadelOps coach workload linked to his load', 'later', null], ['OpenCap: real movement capture into the anatomy lab', 'later', null]]],
  ['Squad', [
    ['Testing and prescription per athlete, same standards, by sex and age', 'built', 'classify'], ['Per-athlete overview, time-only load with threshold guard, testing and prescription', 'built', 'athletes'], ['Per-athlete return plan with dates (only Player 1 has one today)', 'partial', 'athletes'],
    ['Recovery station: five stations, daily attendance and adherence', 'built', 'recovery'], ['Recovery station: content loaded from your station design; station 3 back-stretch example to add', 'partial', 'recovery'], ['Sensory track: nine surfaces and lap log', 'built', 'recovery'],
    ['Coaches Andre, Pablo, Carlos, Javi and David as users', 'built', null], ['Education hub, anatomy lab, Ask, messages', 'built', 'learn']]],
  ['Evidence', [
    ['Norms traced to peer-reviewed sources; invented bands removed', 'built', 'p1rx'], ['ACSM 2015 screening algorithm replaces the retired risk-factor count', 'built', 'classify'], ['Acute:chronic ratio flagged as a monitoring aid only', 'built', 'loadlab'],
    ['0 to 10 domain score labelled as our reporting convention', 'built', 'classify'], ['Education hub topics: source check of every claim', 'partial', 'learn']]],
  ['Agents and innovation', [
    ['Innovation scout (daily), evidence watch (weekly), Ask desk (hourly)', 'built', 'agents'], ['LINC, Blaze and Sonar in the innovation pipeline', 'built', 'innovation'], ['Mueller taping supplier', 'built', 'p1kit'], ['Claude or Grok for the agents', 'decision', null]]],
  ['Merged apps', [
    ['fascia-body-flow: routines, clinical domains', 'built', 'p1edu'], ['Threshold: load guard', 'built', 'loadlab'], ['rehab-hub, Hub (Base44), health-peak-core: feature-by-feature check', 'partial', null]]],
  ['Security and launch', [
    ['Encryption, audit log, idle lock, access lists', 'built', 'trust'], ['Hosting in a UAE region under DoH and ADHICS, before real patient data', 'decision', null], ['Physician identity, day-one users, who gets edit or view access', 'decision', null],
    ['Emergent handoff package', 'later', null], ['Re-render the trailer and app video from this build', 'later', null]]]
];
const BSTATE = { built: ['Built', 'c-ok'], partial: ['Partly built', 'c-load'], waiting: ['Waiting on JP', 'c-health'], decision: ['Your decision', 'c-health'], later: ['Later', 'c-muted'] };
function pageBuild() {
  const all = BUILD.flatMap(([, i]) => i), n = k => all.filter(x => x[1] === k).length;
  return `<div class="sec-head"><div><span class="eyebrow">Admin · everything we have agreed, and where it stands</span><h1 style="font-size:34px;letter-spacing:-.6px">Build status</h1></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${Object.entries(BSTATE).map(([k, [l]]) => `<div class="kpi"><span class="eyebrow">${l}</span><b>${n(k)}</b></div>`).join('')}</div>
  ${BUILD.map(([g, items]) => `<section class="panel"><div class="sec-head"><h2>${esc(g)}</h2></div><div class="rows">${items.map(([t, k, r]) => `<div class="row"><span class="grow">${r ? `<a href="#${r}">${esc(t)}</a>` : esc(t)}</span><span class="chip plain ${BSTATE[k][1]}">${BSTATE[k][0]}</span></div>`).join('')}</div></section>`).join('')}`;
}
