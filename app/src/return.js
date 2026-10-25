/* ---------- Return to padel (ported from the Threshold engine, Emergent build) ----------
   Engine rules follow backend/engine/metrics.py and plan_liv.py in Mc-Lovin-Creator/threshold.
   All data here is synthetic. No real patient log is bundled into this page. */
/* Plan dates: start date, pauses (sick, travel, flare-up) that push everything later, and weeks repeated on a Hold. Changing any of them rebuilds the plan. */
function rtCfg() { return Object.assign({ start: '2026-09-20', pauses: [], repeats: [] }, store.get('rt-cfg', {})); }
function makeRT(cfg) {
  const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const PLAN_START = pd(cfg.start);
  const WEEKS = 8;
  const CAPS = [[0, 60], [60, 120], [90, 160], [120, 220], [160, 280], [200, 350], [250, 420], [300, 480]];
  const HR_CAPS = [[0, 0], [0, 10], [10, 25], [20, 45], [40, 70], [60, 100], [90, 140], [120, 180]];
  const CAP_RULES = ['Protect and establish baseline', 'Technical exposure only', 'Introduce controlled movement', 'Controlled points only', 'Build padel-specific capacity', 'Progressive sets and reactive work', 'Near-normal practice exposure', 'Individualised return, match readiness confirmed'];
  // Sun-first day template: intensity, share of the weekly minutes, extras
  const TPL = [['easy', .105, ['Active rest', 'Game Ready']], ['medium', .15, ['Weights', '7-minute protocol', 'Hands-on']], ['hard', .19, ['Game Ready']], ['easy', .105, ['Weights', '7-minute protocol']], ['medium', .15, ['Hands-on', 'Rehab strength']], ['medium', .15, ['Weights', '7-minute protocol']], ['hard', .19, ['Hands-on', 'Rehab strength']]];
  const BAND = { hard: { label: 'Play hard', rpe: 8.5, range: '8 to 9', type: 'controlled', stop: 'Keep 2 points in reserve. Stop the moment the arch aches, never push through it.' },
    medium: { label: 'Medium', rpe: 6, range: '5 to 7', type: 'movement', stop: 'Keep 2 to 3 points in reserve. Back off to easy if the arch starts to ache during play.' },
    easy: { label: 'Go easy', rpe: 3.5, range: '3 to 4', type: 'lowload', stop: 'Technical only. No sprinting to wide balls, no hard decelerations. Stop at the first sign of arch ache.' } };
  const TYPES = [['recovery', 'Recovery technical', 'Serving, volleys, stationary feeds', .6], ['lowload', 'Technical low-load', 'Controlled drills, limited movement', .8], ['movement', 'Technical movement', 'Planned movement, controlled court coverage', 1], ['controlled', 'Controlled points', 'Restricted points, moderate reactive movement', 1.15], ['sets', 'Competitive sets', 'Match-like points and sets', 1.3], ['match', 'Full match', 'Unrestricted competitive play', 1.5]];
  const ACT = { hand: 'Hands-on therapy', gr: 'Game Ready', weights: 'Weights with trainer', proto: '7-minute protocol', rehabstr: 'Rehab strengthening', rest: 'Active rest' };
  const STDW = [['hand', 'gr'], ['weights', 'proto'], ['hand', 'rehabstr'], ['weights', 'proto'], ['hand', 'rehabstr', 'gr'], ['weights', 'proto'], ['rest']];
  const WEEKPLAN = [[['hand', 'gr'], ['weights', 'proto'], ['hand', 'rehabstr'], ['proto'], ['hand'], ['weights', 'proto'], ['rest', 'gr']], [['hand', 'gr'], ['weights', 'proto'], ['hand', 'rehabstr'], ['proto', 'rehabstr'], ['hand', 'rehabstr', 'gr'], ['weights', 'proto'], ['rest']], STDW, STDW, STDW, STDW, STDW, STDW];
  const P = { h: 'hard', m: 'medium', e: 'easy' }, C = s => s.split('').map(c => P[c]);
  const COLOURS = { 1: C('eeeeeem'), 2: C('memmmem'), 3: C('hememeh'), 4: C('hememeh'), 5: C('hmhmhmh'), 6: C('hmhmhmh'), 7: C('hmhmhmh'), 8: C('hhhhhhh') };
  const HEAL = [['Calm it down', 'Days 0 to 5', 'Settle the irritation; protect the arch; gentle movement'], ['Rebuild', '2 days to 6 weeks', 'Controlled, gradual loading; no full court loads yet'], ['Get strong', '6 to 12 weeks', 'Progressive strength and impact work; the longest phase']];
  const HEAL_BY_WEEK = [0, 1, 1, 1, 2, 2, 2, 2];
  const MULT = Object.fromEntries(TYPES.map(t => [t[0], t[3]]));
  const TLABEL = Object.fromEntries(TYPES.map(t => [t[0], t[1]]));
  const PHASES = [['Protect', 'Maintain skill with minimal foot stress', 'Walking without a limp; pain and swelling controlled'], ['Reintroduce', 'Controlled technical contact', 'Symptoms back to baseline by the next morning'], ['Build', 'Planned multidirectional movement', 'Controlled lateral movement tolerated'], ['Integrate', 'Reactive movement and controlled points', 'Hopping and landing progression tolerated'], ['Perform', 'Match-specific conditioning', 'Stable function under fatigue; no symptom escalation'], ['Return', 'Full practice and match play', 'Function restored, symptoms settled, confidence back, clinician clearance']];
  const RATIO = [[.8, 'De-load or reduced exposure', 'Check whether this is planned recovery or underloading.', 'c-load'], [1.1, 'Stable build', 'Continue if symptoms are green.', 'c-ok'], [1.25, 'Moderate rise', 'Do not increase high-risk minutes next week.', 'c-warn'], [99, 'Large rise', 'Hold or reduce load; inspect the sessions causing the spike.', 'c-risk']];
  const RMOD = { GREEN: 1, AMBER: .85, RED: .7 };

  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function status(s, readiness) {
    const fss = s.rest + s.during + s.morning + s.stiff + s.swell, trig = [];
    if (s.during >= 4) trig.push('Pain during play 4/10 or more');
    if (s.rest >= 4) trig.push('Pain at rest 4/10 or more');
    if (s.limp) trig.push('New limp');
    if (s.instab) trig.push('Instability or sharp pain');
    if (s.swell >= 2) trig.push('Moderate or severe swelling');
    if (fss >= 10) trig.push('Foot symptom score 10 or more');
    if (trig.length) return { st: 'RED', mod: .6, fss, trig, head: 'No high-impact padel today', act: 'Enter the de-load and clinical review pathway. Rehab, cycling or pool if tolerated.' };
    if (fss >= 6) trig.push('Foot symptom score 6 to 9');
    if (s.morning >= 3) trig.push('Next-morning pain 3/10 or more');
    if (readiness === 'AMBER' || readiness === 'RED') trig.push(readiness === 'RED' ? 'All three wellness flags (HRV, sleep, soreness)' : 'Wellness flag (HRV, sleep or soreness)');
    if (trig.length) return { st: 'AMBER', mod: .75, fss, trig, head: "Modify today's session", act: 'Cut padel load by 20 to 30%. No match play or maximal cutting; swap competitive points for controlled drills.' };
    return { st: 'GREEN', mod: 1, fss, trig, head: 'Train as planned', act: 'Follow the colour for today and keep the stop rule.' };
  }

  // build the plan and a synthetic history (28-day baseline + plan days up to yesterday)
  const days = [];
  const levels = []; for (let w = 1; w <= WEEKS; w++) { levels.push(w); for (let k = 0; k < (cfg.repeats || []).filter(x => x === w).length; k++) levels.push(w); }
  const pauses = (cfg.pauses || []).map(p => [p.from, p.to || p.from, p.why || 'Pause']);
  const pausedOn = s => pauses.find(p => s >= p[0] && s <= p[1]);
  for (let i = -42; i < 0; i++) { const d = addD(PLAN_START, i); days.push({ d, iso: iso(d), plan: null }); }
  let cur = new Date(PLAN_START);
  const slots = [];
  for (let li = 0; li < levels.length; li++) for (let k = 0; k < 7; k++) {
    while (pausedOn(iso(cur))) { slots.push({ d: new Date(cur), pause: pausedOn(iso(cur))[2] }); cur = addD(cur, 1); }
    slots.push({ d: new Date(cur), w: levels[li] - 1, seq: li + 1 }); cur = addD(cur, 1);
  }
  const END = addD(cur, -1);
  const padTo = addD(new Date(Math.max(END.getTime(), (typeof TODAY !== 'undefined' ? TODAY : new Date()).getTime())), 28);
  while (cur <= padTo) { slots.push({ d: new Date(cur), after: true }); cur = addD(cur, 1); }
  for (const sl of slots) {
    const d = sl.d, w = sl.w;
    let plan = null;
    if (sl.pause) { days.push({ d, iso: iso(d), plan: null, pause: sl.pause }); continue; }
    if (sl.after) { days.push({ d, iso: iso(d), plan: null, after: true }); continue; }
    {
      const cap = (CAPS[w][0] + CAPS[w][1]) / 2, hr = (HR_CAPS[w][0] + HR_CAPS[w][1]) / 2;
      // Week-by-week colours and activities from Player 1's own app (fascia-body-flow, recoveryGuideData)
      const dow = d.getDay(), acts = WEEKPLAN[w][dow], band = acts.includes('rest') ? 'easy' : COLOURS[w + 1][dow];
      const share = x => ({ hard: .19, medium: .15, easy: .105 })[x];
      const tw = COLOURS[w + 1].reduce((a, x, k) => a + share(WEEKPLAN[w][k].includes('rest') ? 'easy' : x), 0), b = BAND[band];
      const min = Math.round(cap * share(band) / tw);
      plan = { week: w + 1, seq: sl.seq, band, min, hr: band === 'easy' ? 0 : Math.round(hr * share(band) / tw), type: b.type, au: min, extras: ['Treatment', ...acts.map(a => ACT[a])], heal: HEAL_BY_WEEK[w] };
    }
    days.push({ d, iso: iso(d), plan });
  }
  function seedHistory(todayIso) {
    seed = 7;
    /* on the team server nothing is generated: a past day has data only if a session was logged */
    if (LIVE) for (const x of days) x.done = null;
    else for (const x of days) {
      if (x.iso >= todayIso) { x.done = null; continue; }
      const p = x.plan, base = p ? p.min : 18 + rnd() * 14;
      const min = Math.max(0, Math.round(base * (.82 + rnd() * .3)));
      const rpe = p ? Math.max(2, Math.min(9, Math.round(BAND[p.band].rpe + (rnd() - .5) * 2))) : Math.round(3 + rnd() * 2);
      const type = p ? p.type : 'recovery';
      const k = rnd();
      const sym = { rest: k > .9 ? 2 : k > .6 ? 1 : 0, during: k > .9 ? 3 : k > .55 ? 1 : 0, morning: k > .97 ? 3 : k > .5 ? 1 : 0, stiff: k > .75 ? 2 : 1, swell: k > .992 ? 2 : k > .85 ? 1 : 0, limp: false, instab: false };
      x.done = { min, rpe, type, sym, au: min };
      if (x.pause) x.done = { min: 0, rpe: 0, type: 'recovery', sym, au: 0 };
      x.s = status(sym, 'GREEN');
    }
    const ov = (typeof store !== 'undefined' ? store.get('p1sess', {}) : {});
    for (const x of days) { const o = ov[x.iso]; if (o && x.iso < todayIso) { const sym = (x.done && x.done.sym) || { rest: 0, during: 0, morning: 0, stiff: 1, swell: 0, limp: false, instab: false }; x.done = { min: +o.min || 0, rpe: +o.rpe || 0, type: o.type || 'movement', sym, au: Math.round(+o.min || 0), logged: true, note: o.note || '' }; x.s = x.s || status(sym, 'GREEN'); } }
  }
  function sums(idx) {
    const win = n => days.slice(Math.max(0, idx - n + 1), idx + 1).reduce((a, x) => a + (x.done ? x.done.au : 0), 0);
    const a7 = win(7), c = win(28) / 4;
    return { a7, c, r: c > 0 && idx >= 20 ? a7 / c : null };
  }
  const band = r => r == null ? null : RATIO.find(b => r <= b[0]);
  function weekly(w) {
    const wd = days.filter(x => x.plan && x.plan.week === w && x.done);
    if (!wd.length) return null;
    const reds = wd.filter(x => x.s.st === 'RED').length, ambers = wd.map(x => x.s.st === 'AMBER');
    let consec = 0, run = 0; ambers.forEach(a => { run = a ? run + 1 : 0; consec = Math.max(consec, run); });
    const maxM = Math.max(...wd.map(x => x.done.sym.morning)), maxF = Math.max(...wd.map(x => x.s.fss));
    const r = sums(days.indexOf(wd[wd.length - 1])).r;
    if (reds) return ['Stop', 'c-risk', 'Clinical review: ' + reds + ' red day' + (reds > 1 ? 's' : '') + ' this week'];
    if (maxM >= 3 || maxF >= 10) return ['Hold', 'c-warn', 'Modify: next-morning pain reached ' + maxM + '/10'];
    if (consec >= 2) return ['Hold', 'c-warn', 'Modify: ' + consec + ' amber days in a row'];
    if (r != null && r > 1.1) return ['Hold', 'c-warn', 'Load ratio ' + r.toFixed(2) + ' above 1.10'];
    return ['Progress', 'c-ok', 'Symptoms green and load stable'];
  }
  return { HEAL, ACT, PLAN_START, END, LEVELS: levels, cfg, WEEKS, CAPS, HR_CAPS, CAP_RULES, BAND, TYPES, MULT, TLABEL, PHASES, RATIO, RMOD, days, status, seedHistory, sums, band, weekly, iso };
}
let RT = makeRT(rtCfg());
function rtRebuild(cfg) { store.set('rt-cfg', cfg); RT = makeRT(cfg); RT.seedHistory(TODAY_ISO); }

