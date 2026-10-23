/* ---------- Player 1 hub: clinical view (tabs) and patient view. Player 1 is always private. ---------- */
const P1_TABS = [['player1', 'Today'], ['calendar', 'Duty calendar'], ['p1rx', 'Prescription'], ['return', 'Return plan'], ['loadlab', 'Load'], ['p1tx', 'Treatment'], ['p1inj', 'Injuries'], ['p1test', 'Testing'], ['p1edu', 'Education'], ['p1kit', 'Kit and trials'], ['p1chat', 'Chat and privacy']];
function p1Tabs(k) { return `<nav class="seg p1tabs p1tabs-wide" aria-label="Player 1 sections">${P1_TABS.filter(([r]) => allowedRoutes().includes(r)).map(([r, l]) => `<a href="#${r}" ${k === r ? 'aria-current="page"' : ''}>${l}</a>`).join('')}<a href="#anatomy" data-act="focus" data-arg="spring_ligament_R">Anatomy ↗</a></nav>`; }
function p1Head(k, title, sub) { return `<div class="stack" style="gap:14px"><div class="sec-head"><div><span class="eyebrow">Player 1 · ${lockIcon} private · ${esc(sub)}</span><h1 style="font-size:34px;letter-spacing:-.6px">${title}</h1></div></div>${p1Tabs(k)}</div>`; }
function p1Gate() {
  const a = P1();
  if (seesClinical(a) || (me().role === 'coach' && seesAthlete(a))) return null;
  audit('Open Player 1', 'Private record', 'Denied');
  return `<div class="hero"><div class="stack"><span class="eyebrow">${lockIcon} Private record</span><span class="big" style="font-size:64px">Player 1</span><span class="hero-sub">Player 1 is always private. You are not on his access list, and the attempt was logged.</span></div><button class="btn primary" data-act="request" data-arg="p1">Request access from JP</button></div>`;
}

