/* HorizonX Glass Effort Slider (horizonx.so/tools/effort-slider-glass), exported via the HorizonX MCP.
   Engine as authored by HorizonX, trimmed to the Glass look (sound off, no catalogue preview loop).
   Used for "What he played": six session stops from Recovery to Match, with the guided stop badged. */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (l) => l[(Math.random() * l.length) | 0];
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const hexRgb = (hex) => { let h = hex.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const STOPS = 6;
  const glowCache = new Map();
  function glow(hex) {
    let c = glowCache.get(hex); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(0.2, rgba(hex, 0.75)); gr.addColorStop(0.5, rgba(hex, 0.2)); gr.addColorStop(1, rgba(hex, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowCache.set(hex, c); return c;
  }
  class FX {
    constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ps = []; this.dirty = true; this.w = 0; this.h = 0; }
    resize(w, h) { const d = Math.min(2, globalThis.devicePixelRatio || 1); this.w = w; this.h = h; this.cv.width = Math.max(1, Math.round(w * d)); this.cv.height = Math.max(1, Math.round(h * d)); this.ctx && this.ctx.setTransform(d, 0, 0, d, 0, 0); this.dirty = true; }
    add(o) { const p = Object.assign({ t: 0, life: 1, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, size: 2, kind: 'dot', comp: 'lighter', color: '#ffffff', delay: 0, a: 1 }, o); this.ps.push(p); return p; }
    step(dt) {
      const ps = this.ps;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; if (p.delay > 0) { p.delay -= dt; continue; }
        p.t += dt; if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        p.vx += p.ax * dt; p.vy += p.ay * dt; if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    clear() { this.ctx && this.ctx.clearRect(0, 0, this.w, this.h); }
    draw() {
      const c = this.ctx; if (!c) return;
      for (const p of this.ps) {
        if (p.delay > 0) continue; const k = p.t / p.life, a = p.a * (1 - k); c.globalCompositeOperation = p.comp;
        if (p.kind === 'glow') { const s = p.size * (p.grow ? 1 + p.grow * easeOut(k) : 1); c.globalAlpha = a; c.drawImage(glow(p.color), p.x - s, p.y - s, s * 2, s * 2); }
        else if (p.kind === 'flash') { const s = p.size * (0.5 + 0.7 * easeOut(k)); c.globalAlpha = p.a * (1 - k) * (1 - k); c.drawImage(glow(p.color), p.x - s, p.y - s, s * 2, s * 2); }
        else if (p.kind === 'ring') { const r = p.r0 + (p.r1 - p.r0) * easeOut(k); c.globalAlpha = a; c.strokeStyle = p.color; c.lineWidth = Math.max(0.1, p.size * (1 - k)); c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke(); }
        else if (p.kind === 'bubble') {
          const r = p.size * (0.6 + 0.4 * easeOut(Math.min(1, k * 3))); c.globalAlpha = a; c.lineWidth = 1; c.fillStyle = 'rgba(255,255,255,.08)'; c.strokeStyle = 'rgba(255,255,255,.75)';
          c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.22, 0, TAU); c.fill();
        } else { c.globalAlpha = a; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, TAU); c.fill(); }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }
  const NOFX = { add() { }, w: 0, h: 0 };
  const TINTS = ['#ffc2e0', '#ffd8b0', '#d4c4ff'];
  const THEME = {
    id: 'glass', round: '999px', shake: 0, chargeRate: 24,
    sceneDecor: '<div class="esg-blobs" aria-hidden="true"><i class="esg-blob"></i><i class="esg-blob"></i><i class="esg-blob"></i><i class="esg-blob"></i></div>',
    fill: '<div class="esg-fill"></div>',
    thumb: '<div class="esg-halo"></div><div class="esg-lens"><div class="esg-knob"></div></div>',
    knob: '.esg-knob',
    init(s) { s.st = 0; },
    frame(s, dt) { const target = clamp(Math.abs(s.v) * 0.09, 0, 0.32); const st = lerp(s.st, target, 1 - Math.exp(-dt * 18)); if (Math.abs(st - s.st) > 0.0005 || (st < 0.001 && s.st !== 0)) { s.st = st < 0.001 ? 0 : st; s.knob.style.setProperty('--st', s.st.toFixed(3)); } },
    step(s, i, dir, fx, x, y) { fx.add({ kind: 'glow', x, y, size: 12, grow: 1.2, life: 0.45, color: '#ffffff', a: 0.5 }); },
    up(s, i, l, fx, x, y) {
      fx.add({ kind: 'ring', x, y, r0: 16, r1: 36 + l * 50, size: 3 + l * 4, life: 0.65, delay: 0.3, color: '#ffffff', a: 0.3 + l * 0.35 });
      fx.add({ kind: 'glow', x, y, size: 20 + l * 30, grow: 0.8, life: 0.5, delay: 0.3, color: pick(TINTS), a: 0.5 + l * 0.4 });
      for (let k = 0; k < Math.round((2 + l * 9) * s.q); k++) fx.add({ kind: 'bubble', x: x + R(-10, 10), y: y + R(-6, 6), vx: R(-50, 50), vy: R(-120, -40), drag: 1.4, ay: -30, delay: 0.3, size: R(2.5, 5 + l * 5), life: R(0.8, 1.5), comp: 'source-over', a: 0.9 });
    },
    charge(s, fx, x, y) { fx.add({ kind: 'glow', x: x + R(-8, 8), y, vx: R(-40, 40), vy: R(-60, -10), size: R(3, 6), life: R(0.5, 1), color: pick(TINTS) }); },
    burst(s, fx, x, y) {
      fx.add({ kind: 'flash', x, y, size: 280, life: 0.95, color: '#ffd1ea' }); fx.add({ kind: 'flash', x, y, size: 130, life: 0.5, color: '#ffffff' });
      fx.add({ kind: 'ring', x, y, r0: 12, r1: 210, size: 8, life: 0.9, color: '#ffffff', a: 0.55 }); fx.add({ kind: 'ring', x, y, r0: 12, r1: 140, size: 3, life: 0.7, delay: 0.1, color: '#ffd8f0', a: 0.6 });
      for (let i = 0; i < 28 * s.q; i++) { const a = R(0, TAU), sp = R(60, 270); fx.add({ kind: 'bubble', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.6, ay: -40, life: R(1, 2.2), size: R(4, 14), comp: 'source-over', a: 0.95 }); }
      for (let i = 0; i < 36 * s.q; i++) { const a = R(0, TAU), sp = R(100, 420); fx.add({ kind: 'glow', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: R(0.6, 1.3), size: R(4, 10), color: pick(['#ff8fc0', '#ffb27a', '#b99bff', '#8fb2ff', '#ffffff']) }); }
    },
    ambient(s, fx, c, x, y, t, amb, dt) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * amb; const r = 24 + Math.sin(t * 2.2) * 4; c.drawImage(glow('#ffc6e6'), x - r, y - r, r * 2, r * 2);
      s.aacc = (s.aacc || 0) + dt * 2.5 * amb * s.q; while (s.aacc >= 1) { s.aacc--; fx.add({ kind: 'bubble', x: x + R(-14, 6), y: y + R(-6, 6), vx: R(-45, -15), vy: R(-8, 4), size: R(2.5, 5), life: R(1, 1.8), comp: 'source-over', a: 0.9 }); }
    }
  };
  class Slider {
    constructor(root, cfg, onPick) {
      this.root = root; this.theme = THEME; this.cfg = cfg; this.onPick = onPick;
      this.rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; this.q = this.rm ? 0.35 : 1;
      this.clock = 0; this.jobs = []; this.N = STOPS;
      root.innerHTML = THEME.sceneDecor + '<canvas class="es-fx" aria-hidden="true"></canvas><div class="es-wrap"><div class="es es--glass"><div class="es-in">' +
        '<div class="es-head"><span class="es-k"></span><span class="es-val" aria-hidden="true"></span><span class="es-sp"></span></div>' +
        '<div class="es-sub" aria-hidden="true"><span class="es-lo"></span><span class="es-hi"></span></div>' +
        `<div class="es-track" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="${STOPS - 1}"><div class="es-fill">${THEME.fill}<div class="es-sweep"></div></div><div class="es-lane"><div class="es-ticks"></div><div class="es-thumb">${THEME.thumb}</div><div class="es-rec" aria-hidden="true"></div></div></div>` +
        '<div class="es-foot"></div></div></div></div>';
      root.classList.add('es-root', 'es-root--glass');
      const q = (sel) => root.querySelector(sel);
      this.card = q('.es'); this.track = q('.es-track'); this.lane = q('.es-lane'); this.thumb = q('.es-thumb'); this.fill = q('.es-fill'); this.val = q('.es-val'); this.recEl = q('.es-rec');
      this.fx = new FX(q('.es-fx')); this.knob = q(THEME.knob);
      this.idx = this.ti = cfg.start; this.x = this.target = this.idx / (this.N - 1); this.v = 0; this.drag = false; this.armed = this.idx < this.N - 1; this.maxed = false; this.amb = 0; this.acc = 0; this.sx = 0; this.sy = 0; this.charge = 0; this.tx = 0; this.W = 0; this.TW = 0; this.padL = 0; this.lx = 0; this.ly = 0;
      const tw = q('.es-ticks');
      this.ticks = Array.from({ length: this.N }, (_, i) => { const d = document.createElement('i'); d.className = 'es-tick'; d.style.left = (i / (this.N - 1)) * 100 + '%'; tw.append(d); return d; });
      q('.es-k').textContent = cfg.title; q('.es-lo').textContent = cfg.low; q('.es-hi').textContent = cfg.high; this.recEl.textContent = cfg.recText; this.recEl.style.left = (cfg.rec / (this.N - 1)) * 100 + '%';
      this.track.setAttribute('aria-label', cfg.title);
      THEME.init(this); this.setLabel(cfg.levels[this.idx], 0, true); this.bind(); this.measure(); this.syncStep(true); this.picked = this.idx;
    }
    later(sec, fn) { const job = { at: this.clock + sec, fn }; this.jobs.push(job); return job; }
    runJobs() { if (!this.jobs.length) return; const due = []; this.jobs = this.jobs.filter((j) => { if (!j.fn) return false; if (j.at <= this.clock) { due.push(j); return false; } return true; }); for (const j of due) j.fn && j.fn(); }
    restart(el, cls, ms = 1900) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); this.later(ms / 1000, () => el.classList.remove(cls)); }
    bind() {
      const t = this.track;
      this.onDown = (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); t.classList.add('es-ptr'); t.focus({ preventScroll: true }); t.setPointerCapture && t.setPointerCapture(e.pointerId); this.lr = this.lane.getBoundingClientRect(); const px = this.x * this.lr.width, ex = e.clientX - this.lr.left; this.grab = Math.abs(ex - px) < 26 * (this.lr.width / (this.W || this.lr.width)) ? px - ex : 0; this.drag = true; this.card.classList.add('is-drag'); this.target = this.magnet(this.ptr(e)); };
      this.onMove = (e) => { if (this.drag) this.target = this.magnet(this.ptr(e)); };
      this.onUp = () => { if (!this.drag) return; this.drag = false; this.card.classList.remove('is-drag'); const proj = clamp(this.x + this.v * 0.12, 0, 1); this.go(Math.round(proj * (this.N - 1))); };
      this.onKey = (e) => { const top = this.N - 1, steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }; let i = null; if (e.key in steps) i = clamp(this.ti + steps[e.key], 0, top); else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = top; if (i === null) return; e.preventDefault(); t.classList.remove('es-ptr'); this.go(i); };
      t.addEventListener('pointerdown', this.onDown); t.addEventListener('pointermove', this.onMove); t.addEventListener('pointerup', this.onUp); t.addEventListener('pointercancel', this.onUp); t.addEventListener('lostpointercapture', this.onUp); t.addEventListener('keydown', this.onKey);
    }
    ptr(e) { return clamp((e.clientX - this.lr.left + this.grab) / this.lr.width, 0, 1); }
    magnet(r) { const s = 1 / (this.N - 1), n = Math.round(r / s) * s, d = r - n, z = s * 0.2; return Math.abs(d) < z ? n + Math.sign(d) * z * (d / z) * (d / z) : r; }
    go(i) { this.ti = i; this.target = i / (this.N - 1); }
    measure() {
      const root = this.root, s = root.getBoundingClientRect(), l = this.lane.getBoundingClientRect(), t = this.track.getBoundingClientRect(), k = root.offsetWidth ? s.width / root.offsetWidth || 1 : 1;
      this.fx.resize(root.clientWidth, root.clientHeight); this.W = l.width / k; this.TW = t.width / k; this.padL = (l.left - t.left) / k; this.lx = (l.left - s.left) / k - this.sx; this.ly = (l.top - s.top + l.height / 2) / k - this.sy; this.render();
    }
    render() {
      const px = this.x * this.W; this.tx = px; this.thumb.style.transform = `translate3d(${px.toFixed(2)}px,0,0)`;
      const right = Math.max(0, this.TW - (this.padL + px)); this.fill.style.clipPath = `inset(0 ${right.toFixed(2)}px 0 0 round 999px)`;
      const cs = this.card.style, vx = clamp(this.v / 3, -1, 1); this.charge = sstep(0.62, 1, this.x);
      cs.setProperty('--p', this.x.toFixed(4)); cs.setProperty('--vx', vx.toFixed(3)); cs.setProperty('--spd', Math.abs(vx).toFixed(3)); cs.setProperty('--charge', this.charge.toFixed(3));
    }
    syncStep(force) {
      const i = Math.round(this.x * (this.N - 1)); if (i === this.idx && !force) return; const dir = Math.sign(i - this.idx); this.idx = i;
      this.ticks.forEach((tk, j) => tk.classList.toggle('on', j <= i)); this.recEl.classList.toggle('on', i === this.cfg.rec);
      this.track.setAttribute('aria-valuenow', String(i)); this.track.setAttribute('aria-valuetext', this.cfg.levels[i]);
      this.root.style.setProperty('--lvl', (i / (this.N - 1)).toFixed(3)); this.root.dataset.lvl = String(i);
      this.root.classList.toggle('over', i > this.cfg.rec);
      if (force) return;
      if (this.maxed && i < this.N - 1) { this.maxed = false; this.card.classList.remove('is-max'); }
      if (i < this.N - 1) this.setLabel(this.cfg.levels[i], dir);
      const x = this.lx + (i / (this.N - 1)) * this.W + this.sx; THEME.step(this, i, dir, this.fx, x, this.ly); this.bump(dir > 0, i / (this.N - 1));
      if (dir > 0 && i < this.N - 1) { this.restart(this.card, 'lvlup', 560); THEME.up(this, i, i / (this.N - 1), this.fx, x, this.ly); }
    }
    bump(up, l) { if (this.rm || !this.knob.animate) return; const a = up ? 1.1 + l * 0.24 : 1.05; this.knob.animate([{ scale: 1 }, { scale: a, offset: 0.28 }, { scale: 1 }], { duration: up ? 460 : 300, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    setLabel(text, dir, instant) {
      const el = this.val;
      if (instant || this.rm) { el.replaceChildren(); const s = document.createElement('span'); s.className = 'cur'; s.textContent = text; el.append(s); return; }
      const d = dir < 0 ? 'down' : 'up', old = el.querySelector('span:not(.out)'), n = document.createElement('span'); n.textContent = text; n.className = 'in ' + d; el.append(n);
      if (old) { old.className = 'out ' + d; this.later(0.52, () => old.remove()); } void n.offsetWidth; n.className = 'cur';
    }
    explode() { this.maxed = true; this.card.classList.add('is-max'); this.setLabel(this.cfg.levels[this.N - 1], 1); this.restart(this.card, 'burst'); this.restart(this.root, 'boom'); const X = this.lx + this.tx + this.sx, Y = this.ly; THEME.burst(this, this.fx, X, Y); }
    update(dt) {
      this.clock += dt; this.runJobs();
      const moving = this.drag || Math.abs(this.v) > 2e-4 || Math.abs(this.target - this.x) > 2e-4;
      if (moving) {
        const k = this.drag ? 620 : 180, z = this.drag ? 0.92 : 0.6, c = 2 * Math.sqrt(k) * z, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
        for (let i = 0; i < n; i++) { this.v += (k * (this.target - this.x) - c * this.v) * h; this.x += this.v * h; if (this.x > 1) { this.x = 1; if (this.v > 0) this.v *= -0.28; } else if (this.x < 0) { this.x = 0; if (this.v < 0) this.v *= -0.28; } }
        if (!this.drag && Math.abs(this.v) < 2e-4 && Math.abs(this.target - this.x) < 2e-4) { this.x = this.target; this.v = 0; }
        this.render(); this.syncStep();
        if (this.x >= 0.992 && this.armed) { this.armed = false; this.explode(); } else if (this.x < 0.9 && !this.armed) this.armed = true;
      } else if (!this.drag && this.idx !== this.picked) { this.picked = this.idx; this.onPick && this.onPick(this.idx); }
      const X = this.lx + this.tx + this.sx, Y = this.ly;
      if (moving && !this.maxed && this.charge > 0.02) { this.acc += dt * this.charge * THEME.chargeRate * this.q; while (this.acc >= 1) { this.acc--; THEME.charge(this, this.fx, X, Y, this.charge); } }
      this.amb = this.maxed ? Math.min(1, this.amb + dt * 1.2) : Math.max(0, this.amb - dt * 2.5); THEME.frame(this, dt);
      const fx = this.fx; fx.step(dt); const has = fx.ps.length > 0 || this.amb > 0;
      if (has || fx.dirty) { fx.clear(); if (has && fx.ctx) { if (this.amb > 0) THEME.ambient(this, fx, fx.ctx, X, Y, this.clock, this.amb, dt); fx.draw(); } fx.dirty = has; }
    }
    destroy() { const t = this.track; t.removeEventListener('pointerdown', this.onDown); t.removeEventListener('pointermove', this.onMove); t.removeEventListener('pointerup', this.onUp); t.removeEventListener('pointercancel', this.onUp); t.removeEventListener('lostpointercapture', this.onUp); t.removeEventListener('keydown', this.onKey); this.jobs.length = 0; this.fx.ps.length = 0; }
  }
  function buildEffortSlider(root, cfg, onPick) {
    const slider = new Slider(root, cfg, onPick); let raf = 0, last = 0, onScreen = true, alive = true;
    const loop = (now) => { raf = 0; if (!alive) return; const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60; last = now; slider.update(dt); raf = requestAnimationFrame(loop); };
    const wake = () => { const awake = alive && onScreen && !document.hidden; if (awake && !raf) { last = 0; raf = requestAnimationFrame(loop); } else if (!awake && raf) { cancelAnimationFrame(raf); raf = 0; } };
    const io = new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; wake(); }); io.observe(root);
    const ro = new ResizeObserver(() => slider.measure()); ro.observe(root);
    document.addEventListener('visibilitychange', wake); wake();
    return { destroy() { alive = false; if (raf) cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', wake); slider.destroy(); root.replaceChildren(); } };
  }
  let live = [];
  window.hxMountSliders = function () {
    live.forEach(x => { try { x.destroy(); } catch (e) { } }); live = [];
    document.querySelectorAll('[data-hx-effort]').forEach(root => {
      const d = JSON.parse(root.dataset.hxEffort);
      live.push(buildEffortSlider(root, { title: d.title, low: 'Easier', high: 'Harder', recText: 'Guided', levels: d.levels, rec: d.rec, start: d.start }, i => {
        root.dispatchEvent(new CustomEvent('hx-effort', { bubbles: true, detail: { index: i } }));
      }));
    });
  };
  /* the app may render before this script loads; mount whatever is already on the page */
  try { window.hxMountSliders(); } catch (e) { }
})();