/* ---------- Player 1: one data source for Today, Return plan and Load ---------- */
const RS_SAVED = store.get('rt-today', {}) || {};
/* today's symptom check-in; yesterday's answers never carry over */
const RS = Object.assign({ rest: 1, during: 1, morning: 1, stiff: 1, swell: 0, limp: false, instab: false }, RS_SAVED.at === TODAY_ISO ? RS_SAVED : {});
RT.seedHistory(TODAY_ISO);
const P1_STATUS = { GREEN: 'Ready', AMBER: 'Modify', RED: 'Hold' };
const RT_STW = { GREEN: ['Ready', 'c-ok'], AMBER: ['Modify', 'c-warn'], RED: ['Hold', 'c-risk'] };

function p1Wellness() {
  const a = ATH.find(x => x.id === 'p1');
  const rules = [['HRV more than 10% under baseline', a.hrv != null && a.hrv < -10, a.hrv + '%'], ['Sleep under 6 h', !!a.sleep && parseInt(a.sleep) < 6, a.sleep], ['Soreness 6 or more out of 10', a.sore != null && a.sore >= 6, a.sore + '/10']];
  /* no data is not a green light: with no wearable and no check-in today the day is treated as Modify until someone checks in */
  if (LIVE && RS.at !== TODAY_ISO) rules.push([a.hrv == null && a.sleep == null ? 'No wellness data or check-in today' : 'No symptom check-in today', true, '—']);
  const n = rules.filter(r => r[1]).length;
  return { rules, n, band: n >= 3 ? 'RED' : n ? 'AMBER' : 'GREEN' };
}
const p1Type = r => r.court.type || 'movement';
/* load is time on court only for now; physiological data (Whoop, Garmin, Polar, Suunto) is added later */
const p1AU = r => Math.round(r.court.min || 0);
function rtToday() {
  let idx = RT.days.findIndex(x => x.iso === TODAY_ISO); if (idx < 0) { RT.days.unshift({ d: TODAY, iso: TODAY_ISO, plan: null }); idx = 0; }
  const day = RT.days[idx], w = p1Wellness();
  const s = RT.status(RS, w.band), p = day && day.plan, inc = todayRec().court.inc;
  if (inc) { s.trig.push('Incident logged in today\'s session'); if (s.st === 'GREEN') Object.assign(s, { st: 'AMBER', mod: .75, head: 'Review after today\'s incident', act: 'A clinician checks the foot before the next court session.' }); }
  const ar = (typeof P1 === 'function' && P1() && !P1().noLoad && P1().acwr) || 0;
  if (ar > 1.25 && s.st !== 'RED') { s.trig.push('Load ratio ' + ar.toFixed(2) + ' above 1.25'); if (s.st === 'GREEN') Object.assign(s, { st: 'AMBER', mod: .75, head: "Modify today's session", act: 'Load ratio above 1.25: reduce minutes and hold progression.' }); }
  const mins = p && s.st !== 'RED' ? Math.round(p.min * s.mod * RT.RMOD[w.band]) : 0;
  /* effective band: an AMBER day drops one effort band, so the headline never says "play hard" on a modified day */
  let eb = !p ? null : s.st === 'AMBER' ? (p.band === 'hard' ? 'medium' : 'easy') : p.band;
  /* carry-over from his own choice yesterday */
  const y = new Date(TODAY); y.setDate(y.getDate() - 1); const cy = p1Carry(DAILY[ISO(y)]);
  let m2 = mins;
  if (cy && p && s.st !== 'RED') { m2 = Math.round(mins * (1 - cy.cut)); if (cy.drop) eb = BDOWN_(eb); s.trig.push(cy.why); if (s.st === 'GREEN') Object.assign(s, { st: 'AMBER', head: 'Adjusted after yesterday', act: 'Plan adapted to what he actually played yesterday.' }); }
  return { idx, day, s, p, mins: m2, w, eb, cy };
}
/* Feed Player 1's 42-day load (EWMA, monotony, strain) from the return-plan history plus today's logged court session */
function rtSync() {
  const a = ATH.find(x => x.id === 'p1'), T = rtToday(), r = todayRec();
  T.day.done = r.court.min > 0 ? { min: r.court.min, rpe: r.court.rpe, type: p1Type(r), sym: Object.assign({}, RS), au: p1AU(r) } : null;
  T.day.s = T.s;
  a.loads = RT.days.slice(Math.max(0, T.idx - 41), T.idx + 1).map(x => x.done ? x.done.au : 0); while (a.loads.length < 42) a.loads.unshift(0);
  const la = 2 / 8, lc = 2 / 29; let ac = a.loads[0], ch = a.loads[0]; a.acute = []; a.chronic = [];
  for (const v of a.loads) { ac = v * la + (1 - la) * ac; ch = v * lc + (1 - lc) * ch; a.acute.push(ac); a.chronic.push(ch); }
  a.acwr = +(a.acute[41] / a.chronic[41]).toFixed(2);
  /* the ratio needs history: fewer than 14 logged days in the last 28 and it is not shown or used */
  a.noLoad = a.loads.slice(-28).filter(v => v > 0).length < 14; if (a.noLoad || !isFinite(a.acwr)) a.acwr = 0;
  if (LIVE) liveP1(a);
  const wk = a.loads.slice(-8, -1), mean = wk.reduce((x, y) => x + y, 0) / 7, sd = Math.sqrt(wk.reduce((x, y) => x + (y - mean) ** 2, 0) / 7);
  a.week = Math.round(mean * 7); a.monotony = +(mean / (sd || 1)).toFixed(2); a.strain = Math.round(a.week * a.monotony);
  a.status = P1_STATUS[T.s.st]; if (!LIVE || RS.at === TODAY_ISO) a.sore = Math.max(RS.rest, RS.during, RS.morning) > a.sore ? Math.max(RS.rest, RS.during, RS.morning) : a.sore;
  a.plan = T.p ? (T.s.st === 'RED' ? 'No high-impact padel; rehab, bike or pool' : RT.BAND[T.p.band].label + ', ' + T.mins + ' min, ' + RT.TLABEL[T.p.type].toLowerCase()) : a.plan;
  return T;
}

