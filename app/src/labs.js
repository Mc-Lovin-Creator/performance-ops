/* ---------- v44 Interactive labs: real-time tools per domain (levers, fitness-fatigue, heart-rate zones, load dosing) ---------- */
SRC.banister = { cite: 'Banister EW, Calvert TW, Savage MV, Bach T. A systems model of training for athletic performance. Aust J Sports Med 1975;7:57-61; teaching review: Clarke DC, Skiba PF. Adv Physiol Educ 2013;37(2):134-152', url: PM('Clarke Skiba 2013 rationale and resources for teaching the mathematical modeling of athletic training and performance') };
SRC.hall = { cite: 'Hall SJ. Basic Biomechanics, 8th ed. McGraw-Hill 2019 (levers and torque); McGinnis PM. Biomechanics of Sport and Exercise, 4th ed. Human Kinetics 2020', url: 'https://www.google.com/search?q=Hall+Basic+Biomechanics+levers' };
const srcLink = k => SRC[k] ? `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].cite.split(/\. (?=[A-Z])/)[0].slice(0, 46))} ${esc((SRC[k].cite.match(/(19|20)\d\d/) || [''])[0])}</a>` : '';
const LAB = store.get('lab') || { cls: 3, ea: 4, la: 32, kg: 5, ang: 0, racket: false, wk: 400, taper: 9, cut: 50, age: 45, rhr: 60, orm: 100, goal: 'strength' };
const labSave = () => store.set('lab', LAB);

