/* ---------- Team workload: coaches as in PadelOps (screenshot values for this month; Player 1 sessions from the PadelOps tracker, Mar to Jun 2026) ---------- */
const COACHES = [
  { id: 'andre', name: 'Andre', score: 74, status: 'Available', streak: 3, worked: 16, game: 396, warm: 168, vac: 17.5, comp: 33 },
  { id: 'carlos', name: 'Carlos', score: 71, status: 'Off today', streak: 0, worked: 15, game: 412, warm: 169, vac: 30.7, comp: 9 },
  { id: 'david', name: 'David', score: 65, status: 'Available', streak: 1, worked: 15, game: 372, warm: 198, vac: 7.1, comp: 28 },
  { id: 'pablo', name: 'Pablo', score: 52, status: 'Available', streak: 5, worked: 12, game: 285, warm: 108, vac: 22.6, comp: 26 },
  { id: 'javi', name: 'Javi', score: 29, status: 'Off today', streak: 0, worked: 9, game: 162, warm: 93, vac: 17.6, comp: 23, head: true }
];
const COACH_P1 = {"Andre": {"sessions": 18, "game": 710, "warm": 382, "months": [83.0, 351.0, 418.0, 240.0], "note": "Defense w/ slice and topspin. Volley. Dropshot", "noteDate": "2026-06-22"}, "Carlos": {"sessions": 17, "game": 641, "warm": 375, "months": [31.0, 316.0, 379.0, 290.0], "note": "Back of the court sliced and top spin. Volleys and focusing on the elbow height on the overheads.", "noteDate": "2026-06-23"}, "Pablo": {"sessions": 20, "game": 793, "warm": 361, "months": [47.0, 342.0, 450.0, 315.0], "note": "Back shots. Trying all the spins.", "noteDate": "2026-06-21"}, "David": {"sessions": 13, "game": 401, "warm": 301, "months": [20.0, 155.0, 216.0, 311.0], "note": "Magic, drop shots, tricks, blocks.", "noteDate": "2026-06-17"}, "Javi": {"sessions": 18, "game": 775, "warm": 334, "months": [12.0, 326.0, 476.0, 295.0], "note": "Dropshot from defense. Bandeja. Volley long", "noteDate": "2026-05-16"}};
const band = s => s >= 85 ? ['Very high', 'var(--band-vhigh)'] : s >= 70 ? ['High', 'var(--band-high)'] : s >= 40 ? ['Moderate', 'var(--band-mod)'] : ['Low', 'var(--band-low)'];
const hm = m => Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
let TEAM_TAB = 'coaches', COACH_OPEN = null;
function pageTeam() {
  const tabs = `<nav class="seg p1tabs" aria-label="Team"><a href="#athletes" data-tm="coaches" ${TEAM_TAB === 'coaches' ? 'aria-current="page"' : ''}>Coaches</a><a href="#athletes" data-tm="athletes" ${TEAM_TAB === 'athletes' ? 'aria-current="page"' : ''}>Athletes</a></nav>`;
  if (TEAM_TAB === 'athletes') return pageAthletes().replace('</h1>', '</h1>' + `<div style="margin-top:14px">${tabs}</div>`);
  const team = Math.round(COACHES.reduce((a, c) => a + c.score, 0) / COACHES.length);
  const maxP1 = Math.max(...Object.values(COACH_P1).map(c => c.game + c.warm));
  return `<div class="sec-head"><div><span class="eyebrow">Workload · ${TODAY.toLocaleDateString('en-GB', { month: 'long' })} · team ${team}</span><h1 style="font-size:34px;letter-spacing:-.6px">Team</h1><div style="margin-top:14px">${tabs}</div></div><a class="btn sm" href="#calendar">How the score works</a></div>
  <div class="team-grid"><div class="drift" id="drift" tabindex="0" aria-label="Coaches. Press Space to pause."><div class="drift-track">${[...DRIFT_ORDER(), ...DRIFT_ORDER()].map(c => { const b = band(c.score); return `<div class="drift-wrap"><button class="drift-card" data-cx="${c.id}" style="background-image:url(img/${c.id}.webp)" aria-label="${c.name}, load ${c.score}, ${b[0]}"><span class="drift-meta"><b>${c.name}</b><span class="serif num">${c.score}</span><em>${b[0]} · ${c.status.toLowerCase()}</em><i style="--w:${c.score}%;--c:${b[1]}"></i></span></button></div>`; }).join('')}</div></div>
  <div class="grid2" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><section class="coach-list">${COACHES.map(c => { const b = band(c.score), p = COACH_P1[c.name], open = COACH_OPEN === c.id; return `<article class="coach ${open ? 'open' : ''}">
    <button class="coach-head" data-cx="${c.id}" aria-expanded="${open}"><span class="av av-lg av-img" style="background-image:url(img/${c.id}-av.webp)" aria-hidden="true"></span><span class="grow"><b class="coach-name">${c.name}${c.head ? ' <span class="chip plain c-muted" style="font-size:11px!important">Head coach</span>' : ''}</b><span class="muted">${c.status}${c.streak ? ' · ' + c.streak + ' day streak' : ''}</span></span><span class="coach-score"><span class="serif num">${c.score}</span><span class="eyebrow" style="color:var(--ink-2)">${b[0]}</span></span></button>
    <span class="coach-bar"><i style="width:${c.score}%;background:${b[1]}"></i></span>
    <span class="coach-stats"><span><b>${c.worked}d</b> worked</span><span><b>${hm(c.game)}</b> game</span><span><b>${hm(c.warm)}</b> warm-up</span><span><b>${c.vac}</b> vac · <b style="color:var(--band-high)">+${c.comp}</b> comp</span></span>
    ${open && p ? `<div class="coach-more"><span class="eyebrow">With Player 1 · March to June</span><div class="coach-p1"><span><b class="serif num" style="font-size:28px">${p.sessions}</b> sessions</span><span><b>${hm(p.game)}</b> game</span><span><b>${hm(p.warm)}</b> warm-up</span></div>
      <div class="coach-months">${['Mar', 'Apr', 'May', 'Jun'].map((m, i) => `<span><i style="height:${Math.round(p.months[i] / 480 * 100)}%"></i><em>${m}</em></span>`).join('')}</div>
      ${p.note ? `<p class="muted" style="margin:0;font-size:13.5px">Last note, ${p.noteDate}: “${esc(p.note)}”</p>` : ''}</div>` : ''}</article>`; }).join('')}</section>
  <aside class="stack team-aside" style="gap:16px"><div class="ink-panel"><span class="eyebrow">Manager insight</span><b style="font-size:20px;line-height:1.3">Andre and Carlos are carrying the month.</b><span style="font-size:13.5px;opacity:.85">Both are in the high band with 15 or more days worked. Pablo has a 5-day streak; a rest day before the weekend keeps him in moderate. Javi has room.</span></div>
    <div class="panel"><h3>Who coaches Player 1</h3><div class="rows">${COACHES.map(c => { const p = COACH_P1[c.name]; return `<div class="row" style="font-size:13.5px"><span class="av av-img" style="background-image:url(img/${c.id}-av.webp)" aria-hidden="true"></span><span class="grow"><b>${c.name}</b> · ${p.sessions} sessions<span class="bar-track" style="display:block;margin-top:6px"><span class="bar-fill" style="display:block;width:${Math.round((p.game + p.warm) / maxP1 * 100)}%;background:var(--accent)"></span></span></span><span class="num muted">${hm(p.game + p.warm)}</span></div>`; }).join('')}</div>
    <span class="muted" style="font-size:12.5px">From the PadelOps tracker, March to June 2026. Court minutes feed Player 1's load.</span></div></aside></div></div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tm]'); if (t) { e.preventDefault(); TEAM_TAB = t.dataset.tm; keepRender(); return; }
  const c = e.target.closest('[data-cx]'); if (c) { COACH_OPEN = COACH_OPEN === c.dataset.cx ? null : c.dataset.cx; keepRender(); }
});

const DRIFT_ORDER = () => ['andre', 'pablo', 'carlos', 'javi', 'david'].map(id => COACHES.find(c => c.id === id));
/* Coach card column: the HorizonX Scroll Drift motion (horizonx.so/tools/scroll-drift), rebuilt without GSAP so it runs on our frame loop and can be filmed */
const DRIFT = { raf: 0, y: 0, last: 0, paused: false, cfg: { amplitude: 70, rotateX: 95, rotateY: 18, rotateZ: 14, depth: 60, speed: 30 } };
const jit = i => { const v = Math.sin((i + 1) * 12.98984) * 43758.5453; return v - Math.floor(v); };
function driftFrame(root, items, lap) {
  const vp = root.clientHeight, sc = root.scrollTop, C = DRIFT.cfg;
  items.forEach((el, i) => {
    const h = el.offsetHeight, top = el.parentElement.offsetTop - sc, pr = Math.min(1, Math.max(0, (vp - top) / (vp + h))), rest = 1 - pr, side = i % 2 ? 1 : -1;
    el.style.transform = `translate3d(${Math.sin(i * 0.450008) * C.amplitude}px,0,${-C.depth * Math.sin(pr * Math.PI)}px) rotateX(${C.rotateX * (0.75 + jit(i) * 0.5) * rest}deg) rotateY(${C.rotateY * side * rest}deg) rotateZ(${C.rotateZ * -side * rest}deg)`;
  });
}
function mountDrift() {
  cancelAnimationFrame(DRIFT.raf);
  const root = document.getElementById('drift'); if (!root) return;
  const items = [...root.querySelectorAll('.drift-card')]; if (items.length < 2) return;
  const lap = items[items.length / 2].parentElement.offsetTop - items[0].parentElement.offsetTop;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.scrollTop = DRIFT.y % lap; driftFrame(root, items, lap);
  root.addEventListener('scroll', () => driftFrame(root, items, lap), { passive: true });
  root.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); DRIFT.paused = !DRIFT.paused; } });
  root.addEventListener('pointerenter', () => DRIFT.hover = true); root.addEventListener('pointerleave', () => DRIFT.hover = false);
  if (reduce) return;
  DRIFT.last = performance.now();
  const step = now => {
    if (!document.body.contains(root)) return;
    const dt = Math.min(0.05, (now - DRIFT.last) / 1000); DRIFT.last = now;
    if (!DRIFT.paused && !DRIFT.hover && !window.__filming) { DRIFT.y = (root.scrollTop + DRIFT.cfg.speed * dt) % lap; root.scrollTop = DRIFT.y; }
    driftFrame(root, items, lap); DRIFT.raf = requestAnimationFrame(step);
  };
  DRIFT.raf = requestAnimationFrame(step);
}
window.__drift = (t) => { const root = document.getElementById('drift'); if (!root) return; const items = [...root.querySelectorAll('.drift-card')]; const lap = items[items.length / 2].parentElement.offsetTop - items[0].parentElement.offsetTop; root.scrollTop = (t * DRIFT.cfg.speed) % lap; driftFrame(root, items, lap); };