/* Player 1 on the team server: his case comes from the clinician-entered profile, wellness from his wearable (WHOOP) */
function liveP1(a) {
  let inj = null; try { inj = INJ.find(i => i.status === 'Active'); } catch (e) { inj = (store.get('p1inj', []) || []).find(i => i.status === 'Active'); }   /* INJ may not exist yet on first load */
  const ups = UPDATES.filter(u => u.ath === 'p1');
  a.case = inj ? { region: inj.region, dx: inj.dx || inj.mech, stage: (ups[0] && ups[0].stage) || 'Assess', pain: ups.map(u => +u.pain).reverse(), since: inj.date, structure: inj.structure || null, next: (ups[0] && ups[0].plan) || '' } : null;
  let W; try { W = WEAR; } catch (e) { W = store.get('wear', {}); } W = W || {}; const days = Object.keys(W).sort(), last = days[days.length - 1];
  const today = last && (new Date(TODAY) - new Date(last)) / 864e5 <= 1 ? W[last] : null;
  const base = days.slice(-29, -1).map(d => W[d] && W[d].hrv).filter(v => v != null);
  a.hrv = today && today.hrv != null && base.length >= 7 ? Math.round((today.hrv / (base.reduce((x, y) => x + y, 0) / base.length) - 1) * 100) : null;
  a.sleep = today && today.sleep != null ? Math.floor(today.sleep) + 'h ' + String(Math.round(today.sleep % 1 * 60)).padStart(2, '0') : null;
  a.device = days.length ? 'Wearable synced ' + last : 'No wearable connected';
}
function rtGlyph(st, size) {
  const s = size || 12, c = st === 'RED' ? 'var(--risk)' : st === 'AMBER' ? 'var(--warn)' : 'var(--ok)';
  const inner = st === 'RED' ? `<rect x="3.4" y="6.9" width="9.2" height="2.2" rx="1" fill="${c}"/>` : st === 'AMBER' ? `<path d="M3.6 12.4 12.4 3.6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` : `<circle cx="8" cy="8" r="2.9" fill="${c}"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" role="img" aria-label="${RT_STW[st][0]}"><rect x=".8" y=".8" width="14.4" height="14.4" rx="4" fill="none" stroke="${c}" stroke-width="1.6"/>${inner}</svg>`;
}
const rtInt = b => `<span class="int int-${b}" aria-label="${RT.BAND[b].label}"><i></i><i></i><i></i></span>`;