/* ---- 1. Levers ---- */
const LEVERS = {
  1: { name: 'First class', rule: 'Fulcrum between effort and load', ex: 'Head on the neck: neck extensors pull behind the joint to hold the head\'s weight in front. Triceps on the olecranon is another.', ea: 4, la: 3, kg: 5, pops: 'Posture, neck and upper-back endurance in desk workers and padel players who look up for the lob' },
  2: { name: 'Second class', rule: 'Load between fulcrum and effort', ex: 'Calf raise: the ball of the foot is the fulcrum, body weight acts through the ankle, the calf pulls up at the heel through the Achilles.', ea: 16, la: 12, kg: 80, pops: 'Force advantage: the calf can lift big loads; the reason heel raises are a key Achilles and ankle loading tool' },
  3: { name: 'Third class', rule: 'Effort between fulcrum and load', ex: 'Elbow flexion: biceps inserts about 4 to 5 cm from the elbow, the load sits in the hand about 30 to 35 cm away. Most limbs work this way.', ea: 4, la: 32, kg: 5, pops: 'Speed advantage: a small shortening of the muscle moves the hand, and the racket head, far and fast' }
};
function leverCalc() {
  const L = LEVERS[LAB.cls], ea = LAB.ea / 100, la = (LAB.la + (LAB.racket && LAB.cls === 3 ? 36 : 0)) / 100, F = LAB.kg * 9.81, c = Math.cos(LAB.ang * Math.PI / 180);
  const tq = F * la * c, eff = ea > 0 ? tq / ea : 0, ma = ea / la;
  return { L, ea, la, F, tq, eff, ma, speed: la / ea, bw: eff / (75 * 9.81) };
}
function labLevers() {
  const c = leverCalc();
  return `<div class="lab-x">
  <div class="lab-canvas-wrap holo-panel"><canvas id="lv-c" class="lab-cv" aria-label="Lever simulator"></canvas>
    <div class="lab-hud"><div><span>Mechanical advantage</span><b id="lv-ma">${c.ma.toFixed(2)}</b><em id="lv-mat">${c.ma >= 1 ? 'force advantage' : 'speed advantage'}</em></div><div><span>Muscle force needed</span><b id="lv-eff">${Math.round(c.eff)} N</b><em id="lv-bw">${c.bw.toFixed(2)} × body weight (75 kg)</em></div><div><span>Torque at the joint</span><b id="lv-tq">${c.tq.toFixed(1)} N·m</b><em>load × load arm</em></div><div><span>End-point speed</span><b id="lv-sp">${c.speed.toFixed(1)}×</b><em>the muscle's shortening speed</em></div></div></div>
  <div class="lab-ctl">
    <div class="seg">${[1, 2, 3].map(k => `<button data-lv="${k}" aria-pressed="${LAB.cls === k}">${LEVERS[k].name}</button>`).join('')}</div>
    <p class="lab-rule"><b>${esc(c.L.rule)}.</b> ${esc(c.L.ex)}</p>
    <label class="range">Effort arm (muscle insertion to joint) <b id="lv-ea-v">${LAB.ea} cm</b><input type="range" min="1" max="30" step="0.5" value="${LAB.ea}" data-lab="ea"></label>
    <label class="range">Load arm (load to joint) <b id="lv-la-v">${LAB.la} cm</b><input type="range" min="2" max="60" step="1" value="${LAB.la}" data-lab="la"></label>
    <label class="range">Load <b id="lv-kg-v">${LAB.kg} kg</b><input type="range" min="0.5" max="${LAB.cls === 2 ? 160 : 40}" step="0.5" value="${LAB.kg}" data-lab="kg"></label>
    ${LAB.cls === 3 ? `<label class="range">Forearm angle below horizontal <b id="lv-ang-v">${LAB.ang}°</b><input type="range" min="-80" max="80" step="1" value="${LAB.ang}" data-lab="ang"></label>
    <label class="layer"><input type="checkbox" data-lab="racket" ${LAB.racket ? 'checked' : ''}> Add a padel racket (+36 cm to the lever)</label>` : ''}
    <div class="lab-take"><span class="eyebrow">Apply it</span><p id="lv-take">${esc(leverTake(c))}</p></div>
    <p class="lab-src">${srcLink('hall')} · Moment arms vary with joint angle; this model holds the muscle's arm fixed and is for teaching.</p>
  </div></div>`;
}
function leverTake(c) {
  if (LAB.cls === 2) return `Heel raise at ${LAB.kg} kg: the calf needs about ${Math.round(c.eff)} N, less than the load (${Math.round(c.F)} N), because the effort arm is longer. Progress Achilles and ankle loading by adding weight, then single leg, then speed.`;
  if (LAB.cls === 1) return `Each 1 cm the head sits further forward lengthens the load arm, so the neck extensors work harder for the same head. Cue a stacked head for long sessions and lob tracking.`;
  return `${LAB.racket ? 'With the racket the' : 'The'} hand${LAB.racket ? ' and racket head move' : ' moves'} ${c.speed.toFixed(1)} times faster than the biceps shortens, but the muscle must pull ${Math.round(c.eff)} N to hold ${LAB.kg} kg. Shorter levers (load closer, elbow bent) make strength work safer early in rehab; longer levers add speed and load later.`;
}
function drawLever() {
  const cv = document.getElementById('lv-c'); if (!cv) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, c = leverCalc(), t = performance.now() / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0); const w = W / dpr, h = H / dpr;
  g.clearRect(0, 0, w, h);
  /* holographic grid floor */
  g.strokeStyle = 'rgba(94,234,212,.08)'; g.lineWidth = 1; for (let x = 0; x < w; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const total = LAB.cls === 2 ? Math.max(c.ea, c.la) : LAB.cls === 1 ? c.ea + c.la : Math.max(c.ea, c.la), sc = (w * 0.72) / Math.max(total, 0.05);
  const wob = Math.sin(t * 2.2) * (LAB.cls === 3 ? 0.06 : 0.03), ang = (LAB.cls === 3 ? LAB.ang * Math.PI / 180 : 0) + wob;
  let fx; if (LAB.cls === 1) fx = w * 0.14 + c.ea * sc; else fx = w * 0.14; const fy = h * 0.4;
  const pt = (d, dir) => [fx + Math.cos(ang) * d * sc * dir, fy + Math.sin(ang) * d * sc * dir];
  const effP = LAB.cls === 1 ? pt(c.ea, -1) : pt(c.ea, 1), loadP = pt(c.la, 1), endP = LAB.cls === 1 ? [effP, loadP] : [[fx, fy], pt(total, 1)];
  /* beam glow */
  g.save(); g.lineCap = 'round'; g.shadowColor = '#5eead4'; g.shadowBlur = 18; g.strokeStyle = 'rgba(94,234,212,.9)'; g.lineWidth = 7; g.beginPath(); g.moveTo(...endP[0]); g.lineTo(...endP[1]); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#e6fffb'; g.lineWidth = 2; g.stroke(); g.restore();
  /* speed trail at the tip */
  const tip = LAB.cls === 1 ? loadP : pt(total, 1); g.fillStyle = 'rgba(94,234,212,.25)'; for (let k = 1; k < 7; k++) { const a2 = ang - wob + Math.sin(t * 2.2 - k * 0.12) * (LAB.cls === 3 ? 0.06 : 0.03), d = LAB.cls === 1 ? c.la : total; g.beginPath(); g.arc(fx + Math.cos(a2) * d * sc, fy + Math.sin(a2) * d * sc, 5 - k * 0.6, 0, 7); g.fill(); }
  /* fulcrum */
  g.fillStyle = '#fde68a'; g.shadowColor = '#fde68a'; g.shadowBlur = 14; g.beginPath(); g.moveTo(fx, fy + 4); g.lineTo(fx - 14, fy + 28); g.lineTo(fx + 14, fy + 28); g.closePath(); g.fill(); g.shadowBlur = 0;
  const arrow = (x, y, len, col, up, label) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(2, Math.min(9, len / 16)); g.shadowColor = col; g.shadowBlur = 12; const y2 = y + (up ? -len : len); g.beginPath(); g.moveTo(x, up ? y + 2 : y - 2); g.lineTo(x, y2); g.stroke(); g.beginPath(); g.moveTo(x, y2 + (up ? -8 : 8)); g.lineTo(x - 8, y2); g.lineTo(x + 8, y2); g.closePath(); g.fill(); g.shadowBlur = 0; g.font = '600 12px system-ui'; g.fillText(label, x + 10, (y + y2) / 2); };
  const maxF = Math.max(c.eff, c.F), sF = v => 22 + h * 0.2 * v / maxF;
  arrow(loadP[0], loadP[1], sF(c.F), '#fb7185', false, `Load ${Math.round(c.F)} N`);
  arrow(effP[0], effP[1], sF(c.eff), '#5eead4', LAB.cls !== 1 ? true : false, `Muscle ${Math.round(c.eff)} N`);
  g.fillStyle = 'rgba(204,251,241,.7)'; g.font = '600 11px system-ui'; g.fillText('FULCRUM · JOINT', fx - 40, fy + 46);
}
let LV_RAF = 0; function leverLoop() { cancelAnimationFrame(LV_RAF); const f = () => { if (!document.getElementById('lv-c')) return; drawLever(); LV_RAF = requestAnimationFrame(f); }; LV_RAF = requestAnimationFrame(f); }
function leverHud() { const c = leverCalc(), s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; }; s('lv-ma', c.ma.toFixed(2)); s('lv-mat', c.ma >= 1 ? 'force advantage' : 'speed advantage'); s('lv-eff', Math.round(c.eff) + ' N'); s('lv-bw', c.bw.toFixed(2) + ' × body weight (75 kg)'); s('lv-tq', c.tq.toFixed(1) + ' N·m'); s('lv-sp', c.speed.toFixed(1) + '×'); s('lv-take', leverTake(c)); ['ea', 'la', 'kg', 'ang'].forEach(k => s('lv-' + k + '-v', LAB[k] + (k === 'kg' ? ' kg' : k === 'ang' ? '°' : ' cm'))); }

