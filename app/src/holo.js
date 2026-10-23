/* ---------- v44 Holo morph: a particle field that welds into a hologram of what you point at (the body, a lever, a heart, a racket, a book) ---------- */
const HOLO_SHAPES = {
  body: g => { g.beginPath(); g.arc(100, 26, 15, 0, 7); g.fill(); g.lineCap = 'round'; g.lineWidth = 20; const L = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }; L(100, 52, 100, 112); g.lineWidth = 13; L(100, 58, 66, 98); L(66, 98, 52, 132); L(100, 58, 134, 98); L(134, 98, 148, 132); g.lineWidth = 16; L(92, 116, 84, 156); L(84, 156, 82, 192); L(108, 116, 116, 156); L(116, 156, 118, 192); },
  lunge: g => { g.beginPath(); g.arc(112, 32, 14, 0, 7); g.fill(); g.lineCap = 'round'; const L = (w, a, b, c, d) => { g.lineWidth = w; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }; L(20, 108, 56, 96, 112); L(12, 106, 62, 150, 40); L(12, 104, 64, 72, 92); L(16, 96, 116, 136, 132); L(16, 136, 132, 136, 186); L(15, 94, 118, 52, 150); L(14, 52, 150, 30, 186); },
  lever: g => { g.lineCap = 'round'; g.lineWidth = 12; g.beginPath(); g.moveTo(20, 120); g.lineTo(184, 96); g.stroke(); g.beginPath(); g.moveTo(70, 116); g.lineTo(52, 160); g.lineTo(88, 160); g.closePath(); g.fill(); g.fillRect(156, 50, 34, 34); g.lineWidth = 8; g.beginPath(); g.moveTo(30, 60); g.lineTo(30, 104); g.stroke(); },
  heart: g => { g.beginPath(); g.moveTo(100, 180); g.bezierCurveTo(10, 120, 20, 30, 100, 64); g.bezierCurveTo(180, 30, 190, 120, 100, 180); g.fill(); },
  racket: g => { g.beginPath(); g.ellipse(100, 74, 52, 62, 0, 0, 7); g.fill(); g.lineCap = 'round'; g.lineWidth = 16; g.beginPath(); g.moveTo(100, 132); g.lineTo(100, 194); g.stroke(); },
  book: g => { g.beginPath(); g.moveTo(100, 56); g.quadraticCurveTo(60, 36, 22, 50); g.lineTo(22, 164); g.quadraticCurveTo(60, 150, 100, 170); g.quadraticCurveTo(140, 150, 178, 164); g.lineTo(178, 50); g.quadraticCurveTo(140, 36, 100, 56); g.fill(); }
};
const HOLO_DOM = { labs: 'lever', routines: 'lunge', recovery: 'heart', biomech: 'lever', physiology: 'heart', coaching: 'racket', evidence: 'book', body: 'body' };
const HOLO = { pts: {}, el: null, P: null, shape: null, raf: 0, hover: false };
function holoTargets(name) {
  if (HOLO.pts[name]) return HOLO.pts[name];
  const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = g.strokeStyle = '#fff'; HOLO_SHAPES[name](g);
  const d = g.getImageData(0, 0, 200, 200).data, out = []; for (let y = 0; y < 200; y += 2) for (let x = 0; x < 200; x += 2) if (d[(y * 200 + x) * 4 + 3] > 128) out.push([x / 200, y / 200]);
  return (HOLO.pts[name] = out);
}
function holoMount() {
  const cv = document.getElementById('holo-cv'); if (!cv || cv.dataset.on) return; cv.dataset.on = 1; HOLO.el = cv;
  const N = 1300, P = []; for (let i = 0; i < N; i++) P.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, s: Math.random(), tx: null, ty: null });
  HOLO.P = P; HOLO.shape = null; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cv.addEventListener('pointerenter', () => { HOLO.hover = true; holoTo('body'); });
  cv.addEventListener('pointerleave', () => { HOLO.hover = false; holoTo(null); });
  cancelAnimationFrame(HOLO.raf);
  const tick = now => {
    if (!document.body.contains(cv)) return; HOLO.raf = requestAnimationFrame(tick);
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (!r.width) return;
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, t = now / 1000, sz = Math.min(w, h) * 0.92, ox = (w - sz) / 2, oy = (h - sz) / 2;
    g.clearRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.tx != null) { const tx = ox + p.tx * sz, ty = oy + p.ty * sz, px = p.x * w, py = p.y * h; p.vx += (tx - px) / w * 0.06; p.vy += (ty - py) / h * 0.06; p.vx *= 0.82; p.vy *= 0.82; }
      else { p.vx += Math.sin(t * 0.6 + p.s * 40 + p.y * 6) * 0.00012; p.vy += Math.cos(t * 0.5 + p.s * 30 + p.x * 6) * 0.00012; p.vx *= 0.97; p.vy *= 0.97; }
      if (!reduce) { p.x += p.vx; p.y += p.vy; } if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05; if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
      const locked = p.tx != null && Math.abs(p.vx) + Math.abs(p.vy) < 0.002, a = locked ? 0.85 : 0.35 + p.s * 0.3;
      g.fillStyle = locked ? `rgba(${120 + p.s * 60 | 0},${235},${225},${a})` : `rgba(${140 + p.s * 80 | 0},${150 + p.s * 60 | 0},255,${a})`;
      const rr = (locked ? 1.7 : 1) * dpr * (0.8 + p.s * 0.9); g.fillRect(p.x * w - rr / 2, p.y * h - rr / 2, rr, rr);
    }
    if (HOLO.shape) { const sy = (t * 0.45 % 1) * h; const gr = g.createLinearGradient(0, sy - 30 * dpr, 0, sy + 4 * dpr); gr.addColorStop(0, 'rgba(94,234,212,0)'); gr.addColorStop(1, 'rgba(94,234,212,.28)'); g.fillStyle = gr; g.fillRect(0, sy - 30 * dpr, w, 34 * dpr); }
    g.globalCompositeOperation = 'source-over';
  };
  HOLO.raf = requestAnimationFrame(tick);
}
function holoTo(name) {
  if (!HOLO.P) return; HOLO.shape = name; const T = name ? holoTargets(name) : null;
  HOLO.P.forEach((p, i) => { if (T && i < T.length * 1.0) { const q = T[(i * 7919) % T.length]; p.tx = q[0] + (Math.random() - .5) * 0.006; p.ty = q[1] + (Math.random() - .5) * 0.006; } else { p.tx = p.ty = null; if (name) { p.vx += (Math.random() - .5) * 0.01; p.vy += (Math.random() - .5) * 0.01; } } });
  const lab = document.getElementById('holo-l'); if (lab) lab.textContent = name ? { body: 'The body', lunge: 'Movement', lever: 'Levers and force', heart: 'Physiology', racket: 'Padel', book: 'Evidence' }[name] : 'Point here';
}
function holoCard() { return `<div class="holo-card" title="Point at it"><canvas id="holo-cv" aria-hidden="true"></canvas><span id="holo-l">Point here</span></div>`; }
/* hovering a domain tab morphs the hologram into that domain */
document.addEventListener('pointerover', e => { const b = e.target.closest && e.target.closest('.edu-doms [data-edu="dom"]'); if (b && HOLO.P) holoTo(HOLO_DOM[b.dataset.arg] || 'body'); });
document.addEventListener('pointerout', e => { const b = e.target.closest && e.target.closest('.edu-doms'); if (b && !b.contains(e.relatedTarget) && HOLO.P && !HOLO.hover) holoTo(null); });