/* Today's light, shared by the Today hero and the athlete's own view */
function p1Hero(T, extra) {
  const { s, p, mins } = T, B = RT.BAND[p.band];
  return `<section class="hero rt-hero"><div class="stack" style="gap:12px"><span class="eyebrow">Player 1 · return to padel · week ${p.week} of ${RT.WEEKS} · ${TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    <div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap"><span class="big" style="font-size:clamp(52px,7vw,92px)">${s.st === 'RED' ? 'Rest the arch' : s.st === 'AMBER' ? 'Modify · ' + RT.BAND[T.eb].label : B.label}</span>${s.st === 'RED' ? '' : rtInt(p.band)}<span class="chip ${RT_STW[s.st][1]}">${RT_STW[s.st][0]}</span></div>
    <span class="hero-sub" style="font-size:17px;max-width:62ch">${s.st === 'RED' ? esc(s.act) : `${mins} minutes on court, effort ${RT.BAND[T.eb || p.band].range} out of 10, ${RT.TLABEL[p.type].toLowerCase()}. ${s.st === 'AMBER' ? 'No match play. ' : ''}${esc(B.stop)}`}</span>${extra || ''}</div>
    <div class="rt-today-num"><span class="eyebrow">Court today</span><span class="serif num" style="font-size:64px;line-height:1">${mins}</span><span class="muted">minutes · ${mins !== p.min ? 'cut from ' + p.min + ' planned' : 'as planned'}</span></div></section>`;
}

