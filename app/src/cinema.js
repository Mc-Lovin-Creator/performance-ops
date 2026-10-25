/* ---------- Cinema layer: the trailer's language inside the product. Command hero, drawn charts, rings, page transitions, scroll reveals ---------- */
const CINE = { warp: null };
/* Player 1 command hero: one decision, why, and the numbers that drive it */
function p1Command(T, au, planAU) {
  const a = P1(), w = p1Wellness(), rb = RT.band(a.acwr), p = T.p, B = p ? RT.BAND[p.band] : null, st = T.s ? RT_STW[T.s.st] : ['', ''];
  const EB = T.eb ? RT.BAND[T.eb] : B, amber = T.s && T.s.st === 'AMBER';
  const word = T.s && T.s.st === 'RED' ? 'Rest the arch' : amber ? 'Modify' : B ? B.label : 'No plan';
  const n = a.loads.length, L = a.loads.slice(-42), A = a.acute.slice(-Math.min(42, a.acute.length)), C = a.chronic.slice(-Math.min(42, a.chronic.length)), mx = Math.max(1, ...L, ...A, ...C) * 1.08;
  const W = 560, H = 170, bw = W / L.length;
  const line = arr => { const o = L.length - arr.length; return arr.map((v, i) => `${i ? 'L' : 'M'}${((i + o) + 0.5) * bw},${(H - v / mx * H).toFixed(1)}`).join(' '); };
  const bars = L.map((v, i) => `<rect x="${(i * bw + bw * 0.18).toFixed(1)}" y="${(H - v / mx * H).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(v / mx * H).toFixed(1)}" rx="2" style="--d:${i * 14}ms"/>`).join('');
  const ring = (k, val, frac, label, col) => { const r = 34 - k * 11, c = 2 * Math.PI * r; return `<circle r="${r}" cx="44" cy="44" class="rg-bg"/><circle r="${r}" cx="44" cy="44" class="rg" style="--c:${col};--len:${c.toFixed(1)};--off:${(c * (1 - Math.max(0.04, Math.min(1, frac)))).toFixed(1)};--d:${200 + k * 160}ms"/>`; };
  const hrvF = a.hrv == null ? 0.5 : Math.max(0, 1 + a.hrv / 40), sleepF = a.sleep ? (parseInt(a.sleep) + (parseInt((a.sleep.split(' ')[1] || '0')) / 60)) / 8 : 0.5, soreF = 1 - (a.sore || 0) / 10;
  const flag = (bad) => bad ? 'var(--risk)' : 'var(--ok)';
  return `<section class="cmd">
    <canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l">
      <span class="eyebrow">Player 1 · ${lockIcon} private · week ${p ? p.week : '-'} of ${RT.WEEKS} · ${TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <span class="cmd-tag">One colour a day.</span>
      <h1 class="cmd-word">${esc(word)}</h1>
      <p class="cmd-why">${T.s && T.s.st === 'RED' ? esc(T.s.act) : p ? `${T.mins} minutes on court at effort ${EB.range} out of 10${amber ? ', controlled drills, no match play or maximal cutting' : ', ' + RT.TLABEL[p.type].toLowerCase()}. ${amber ? 'Why: ' + esc(T.s.trig.join('; ')) + '.' : esc(B.stop)}` : ''}</p>
      <div class="cmd-chips"><span class="cmd-chip"><em>Plan</em><i style="background:var(--band-mod)"></i>${esc(B ? B.label : '')}${amber ? ' → ' + esc(EB.label) : ''} · ${T.mins} min</span><span class="cmd-chip"><em>Status</em><i style="background:${T.s && T.s.st === 'GREEN' ? 'var(--ok)' : T.s && T.s.st === 'RED' ? 'var(--risk)' : 'var(--warn)'}"></i>${st[0]} · ${w.n} wellness flag${w.n === 1 ? '' : 's'}</span><span class="cmd-chip"><em>Ratio</em>${a.noLoad ? '<i style="background:var(--ink-3)"></i>needs 14 logged days' : `<i style="background:${a.acwr > 1.25 ? 'var(--risk)' : a.acwr > 1.1 ? 'var(--warn)' : 'var(--ok)'}"></i>${a.acwr.toFixed(2)} · ${rb ? rb[1].toLowerCase() : ''}`}</span></div>
    </div>
    <div class="cmd-r">
      <div class="cmd-num"><span class="eyebrow">Court today</span><b class="serif num">${T.mins}</b><span>minutes allowed · ${p && T.mins !== p.min ? 'cut from ' + p.min + ' planned' : 'as planned'}</span></div>
      <div class="cmd-rings"><svg viewBox="0 0 88 88" width="132" height="132" aria-hidden="true">${ring(0, a.hrv, hrvF, 'HRV', flag(a.hrv != null && a.hrv < -10))}${ring(1, a.sleep, sleepF, 'Sleep', flag(sleepF < 0.75))}${ring(2, a.sore, soreF, 'Soreness', flag(a.sore >= 6))}</svg>
        <div class="cmd-legend"><span><i style="background:${flag(a.hrv != null && a.hrv < -10)}"></i>HRV <b>${a.hrv == null ? '–' : a.hrv + '%'}</b></span><span><i style="background:${flag(sleepF < 0.75)}"></i>Sleep <b>${esc(a.sleep || '–')}</b></span><span><i style="background:${flag(a.sore >= 6)}"></i>Soreness <b>${a.sore == null ? '–' : a.sore + '/10'}</b></span></div></div>
    </div>
    <figure class="cmd-chart"><figcaption><span class="eyebrow">Load · last 42 days</span><span class="cmd-key"><i class="k-bar"></i>Court minutes <i class="k-a"></i>Acute 7-day <i class="k-c"></i>Chronic 28-day</span><b class="num">${au} <small>min on court today · allowed ${T.mins}</small></b></figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Session load with acute and chronic averages"><defs><clipPath id="cmdclip"><rect class="clipr" x="0" y="-20" width="${W}" height="${H + 40}"/></clipPath></defs><g class="cb">${bars}</g><g clip-path="url(#cmdclip)"><path class="ln-c" d="${line(C)}"/><path class="ln-a" d="${line(A)}"/></g></svg></figure>
  </section>`;
}
function cineMountWarp() {
  const c = document.querySelector('.cmd-warp');
  if (CINE.warp && CINE.canvas !== c) { try { CINE.warp.destroy(); } catch (e) { } CINE.warp = null; }
  if (!c || CINE.warp) return; CINE.canvas = c;
  if (!window.mountLightWarp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { CINE.warp = window.mountLightWarp(c, { speed: 0.28, scale: 1.05, intensity: document.documentElement.dataset.theme === 'light' ? 0.75 : 1.05, glow: 1.1, density: 110, tilt: -14, sparkle: 0.6 }); } catch (e) { }
}
/* scroll reveals: panels rise in as they enter the viewport */
let CINE_IO = null;
function cineReveal() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || window.__filming) return;
  if (!CINE_IO) CINE_IO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); CINE_IO.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  document.querySelectorAll('#page .panel, #page .ag-card, #page .edu-step, #page .p1d, #page .kpi, #page .ev-card').forEach((el, i) => { if (el.dataset.rv) return; el.dataset.rv = 1; el.classList.add('rv'); el.style.setProperty('--rvd', Math.min(i % 6, 5) * 45 + 'ms'); CINE_IO.observe(el); });
}
/* every other page: its title block becomes a cinematic band with the light streaks behind it */
function cineBand() {
  const page = document.getElementById('page'); if (!page || page.querySelector('.cmd')) return;
  const h = page.querySelector(':scope > .sec-head, :scope > .stack > .sec-head'); if (!h || h.closest('.cine-band')) return;
  const band = document.createElement('section'); band.className = 'cine-band';
  band.innerHTML = '<canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>';
  h.parentNode.insertBefore(band, h); band.appendChild(h);
  const tabs = band.nextElementSibling; if (tabs && tabs.matches && tabs.matches('.p1tabs, div:has(> .p1tabs)')) band.appendChild(tabs);
}
function cineAfterRender() { if (window.hxMountAll) try { window.hxMountAll(); } catch (e) { } if (window.hxMountSliders) try { window.hxMountSliders(); } catch (e) { } hxRail(); hxNeon(); hxNeonAll(); funAfterRender(); cineBand(); cineMountWarp(); cineReveal(); }