/* ---- 2. Fitness-fatigue (Banister impulse-response) ---- */
function banister() {
  const days = 84, k1 = 1, k2 = 2, t1 = 42, t2 = 7, out = []; let fit = 0, fat = 0;
  for (let d = 0; d < days; d++) {
    const wk = Math.floor(d / 7), dow = d % 7, taper = wk >= LAB.taper, base = LAB.wk / 6;
    let w = dow === 6 ? 0 : base * (wk % 4 === 3 ? 0.6 : 1 + (wk % 4) * 0.08); if (taper) w = base * (1 - LAB.cut / 100);
    fit = fit * Math.exp(-1 / t1) + w; fat = fat * Math.exp(-1 / t2) + w; out.push({ d, w, fit: k1 * fit, fat: k2 * fat, perf: k1 * fit - k2 * fat });
  }
  return out;
}
function vizBanister() {
  const B = banister(), last = B[B.length - 1], peak = B.reduce((a, b) => b.perf > a.perf ? b : a, B[0]);
  const W = 640, H = 220, mx = Math.max(...B.map(b => Math.max(b.fit, b.fat))) || 1, mn = Math.min(0, ...B.map(b => b.perf)), xs = d => 8 + d / 83 * (W - 16), ys = v => H - 14 - (v - mn) / (mx - mn) * (H - 28);
  const line = (k, col, wd) => `<polyline fill="none" stroke="${col}" stroke-width="${wd}" stroke-linejoin="round" points="${B.map(b => xs(b.d).toFixed(1) + ',' + ys(b[k]).toFixed(1)).join(' ')}"/>`;
  return `<div class="holo-panel lab-svg"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Fitness, fatigue and performance over 12 weeks">
    ${B.map(b => `<rect x="${xs(b.d) - 2}" y="${H - 14 - b.w / (LAB.wk / 6 * 1.3) * 40}" width="4" height="${b.w / (LAB.wk / 6 * 1.3) * 40}" fill="rgba(148,163,184,.35)"/>`).join('')}
    <rect x="${xs(LAB.taper * 7)}" y="0" width="${W - xs(LAB.taper * 7)}" height="${H}" fill="rgba(253,230,138,.06)"/>
    ${line('fit', '#38bdf8', 2)}${line('fat', '#fb7185', 2)}${line('perf', '#5eead4', 3.5)}
    <circle cx="${xs(peak.d)}" cy="${ys(peak.perf)}" r="6" fill="#fde68a" style="filter:drop-shadow(0 0 6px #fde68a)"/></svg>
    <div class="lab-legend"><span style="--c:#38bdf8">Fitness (slow, τ 42 d)</span><span style="--c:#fb7185">Fatigue (fast, τ 7 d)</span><span style="--c:#5eead4">Performance = fitness − fatigue</span><span style="--c:#fde68a">Peak: day ${peak.d + 1}</span></div></div>
    <div class="lab-take"><span class="eyebrow">What it shows</span><p>Training builds fitness slowly and fatigue quickly. Every fourth week is lighter so fatigue can clear (overload, then recovery). ${LAB.cut >= 40 && LAB.cut <= 60 ? 'Your taper cut sits in the 41 to 60% band that the taper meta-analysis supports: performance rises as fatigue falls faster than fitness.' : LAB.cut < 40 ? 'A cut under 40% leaves fatigue high at the end. The taper meta-analysis supports 41 to 60%.' : 'A cut beyond 60% starts to lose fitness (reversibility). The taper meta-analysis supports 41 to 60%, keeping intensity.'} End of block: performance ${last.perf >= peak.perf * 0.97 ? 'near its peak' : 'below its peak'}.</p></div>`;
}
function labBanister() {
  return `<div class="lab-x"><div id="lab-viz" data-viz="banister">${vizBanister()}</div>
  <div class="lab-ctl">
    <label class="range">Weekly training load <b>${LAB.wk} AU</b><input type="range" min="100" max="900" step="25" value="${LAB.wk}" data-lab="wk" data-rr="1"></label>
    <label class="range">Taper starts in week <b>${LAB.taper + 1}</b><input type="range" min="6" max="11" step="1" value="${LAB.taper}" data-lab="taper" data-rr="1"></label>
    <label class="range">Taper volume cut <b>${LAB.cut}%</b><input type="range" min="0" max="90" step="5" value="${LAB.cut}" data-lab="cut" data-rr="1"></label>
    <p class="lab-src">${srcLink('banister')} · ${srcLink('bosquet')} · ${srcLink('mujika')} · Population constants; individual values differ, so this teaches the principle and does not predict a person.</p>
  </div></div>`;
}