/* Morning check-in, step 1 of Today */
function p1CheckIn(T) {
  const { s, w } = T;
  const sl = (k, label, max) => `<label class="range rt-sl">${label}<span class="num rt-v">${RS[k]}</span><input type="range" min="0" max="${max}" step="1" value="${RS[k]}" data-rs="${k}"></label>`;
  return `<div class="rt-grid">${sl('rest', 'Pain at rest', 10)}${sl('during', 'Pain during last play', 10)}${sl('morning', 'Next-morning pain', 10)}${sl('stiff', 'Stiffness', 10)}${sl('swell', 'Swelling (0 none to 3 severe)', 3)}</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap"><label class="layer"><input type="checkbox" data-rs="limp" ${RS.limp ? 'checked' : ''}> New limp</label><label class="layer"><input type="checkbox" data-rs="instab" ${RS.instab ? 'checked' : ''}> Instability or sharp pain</label></div>
    <div class="rows">${w.rules.map(x => `<div class="row" style="font-size:13.5px;min-height:38px"><span class="grow">${x[0]} <span class="muted">· Oura</span></span><b class="num">${esc(x[2])}</b><span class="chip plain ${x[1] ? 'c-warn' : 'c-ok'}">${x[1] ? 'Flag' : 'OK'}</span></div>`).join('')}</div>
    <div class="rt-verdict" ${me().role === 'athlete' && !P1_VIS.today ? 'hidden' : ''}><div><span class="eyebrow">Foot symptom score</span><span class="serif num" style="font-size:44px;line-height:1">${s.fss}</span><span class="muted" style="font-size:12px">Modify at 6, Hold at 10</span></div>
      <div class="stack" style="gap:6px"><b>${esc(s.head)}</b><span style="font-size:14px">${esc(s.act)}</span>${s.trig.length ? `<span class="muted" style="font-size:12.5px">Because: ${s.trig.map(esc).join(' · ')}</span>` : ''}<span class="muted" style="font-size:12.5px">Hard stop rules override every number in the app. The clinician makes the final call.</span></div></div>`;
}

