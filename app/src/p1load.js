/* ---------- Player 1 load: his simple view (today's minutes, his load, log a session by date) and the clinical tools (session log, plan dates). Any change rebuilds the plan and the load numbers ---------- */
const P1L = { form: null };
const simpleTypes = [['lowload', 'Technical'], ['movement', 'Movement drills'], ['controlled', 'Controlled points'], ['sets', 'Sets'], ['match', 'Match'], ['recovery', 'Recovery hit']];
function p1Sessions() { return store.get('p1sess', {}); }
function p1SaveSession(iso, s) {
  if (iso === TODAY_ISO) { const r = todayRec(); r.court.min = +s.min || 0; r.court.rpe = +s.rpe || 0; r.court.type = s.type; store.set('daily', DAILY); }
  else { const all = p1Sessions(); if (s === null) delete all[iso]; else all[iso] = s; store.set('p1sess', all); }
  RT.seedHistory(TODAY_ISO); rtSync(); audit('Logged a court session', iso);
}
function p1DayLoad(x) { if (x.iso === TODAY_ISO) { const r = todayRec(); return r.court.min ? p1AU(r) : 0; } return x.done ? x.done.au : 0; }
/* simple 14-day chart for Player 1: bars done, outlines for what is planned */
function p1MiniChart(T) {
  const i0 = Math.max(0, T.idx - 13), win = RT.days.slice(i0, T.idx + 8), W = 640, H = 150;
  const vals = win.map(x => x.iso <= TODAY_ISO ? p1DayLoad(x) : (x.plan ? x.plan.au : 0)), mx = Math.max(1, ...vals, ...win.map(x => x.plan ? x.plan.au : 0)) * 1.1, bw = W / win.length;
  return `<svg class="p1mini" viewBox="0 0 ${W} ${H + 22}" aria-label="Your load, last two weeks and the week ahead">${win.map((x, i) => { const v = vals[i], h = v / mx * H, fut = x.iso > TODAY_ISO, today = x.iso === TODAY_ISO, pl = x.plan ? x.plan.au / mx * H : 0;
    return `<g style="--d:${i * 25}ms">${!fut && pl ? `<rect x="${(i * bw + bw * .16).toFixed(1)}" y="${(H - pl).toFixed(1)}" width="${(bw * .68).toFixed(1)}" height="${pl.toFixed(1)}" rx="4" class="pm-plan"/>` : ''}<rect x="${(i * bw + bw * .16).toFixed(1)}" y="${(H - (fut ? pl : h)).toFixed(1)}" width="${(bw * .68).toFixed(1)}" height="${(fut ? pl : h).toFixed(1)}" rx="4" class="${fut ? 'pm-fut' : today ? 'pm-today' : 'pm-done'}"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 16}" text-anchor="middle" class="pm-l${today ? ' t' : ''}">${today ? 'Today' : x.d.getDate()}</text></g>`; }).join('')}</svg>
    <div class="legend"><span><i style="background:var(--health)"></i>Done</span><span><i style="background:transparent;border:1.5px dashed var(--ink-3)"></i>Planned</span></div>`;
}
function p1LogForm(scope) {
  const f = P1L.form || { date: TODAY_ISO, type: 'movement', min: '', rpe: '' };
  return `<form class="p1log" data-p1l="save"><label class="field">Date<input type="date" name="date" value="${f.date}" max="${TODAY_ISO}" required></label>
    <label class="field">Session<select name="type">${simpleTypes.map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field">Minutes on court<input type="number" name="min" min="0" max="300" value="${f.min}" required></label>
    <label class="field">How hard (0 to 10)<input type="number" name="rpe" min="0" max="10" value="${f.rpe}" required></label>
    <button class="btn primary" type="submit">${scope === 'athlete' ? 'Save my session' : 'Save session'}</button></form>`;
}
/* Player 1's own view of today and his load */
function p1AthleteToday(T) {
  return (P1_VIS.today ? p1AthleteHero(T) : p1AthleteGate('today', '', 'Today\'s court time')) + `<div class="grid2">${p1AthleteGate('load', `<section class="panel"><div class="sec-head"><h2>Your load</h2><span class="muted" style="font-size:13px">Last two weeks and the week ahead</span></div>${p1MiniChart(T)}<p class="muted" style="margin:0;font-size:13px">Load is your minutes on court. Your team adjusts the plan from it.</p></section>`, 'Your load')}<section class="panel"><div class="sec-head"><h2>Log a session</h2><span class="muted" style="font-size:13px">Missed one? Pick the date</span></div>${p1LogForm('athlete')}<p class="muted" style="margin:0;font-size:13px">Your team sees it straight away.</p></section></div>` + (P1_SHOWN.length ? `<section class="panel"><h2>From your team</h2><div class="rows">${P1_SHOWN.slice(0, 5).map(x => `<div class="row" style="font-size:14px"><span class="grow">${esc(x.text)}</span><span class="muted" style="font-size:12px">${esc(x.by)}</span></div>`).join('')}</div></section>` : '');
}
function p1AthleteHero(T) {
  const a = P1(), p = T.p, B = p ? RT.BAND[p.band] : null, r = todayRec(), au = r.court.min ? p1AU(r) : 0;
  const wkDone = RT.days.slice(Math.max(0, T.idx - 6), T.idx + 1).reduce((s, x) => s + p1DayLoad(x), 0);
  const wkPlan = RT.days.slice(Math.max(0, T.idx - 6), T.idx + 1).reduce((s, x) => s + (x.plan ? x.plan.au : 0), 0);
  const ratio = a.acwr, words = ratio > 1.25 ? ['Building faster than usual', 'Stick to today\'s minutes and the stop rule. No extra sessions this week.', 'var(--risk)'] : ratio > 1.1 ? ['Building a little quicker', 'Keep to the plan; do not add extra court time.', 'var(--warn)'] : ratio < 0.8 ? ['Lighter than usual', 'That is fine if it was planned. Follow today\'s colour.', 'var(--band-mod)'] : ['Right on track', 'Keep doing what you are doing.', 'var(--ok)'];
  return `<section class="cmd ath-hero"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">Today · ${TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="cmd-tag">${T.s.st === 'RED' ? 'No padel today.' : 'Your court time today'}</span>
      <h1 class="cmd-word">${T.s.st === 'RED' ? 'Rest' : T.mins + ' min'}</h1>
      <p class="cmd-why">${T.s.st === 'RED' ? esc(T.s.act) : `${esc(B.label)} · effort ${B.range} out of 10 · ${RT.TLABEL[p.type].toLowerCase()}. ${esc(B.stop)}`}</p>
      <div class="cmd-chips"><span class="cmd-chip"><em>Done today</em>${r.court.min ? r.court.min + ' min' : 'Not logged yet'}</span><span class="cmd-chip"><em>This week</em>${wkDone.toLocaleString()} of ${wkPlan.toLocaleString()} min planned</span></div></div>
    <div class="cmd-r">${P1_VIS.load ? `<div class="cmd-num"><span class="eyebrow">Your load</span><b class="serif num" style="font-size:64px">${wkDone.toLocaleString()}</b><span>minutes this week</span></div>
      <div class="cmd-rings" style="flex-direction:column;align-items:flex-start;gap:6px;max-width:300px"><b style="color:${words[2]};font-size:16px">${words[0]}</b><span style="font-size:13.5px;opacity:.8">${words[1]}</span></div>` : ''}</div></section>
`;
}
/* clinical: session log by date */
function p1SessionLog(T) {
  const ov = p1Sessions(), rows = RT.days.slice(Math.max(0, T.idx - 13), T.idx + 1).reverse();
  return `<section class="panel"><div class="sec-head"><div><h2>Session log</h2><span class="muted" style="font-size:13px">Enter or correct any day; load, ratio and the plan recalculate</span></div></div>${p1LogForm('clinical')}
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Session</th><th>Minutes</th><th>RPE</th><th>Load (min)</th><th>Planned</th><th></th></tr></thead><tbody>${rows.map(x => { const today = x.iso === TODAY_ISO, r = todayRec(), d = today ? (r.court.min ? { min: r.court.min, rpe: r.court.rpe, type: p1Type(r), au: p1AU(r), logged: true } : null) : x.done;
      return `<tr${today ? ' class="rt-cur"' : ''}><td class="num" style="white-space:nowrap">${x.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${x.pause ? ` <span class="chip plain c-muted">${esc(x.pause)}</span>` : ''}</td><td>${d ? esc((simpleTypes.find(t => t[0] === d.type) || [0, RT.TLABEL[d.type] || d.type])[1]) : '–'}</td><td class="num">${d ? d.min : '–'}</td><td class="num">${d ? d.rpe : '–'}</td><td class="num"><b>${d ? d.au : 0}</b></td><td class="num muted">${x.plan ? x.plan.min + ' min' : '–'}</td><td>${ov[x.iso] || today ? '<span class="chip plain c-ok">Logged</span>' : '<span class="muted" style="font-size:12px">Recorded</span>'} <button class="btn sm" data-p1l="edit" data-arg="${x.iso}">Edit</button></td></tr>`; }).join('')}</tbody></table></div></section>`;
}
/* clinical: plan dates (start, pauses, repeated weeks) */
function rtDates() {
  const c = RT.cfg, end = RT.END, days = Math.round((end - TODAY) / 864e5);
  return `<section class="panel rt-dates"><div class="sec-head"><div><h2>Plan dates</h2><span class="muted" style="font-size:13px">Change a date and the whole plan moves with it</span></div><div class="rt-end"><span class="eyebrow">Back to full padel</span><b class="serif">${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</b><span class="muted">${days >= 0 ? days + ' days from today' : 'plan complete'}</span></div></div>
    <div class="grid3" style="gap:14px;align-items:end"><label class="field">Plan start<input type="date" value="${c.start}" data-rtc="start"></label>
      <div class="field">Repeated weeks<div class="pills">${c.repeats.length ? c.repeats.map((w, i) => `<button class="pill" data-rtc="unrep" data-arg="${i}" aria-pressed="true">Week ${w} again ✕</button>`).join('') : '<span class="muted" style="font-size:13px">None. Use Repeat on a week below after a Hold.</span>'}</div></div></div>
    <div class="field">Pauses<div class="rows">${c.pauses.map((p, i) => `<div class="row" style="font-size:13.5px"><span class="grow"><b>${esc(p.why)}</b> · ${esc(p.from)}${p.to && p.to !== p.from ? ' to ' + esc(p.to) : ''}</span><button class="btn sm" data-rtc="unpause" data-arg="${i}">Remove</button></div>`).join('') || '<div class="row muted" style="font-size:13px">No pauses. Add sick days, travel or a flare-up and the plan shifts later.</div>'}</div></div>
    <form class="p1log" data-rtc="pause"><label class="field">From<input type="date" name="from" required></label><label class="field">To<input type="date" name="to"></label><label class="field">Reason<select name="why"><option>Sick</option><option>Travel</option><option>Flare-up</option><option>Other</option></select></label><button class="btn" type="submit">Add pause</button></form></section>`;
}
function p1Changed(msg) { rtSync(); toast(msg); keepRender(); }
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-p1l], form[data-rtc]'); if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f));
  if (f.dataset.p1l === 'save') { if (d.date > TODAY_ISO) { toast('Future sessions are planned, not logged'); return; } p1SaveSession(d.date, { min: +d.min, rpe: +d.rpe, type: d.type }); P1L.form = null; p1Changed('Session saved. Load and plan updated.'); }
  if (f.dataset.rtc === 'pause') { const c = RT.cfg; c.pauses.push({ from: d.from, to: d.to || d.from, why: d.why }); rtRebuild(c); audit('Added a plan pause', d.why + ' ' + d.from); p1Changed('Pause added. The plan now ends ' + RT.END.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); }
});
document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.rtc === 'start' && t.value) { const c = RT.cfg; c.start = t.value; rtRebuild(c); audit('Moved plan start', t.value); p1Changed('Plan start moved. Every date has been recalculated.'); } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-p1l="edit"], [data-rtc]'); if (!t || t.tagName === 'INPUT' || t.tagName === 'FORM') return;
  if (t.dataset.p1l === 'edit') { const iso = t.dataset.arg, x = RT.days.find(y => y.iso === iso), r = todayRec(); const d = iso === TODAY_ISO ? { min: r.court.min, rpe: r.court.rpe, type: p1Type(r) } : x && x.done; P1L.form = { date: iso, type: d ? d.type : 'movement', min: d ? d.min : '', rpe: d ? d.rpe : '' }; keepRender(); setTimeout(() => { const f = document.querySelector('form[data-p1l]'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); return; }
  const k = t.dataset.rtc, c = RT.cfg;
  if (k === 'rep') { c.repeats.push(+t.dataset.arg); rtRebuild(c); audit('Repeated a plan week', 'Week ' + t.dataset.arg); p1Changed('Week ' + t.dataset.arg + ' repeated. The plan now ends ' + RT.END.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); }
  if (k === 'unrep') { c.repeats.splice(+t.dataset.arg, 1); rtRebuild(c); p1Changed('Repeat removed'); }
  if (k === 'unpause') { c.pauses.splice(+t.dataset.arg, 1); rtRebuild(c); p1Changed('Pause removed'); }
});
/* Threshold guard: every limit in one place, today's value against it, and what the system does automatically */
function p1Guard(T) {
  const a = P1(), n = a.loads.length, p = T.p, r = todayRec(), lvl = p ? p.week : 1, seq = p ? p.seq : null;
  const wkDays = seq ? RT.days.filter(x => x.plan && x.plan.seq === seq) : [];
  const wkMin = wkDays.reduce((s, x) => s + (x.iso === TODAY_ISO ? (r.court.min || 0) : x.iso < TODAY_ISO && x.done ? x.done.min : 0), 0);
  const cap = RT.CAPS[lvl - 1], hr = RT.HR_CAPS[lvl - 1];
  const L7 = a.loads.slice(-7), mean = L7.reduce((x, y) => x + y, 0) / 7, sd = Math.sqrt(L7.reduce((x, y) => x + (y - mean) ** 2, 0) / 7), mono = mean / (sd || 1);
  const sym = RS, fss = sym.rest + sym.during + sym.morning + sym.stiff + sym.swell;
  const row = (name, val, limit, state, auto) => ({ name, val, limit, state, auto });
  const st = (v, warn, over) => v >= over ? 'over' : v >= warn ? 'near' : 'ok';
  const rows = [
    row('Court minutes today', (r.court.min || 0) + ' min', 'Planned ' + (p ? p.min : 0) + ' min, adjusted to ' + T.mins, (r.court.min || 0) > T.mins * 1.1 ? 'over' : (r.court.min || 0) > T.mins * 0.9 && T.mins ? 'near' : 'ok', 'Over the adjusted minutes: tomorrow\'s minutes are cut by the excess and the session is flagged to the clinician.'),
    row('Court minutes this week', wkMin + ' min', 'Week ' + lvl + ' cap ' + cap[1] + ' min (floor ' + cap[0] + ')', st(wkMin, cap[1] * 0.9, cap[1]), 'At the cap: no more court time this week; the rest of the week switches to rehab and recovery.'),
    row('High-risk minutes this week', 'Logged by the coach', 'Week ' + lvl + ' cap ' + hr[1] + ' min', 'ok', 'Court minutes and high-risk minutes never rise in the same week.'),
    row('Acute to chronic ratio', a.acwr.toFixed(2), 'Hold above 1.10 · reduce above 1.25', a.acwr > 1.25 ? 'over' : a.acwr > 1.1 ? 'near' : 'ok', 'Above 1.10 the week cannot progress. Above 1.25 the next sessions are reduced and the week repeats.'),
    row('Monotony, 7 days', mono.toFixed(2), 'Caution above 2.0', st(mono, 1.8, 2), 'Above 2: vary the sessions (add an easy day) before adding load.'),
    row('Foot symptom score', fss + ' / 50', 'Modify at 6 · Hold at 10', fss >= 10 ? 'over' : fss >= 6 ? 'near' : 'ok', 'Score 6 to 9 cuts today by 25%. Score 10 or more stops high-impact padel and opens a clinical review.'),
    row('Pain during play', sym.during + ' / 10', 'Stop at 4', sym.during >= 4 ? 'over' : sym.during >= 3 ? 'near' : 'ok', 'Pain 4 or more during play stops the session immediately.'),
    row('Next-morning pain', sym.morning + ' / 10', 'Modify at 3', sym.morning >= 3 ? 'over' : sym.morning >= 2 ? 'near' : 'ok', 'Pain 3 or more the next morning modifies the day and holds progression.'),
    row('Wellness flags', T.w.n + ' of 3', 'Any flag modifies', T.w.n >= 3 ? 'over' : T.w.n ? 'near' : 'ok', 'Each flag (HRV, sleep, soreness) takes minutes down: one or two by 15%, all three by 30%.')];
  const over = rows.filter(x => x.state === 'over'), near = rows.filter(x => x.state === 'near');
  const verdict = over.length ? ['Doing too much', 'var(--risk)', over.map(x => x.name.toLowerCase()).join(', ') + ' over the limit. The plan has already been adjusted: ' + (T.s.st === 'RED' ? 'no padel today.' : T.mins + ' min today.')] : near.length ? ['Close to the limit', 'var(--warn)', near.map(x => x.name.toLowerCase()).join(', ') + ' near the limit. Keep to today\'s ' + T.mins + ' min.'] : ['Within limits', 'var(--ok)', 'Everything is inside the thresholds. Follow today\'s plan.'];
  const hot = over.length ? '#f43f5e,#fb923c,#fda4af,#f43f5e' : near.length ? '#fbbf24,#fb923c,#fde68a,#fbbf24' : '';
  const lamp = hot ? '<span class="bgl-lamp" aria-hidden="true"><span class="bgl-wash"></span><span class="bgl-bloom"><i class="bgl-bloom-ring"></i></span><span class="bgl-rim"></span></span>' : '';
  return `<section class="guard"><div class="guard-v${hot ? ' hx-glow' : ''}" style="--vc:${verdict[1]};--bgl-radius:22px;--bgl-halo:30px;--bgl-rim:1.5px;--bgl-spread:170px;--bgl-brightness:1;--bgl-wash:.16;--bgl-wheel:conic-gradient(from -90deg at 50% 50%,${hot || '#34d399,#34d399'})">${lamp}<span class="eyebrow">Threshold guard · automatic</span><b class="serif">${verdict[0]}</b><span>${esc(verdict[2])}</span></div>
    <div class="guard-rows">${rows.map(x => `<div class="gr ${x.state}"><i></i><span class="gr-n"><b>${x.name}</b><em>${esc(x.limit)}</em></span><b class="num gr-v">${esc(x.val)}</b><span class="gr-a">${esc(x.auto)}</span></div>`).join('')}</div></section>`;
}

/* Player 1 privacy switchboard: everything is internal by default; the clinical team chooses what he sees, one tap each */
let P1_VIS = Object.assign({ today: false, load: false, plan: false, tests: false }, store.get('p1vis', {}));
let P1_SHOWN = store.get('p1shown', []);
const P1_VIS_L = [['today', 'Today\'s court time'], ['load', 'His load'], ['plan', 'His plan and recovery'], ['tests', 'Test results']];
function p1Switchboard() {
  const on = P1_VIS_L.filter(([k]) => P1_VIS[k]);
  return `<section class="p1vis"><div class="p1vis-l">${lockIcon}<b>${on.length ? 'Player 1 sees: ' + on.map(x => x[1].toLowerCase()).join(', ') : 'Private. Player 1 sees nothing from here.'}</b><span class="muted">Chats, daily updates and notes stay internal. Tap to show him something.</span></div>
    <div class="p1vis-t">${P1_VIS_L.map(([k, l]) => `<button class="vis-t" data-vis="${k}" aria-pressed="${!!P1_VIS[k]}"><span class="nls-track" aria-hidden="true"><span class="nls-thumb"><span class="nls-led"></span></span></span>${l}</button>`).join('')}</div></section>`;
}
function p1AthleteGate(k, html, what) { return P1_VIS[k] ? html : `<section class="panel p1-hidden"><span class="eyebrow">${lockIcon} ${what}</span><p class="muted" style="margin:0">Your team will share this with you when it is ready.</p></section>`; }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-vis]'); if (t) { const k = t.dataset.vis; P1_VIS[k] = !P1_VIS[k]; store.set('p1vis', P1_VIS); audit(P1_VIS[k] ? 'Shown to Player 1' : 'Hidden from Player 1', (P1_VIS_L.find(x => x[0] === k) || [0, k])[1]); toast(P1_VIS[k] ? 'Player 1 can now see ' + (P1_VIS_L.find(x => x[0] === k) || [0, k])[1].toLowerCase() : 'Hidden from Player 1'); keepRender(); return; }
  const s = e.target.closest('[data-act="show-p1"]'); if (s) { const T = rtSync(), r = todayRec(); const msg = `${TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}: ${r.court.min ? r.court.min + ' min on court' : 'no court logged'}${r.court.warm ? ', warm-up done' : ''}. ${T.s.st === 'RED' ? 'Rest the arch tomorrow.' : 'Tomorrow: follow your colour and the stop rule.'}`; P1_SHOWN.unshift({ at: new Date().toISOString(), by: me().name, text: msg }); store.set('p1shown', P1_SHOWN.slice(0, 30)); audit('Shared a summary with Player 1', ''); toast('A short summary was shared with Player 1. The clinical update stays private.'); keepRender(); }
});

/* ---------- his call: we guide, he decides. Log what he actually did; tomorrow adjusts automatically ---------- */
function BRANK_(k) { return { easy: 0, medium: 1, hard: 2 }[k]; }
function BDOWN_(k) { return { hard: 'medium', medium: 'easy', easy: 'easy' }[k] || k; }
function p1Carry(rec) {
  /* rec = a logged day; returns how the NEXT day changes, or null */
  if (!rec || !rec.court || !(rec.court.min > 0) || !rec.court.allowed) return null;
  const c = rec.court, over = (c.min - c.allowed) / c.allowed, up = c.band && c.guided && BRANK_(c.band) > BRANK_(c.guided);
  if (over <= 0.1 && !up) return null;
  const cut = Math.min(0.3, Math.max(up ? 0.15 : 0, over > 0.1 ? over / 2 : 0, 0.1));
  const why = [up ? 'played at ' + c.band + ' effort (guided ' + c.guided + ')' : '', over > 0.1 ? c.min + ' min against ' + c.allowed + ' allowed' : ''].filter(Boolean).join(', ');
  return { cut, drop: !!up || over > 0.25, why: 'His call yesterday: ' + why };
}
function p1CarryText(cy) { return cy ? `Minutes cut by ${Math.round(cy.cut * 100)}%${cy.drop ? ' and effort one band lower' : ''}. ${cy.why.replace('yesterday', 'today')}.` : 'No change: he stayed within today\'s guidance.'; }
function p1Choice(T, r) {
  if (!T.p) return '';
  const guided = T.eb || T.p.band, band = r.court.band || '', cy = p1Carry(Object.assign({}, r, { court: Object.assign({}, r.court, { allowed: T.mins, guided }) }));
  const off = r.court.min > 0 && cy;
  return `<div class="choice${off ? ' off' : ''}"><div class="grid3" style="gap:14px;align-items:end"><label class="field">Guided today<span class="choice-g">${esc(RT.BAND[guided].label)} · ${T.mins} min · effort ${esc(RT.BAND[guided].range)}</span></label>
    <span class="chip ${off ? 'c-warn' : 'c-ok'}" style="justify-self:start">${off ? 'His call · above guidance' : 'Within guidance'}</span></div>
    ${(() => { const ids = RT.TYPES.map(t => t[0]), rec = Math.max(0, ids.indexOf(RT.BAND[guided].type)), cur = r.court.type && r.court.min > 0 ? ids.indexOf(r.court.type) : rec; return `<div class="hx-effort" data-hx-effort='${JSON.stringify({ title: 'What he played', levels: ['Recovery', 'Low-load', 'Movement', 'Controlled', 'Sets', 'Match'], rec, start: cur < 0 ? rec : cur })}'></div><span class="muted" style="font-size:12px">Drag to what he actually played. The badge marks today's guidance; anything to the right of it is his call and tomorrow adjusts.</span>`; })()}
    <p class="choice-auto"><b>Tomorrow, automatically:</b> ${esc(p1CarryText(off ? cy : null))} The weekly minute cap and the ratio update from his real minutes; nothing he chose is blocked, it is logged and the plan adapts.</p></div>`;
}

/* guided vs played: the visual scale for the dashboard and load page */
function p1GuideScale(T, r) {
  if (!T.p) return '';
  const guided = T.eb || T.p.band, allow = T.mins, played = r.court.min || 0, chosen = r.court.band || (played ? guided : '');
  const cy = played ? p1Carry({ court: Object.assign({}, r.court, { allowed: allow, guided }) }) : null;
  const max = Math.max(allow * 1.6, played * 1.1, 10), x = v => Math.min(100, v / max * 100).toFixed(1);
  const state = !played ? 'none' : cy ? 'over' : 'ok';
  const ranks = ['easy', 'medium', 'hard'];
  /* last 14 days: guided vs played, from what was logged */
  const A1 = P1(), nL = A1.loads.length, days = [];
  for (let d = 13; d >= 0; d--) { const t = new Date(TODAY); t.setDate(t.getDate() - d); const iso = ISO(t), rec = DAILY[iso], c = rec && rec.court, rd = RT.days.find(x => x.iso === iso);
    const min = d === 0 ? played : c && c.min ? c.min : (A1.loads[nL - 1 - d] || 0), al = d === 0 ? allow : c && c.allowed ? c.allowed : rd && rd.plan ? rd.plan.min : null;
    days.push({ min, al, over: d === 0 ? !!cy : c && c.allowed ? !!p1Carry(rec) : !!(al && min > al * 1.1) }); }
  const hm = Math.max(1, ...days.map(z => Math.max(z.min, z.al || 0))) * 1.1;
  const glowLamp = state === 'over' ? '<span class="bgl-lamp" aria-hidden="true"><span class="bgl-wash"></span><span class="bgl-bloom"><i class="bgl-bloom-ring"></i></span><span class="bgl-rim"></span></span>' : '';
  return `<section class="panel gs gs-cine${state === 'over' ? ' hx-glow' : ''}" style="--bgl-radius:24px;--bgl-halo:30px;--bgl-rim:1.5px;--bgl-spread:180px;--bgl-brightness:1;--bgl-wash:.12;--bgl-wheel:conic-gradient(from -90deg at 50% 50%,#fbbf24,#fb923c,#f43f5e,#fbbf24)">${glowLamp}<div class="fx-grid" aria-hidden="true"></div><div class="sec-head"><div><span class="eyebrow">Guided vs played · we guide, he decides</span><h2>Today's scale</h2></div><span class="chip ${state === 'over' ? 'c-warn' : state === 'ok' ? 'c-ok' : 'c-muted'}">${state === 'over' ? 'His call · above guidance' : state === 'ok' ? 'Within guidance' : 'Not played yet'}</span></div>
    <div class="gs-row"><span class="gs-l">Minutes</span><div class="gs-track"><span class="gs-zone" style="left:${x(allow * 0.9)}%;width:${(x(allow * 1.1) - x(allow * 0.9)).toFixed(1)}%"></span><span class="gs-bar ${state}" style="width:${x(played)}%"></span><i class="gs-mark" style="left:${x(allow)}%"><em>Guided ${allow}</em></i>${played ? `<i class="gs-play" style="left:${x(played)}%"><em>Played ${played}</em></i>` : ''}</div></div>
    <div class="gs-row"><span class="gs-l">Effort</span><div class="gs-eff">${ranks.map(k => `<span class="${k === guided ? 'g' : ''} ${k === chosen ? 'c ' + state : ''}"><b>${esc(RT.BAND[k].label)}</b><em>effort ${esc(RT.BAND[k].range)}</em><span class="gs-tags">${k === guided ? '<i>Guided</i>' : ''}${k === chosen && played ? '<i class="gs-pl">Played</i>' : ''}</span></span>`).join('')}</div></div>
    <div class="gs-row"><span class="gs-l">14 days</span><svg class="gs-h" viewBox="0 0 560 90" preserveAspectRatio="none" role="img" aria-label="Guided versus played minutes, last 14 days">${days.map((z, i) => { const w = 560 / 14, bx = i * w + 6, bw = w - 12, h = z.min / hm * 80; return `<rect x="${bx}" y="${84 - h}" width="${bw}" height="${h}" rx="3" class="${z.over ? 'over' : 'ok'}"/>${z.al ? `<line x1="${bx - 3}" x2="${bx + bw + 3}" y1="${84 - z.al / hm * 80}" y2="${84 - z.al / hm * 80}" class="gl"/>` : ''}`; }).join('')}</svg></div>
    <p class="gs-next"><b>Tomorrow, automatically:</b> ${esc(p1CarryText(cy))}</p>
    <div class="legend" style="font-size:11.5px"><span><i style="background:var(--ok)"></i>Played within guidance</span><span><i style="background:var(--warn)"></i>His call, above guidance</span><span><i style="background:var(--ink)"></i>Guided minutes</span><span><i style="background:color-mix(in srgb,var(--ok) 35%,transparent)"></i>Within 10% of guided</span></div></section>`;
}

/* ---------- risk forecast · ported from Threshold (Mc-Lovin-Creator/threshold, server.py _risk_projection) ----------
   Same rules: zones quiet <0.8, sweet spot 0.8-1.1, caution 1.1-1.25, high risk >1.25; two scenarios
   (follow the plan, or repeat this week's overshoot); overshoot auto-detected as played ÷ planned this week,
   capped at ×2, with a clinician override slider; horizon 7, 9, 14 or 21 days. Paused days count as zero. */
const FCZ = [['quiet', 'Quieter than normal', 0.5, 0.8, '#94a3b8'], ['sweet', 'Sweet spot', 0.8, 1.1, '#34d399'], ['caution', 'Caution', 1.1, 1.25, '#fbbf24'], ['high', 'High risk', 1.25, 1.6, '#f43f5e']];
let FCST = { f: null, h: 14 };
function fcZone(v) { return v == null ? null : v < 0.8 ? FCZ[0] : v <= 1.1 ? FCZ[1] : v <= 1.25 ? FCZ[2] : FCZ[3]; }
function p1Forecast(T, r) {
  const a = P1(), n = a.loads.length, H = FCST.h;
  const fmt = t => t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), dd = k => { const t = new Date(TODAY); t.setDate(t.getDate() + k); return t; };
  /* actual minutes, last 14 days (logged days win over history) */
  const past = []; for (let d = 13; d >= 0; d--) { const t = dd(-d), iso = ISO(t), c = DAILY[iso] && DAILY[iso].court; past.push({ t, v: d === 0 ? (r.court.min || 0) : c && c.min ? c.min : (a.loads[n - 1 - d] || 0) }); }
  /* overshoot observed over the last 7 days, Threshold's rule */
  let pl = 0, pr = 0; past.slice(-7).forEach(x => { const rd = RT.days.find(y => y.iso === ISO(x.t)); const al = x === past[13] ? T.mins : rd && rd.plan ? rd.plan.min : 0; if (al > 0) { pl += x.v; pr += al; } });
  const auto = pr > 0 && pl > pr ? Math.min(2, pl / pr) : 1, f = FCST.f == null ? auto : FCST.f;
  const over = pr > 0 && pl > pr * 1.15 && pl - pr >= 15;
  /* run the app's 7-day and 28-day weighted averages forward under each scenario */
  const la = 2 / 8, lc = 2 / 29, run = mult => { let ac = a.acute[n - 1], ch = a.chronic[n - 1]; const out = [];
    for (let k = 1; k <= H; k++) { const t = dd(k), rd = RT.days.find(x => x.iso === ISO(t)), pm = rd && rd.plan && !rd.pause ? rd.plan.min : 0, v = pm * mult; ac = v * la + (1 - la) * ac; ch = v * lc + (1 - lc) * ch; out.push({ t, pm, v, ratio: ch ? ac / ch : null }); } return out; };
  const P = run(1), S = run(f), now = a.acwr;
  /* past ratio path from the same averages */
  const pastR = past.map((x, i) => { const j = n - 14 + i; return a.chronic[j] ? a.acute[j] / a.chronic[j] : null; });
  const wkEnd = Math.min(H, 7 - ((TODAY.getDay() + 6) % 7)) || 7, ewP = P[wkEnd - 1].ratio, ewS = S[wkEnd - 1].ratio, endP = P[H - 1].ratio, endS = S[H - 1].ratio;
  const firstS = S.findIndex(x => x.ratio > 1.25), firstP = P.findIndex(x => x.ratio > 1.25);
  const zw = v => (fcZone(v) || ['', ''])[1].toLowerCase();
  const take = f > 1.05 ? `Follow the plan from here and the week ends around ${ewP.toFixed(2)} (${zw(ewP)}). Keep adding ${Math.round((f - 1) * 100)}% like this week and it ends around ${ewS.toFixed(2)} (${zw(ewS)}).` : `Stay with the plan and the week ends around ${ewP.toFixed(2)} (${zw(ewP)}).`;
  const alert = firstS >= 0 ? `Breaks into high risk on ${fmt(S[firstS].t)} if he keeps this pattern${firstP >= 0 && firstP < firstS ? ' (the plan itself gets there sooner, on ' + fmt(P[firstP].t) + ')' : firstP === firstS ? ': the plan itself steps up faster than his previous load' : ''}.` : 'Stays out of the high-risk zone across the whole horizon.';
  /* geometry */
  const W = 1000, Hh = 300, padL = 40, padR = 96, N = 14 + H, bw = (W - padL - padR) / N, X = i => padL + (i + 0.5) * bw;
  const rMin = 0.5, rMax = 1.6, Yr = v => Hh - 20 - (Math.max(rMin, Math.min(rMax, v)) - rMin) / (rMax - rMin) * (Hh - 40);
  const mMax = Math.max(1, ...past.map(x => x.v), ...S.map(x => x.v), ...P.map(x => x.pm)) * 1.15, Ym = v => Hh - 20 - v / mMax * (Hh - 40) * 0.55;
  const path = (pts) => pts.filter(p => p[1] != null).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${Yr(p[1]).toFixed(1)}`).join(' ');
  const zones = FCZ.map(z => `<rect x="${padL}" width="${W - padL - padR}" y="${Yr(z[3])}" height="${Yr(z[2]) - Yr(z[3])}" fill="${z[4]}" class="fx-zb"/><text x="${W - padR + 8}" y="${(Yr(z[3]) + Yr(z[2])) / 2 + 4}" class="fx-zl" fill="${z[4]}">${z[0] === 'quiet' ? 'Quiet' : z[1]}</text>`).join('');
  const bars = past.map((x, i) => `<rect x="${X(i) - bw * .3}" width="${bw * .6}" y="${Ym(x.v)}" height="${Hh - 20 - Ym(x.v)}" rx="2" class="fx-bar" style="--d:${i * 30}ms"/>`).join('') + S.map((x, i) => `<rect x="${X(14 + i) - bw * .3}" width="${bw * .6}" y="${Ym(x.v)}" height="${Hh - 20 - Ym(x.v)}" rx="2" class="fx-ghost" style="--d:${(14 + i) * 30}ms"/>`).join('');
  const pastPath = path(pastR.map((v, i) => [X(i), v])), planPath = path([[X(13), pastR[13]], ...P.map((x, i) => [X(14 + i), x.ratio])]), scenPath = path([[X(13), pastR[13]], ...S.map((x, i) => [X(14 + i), x.ratio])]);
  const risk = S.map((x, i) => x.ratio > 1.25 ? `<circle cx="${X(14 + i)}" cy="${Yr(x.ratio)}" r="5" class="fx-hot" style="--d:${i * 90}ms"/>` : '').join('');
  const ticks = [...past, ...S].map((x, i) => i % 3 === 0 ? `<text x="${X(i)}" y="${Hh - 4}" text-anchor="middle" class="fx-t">${x.t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>` : '').join('');
  const gx = v => ((Math.max(rMin, Math.min(rMax, v)) - rMin) / (rMax - rMin) * 100).toFixed(1);
  const mk = (v, cls, lab) => `<i class="fx-m ${cls}" style="left:${gx(v)}%"><b>${v.toFixed(2)}</b><em>${lab}</em></i>`;
  const zNow = fcZone(now), zS = fcZone(endS), zP = fcZone(endP);
  return `<section class="fx" aria-label="Injury-risk forecast">
    <div class="hx-phosphor" data-tone="${firstS >= 0 ? 'risk' : 'forecast'}" aria-hidden="true"><canvas></canvas></div><div class="fx-veil" aria-hidden="true"></div><div class="fx-grid" aria-hidden="true"></div>
    <header class="fx-h"><div><span class="fx-k">Threshold engine · injury-risk forecast · checked against his previous load</span><h2 class="fx-title">Where his load is heading</h2></div>
      <div class="fx-ctl"><div class="fx-seg" role="group" aria-label="Horizon">${[7, 9, 14, 21].map(h => `<button data-fx="h|${h}" aria-pressed="${H === h}">${h}d</button>`).join('')}</div></div></header>
    <div class="fx-read">
      <div class="fx-r" style="--z:${zNow[4]}"><span>Now</span><b class="fx-num">${now.toFixed(2)}</b><em>${zNow[1]}</em></div>
      <div class="fx-r" style="--z:${zP[4]}"><span>In ${H} days · on plan</span><b class="fx-num">${endP.toFixed(2)}</b><em>${zP[1]}</em></div>
      <div class="fx-r hot" style="--z:${zS[4]}"><span>In ${H} days · at ×${f.toFixed(2)}</span><b class="fx-num">${endS.toFixed(2)}</b><em>${zS[1]}</em></div>
      <div class="fx-r alert ${firstS >= 0 ? 'on hx-glow' : ''}" style="--bgl-radius:18px;--bgl-halo:26px;--bgl-rim:1.5px;--bgl-spread:130px;--bgl-brightness:1;--bgl-wash:.14;--bgl-wheel:conic-gradient(from -90deg at 50% 50%,#f43f5e,#fb923c,#fda4af,#f43f5e)">${firstS >= 0 ? '<span class="bgl-lamp" aria-hidden="true"><span class="bgl-wash"></span><span class="bgl-bloom"><i class="bgl-bloom-ring"></i></span><span class="bgl-rim"></span></span>' : ''}<span>Tether check</span><b>${firstS >= 0 ? fmt(S[firstS].t) : 'Clear'}</b><em>${esc(alert)}</em></div></div>
    <div class="fx-gauge"><div class="fx-track">${FCZ.map(z => `<span style="width:${((z[3] - z[2]) / (rMax - rMin) * 100).toFixed(1)}%;--c:${z[4]}"></span>`).join('')}</div>${[0.8, 1.1, 1.25].map(v => `<em class="fx-tk" style="left:${gx(v)}%">${v}</em>`).join('')}${mk(now, 'now', 'now')}${mk(ewP, 'plan', 'week end · plan')}${f > 1.02 ? mk(ewS, 'scen', 'week end · ×' + f.toFixed(2)) : ''}</div>
    <div class="fx-cw"><svg class="fx-chart" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Past and projected load ratio against the risk zones">
      <defs><filter id="fxglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="fxbeam" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      ${zones}${bars}
      <rect x="${X(14) - bw / 2}" y="0" width="${W - padR - X(14) + bw / 2}" height="${Hh - 20}" class="fx-future"/>
      <rect x="${X(14) - bw / 2}" y="0" width="${bw * 3}" height="${Hh - 20}" fill="url(#fxbeam)" class="fx-beam" style="--span:${W - padR - X(14)}px"/>
      <line x1="${X(13) + bw / 2}" x2="${X(13) + bw / 2}" y1="0" y2="${Hh - 20}" class="fx-today"/><text x="${X(13) + bw / 2}" y="12" text-anchor="middle" class="fx-tl">TODAY</text>
      <path d="${pastPath}" class="fx-lp" filter="url(#fxglow)"/><path d="${planPath}" class="fx-lg" filter="url(#fxglow)"/>${f > 1.02 ? `<path d="${scenPath}" class="fx-ls" filter="url(#fxglow)"/>` : ''}
      ${risk}<circle cx="${X(13)}" cy="${Yr(pastR[13] || now)}" r="6" class="fx-now"/>${ticks}
    </svg></div>
    <div class="fx-assume"><label for="fx-f"><span class="fx-k">Overshoot assumption</span><b>×${f.toFixed(2)}</b> <em>${f > 1 ? '+' : ''}${Math.round((f - 1) * 100)}% vs plan</em></label>
      <input id="fx-f" type="range" min="0.5" max="2" step="0.05" value="${f.toFixed(2)}" data-fx="f" style="--p:${((f - 0.5) / 1.5 * 100).toFixed(0)}%">
      <button data-fx="auto" aria-pressed="${FCST.f == null}">Observed this week ×${auto.toFixed(2)}</button></div>
    <p class="fx-take">${esc(take)}${over ? ` <b>Heads-up:</b> this week is ${Math.round(pl - pr)} min past what the programme predicted; make the next session an easy one.` : ''}</p>
    <div class="fx-legend"><span><i class="lp"></i>Ratio so far</span><span><i class="lg"></i>If he follows the plan</span><span><i class="ls"></i>If he keeps ×${f.toFixed(2)}</span><span><i class="lb"></i>Minutes played</span><span><i class="lgh"></i>Minutes ahead at ×${f.toFixed(2)}</span><span><i class="lh"></i>High-risk day</span></div>
    <details class="fx-how"><summary>How this works, and its limits</summary><p>Rules ported from your Threshold app: same zones (0.8, 1.1, 1.25), the same two scenarios, overshoot auto-detected as played ÷ planned over the last 7 days (capped at ×2), with your override. The ratio uses the app's 7-day and 28-day weighted averages so it matches every other number in the app. It marks a window of raised risk, not a prediction that he will be injured: load models cannot predict individual injuries (<a href="https://pubmed.ncbi.nlm.nih.gov/?term=Bahr+2016+screening+tests+predict+injury" target="_blank" rel="noopener">Bahr 2016</a>; <a href="${SRC.impel.url}" target="_blank" rel="noopener">Impellizzeri 2020</a>), though rapid spikes are linked with more injuries (<a href="https://pubmed.ncbi.nlm.nih.gov/?term=Gabbett+2016+training-injury+prevention+paradox" target="_blank" rel="noopener">Gabbett 2016</a>). Symptoms and your judgement come first.</p></details>
  </section>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-fx]'); if (!b || b.tagName === 'INPUT') return; const [k, v] = b.dataset.fx.split('|'); if (k === 'h') FCST.h = +v; if (k === 'auto') FCST.f = null; keepRender(); });
document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.fx === 'f') { FCST.f = +t.value; keepRender(); } });
document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.fx === 'f') { const l = t.parentElement.querySelector('label b'); if (l) l.textContent = '×' + (+t.value).toFixed(2); t.style.setProperty('--p', ((t.value - 0.5) / 1.5 * 100).toFixed(0) + '%'); } });

/* HorizonX effort slider -> his actual session type and effort band */
document.addEventListener('hx-effort', e => {
  const t = RT.TYPES[e.detail.index]; if (!t) return; const r = todayRec();
  r.court.type = t[0]; r.court.band = { recovery: 'easy', lowload: 'easy', movement: 'medium', controlled: 'hard', sets: 'hard', match: 'hard' }[t[0]];
  r.sent = false; saveDaily(); audit('Session played logged', t[1]); keepRender();
});
