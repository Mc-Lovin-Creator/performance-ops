/* ---------- v43: bring it to life — celebrations, wins, streaks, missions, tactile cards ---------- */
/* confetti: a light canvas burst in the app's colours; respects reduced motion */
function celebrate(x, y, power) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  power = power || 1; const c = document.createElement('canvas'); c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#34d399', '#38bdf8', '#a78bfa', '#f59e0b', '#f472b6', '#facc15', '#fb7185'], P = [];
  x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 3 : y;
  for (let i = 0; i < 70 * power; i++) { const a = Math.random() * Math.PI * 2, s = (4 + Math.random() * 9) * (0.7 + power * 0.3); P.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 1 }); }
  let t0 = performance.now();
  const tick = now => { const dt = Math.min(32, now - t0) / 16; t0 = now; g.clearRect(0, 0, c.width, c.height); let alive = 0;
    for (const p of P) { p.vy += .32 * dt; p.vx *= .985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= .009 * dt; if (p.life > 0 && p.y < c.height + 20) { alive++; g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); g.restore(); } }
    if (alive) requestAnimationFrame(tick); else c.remove(); };
  requestAnimationFrame(tick);
}
const at = el => { if (!el || !el.getBoundingClientRect) return [null, null]; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
/* hooks: capture phase, so the burst fires before the page re-renders */
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-act="send-group"],[data-kitact^="clear"],[data-rs],[data-mt],[data-sqlog] button');
  if (!t) return; const [x, y] = at(t);
  if (t.matches('[data-act="send-group"]')) celebrate(x, y, 1.6);
  else if (t.matches('[data-rs]') && t.getAttribute('aria-pressed') !== 'true') celebrate(x, y, .5);
  else if (!t.matches('[data-rs]')) celebrate(x, y, .7);
}, true);
document.addEventListener('change', e => { const t = e.target; if (t && t.closest && t.closest('.ftc-wrap') && t.checked) { const [x, y] = at(t.closest('.ftc-wrap')); setTimeout(() => celebrate(x, y, .8), 250); } }, true);
/* a perfect day: all seven cover steps done, celebrated once per day */
function funAfterRender() {
  const steps = document.querySelectorAll('.cov-step'); if (steps.length === 7 && [...steps].every(s => s.dataset.done === '1')) { const k = 'plos.perfect.' + TODAY_ISO; try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, 1); setTimeout(() => { celebrate(null, null, 2.2); toast('Perfect day: all seven steps done for Player 1'); }, 400); } } catch (x) { } }
  document.querySelectorAll('.wins-t b[data-to]').forEach(b => { const to = +b.dataset.to; if (b.dataset.done) return; b.dataset.done = 1; if (matchMedia('(prefers-reduced-motion: reduce)').matches) { b.textContent = to; return; } let s = performance.now(); const f = n => { const k = Math.min(1, (n - s) / 900), v = Math.round(to * (1 - Math.pow(1 - k, 3))); b.textContent = v; if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
}
/* streaks from the daily log */
function streak(test) { let n = 0; for (let d = 0; d < 60; d++) { const t = new Date(TODAY); t.setDate(t.getDate() - d); const r = DAILY[ISO(t)]; if (r && test(r)) n++; else if (d === 0) continue; else break; } return n; }
function p1Wins(T, r) {
  const steps = [RS.at === TODAY_ISO, !!r.court.warm, r.court.min > 0, r.obs.flags.length > 0 || !!r.obs.note, !!(r.other && r.other.type), r.soft.regions.length > 0, !!r.proto.done], done = steps.filter(Boolean).length;
  const warm = streak(x => x.court && x.court.warm), proto = streak(x => x.proto && x.proto.done);
  const within = (() => { let n = 0, m = 0; for (let d = 0; d < 7; d++) { const t = new Date(TODAY); t.setDate(t.getDate() - d); const x = DAILY[ISO(t)]; if (x && x.court && x.court.min > 0) { m++; if (!p1Carry(Object.assign({}, x, { court: Object.assign({ allowed: d === 0 ? T.mins : x.court.allowed, guided: d === 0 ? (T.eb || (T.p && T.p.band)) : x.court.guided }, x.court) }))) n++; } } return [n, m]; })();
  const wk = T.p ? T.p.week : 0, pct = Math.round(wk / RT.WEEKS * 100);
  const ring = (v, max, col) => { const R = 22, C = 2 * Math.PI * R; return `<svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="${R}" class="wr-bg"/><circle cx="27" cy="27" r="${R}" class="wr" style="--c:${col};--len:${C.toFixed(1)};--off:${(C * (1 - Math.min(1, v / max))).toFixed(1)}"/></svg>`; };
  const name = (me().name || '').split(' ')[0], h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const missions = [['cov-1', 'Morning check-in', steps[0]], ['cov-2', 'Warm-up routine', steps[1]], ['cov-3', 'Log court time', steps[2]], ['cov-4', 'Court observation', steps[3]], ['cov-5', 'Other training', steps[4]], ['cov-6', 'Soft tissue', steps[5]], ['cov-7', '7-minute protocol', steps[6]]].filter(m => !m[2]).slice(0, 3);
  return `<section class="wins"><div class="wins-hi"><span class="eyebrow">${hi}, ${esc(name)}</span><h2>${done === 7 ? 'Perfect day. Every step is done.' : missions.length ? `${missions.length === 1 ? 'One thing' : missions.length + ' things'} left to make today a win` : 'On track'}</h2>
      <div class="wins-m">${missions.map(m => `<button class="mission" data-go="${m[0]}"><i></i>${esc(m[1])}</button>`).join('')}${r.sent ? '<span class="mission done"><i></i>Update sent to the physician</span>' : ''}</div></div>
    <div class="wins-g">
      <div class="wins-t" style="--c:#34d399">${ring(done, 7, '#34d399')}<div><b data-to="${done}">0</b><span>of 7 steps today</span></div></div>
      <div class="wins-t" style="--c:#38bdf8">${ring(warm, 7, '#38bdf8')}<div><b data-to="${warm}">0</b><span>day warm-up streak · ${Math.max(0, 7 - warm)} to the 7-day badge</span></div></div>
      <div class="wins-t" style="--c:#a78bfa">${ring(proto, 7, '#a78bfa')}<div><b data-to="${proto}">0</b><span>day protocol streak</span></div></div>
      <div class="wins-t" style="--c:#f59e0b">${ring(within[0], Math.max(1, within[1]), '#f59e0b')}<div><b data-to="${within[0]}">0</b><span>of ${within[1]} logged days within guidance</span></div></div>
      <div class="wins-t" style="--c:#f472b6">${ring(pct, 100, '#f472b6')}<div><b data-to="${wk}">0</b><span>of ${RT.WEEKS} weeks of the return · ${esc((E.springProgressData && E.springProgressData.paceComparison && E.springProgressData.paceComparison.summary) || 'on plan')}</span></div></div>
    </div></section>`;
}
/* tactile cards: a gentle 3D tilt that follows the pointer */
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = e.target.closest && e.target.closest('.wins-t,.mcard,.popsum>div,.kit,.nr,.p1d');
  document.querySelectorAll('.tilted').forEach(x => { if (x !== c) { x.classList.remove('tilted'); x.style.removeProperty('--rx'); x.style.removeProperty('--ry'); } });
  if (!c) return; const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
  c.classList.add('tilted'); c.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg'); c.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
}, { passive: true });
window.celebrate = celebrate;