/* Return plan tab (clinical) and the athlete's own view */
function pageReturn() {
  if (me().role !== 'athlete') { const g = p1Gate(); if (g) return g; }
  const T = rtSync(), { idx, p } = T;
  if (!p) return `<section class="hero"><div class="stack"><span class="eyebrow">Return to padel</span><span class="big">No active plan today</span></div></section>`;
  const athlete = me().role === 'athlete';
  if (athlete) return p1AthleteToday(T) + `<section class="panel" style="gap:16px"><div class="sec-head"><h2>Your morning check-in</h2><span class="muted" style="font-size:13px">JP and Olivia see this before your session</span></div>${p1CheckIn(T)}</section>` + `<div class="grid2"><section class="panel"><h2>Also today</h2><div class="pills">${p.extras.map(e => `<span class="pill" aria-pressed="false">${esc(e)}</span>`).join('')}</div><p class="muted" style="margin:0">Loading the foot step by step is what heals it. Support tools help you feel better; they are never a reason to push through pain.</p></section>
    <aside class="panel"><h3>Your foot</h3><p class="muted" style="margin:0">Healing phase: <b style="color:var(--ink)">${RT.HEAL[p.heal][0]}</b>. How it heals, your week and the stop rules.</p><a class="btn primary" href="#myfoot">Your recovery</a></aside></div>`;
  const wk = p.week, phase = Math.min(6, Math.max(1, Math.ceil(wk * 6 / 8)));
  const wkRows = Array.from({ length: RT.WEEKS }, (_, i) => { const w = RT.weekly(i + 1); return `<tr ${i + 1 === wk ? 'class="rt-cur"' : ''}><td style="white-space:nowrap"><b>Week ${i + 1}</b></td><td class="num" style="white-space:nowrap">${RT.CAPS[i][0]}–${RT.CAPS[i][1]}</td><td class="num" style="white-space:nowrap">${RT.HR_CAPS[i][0]}–${RT.HR_CAPS[i][1]}</td><td>${RT.CAP_RULES[i]}</td><td style="min-width:190px">${w && i + 1 < wk ? `<span class="chip plain ${w[1]}">${w[0]}</span><br><span class="muted" style="font-size:12px;white-space:normal">${w[2]}</span>` : i + 1 === wk ? '<span class="chip plain c-muted">This week</span>' : '<span class="muted">Ahead</span>'}</td></tr>`; }).join('');
  return p1Head('return', 'Return plan', 'right inner arch · ' + RT.WEEKS + '-week graded return') + rtDates() + `
  <section class="panel" style="gap:18px"><div class="sec-head"><h2>Clinical gate</h2><span class="muted" style="font-size:13px">Phase ${phase} of 6 · the clinician moves the gate, not the calendar</span></div>
    <ol class="rt-rail">${RT.PHASES.map((ph, i) => `<li class="${i + 1 < phase ? 'done' : i + 1 === phase ? 'cur' : ''}"><span class="rt-dot">${i + 1 < phase ? '✓' : i + 1}</span><b>${ph[0]}</b><span>${ph[1]}</span></li>`).join('')}</ol>
    <p style="margin:0;font-size:13.5px"><span class="eyebrow">To pass phase ${phase}</span> ${esc(RT.PHASES[phase - 1][2])}</p>
    <div class="facts"><div><span>Healing phase</span><span><b>${RT.HEAL[p.heal][0]}</b> · ${RT.HEAL[p.heal][1]} · ${RT.HEAL[p.heal][2]}</span></div>
      <div><span>Not improving?</span><span>Planned check-in, not a setback: if progress stalls between rebuild and strength despite the rehab, review with the physician (scan, specialist opinion, next options).</span></div></div></section>
  ${rtRibbon(idx)}
  <section class="panel"><div class="sec-head"><h2>Weekly decision</h2><span class="muted" style="font-size:13px">Court minutes and high-risk minutes never rise in the same week</span></div>
    ${rtStairs(wk)}
    <details class="rt-tbl"><summary>Show as a table</summary><div class="table-wrap"><table><thead><tr><th>Week</th><th>Court min</th><th>High-risk min</th><th>Rule</th><th>Decision</th></tr></thead><tbody>${wkRows}</tbody></table></div></details></section>
  ${rtExtras()}`;
}
/* the 8-week staircase: each week's court-minute cap as a column, high-risk minutes inside it, the decision under it */
function rtStairs(wk) {
  const top = RT.CAPS[RT.CAPS.length - 1][1];
  return `<div class="stairs">${RT.CAPS.map((c, i) => { const w = RT.weekly(i + 1), cur = i + 1 === wk, past = i + 1 < wk, hr = RT.HR_CAPS[i];
    return `<div class="st-col${cur ? ' cur' : ''}${past ? ' past' : ''}" style="--d:${i * 70}ms"><div class="st-bar"><span class="st-range" style="bottom:${c[0] / top * 100}%;height:${Math.max(2, (c[1] - c[0]) / top * 100)}%"></span><span class="st-hr" style="height:${hr[1] / top * 100}%"></span></div>
      <b>Week ${i + 1}</b><span class="num">${c[0]}–${c[1]} min</span><span class="muted">${hr[1] ? hr[0] + '–' + hr[1] + ' high-risk' : 'no high-risk'}</span>${past && w ? `<span class="chip plain ${w[1]}">${w[0]}</span>` : cur ? '<span class="chip c-ok">This week</span>' : '<span class="muted">Ahead</span>'}${(past || cur) && perm().clinical ? `<button class="btn sm st-rep" data-rtc="rep" data-arg="${i + 1}" title="Repeat this week; every later date moves back 7 days">Repeat</button>` : ''}</div>`; }).join('')}</div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Court minutes allowed</span><span><i style="background:var(--warn)"></i>High-risk minutes allowed</span></div>`;
}
const P1_MENU = [
  ['Essential', 'Calf, arch and ankle strengthening', '3 to 4 days a week; 3 × 12 to 15 early, single-leg and heavier (3 to 4 × 6 to 12) by weeks 5 to 6; pain 2/10 or less'],
  ['Essential', 'Intrinsic foot strengthening', 'Daily; short-foot and toe work, 3 × 8 to 12 with holds; sitting, then standing, then single-leg'],
  ['Essential', 'Balance and control', 'Most days; 3 × 30 to 45 s; single-leg, head turns, reaches, controlled landings'],
  ['Essential', 'Gradual return to impact', 'From weeks 3 to 4, 2 days a week, 48 h apart; low hops to bounds, deceleration and cutting; progress only with no next-day flare'],
  ['Essential', 'Arch support and awareness', '10 min each morning; taping or insoles discussed separately'],
  ['Essential', 'Hands-on therapy', '3 to 4 times a week early, tapering by weeks 3 to 6; always followed straight away by active exercise'],
  ['Helpful', 'Compex muscle stimulation', 'About 20 min, 3 to 4 days a week on the calf; taper as normal loading takes over'],
  ['Helpful', 'Load monitoring (wearable or insole)', 'Every session; weekly review of load and left-right differences'],
  ['Helpful', 'Bike or pool fitness', '2 to 4 × 20 to 40 min, easy to moderate, pain-free during and next morning'],
  ['Helpful', 'Game Ready, contrast, red light, TECAR', 'Comfort and recovery tools; none of them heals the ligament'],
  ['Optional', 'Therapeutic ultrasound', 'Weak evidence for this injury; not a priority']];