/* Treatment: his updates, assessments and the treatment menu */
const P1_MODS = ['Hands-on therapy', 'Intrinsic foot work', 'Calf and arch strengthening', 'Balance and control', 'Impact progression', '7-minute protocol', 'Compex', 'Red light', 'TECAR', 'Game Ready', 'Education'];
function pageP1Tx() {
  const g = p1Gate(); if (g) return g;
  const a = P1(), ups = UPDATES.filter(u => u.ath === 'p1'), as = ASSESS.filter(x => x.ath === 'p1').slice().reverse(), can = perm().clinical;
  return p1Head('p1tx', 'Treatment', 'daily updates and assessments') + `
  <div class="grid2"><section class="panel"><h2>Log today's treatment</h2>${can ? `<form id="upd" class="stack">
    <select id="u-ath" hidden><option value="p1">Player 1</option></select>
    <div class="grid3" style="gap:14px"><label class="field">Pain now: <output id="u-pain-o">2</output> / 10<input id="u-pain" type="range" min="0" max="10" value="2" oninput="document.getElementById('u-pain-o').textContent=this.value"></label>
    <label class="field">Stage<select id="u-stage">${STAGES.map(s => `<option ${a.case.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="field">Response<select id="u-resp"><option>Better</option><option>Same</option><option>Worse</option></select></label></div>
    <div class="field">Treatment given<div class="pills" id="u-mods">${P1_MODS.map(m => `<button type="button" class="pill" data-act="mod" data-arg="${m}" aria-pressed="false">${m}</button>`).join('')}</div></div>
    <label class="field">Plan and next step<textarea id="u-plan" placeholder="What happens next, and what the coach needs to know"></textarea></label>
    <label class="layer"><input type="checkbox" id="u-share" checked> Send a summary to the physician (clinical thread)</label>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">Save update</button><a class="btn" href="#assess">New assessment</a></div></form>` : locked('Only the clinical team logs treatment.')}</section>
  <aside class="stack" style="gap:16px"><div class="panel"><h3>Updates</h3><div class="rows">${ups.map(u => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="av">${PEOPLE.find(p => p.id === u.by).init}</span><span class="grow"><b>${esc(u.at)}</b> · ${esc(PEOPLE.find(p => p.id === u.by).name)} · pain ${u.pain}/10<br><span class="muted">${esc(u.mods.join(', '))}</span><br>${esc(u.plan)}</span><span class="chip plain ${u.response === 'Better' ? 'c-ok' : u.response === 'Worse' ? 'c-risk' : 'c-muted'}">${esc(u.response)}</span></div>`).join('') || '<span class="muted">None yet.</span>'}</div></div>
    <div class="panel"><h3>Assessments</h3><div class="rows">${as.map(x => { const pos = Object.entries(x.tests).filter(([, v]) => v === 'pos').map(([k]) => k); return `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${esc(x.region)} ${esc(x.side.toLowerCase())}</b> · ${esc(x.at)}<br><span class="muted">${pos.length ? 'Positive: ' + pos.map(esc).join(', ') : 'No positive tests'}</span><br>${esc(x.plan)}</span><span class="chip plain ${x.sev === 'High' ? 'c-risk' : x.sev === 'Moderate' ? 'c-warn' : 'c-ok'}">${esc(x.sev)}</span></div>`; }).join('') || '<span class="muted">None yet.</span>'}</div></div></aside></div>
  ${p1Menu()}`;
}

/* Injuries: current injury, timeline and the log */
let INJ = store.get('p1inj', null) || [{ id: 'i1', date: '2026-09-18', region: 'Right foot and arch', dx: 'Spring ligament sprain, mild (higher-mild, edging into moderate). No tear; two nearby tendons slightly irritated.', mech: 'Padel, change of direction', sev: 'Moderate', status: 'Active' }];
function pageP1Inj() {
  const g = p1Gate(); if (g) return g;
  if (!perm().clinical) return p1Head('p1inj', 'Injuries', 'clinical only') + locked('Injury details are visible to the clinical team only.');
  const T = rtSync(), cur = INJ.filter(i => i.status === 'Active'), wk = T.p ? T.p.week : null;
  const tl = [[RT.iso(new Date(RT.PLAN_START.getTime() - 2 * 864e5)), 'Scan: mild spring ligament sprain, no tear'], [RT.iso(RT.PLAN_START), 'Graded return starts · Calm it down'], [RT.iso(new Date(RT.PLAN_START.getTime() + 7 * 864e5)), 'Rebuild phase'], [RT.iso(new Date(RT.PLAN_START.getTime() + 28 * 864e5)), 'Get strong phase · plyometrics started and tolerated'], [TODAY_ISO, `Today · week ${wk} of ${RT.WEEKS} · ${RT_STW[T.s.st][0]}`]];
  return p1Head('p1inj', 'Injuries', 'current injury, timeline and history') + (cur[0] ? injHero(cur[0], T) : '') + `
  <div class="grid2"><div class="stack" style="gap:16px">${cur.map(i => `<section class="panel"><div class="sec-head"><h2>${esc(i.region)}</h2><span class="chip c-warn">Active</span></div><p style="margin:0">${esc(i.dx)}</p>
    <div class="facts"><div><span>Since</span><span>${esc(i.date)} · ${esc(i.mech)}</span></div><div><span>Severity</span><span>${esc(i.sev)}</span></div><div><span>Healing phase</span><span>${T.p ? RT.HEAL[T.p.heal][0] + ' · ' + RT.HEAL[T.p.heal][1] : ''}</span></div><div><span>Timeline</span><span>A few weeks to settle; 3 to 4 months to be fully strong</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="focus" data-arg="spring_ligament_R">Show in 3D</button><a class="btn sm" href="#return">Return plan</a><button class="btn sm" data-hb="injclose" data-arg="${i.id}">Mark resolved</button></div></section>`).join('')}
    <section class="panel"><h2>Timeline</h2><ol class="tl">${tl.map(([d, t]) => `<li><span class="num muted">${d}</span><span>${esc(t)}</span></li>`).join('')}</ol></section></div>
  <aside class="stack" style="gap:16px"><section class="panel"><h3>Log an injury</h3><form id="injform" class="stack" style="gap:12px">
    <div class="grid3" style="gap:10px;grid-template-columns:1fr 1fr"><label class="field">Date<input type="date" id="inj-date" value="${TODAY_ISO}"></label><label class="field">Severity<select id="inj-sev"><option>Mild</option><option>Moderate</option><option>Severe</option></select></label></div>
    <label class="field">Region<select id="inj-reg">${SOFT_REGIONS.map(r => `<option>${r}</option>`).join('')}</select></label>
    <label class="field">What happened<input id="inj-mech" placeholder="Mechanism and context"></label><label class="field">Working diagnosis<input id="inj-dx" placeholder="Clinical impression"></label>
    <div><button class="btn primary" type="submit">Add to history</button></div></form></section>
    <section class="panel"><h3>History</h3><div class="rows">${INJ.map(i => `<div class="row" style="font-size:13.5px"><span class="grow"><b>${esc(i.region)}</b> · ${esc(i.date)}<br><span class="muted">${esc(i.dx || i.mech)}</span></span><span class="chip plain ${i.status === 'Active' ? 'c-warn' : 'c-ok'}">${i.status}</span></div>`).join('')}</div></section></aside></div>`;
}

/* Testing: return-to-padel battery with limb symmetry (right foot is the injured side) */
let P1T = store.get('p1test', null) || { date: '2026-10-16', rows: { calf: [22, 28], bal: [26, 30], hop: [142, 155], triple: [430, 468], side: [31, 36], yb: [61, 64] } };
const P1_BATTERY = [['calf', 'Single-leg calf raises', 'reps to fatigue', 'Calf-foot capacity'], ['bal', 'Single-leg balance, eyes closed', 'seconds, max 30', 'Early control'], ['hop', 'Single-leg hop for distance', 'cm', 'Power and landing'], ['triple', 'Triple hop for distance', 'cm', 'Repeated power'], ['side', 'Side hop, 30 s', 'reps', 'Lateral tolerance, padel-specific'], ['yb', 'Y-balance, anterior reach', 'cm', 'Dynamic control']];
function pageP1Test() {
  const g = p1Gate(); if (g) return g;
  const rows = P1_BATTERY.map(([k, n, u, use]) => { const [R, L] = P1T.rows[k], lsi = L ? Math.round(R / L * 100) : 0; return { k, n, u, use, R, L, lsi, ok: lsi >= 90 }; });
  const pass = rows.filter(r => r.ok).length;
  return p1Head('p1test', 'Testing', 'return-to-padel battery') + testHero(rows, P1T.date) + `
  <div class="grid2"><section class="panel" style="gap:14px"><div class="sec-head"><h2>Limb symmetry · tested ${esc(P1T.date)}</h2><span class="chip ${pass === rows.length ? 'c-ok' : 'c-warn'}">${pass} of ${rows.length} at 90% or more</span></div>
    <div class="table-wrap"><table style="min-width:620px"><thead><tr><th>Test</th><th>Right (injured)</th><th>Left</th><th>Symmetry</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${r.n}</b><br><span class="muted" style="font-size:12px">${r.u} · ${r.use}</span></td><td><input class="tin" type="number" value="${r.R}" data-pt="${r.k}:0" ${perm().clinical ? '' : 'disabled'} aria-label="${r.n} right"></td><td><input class="tin" type="number" value="${r.L}" data-pt="${r.k}:1" ${perm().clinical ? '' : 'disabled'} aria-label="${r.n} left"></td><td><span class="chip plain ${r.ok ? 'c-ok' : 'c-warn'}">${r.lsi}%</span></td></tr>`).join('')}</tbody></table></div>
    <span class="muted" style="font-size:12.5px">Symmetry = injured ÷ uninjured × 100. Return to full padel needs 90% or more on every test, no pain during or the next morning, and clinician sign-off. Symmetry can flatter if the good side has also weakened, so track absolute values too.</span></section>
  <aside class="stack" style="gap:16px"><div class="panel"><h3>Readiness to progress</h3>${rows.filter(r => !r.ok).map(r => `<div class="row" style="font-size:13.5px"><span class="grow">${r.n}</span><b class="num">${r.lsi}%</b></div>`).join('') || '<span>All tests at 90% or more.</span>'}<a class="btn sm" href="#return">On-court readiness score</a></div>
    <div class="panel"><h3>Population testing</h3><p class="muted" style="margin:0;font-size:13.5px">Classification, ACSM screening and the full prescription live in Classify and test.</p><a class="btn sm" href="#classify">Open Classify and test</a></div></aside></div>`;
}

/* Education: topics for Player 1, shared to his view by the clinician */
const P1_EDU = [['foot', 'Your foot: the spring ligament', 'A hammock under the arch. What a mild sprain means, and why there is no tear and no surgery.'], ['phases', 'How it heals', 'Calm it down, rebuild, get strong. What each phase feels like and what we do in it.'], ['load', 'Why loading heals it', 'Step-by-step load is what makes the ligament strong. Support tools help you train; they do not heal.'], ['colours', 'Play by colour', 'Green play hard, orange medium, red go easy, and the stop rules for each.'], ['seven', 'The 7-minute protocol', 'Compex, red light and active foot control running together, and why the active part matters.'], ['decel', 'Deceleration and cutting', 'How the foot absorbs braking forces in padel and how we train it back.'], ['sleep', 'Sleep and recovery', 'Why sleep and HRV change today\'s plan.']];
let P1_SHARE = store.get('p1share', { foot: true, phases: true, load: true, colours: true, seven: true });
function pageP1Edu() {
  const g = p1Gate(); if (g) return g;
  return p1Head('p1edu', 'Education hub', 'his routines, his recovery and the Performance Library') + eduHub('p1') + `
  <section class="panel"><div class="sec-head"><h2>Shared to his app</h2><span class="muted" style="font-size:13px">Ticked topics appear on his Education page, above the full hub</span></div><div class="rows">${P1_EDU.map(([k, t, d]) => `<label class="row" style="font-size:13.5px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-ps="${k}" ${P1_SHARE[k] ? 'checked' : ''} ${perm().clinical ? '' : 'disabled'}><span class="grow"><b>${t}</b><br><span class="muted">${d}</span></span><span class="chip plain ${P1_SHARE[k] ? 'c-ok' : 'c-muted'}">${P1_SHARE[k] ? 'Shared' : 'Not shared'}</span></label>`).join('')}</div></section>
  <section class="panel"><h3>The same hub for the squad and team</h3><p class="muted" style="margin:0;font-size:13.5px">Every athlete and the staff get this Performance Library under Squad, Education hub, with team CPD.</p><a class="btn sm" href="#learn">Open the squad Education hub</a></section>`;
}

/* Chat and privacy */
function pageP1Chat() {
  const g = p1Gate(); if (g) return g;
  const a = P1(), chans = CHANNELS.filter(c => (c.ath === 'p1' || c.id === 'dm-p1' || c.id === 'p1-daily') && c.members.includes(S.me));
  const uniq = [...new Map(chans.map(c => [c.id, c])).values()];
  return p1Head('p1chat', 'Chat and privacy', 'private threads and who can see him') + `
  <div class="grid2"><div class="stack" style="gap:16px">${uniq.map(c => { const m = (MSGS[c.id] || []).slice(-3); return `<section class="panel"><div class="sec-head"><h3>${lockIcon} ${esc(c.kind === 'dm' ? c.name + ' · direct' : c.name)}</h3><span class="chip plain c-health">${c.kind === 'dm' ? 'Encrypted' : 'Private'} · ${c.members.length + (c.external ? c.external.length : 0)} people</span></div>
    <div class="rows">${c.kind === 'dm' ? '<span class="muted" style="font-size:13.5px">Direct conversation with Player 1, encrypted end to end. Messages are readable only inside the thread on your device.</span>' : m.map(x => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="av">${(PEOPLE.find(p => p.id === x[0]) || { init: '··' }).init}</span><span class="grow"><b>${esc((PEOPLE.find(p => p.id === x[0]) || { name: x[0] }).name)}</b> · <span class="muted">${esc(x[1])}</span><br>${c.kind === 'dm' ? '<span class="muted">Encrypted message · open to read</span>' : esc(String(x[2]).split('\n')[0])}</span></div>`).join('') || '<span class="muted">No messages yet.</span>'}</div>
    <div><button class="btn sm" data-hb="opench" data-arg="${c.id}">Open thread</button></div></section>`; }).join('') || locked('You are not a member of Player 1\'s threads.')}</div>
  <aside class="stack" style="gap:16px"><div class="ink-panel"><span class="eyebrow">Privacy</span><b style="font-size:20px">Always private</b><span style="font-size:13.5px;opacity:.85">Player 1's record, daily updates and threads follow his access list even when private mode is off. Every opening is logged.</span></div>
    <div class="panel"><h3>Who can see Player 1</h3><div class="stack" style="gap:6px">${PEOPLE.filter(p => p.role !== 'athlete').map(p => { const on = a.access.includes(p.id) || p.role === 'lead'; return `<label class="layer" style="justify-content:space-between"><span style="display:flex;gap:10px;align-items:center"><span class="av" style="width:28px;height:28px;font-size:11px">${p.init}</span>${esc(p.full)}</span><input type="checkbox" data-act="grant" data-arg="p1:${p.id}" ${on ? 'checked' : ''} ${perm().editAccess && p.role !== 'lead' ? '' : 'disabled'}></label>`; }).join('')}</div>
      <span class="muted" style="font-size:12.5px">${perm().editAccess ? 'Coaches on the list see his plan and status, never diagnoses or notes.' : 'Only JP changes this list.'}</span></div></aside></div>`;
}

/* Patient view: his recovery guide and his Learn page */
function pageMyFoot() {
  if (me().role === 'athlete' && !P1_VIS.plan) return `<div class="sec-head"><div><span class="eyebrow">Your recovery</span><h1>Your recovery</h1></div></div>` + p1AthleteGate('plan', '', 'Your plan and recovery');
  const T = rtSync(), p = T.p;
  return `<div class="sec-head"><div><span class="eyebrow">Your recovery</span><h1 style="font-size:34px;letter-spacing:-.6px">Your foot</h1></div></div>
  <section class="hero"><div class="stack" style="gap:10px"><span class="eyebrow">Spring ligament · right inner arch</span><span class="hero-sub" style="font-size:19px;max-width:60ch">A mild sprain of the ligament that works like a hammock under your arch. No tear, so no surgery. Yours sits at the firmer end of mild: a few weeks to settle, closer to 3 to 4 months to be fully strong.</span></div></section>
  <section class="panel"><h2>Where you are</h2><ol class="rt-rail" style="grid-template-columns:repeat(3,minmax(0,1fr))">${RT.HEAL.map((h, i) => `<li class="${p && i < p.heal ? 'done' : p && i === p.heal ? 'cur' : ''}"><span class="rt-dot">${p && i < p.heal ? '✓' : i + 1}</span><b>${h[0]}</b><span>${h[1]}</span><span>${h[2]}</span></li>`).join('')}</ol>
    <p class="muted" style="margin:0;font-size:13.5px">If progress stalls, we pause and review together with your physician. That is a planned check-in, not a setback.</p></section>
  <div class="grid2"><section class="panel"><h2>The 7-minute protocol</h2><div class="rows">${PROTO_PARTS.map(s => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${s[0]}</b> · ${s[1]}<br><span class="muted">${s[2]}</span></span></div>`).join('')}</div><p style="margin:0;font-size:13.5px">All three run together. You push into each contraction and hold your arch; that is what makes it count.</p></section>
  <section class="panel"><h2>Your week</h2><div class="rows">${[['7×', 'Padel every day; the colour tells you how hard'], ['3×', 'Weights with your trainer'], ['3×', '7-minute protocol'], ['2×', 'Rehab strengthening'], ['3×', 'Hands-on therapy'], ['2×', 'Game Ready'], ['1×', 'Active rest']].map(r => `<div class="row" style="font-size:13.5px"><b class="num" style="min-width:34px">${r[0]}</b><span class="grow">${r[1]}</span></div>`).join('')}</div></section></div>
  <section class="panel"><h2>Stop and tell us if</h2><p style="margin:0">Sharp pain on the inner arch, or the foot is more swollen or sore the next morning. Loading the foot step by step is what heals it; never use pain relief to push through and play.</p></section>`;
}
function pageLearnAthlete() {
  return `<div class="sec-head"><div><span class="eyebrow">Shared by JP and Olivia</span><h1 style="font-size:34px;letter-spacing:-.6px">Education</h1></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${P1_EDU.filter(([k]) => P1_SHARE[k]).map(([k, t, d]) => `<section class="panel"><h3>${t}</h3><p class="muted" style="margin:0;font-size:13.5px">${d}</p>${k === 'foot' ? '<button class="btn sm" data-act="focus" data-arg="spring_ligament_R">See it in 3D</button>' : k === 'seven' || k === 'phases' ? '<a class="btn sm" href="#myfoot">Read more</a>' : ''}</section>`).join('')}</div>` + eduHub('athlete');
}

/* Clinical / patient switch in the top bar */
function syncMode() {
  const pat = me().role === 'athlete';
  const c = $('#mode-clin'), p = $('#mode-pat'); if (!c) return;
  c.setAttribute('aria-pressed', !pat); p.setAttribute('aria-pressed', pat);
}
(function () {
  const c = $('#mode-clin'), p = $('#mode-pat'); if (!c) return;
  p.addEventListener('click', () => { if (me().role === 'athlete') return; store.set('lastStaff', S.me); window.__app.setMe('p1'); location.hash = 'command'; });
  c.addEventListener('click', () => { if (me().role !== 'athlete') return; window.__app.setMe(store.get('lastStaff', 'jp')); location.hash = 'player1'; });
})();

document.addEventListener('click', e => {
  const t = e.target.closest('[data-hb]'); if (!t) return;
  if (t.dataset.hb === 'opench') { S.ch = t.dataset.arg; go('messages'); }
  if (t.dataset.hb === 'injclose') { const i = INJ.find(x => x.id === t.dataset.arg); if (i) { i.status = 'Resolved'; store.set('p1inj', INJ); audit('Resolved injury', 'Player 1 · ' + i.region); keepRender(); } }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.ps;
  if (k) { P1_SHARE[k] = e.target.checked; store.set('p1share', P1_SHARE); audit(e.target.checked ? 'Shared topic' : 'Unshared topic', 'Player 1 · ' + k); keepRender(); }
  const t = e.target.dataset && e.target.dataset.pt;
  if (t) { const [k2, i] = t.split(':'); P1T.rows[k2][+i] = +e.target.value; P1T.date = TODAY_ISO; store.set('p1test', P1T); keepRender(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'injform') return; e.preventDefault();
  INJ.unshift({ id: 'i' + Date.now(), date: $('#inj-date').value, region: $('#inj-reg').value, dx: $('#inj-dx').value, mech: $('#inj-mech').value || 'Not recorded', sev: $('#inj-sev').value, status: 'Active' });
  store.set('p1inj', INJ); audit('Logged injury', 'Player 1'); toast('Injury added to Player 1\'s history'); keepRender();
});

/* ---------- Player 1 dashboard: who is on duty, which coaches are around, and today's load broken into its parts ---------- */
function p1Dash(T, cov, au, planAU) {
  const a = P1(), r = todayRec(), n = a.loads.length, rb = RT.band(a.acwr), w = p1Wellness(), t = p1Type(r);
  const ST = { duty: ['On duty', 'c-ok'], off: ['Off', 'c-muted'], leave: ['Leave', 'c-load'], sick: ['Sick', 'c-risk'], trip: ['Official trip', 'c-health'] };
  const role = { jp: 'Lead biokineticist', olivia: 'Biokineticist' };
  const duty = `<section class="panel p1d"><div class="sec-head"><div><span class="eyebrow">Today · ${TODAY.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span><h3>On duty for Player 1</h3></div><a class="btn sm" href="#calendar">Calendar</a></div>
    <div class="rows">${cov.map(c => { const st = ST[c.st] || [c.st, 'c-muted']; return `<div class="row"><span class="av">${c.s.name.slice(0, 2).toUpperCase()}</span><span class="grow"><b>${c.s.name}</b><br><span class="muted" style="font-size:12.5px">${role[c.s.id] || ''}</span></span><span class="chip ${st[1]}">${st[0]}</span></div>`; }).join('')}<div class="row"><span class="av">DR</span><span class="grow"><b>Team physician</b><br><span class="muted" style="font-size:12.5px">Receives the daily update · Player 1 access</span></span><span class="chip c-health">On call</span></div></div>
    ${cov.some(c => c.st === 'duty') ? '' : '<p class="muted" style="margin:0;color:var(--risk)">Nobody from the clinical team is on duty today. Assign cover.</p>'}</section>`;
  const coaches = DRIFT_ORDER().map(c => ({ c, p: COACH_P1[c.name] }));
  const coach = `<section class="panel p1d"><div class="sec-head"><div><span class="eyebrow">Court · coaches</span><h3>Coaches today</h3></div><a class="btn sm" href="#athletes">Team</a></div>
    <div class="rows">${coaches.map(({ c, p }) => `<div class="row"><span class="av av-img" style="background-image:url(img/${c.id}-av.webp)" aria-hidden="true"></span><span class="grow"><b>${c.name}</b><br><span class="muted" style="font-size:12.5px">${p ? p.sessions + ' sessions with Player 1 since March' : ''}</span></span><span class="chip ${c.status === 'Available' ? 'c-ok' : 'c-muted'}">${c.status === 'Available' ? 'Available' : 'Off today'}</span></div>`).join('')}</div>
    <p class="muted" style="margin:0;font-size:12.5px">Next step: the coach who runs today's session logs it here, and the minutes and effort go straight into Player 1's load.</p></section>`;
  const comp = [['Minutes on court', r.court.min ? r.court.min + ' min' : 'Not logged'], ['Session type', RT.TLABEL[t]], ['Physiological data', 'Whoop, Garmin, Polar, Suunto · added later'], ['Acute, 7-day weighted', Math.round(a.acute[n - 1]) + ' min'], ['Chronic, 28-day weighted', Math.round(a.chronic[n - 1]) + ' min'], ['Wellness flags (HRV, sleep, soreness)', w.n + ' of 3']];
  const load = `<section class="panel p1d"><div class="sec-head"><div><span class="eyebrow">Load · how it's measured</span><h3>Load today</h3></div><a class="btn sm" href="#loadlab">Detail</a></div>
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="serif num" style="font-size:52px;line-height:1">${au}</span><span class="muted">min on court · plan ${planAU} min</span><span class="chip ${rb ? rb[3] : 'c-muted'}" style="margin-left:auto">Ratio ${a.acwr.toFixed(2)}${rb ? ' · ' + rb[1] : ''}</span></div>
    <div class="mono" style="font-size:12.5px;background:var(--surface-2);border-radius:10px;padding:8px 12px">load = minutes on court · time only for now</div>
    <div class="facts">${comp.map(x => `<div><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('')}</div></section>`;
  return `<div class="p1dash">${duty}${coach}${load}</div>`;
}