/* ---- 3. Heart-rate zones (Tanaka; ACSM bands) ---- */
function vizHR() {
  const max = Math.round(208 - 0.7 * LAB.age), hrr = max - LAB.rhr, kv = p => Math.round(LAB.rhr + hrr * p), pm = p => Math.round(max * p);
  const bands = [['Light', 'very light to light', pm(.57), pm(.63), kv(.30), kv(.39), '#94a3b8'], ['Moderate', 'ACSM moderate', pm(.64), pm(.76), kv(.40), kv(.59), '#5eead4'], ['Vigorous', 'ACSM vigorous', pm(.77), pm(.95), kv(.60), kv(.89), '#f59e0b'], ['Near maximal', 'intervals, short', pm(.96), max, kv(.90), max, '#fb7185']];
  return `<div class="holo-panel lab-hr"><div class="hr-max"><span>Estimated maximum</span><b>${max}</b><em>beats a minute · 208 − 0.7 × age</em></div>
    <div class="hr-bars">${bands.map(b => `<div class="hr-b" style="--c:${b[6]};--w:${Math.max(8, (b[5] - b[4]) / (max - LAB.rhr) * 100)}%"><span><b>${b[0]}</b> · ${b[1]}</span><i></i><em>${b[4]} to ${b[5]} bpm (heart-rate reserve) · ${b[2]} to ${b[3]} bpm (% max)</em></div>`).join('')}</div></div>`;
}
function labHR() {
  return `<div class="lab-x"><div id="lab-viz" data-viz="hr">${vizHR()}</div>
  <div class="lab-ctl"><label class="range">Age <b>${LAB.age}</b><input type="range" min="16" max="80" value="${LAB.age}" data-lab="age" data-rr="1"></label>
    <label class="range">Resting heart rate <b>${LAB.rhr} bpm</b><input type="range" min="38" max="95" value="${LAB.rhr}" data-lab="rhr" data-rr="1"></label>
    <div class="lab-take"><span class="eyebrow">Prescribe it</span><p>ACSM: at least 150 minutes a week moderate, or 75 vigorous, or a mix. Heart-rate reserve (Karvonen) is more individual than % of maximum because it uses the resting rate. Estimates carry about ±10 beats; a measured maximum beats any formula. Beta-blockers and heat change the numbers: use effort (RPE) alongside.</p></div>
    <p class="lab-src">${srcLink('tanaka')} · ${srcLink('garber')}</p></div></div>`;
}