function p1Menu() { return txCards(P1_MENU); }

function rtRibbon(idx) {
  const from = Math.max(0, idx - 20), win = RT.days.slice(from, idx + 22);
  const peak = Math.max(1, ...win.map(x => x.done ? x.done.au : x.plan ? x.plan.au : 0));
  return `<section class="panel" style="gap:12px"><div class="sec-head"><h2>Ledger</h2><span class="muted" style="font-size:13px">Done behind, prescribed ahead · tap a day</span></div>
  <div class="rt-ribbon" id="rt-ribbon">${win.map(x => {
    const today = x.iso === TODAY_ISO, fut = x.iso > TODAY_ISO || (today && !x.done), au = x.done ? x.done.au : 0, pl = x.plan;
    const lab = fut ? (pl ? `${pl.min} minutes planned, ${RT.BAND[pl.band].label}` : 'no plan') : `${RT_STW[x.s.st][0]}, ${x.done.min} minutes`;
    return `<button type="button" class="rt-cell ${fut ? 'fut' : ''} ${today ? 'today' : ''}" data-rt="day" data-arg="${x.iso}" aria-label="${x.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${lab}">
      ${today ? '<span class="rt-cap">Today</span>' : ''}<span class="rt-dow">${'SMTWTFS'[x.d.getDay()]}</span><span class="num rt-dn">${x.d.getDate()}</span>
      <span class="rt-load"><i style="width:${Math.min(100, (fut ? (pl ? pl.au : 0) : au) / peak * 100)}%"></i></span>
      <span class="rt-bar">${fut ? (pl ? rtInt(pl.band) : '') : rtGlyph(x.s.st, 10)}</span></button>`;
  }).join('')}</div>
  <div class="legend" style="display:flex;gap:16px;flex-wrap:wrap"><span>${rtGlyph('GREEN', 10)} Ready</span><span>${rtGlyph('AMBER', 10)} Modify</span><span>${rtGlyph('RED', 10)} Hold</span><span>${rtInt('hard')} Play hard</span><span>${rtInt('medium')} Medium</span><span>${rtInt('easy')} Go easy</span></div>
  <div id="rt-day" class="muted" style="font-size:13.5px">${rtDayLine(RT.days[idx])}</div></section>`;
}
function rtDayLine(x) {
  if (!x) return '';
  const dl = x.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (x.done) return `<b>${dl}</b> · ${x.done.min} min · RPE ${x.done.rpe} · ${RT.TLABEL[x.done.type]} · ${x.done.au} AU · ${RT_STW[x.s.st][0]}, foot score ${x.s.fss}${x.plan ? ' · plan was ' + x.plan.min + ' min ' + RT.BAND[x.plan.band].label.toLowerCase() : ''}`;
  if (x.plan) return `<b>${dl}</b> · plan ${x.plan.min} min · ${RT.BAND[x.plan.band].label} · ${RT.TLABEL[x.plan.type]} · ${x.plan.extras.join(', ')}`;
  return `<b>${dl}</b> · no plan`;
}
function rtCentre() { const r = $('#rt-ribbon'), t = r && r.querySelector('.today'); if (r && t) r.scrollLeft = t.offsetLeft - r.clientWidth / 2 + t.offsetWidth / 2; }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-rt]'); if (!t) return;
  if (t.dataset.rt === 'day') { const x = RT.days.find(d => d.iso === t.dataset.arg); const el = $('#rt-day'); if (el) el.innerHTML = rtDayLine(x); document.querySelectorAll('.rt-cell').forEach(c => c.classList.toggle('sel', c === t)); }
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.rs; if (!k) return;
  RS[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
  RS.at = TODAY_ISO;
  store.set('rt-today', RS); const r = todayRec(); r.sent = false;
  if (e.target.type === 'range') { const v = e.target.parentElement.querySelector('.rt-v'); if (v) v.textContent = RS[k]; }
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.rs) keepRender(); });

rtSync();
