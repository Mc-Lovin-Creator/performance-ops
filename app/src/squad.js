/* ---------- v33: every squad athlete gets Player 1's structure: overview, load (time only), testing and prescription ---------- */
let SQMIN = store.get('sqmin') || {};   /* {aid: {iso: {min, during, morning}}} */
let SQCAP = store.get('sqcap') || {};   /* {aid: weekly minute cap} */
const sqISO = d => { const x = new Date(TODAY); x.setDate(x.getDate() - d); return ISO(x); };
const sqPop = a => a.tier >= 4 ? 'elite' : a.tier === 3 ? 'competitive' : a.tier >= 1 ? 'trained' : 'sedentary';
function sqSeries(a) {
  /* seeded history converted to minutes (session load ÷ a typical RPE of 6), replaced by anything the team logs */
  const log = SQMIN[a.id] || {}, mins = [];
  for (let d = 41; d >= 0; d--) { const iso = sqISO(d); mins.push(log[iso] ? log[iso].min : d === 0 ? 0 : Math.round(a.loads[41 - d] / 6)); }
  const la = 2 / 8, lc = 2 / 29; let ac = mins[0] || 1, ch = mins[0] || 1; const A = [], C = [];
  for (const v of mins) { ac = v * la + (1 - la) * ac; ch = v * lc + (1 - lc) * ch; A.push(ac); C.push(ch); }
  const L7 = mins.slice(-7), mean = L7.reduce((x, y) => x + y, 0) / 7, sd = Math.sqrt(L7.reduce((x, y) => x + (y - mean) ** 2, 0) / 7);
  const week = L7.reduce((x, y) => x + y, 0), chronicWeek = C[41] * 7;
  return { mins, A, C, ratio: C[41] ? A[41] / C[41] : 0, mono: mean / (sd || 1), week, cap: SQCAP[a.id] || Math.round(chronicWeek * 1.1 / 10) * 10, today: log[sqISO(0)] || { min: 0, during: 0, morning: 0 } };
}
function sqGuard(a, S) {
  const st = (v, warn, over) => v >= over ? 'over' : v >= warn ? 'near' : 'ok', flags = [a.hrv != null && a.hrv <= -10, a.sore != null && a.sore >= 6, a.sleep && parseInt(a.sleep) < 6].filter(Boolean).length;
  const rows = [
    ['Court minutes this week', S.week + ' min', 'Cap ' + S.cap + ' min (edit below)', st(S.week, S.cap * 0.9, S.cap), 'At the cap: no more court time this week; swap to off-court work.'],
    ['Acute to chronic ratio', S.ratio.toFixed(2), 'Hold above 1.10 · reduce above 1.25', S.ratio > 1.25 ? 'over' : S.ratio > 1.1 ? 'near' : 'ok', 'Monitoring aid only (Impellizzeri 2020): read it with the minutes and symptoms.'],
    ['Monotony, 7 days', S.mono.toFixed(2), 'Caution above 2.0', st(S.mono, 1.8, 2), 'Above 2: add an easy day before adding load.'],
    ['Pain during play', S.today.during + ' / 10', 'Stop at 4', S.today.during >= 4 ? 'over' : S.today.during >= 3 ? 'near' : 'ok', 'Pain 4 or more during play stops the session.'],
    ['Next-morning pain', S.today.morning + ' / 10', 'Modify at 3', S.today.morning >= 3 ? 'over' : S.today.morning >= 2 ? 'near' : 'ok', 'Pain 3 or more the next morning holds progression.'],
    ['Wellness flags', flags + ' of 3', 'Any flag modifies', flags >= 3 ? 'over' : flags ? 'near' : 'ok', 'HRV down 10% or more, sleep under 6 h, soreness 6 or more.']];
  const over = rows.filter(x => x[3] === 'over'), near = rows.filter(x => x[3] === 'near');
  const v = over.length ? ['Doing too much', 'var(--risk)', over.map(x => x[0].toLowerCase()).join(', ') + ' over the limit.'] : near.length ? ['Close to the limit', 'var(--load)', near.map(x => x[0].toLowerCase()).join(', ') + ' near the limit.'] : ['Within limits', 'var(--ok)', 'Every threshold is inside its limit.'];
  return `<section class="guard"><div class="guard-v" style="--vc:${v[1]}"><span class="eyebrow">Threshold guard · automatic</span><b class="serif">${v[0]}</b><span>${esc(v[2])}</span></div>
    <div class="guard-rows">${rows.map(x => `<div class="gr ${x[3]}"><i></i><span class="gr-n"><b>${x[0]}</b><em>${esc(x[2])}</em></span><b class="num gr-v">${esc(x[1])}</b><span class="gr-a">${esc(x[4])}</span></div>`).join('')}</div></section>`;
}
function sqMiniChart(S) {
  const m = S.mins.slice(-28), mx = Math.max(...m, 1), W = 760, H = 150;
  return `<svg class="p1mini" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Court minutes, last 28 days">${m.map((v, i) => `<rect x="${i * (W / 28) + 3}" y="${H - v / mx * H}" width="${W / 28 - 6}" height="${v / mx * H}" rx="3" fill="var(--accent)" opacity="${i === 27 ? 1 : .55}"/>`).join('')}<polyline fill="none" stroke="var(--load)" stroke-width="2" points="${S.C.slice(-28).map((c, i) => `${i * (W / 28) + W / 56},${H - c / mx * H}`).join(' ')}"/><text x="0" y="${H + 16}" font-size="12" fill="currentColor" opacity=".6">28 days ago</text><text x="${W}" y="${H + 16}" font-size="12" text-anchor="end" fill="currentColor" opacity=".6">Today · bars minutes, line chronic</text></svg>`;
}
function sqTabs(a, k) {
  return `<nav class="seg p1tabs" aria-label="${esc(a.name)} sections">${[['', 'Overview'], ['load', 'Load'], ['tests', 'Testing and prescription']].map(([t, l]) => `<a href="#athlete-${a.id}${t ? '~' + t : ''}" ${k === t ? 'aria-current="page"' : ''}>${l}</a>`).join('')}<a href="#treatment">Treatment ↗</a></nav>`;
}
function athleteHub(arg) {
  const [id, tab] = arg.split('~'), a = ATH.find(x => x.id === id);
  if (id === 'p1') { location.hash = tab === 'load' ? 'loadlab' : tab === 'tests' ? 'p1rx' : 'player1'; return ''; }
  if (!a || !seesAthlete(a) || !tab) return pageAthlete(id).replace('<section class="hero">', a && seesAthlete(a) ? sqTabs(a, '') + '<section class="hero">' : '<section class="hero">');
  const S = sqSeries(a), pop = sqPop(a), head = `<a class="btn sm" href="#athletes" style="align-self:flex-start">Back to athletes</a><div class="sec-head"><div><span class="eyebrow">${esc(a.pos)} · ${esc(TIERS[a.tier])} · McKay tier ${a.tier}</span><h1 style="font-size:34px;letter-spacing:-.6px">${esc(a.name)}</h1></div></div>${sqTabs(a, tab)}`;
  if (tab === 'load') {
    const can = perm().clinical || me().role === 'coach';
    return head + sqGuard(a, S) + `<section class="panel"><div class="sec-head"><div><h2>Court minutes</h2><span class="muted" style="font-size:13px">Load is time only, same as Player 1, until wearables are connected</span></div></div>${sqMiniChart(S)}</section>
    ${transitionCard()}<section class="panel"><div class="sec-head"><h2>Log a session</h2></div>${can ? `<form class="row p1log" data-sqlog="${a.id}" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="field">Date<input type="date" name="iso" value="${sqISO(0)}" max="${sqISO(0)}"></label><label class="field">Minutes<input type="number" name="min" min="0" max="300" value="${S.today.min || ''}" required></label><label class="field">Pain during play<input type="number" name="during" min="0" max="10" value="${S.today.during}"></label><label class="field">Next-morning pain<input type="number" name="morning" min="0" max="10" value="${S.today.morning}"></label><label class="field">Weekly cap<input type="number" name="cap" min="0" step="10" value="${S.cap}"></label><button class="btn primary">Save</button></form>` : locked('Coaches and the clinical team log sessions.')}</section>`;
  }
  return head + `<section class="cmd"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div><div class="cmd-l"><span class="eyebrow">${esc(a.name)} · population</span><span class="cmd-tag">Same verified standards as Player 1.</span><h1 class="cmd-word">${esc(tierName(pop))}</h1><p class="cmd-why">${esc((POP_FRAME.find(f => f.id === pop) || {}).def || '')}</p></div><div class="cmd-r"><div class="pop-stack">${POP_FRAME.map(p => `<span class="${p.id === pop ? 'on' : ''}" style="--c:${tierColor(p.id)}"><b>${esc(p.label)}</b><em>${esc(p.tier)}</em></span>`).join('')}</div></div></section>${rxEvidence(pop)}${normsPanel(a.id, pop)}`;
}
document.addEventListener('submit', e => { const f = e.target; if (!f.dataset || !f.dataset.sqlog) return; e.preventDefault(); const id = f.dataset.sqlog, d = Object.fromEntries(new FormData(f)); SQMIN[id] = SQMIN[id] || {}; SQMIN[id][d.iso] = { min: +d.min || 0, during: +d.during || 0, morning: +d.morning || 0 }; if (+d.cap) SQCAP[id] = +d.cap; store.set('sqmin', SQMIN); store.set('sqcap', SQCAP); audit('Session logged', id); toast('Session saved'); keepRender(); });