/* ---- 4. Load dosing from 1RM (ACSM 2026) ---- */
const DOSE = {
  strength: ['Strength', [.80, .90], '2 to 3 sets, about 3 to 6 reps', 'Each muscle group at least twice a week; stop 1 to 2 reps short of failure', 'currier'],
  hypertrophy: ['Muscle size', [.60, .80], 'About 10 sets per muscle per week, 6 to 15 reps', 'A wide range of loads works when sets end 1 to 2 reps short of failure; 60 to 80% is a practical default', 'currier'],
  power: ['Power', [.30, .70], '3 to 5 sets of 2 to 5 fast reps', 'Move each rep as fast as possible; stop the set when speed drops', 'currier'],
  start: ['Starting out (sedentary)', [.60, .70], '1 to 3 sets of 8 to 12 reps', 'Use 40 to 50% when very deconditioned; 2 to 3 days a week', 'garber']
};
function vizDose() {
  const d = DOSE[LAB.goal] || DOSE.strength, lo = Math.round(LAB.orm * d[1][0] / 2.5) * 2.5, hi = Math.round(LAB.orm * d[1][1] / 2.5) * 2.5;
  return `<div class="holo-panel lab-dose"><span class="eyebrow">${esc(d[0])}</span><div class="dose-kg"><b>${lo}</b><span>to</span><b>${hi}</b><em>kg on the bar</em></div>
    <div class="dose-meter"><i style="left:${d[1][0] * 100}%;width:${(d[1][1] - d[1][0]) * 100}%"></i>${[0, 25, 50, 75, 100].map(p => `<span style="left:${p}%">${p}%</span>`).join('')}</div>
    <p><b>${esc(d[2])}.</b> ${esc(d[3])}.</p></div>`;
}
function labDose() {
  const d = DOSE[LAB.goal] || DOSE.strength;
  return `<div class="lab-x"><div id="lab-viz" data-viz="dose">${vizDose()}</div>
  <div class="lab-ctl"><div class="seg" style="flex-wrap:wrap">${Object.entries(DOSE).map(([k, v]) => `<button data-lab-goal="${k}" aria-pressed="${LAB.goal === k}">${v[0]}</button>`).join('')}</div>
    <label class="range">One-rep max <b>${LAB.orm} kg</b><input type="range" min="10" max="250" step="2.5" value="${LAB.orm}" data-lab="orm" data-rr="1"></label>
    <div class="lab-take"><span class="eyebrow">Safety</span><p>Screen first (ACSM pre-participation algorithm). Estimate the 1RM from a 3 to 5RM when testing a true maximum is not appropriate. After 2 or more weeks off, follow the transition rules: lifting no more than 3 sessions in week 1.</p></div>
    <p class="lab-src">${srcLink(d[4])} · ${srcLink('nsca19')}</p></div></div>`;
}
const LAB_SECTIONS = [
  { id: 'levers', label: 'Levers', title: 'Levers in the body, live', description: 'Pick a lever class, drag the arms and the load. Muscle force, torque and speed update as you move.', render: () => (setTimeout(leverLoop, 30), labLevers()) },
  { id: 'banister', label: 'Fitness and fatigue', title: 'Overload, recovery and the taper', description: 'The fitness-fatigue model: why hard weeks feel worse before they feel better, and why a taper works.', render: labBanister },
  { id: 'hr', label: 'Heart-rate zones', title: 'Heart-rate zones for any age', description: 'Maximum from Tanaka, bands from ACSM, both % of maximum and heart-rate reserve.', render: labHR },
  { id: 'dose', label: 'Load from 1RM', title: 'How heavy, how many', description: 'Turn a one-rep max into the load range, sets and reps for the goal, per the 2026 ACSM resistance stand.', render: labDose }
];
EDU_DOMAINS.unshift({ id: 'labs', label: 'Interactive labs', sections: LAB_SECTIONS });
EDU_POPS.labs = ['sedentary', 'trained', 'competitive', 'elite'];
EDU.dom = 'labs'; EDU.sec = 'levers';
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.lab) return;
  const k = t.dataset.lab; LAB[k] = t.type === 'checkbox' ? t.checked : +t.value; labSave();
  if (t.dataset.rr) { const b = t.closest('label') && t.closest('label').querySelector('b'); if (b) b.textContent = k === 'wk' ? LAB.wk + ' AU' : k === 'taper' ? LAB.taper + 1 : k === 'cut' ? LAB.cut + '%' : k === 'rhr' ? LAB.rhr + ' bpm' : k === 'orm' ? LAB.orm + ' kg' : LAB[k]; const v = document.getElementById('lab-viz'); if (v) v.innerHTML = { banister: vizBanister, hr: vizHR, dose: vizDose }[v.dataset.viz](); return; }
  leverHud();
});
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.lab === 'racket') { LAB.racket = t.checked; labSave(); leverHud(); } });
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lv],[data-lab-goal]'); if (!b) return;
  if (b.dataset.lv) { const k = +b.dataset.lv; Object.assign(LAB, { cls: k, ea: LEVERS[k].ea, la: LEVERS[k].la, kg: LEVERS[k].kg, ang: 0, racket: false }); }
  else LAB.goal = b.dataset.labGoal; labSave(); keepRender();
});