window.addEventListener('warp-ready', () => cineMountWarp());

document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#theme')) setTimeout(() => { if (CINE.warp) { try { CINE.warp.destroy(); } catch (x) { } CINE.warp = null; CINE.canvas = null; } cineMountWarp(); }, 30); });

/* Testing hero: symmetry radar with the 90% return line */
function testHero(rows, date) {
  const n = rows.length, cx = 130, cy = 120, R = 92, lo = 60, hi = 110, rr = v => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * R;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * rr(v), cy + Math.sin(a) * rr(v)]; };
  const poly = vals => vals.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  const pass = rows.filter(r => r.ok).length, worst = rows.slice().sort((a, b) => a.lsi - b.lsi)[0];
  return `<section class="cmd radar-hero"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">Limb symmetry · tested ${esc(date)} · right is the injured side</span><span class="cmd-tag">Return needs 90% on every test.</span><h2 class="cmd-word" style="font-size:clamp(56px,7vw,104px)">${pass} of ${n}</h2>
      <p class="cmd-why">tests at 90% or more. Lowest: ${esc(worst.n.toLowerCase())} at ${worst.lsi}%. Symmetry can flatter if the good side has weakened, so absolute values are tracked too.</p>
      <div class="cmd-chips">${rows.map(r => `<span class="cmd-chip"><i style="background:${r.ok ? 'var(--ok)' : r.lsi >= 80 ? 'var(--warn)' : 'var(--risk)'}"></i>${esc(r.n.replace('Single-leg ', '').replace(' for distance', ''))} ${r.lsi}%</span>`).join('')}</div></div>
    <div class="cmd-r"><svg class="radar" viewBox="0 0 260 240" width="320" aria-label="Symmetry radar">
      ${[70, 80, 90, 100, 110].map(v => `<polygon points="${poly(rows.map(() => v))}" class="${v === 90 ? 'rd-90' : 'rd-g'}"/>`).join('')}
      ${rows.map((r, i) => { const [x, y] = pt(i, hi); const [lx, ly] = pt(i, hi + 13); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="rd-g"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="rd-l" text-anchor="middle">${esc(r.k === 'calf' ? 'Calf' : r.k === 'bal' ? 'Balance' : r.k === 'hop' ? 'Hop' : r.k === 'triple' ? 'Triple' : r.k === 'side' ? 'Side hop' : 'Y-bal')}</text>`; }).join('')}
      <polygon points="${poly(rows.map(r => r.lsi))}" class="rd-p"/>${rows.map((r, i) => { const [x, y] = pt(i, r.lsi); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="rd-d ${r.ok ? 'ok' : ''}"/>`; }).join('')}
      <text x="${cx + 4}" y="${cy - rr(90) - 3}" class="rd-l90">90%</text></svg></div></section>`;
}
/* Injury hero: days since, the healing track and where he is on it */
function injHero(inj, T) {
  const d0 = new Date(inj.date), days = Math.max(0, Math.round((TODAY - d0) / 864e5)), wk = days / 7;
  const stops = [['Calm it down', 0, 1], ['Rebuild', 1, 6], ['Get strong', 6, 12], ['Back to full padel', 12, 16]], tot = 16, pos = Math.min(1, wk / tot);
  return `<section class="cmd inj-hero"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">${esc(inj.region)} · since ${esc(inj.date)} · ${esc(inj.mech)}</span><span class="cmd-tag">Spring ligament, right.</span><h2 class="cmd-word" style="font-size:clamp(56px,7vw,104px)">Day ${days}</h2>
      <p class="cmd-why">${esc(inj.dx)}</p>
      <div class="heal-track"><div class="ht-bar">${stops.map(s => `<span style="left:${s[1] / tot * 100}%;width:${(s[2] - s[1]) / tot * 100}%"><em>${s[0]}</em><small>${s[1]}–${s[2]} wk</small></span>`).join('')}<i class="ht-fill" style="--w:${pos * 100}%"></i><b class="ht-now" style="--x:${pos * 100}%"><em>Today · week ${Math.floor(wk) + 1}</em></b></div></div>
      <div class="cmd-chips"><span class="cmd-chip"><em>Severity</em>${esc(inj.sev)}</span><span class="cmd-chip"><em>Phase</em>${T.p ? esc(RT.HEAL[T.p.heal][0]) : ''}</span><button class="cmd-chip" data-act="focus" data-arg="spring_ligament_R" style="cursor:pointer">See it in 3D ↗</button></div></div></section>`;
}
/* Treatment menu as priority cards */
function txCards(items) {
  const groups = ['Essential', 'Helpful', 'Optional'];
  return `<section class="stack" style="gap:12px"><div class="sec-head"><div><span class="eyebrow">From Player 1's recovery guide</span><h2>Treatment menu</h2></div><span class="muted" style="font-size:13px">Loading heals; support tools only help him train</span></div>
    ${groups.map(g => { const its = items.filter(x => x[0] === g); return its.length ? `<div class="tx-group"><span class="tx-g tx-${g.toLowerCase()}">${g}</span><div class="tx-cards">${its.map(x => `<article class="tx-card tx-${g.toLowerCase()}"><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('')}</div></div>` : ''; }).join('')}</section>`;
}

/* HorizonX Stepper indicators as the daily-cover progress rail: complete, active (first open step), inactive */
function hxRail() {
  const rail = document.querySelector('.hxs-rail'); if (!rail) return;
  const steps = [...document.querySelectorAll('.cov-step')]; if (!steps.length) return;
  const firstOpen = steps.findIndex(s => s.dataset.done !== '1'), done = steps.filter(s => s.dataset.done === '1').length;
  const chk = '<svg class="hxs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  rail.innerHTML = '<div class="hxs-indicators">' + steps.map((s, i) => {
    const st = s.dataset.done === '1' ? 'complete' : i === firstOpen ? 'active' : 'inactive';
    return (i ? `<span class="hxs-connector" aria-hidden="true"><span style="width:${s.dataset.done === '1' || i <= firstOpen ? 100 : 0}%"></span></span>` : '') +
      `<button type="button" class="hxs-indicator" data-status="${st}" data-go="${s.id}" aria-label="Step ${i + 1}: ${s.dataset.title}${st === 'complete' ? ', done' : ''}"><span class="hxs-circle"><span class="hxs-number">${i + 1}</span><span class="hxs-dot"></span>${chk}</span><em>${s.dataset.title}</em></button>`;
  }).join('') + `</div><span class="hxs-sum">${done} of ${steps.length} done</span>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.hxs-indicator[data-go]'); if (!b) return; const t = document.getElementById(b.dataset.go); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });

/* HorizonX Neon Glass Card treatment for the Player 1 dashboard cards (on duty, coaches, load today) */
function hxNeon() {
  const pal = [['#34d399', '#22d3ee'], ['#6366f1', '#0ea5e9'], ['#f43f5e', '#fb923c']];
  document.querySelectorAll('.p1d:not(.ngc-card)').forEach((el, i) => {
    const kids = [...el.childNodes], c = document.createElement('div'); c.className = 'ngc-content'; kids.forEach(k => c.appendChild(k));
    el.classList.add('ngc-card'); const p = pal[i % 3]; el.style.setProperty('--ngc-neon', p[0]); el.style.setProperty('--ngc-neon-alt', p[1]);
    el.insertAdjacentHTML('afterbegin', '<div class="ngc-bloom" aria-hidden="true"></div><div class="ngc-pane" aria-hidden="true"></div><div class="ngc-ring" aria-hidden="true"><i class="ngc-ring-spin"></i></div>'); el.appendChild(c);
  });
}

/* the same HorizonX Neon Glass card language on every panel, except live 3D, charts with their own frame, and form-heavy editors */
function hxNeonAll() {
  if (/^#?(anatomy|p1anat)$/.test(location.hash.replace('#', ''))) return;
  const pal = [['#6366f1', '#0ea5e9'], ['#34d399', '#22d3ee'], ['#a78bfa', '#f472b6'], ['#f59e0b', '#f43f5e']];
  document.querySelectorAll('#page .panel:not(.ngc-card):not(.gs):not(.fx):not(.guard)').forEach((el, i) => {
    if (el.querySelector('canvas') || el.closest('.ngc-card') || el.offsetHeight < 40) return;
    const cs = getComputedStyle(el), c = document.createElement('div'); c.className = 'ngc-content';
    for (const k of ['display', 'flexDirection', 'flexWrap', 'gap', 'gridTemplateColumns', 'alignItems', 'justifyContent', 'padding']) c.style[k] = cs[k];
    [...el.childNodes].forEach(k => c.appendChild(k));
    el.style.padding = '0'; el.style.display = 'block'; el.classList.add('ngc-card', 'ngc-all');
    const p = pal[i % pal.length]; el.style.setProperty('--ngc-neon', p[0]); el.style.setProperty('--ngc-neon-alt', p[1]);
    el.insertAdjacentHTML('afterbegin', '<div class="ngc-bloom" aria-hidden="true"></div><div class="ngc-pane" aria-hidden="true"></div><div class="ngc-ring" aria-hidden="true"><i class="ngc-ring-spin"></i></div>'); el.appendChild(c);
  });
}
