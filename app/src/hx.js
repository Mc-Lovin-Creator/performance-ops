/* HorizonX components (horizonx.so), exported via the HorizonX MCP and embedded:
   - Phosphor Flow shader (horizonx.so/shaders/phosphor-flow): live WebGL backdrop for the risk forecast
   - Border Glow (horizonx.so/tools/border-glow): orbiting lamp on the tether alert card
   Runtime code is HorizonX's original implementation, wrapped so it can mount inside the app. */
(function () {
  /* ---------- Phosphor Flow ---------- */
  const defaults = { background: '#171717', midtone: '#8e8e8e', highlight: '#f8f8f8', speed: 1, scale: 1, brightness: 1, phase: 0, animate: true };
  const controls = [
    { key: 'speed', min: 0, max: 2 }, { key: 'scale', min: 0.5, max: 2 }, { key: 'brightness', min: 0.2, max: 3 }, { key: 'phase', min: 0, max: 20 }
  ];
  const colourControls = [{ key: 'background' }, { key: 'midtone' }, { key: 'highlight' }];
  function resolveState(input = {}) {
    const state = { ...defaults };
    for (const c of controls) { const v = Number(input[c.key] ?? defaults[c.key]); state[c.key] = Number.isFinite(v) ? Math.min(c.max, Math.max(c.min, v)) : defaults[c.key]; }
    for (const { key } of colourControls) state[key] = /^#[0-9a-f]{6}$/i.test(input[key] ?? '') ? input[key] : defaults[key];
    state.animate = typeof input.animate === 'boolean' ? input.animate : defaults.animate;
    return state;
  }
  const rgb = (hex) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
  const vertexSource = 'attribute vec2 position;\nvoid main() { gl_Position = vec4(position, 0.0, 1.0); }';
  const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform float time, scale, brightness;
uniform vec3 background, midtone, highlight;
void main() {
  vec2 coord = (gl_FragCoord.xy - resolution * 0.5) / scale + resolution * 0.5;
  vec3 ray = normalize(vec3(coord, time) * 2.0 - resolution.xyy);
  vec3 energy = vec3(0.0);
  float z = 0.0, d = 0.0, s = 0.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = z * ray;
    vec3 a = normalize(cos(vec3(5.0, 0.0, 1.0) + time - d * 4.0));
    p.z += 5.0;
    a = a * dot(a, p) - cross(a, p);
    for (int layer = 2; layer <= 9; layer++) {
      float frequency = float(layer);
      a -= sin(a * frequency + time).zxy / frequency;
    }
    s = a.y;
    d = 0.1 * abs(length(p) - 3.0) + 0.07 * abs(cos(s));
    z += d;
    energy += (cos(s + vec3(0.0, 1.0, 8.0)) + 1.0) / max(d, 0.00001);
  }
  vec3 e = exp(-2.0 * energy * brightness / 5000.0);
  vec3 mapped = (1.0 - e) / (1.0 + e);
  float light = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  vec3 colour = mix(background, midtone, smoothstep(0.0, 0.55, light));
  colour = mix(colour, highlight, smoothstep(0.350003, 1.0, light));
  gl_FragColor = vec4(colour, 1.0);
}`;
  function mountPhosphorFlow(canvas, initial = {}, onError = () => { }) {
    let state = resolveState(initial);
    let gl, program, buffer, shaders = [], uniforms = {};
    let frame = 0, last = 0, time = 0, visible = true, destroyed = false, lost = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function release() { if (gl) { shaders.forEach((s) => gl.deleteShader(s)); if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); } shaders = []; program = null; buffer = null; }
    function initialize() {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL is unavailable in this browser.');
      const compile = (type, source) => { const sh = gl.createShader(type); shaders.push(sh); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('The shader could not be compiled.'); return sh; };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The shader could not be initialized.');
      gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      for (const key of ['resolution', 'time', 'scale', 'brightness', ...colourControls.map(({ key }) => key)]) uniforms[key] = gl.getUniformLocation(program, key);
      onError('');
    }
    function draw() {
      if (destroyed || lost || !program) return;
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(140000 / Math.max(1, box.width * box.height)));
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height); gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform1f(uniforms.time, time + state.phase);
      for (const key of ['scale', 'brightness']) gl.uniform1f(uniforms[key], state[key]);
      for (const { key } of colourControls) gl.uniform3fv(uniforms[key], rgb(state[key]));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function tick(now) { frame = 0; const delta = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60; time += delta * state.speed; last = now; draw(); schedule(); }
    function schedule() { if (!frame && !destroyed && !lost && program && visible && !document.hidden && state.animate && state.speed > 0 && !motion.matches) frame = requestAnimationFrame(tick); }
    function refresh() { cancelAnimationFrame(frame); frame = 0; last = 0; draw(); schedule(); }
    function contextLost(e) { e.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; }
    function contextRestored() { lost = false; shaders = []; program = null; buffer = null; try { initialize(); refresh(); } catch (err) { release(); onError(err.message); } }
    try { initialize(); } catch (err) { release(); onError(err.message); }
    const resize = new ResizeObserver(refresh); resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }); intersection.observe(canvas);
    motion.addEventListener('change', refresh); document.addEventListener('visibilitychange', refresh);
    canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
    refresh();
    return {
      update(next) { state = resolveState(next); refresh(); },
      destroy() { destroyed = true; cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); motion.removeEventListener('change', refresh); document.removeEventListener('visibilitychange', refresh); canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored); release(); }
    };
  }

  /* ---------- Border Glow ---------- */
  const DEG = Math.PI / 180;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const usableRadius = (w, h, r) => Math.max(0, Math.min(r || 0, w / 2, h / 2));
  const pointOnArc = (cx, cy, r, startDeg, turn) => { const a = (startDeg + 90 * turn) * DEG; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; };
  function nearestEdgePoint(width, height, radius, x, y) {
    const r = usableRadius(width, height, radius), insideX = x >= r && x <= width - r, insideY = y >= r && y <= height - r;
    if (!insideX && !insideY) {
      const cx = x < r ? r : width - r, cy = y < r ? r : height - r, dx = x - cx, dy = y - cy, reachOut = Math.hypot(dx, dy);
      if (r === 0 || reachOut === 0) { const px = x < r ? 0 : width, py = y < r ? 0 : height; return { x: px, y: py, distance: Math.hypot(x - px, y - py) }; }
      return { x: cx + (dx / reachOut) * r, y: cy + (dy / reachOut) * r, distance: Math.abs(reachOut - r) };
    }
    let best = null; const consider = (px, py) => { const d = Math.hypot(x - px, y - py); if (!best || d < best.distance) best = { x: px, y: py, distance: d }; };
    if (insideX) { consider(x, 0); consider(x, height); }
    if (insideY) { consider(0, y); consider(width, y); }
    return best;
  }
  function perimeterPoint(width, height, radius, t) {
    const r = usableRadius(width, height, radius), flatX = Math.max(width - 2 * r, 0), flatY = Math.max(height - 2 * r, 0), arc = (Math.PI * r) / 2, turn = (u) => (arc > 0 ? u / arc : 0);
    const legs = [
      { length: flatX, at: (u) => ({ x: r + u, y: 0 }) }, { length: arc, at: (u) => pointOnArc(width - r, r, r, -90, turn(u)) },
      { length: flatY, at: (u) => ({ x: width, y: r + u }) }, { length: arc, at: (u) => pointOnArc(width - r, height - r, r, 0, turn(u)) },
      { length: flatX, at: (u) => ({ x: width - r - u, y: height }) }, { length: arc, at: (u) => pointOnArc(r, height - r, r, 90, turn(u)) },
      { length: flatY, at: (u) => ({ x: 0, y: height - r - u }) }, { length: arc, at: (u) => pointOnArc(r, r, r, 180, turn(u)) }];
    const total = legs.reduce((s, l) => s + l.length, 0); if (!(total > 0)) return { x: width / 2, y: height / 2 };
    let travel = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < legs.length; i += 1) { const leg = legs[i]; if (travel <= leg.length || i === legs.length - 1) return leg.at(Math.min(travel, leg.length)); travel -= leg.length; }
    return legs[0].at(0);
  }
  function lampFalloff(distance, reach) { if (!(reach > 0)) return distance <= 0 ? 1 : 0; const t = Math.min(Math.max(1 - distance / reach, 0), 1); return t * t * (3 - 2 * t); }
  function approach(cur, target, elapsed, duration) { if (!(duration > 0)) return target; if (!(elapsed > 0)) return cur; return cur + (target - cur) * (1 - Math.exp((-elapsed * 3) / duration)); }
  const prefers = (q) => typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false;
  function buildBorderGlow(card, config = {}) {
    const opts = { activation: 'pointer', intro: true, introDuration: 2600, orbitDuration: 7000, attack: 180, release: 540, reach: 120, ...config };
    const reducedMotion = prefers('(prefers-reduced-motion: reduce)'), hoverless = prefers('(hover: none)');
    let disposed = false, raf = 0, lastFrame = 0, lit = 0, litTarget = 0, mode = opts.activation === 'orbit' || hoverless ? 'orbit' : 'pointer', autoStart = 0;
    const geometry = () => { const rect = card.getBoundingClientRect(), style = getComputedStyle(card); return { rect, width: rect.width, height: rect.height, radius: parseFloat(style.borderTopLeftRadius) || 0 }; };
    const writeLamp = (x, y) => { card.style.setProperty('--bgl-x', `${x.toFixed(2)}px`); card.style.setProperty('--bgl-y', `${y.toFixed(2)}px`); };
    const writeLit = () => card.style.setProperty('--bgl-lit', lit.toFixed(4));
    const parkLamp = (t) => { const { width, height, radius } = geometry(); const p = perimeterPoint(width, height, radius, t); writeLamp(p.x, p.y); };
    const frame = (now) => {
      if (disposed) return; const elapsed = lastFrame ? now - lastFrame : 16; lastFrame = now;
      if (mode === 'intro') { const progress = (now - autoStart) / Math.max(opts.introDuration, 1); if (progress >= 1) { mode = 'pointer'; litTarget = 0; } else { parkLamp(easeInOutCubic(progress)); lit = Math.sin(Math.PI * progress) ** 0.7; litTarget = lit; } }
      else if (mode === 'orbit') { parkLamp(((now - autoStart) % Math.max(opts.orbitDuration, 1)) / Math.max(opts.orbitDuration, 1)); litTarget = 1; }
      lit = approach(lit, litTarget, elapsed, litTarget > lit ? opts.attack : opts.release); if (Math.abs(lit - litTarget) < 0.0005) lit = litTarget; writeLit();
      if (mode !== 'pointer' || lit !== litTarget) raf = requestAnimationFrame(frame); else raf = 0;
    };
    const wake = () => { if (raf || disposed) return; lastFrame = 0; raf = requestAnimationFrame(frame); };
    const sleep = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const startAuto = (next) => { mode = next; autoStart = performance.now(); if (reducedMotion) { sleep(); parkLamp(0.12); lit = next === 'orbit' ? 1 : 0; litTarget = lit; writeLit(); return; } wake(); };
    const onPointerMove = (e) => { if (mode === 'orbit') return; if (mode === 'intro') mode = 'pointer'; const { rect, width, height, radius } = geometry(); const p = nearestEdgePoint(width, height, radius, e.clientX - rect.left, e.clientY - rect.top); if (!p) return; writeLamp(p.x, p.y); litTarget = lampFalloff(p.distance, opts.reach); wake(); };
    const onPointerLeave = () => { if (mode === 'orbit') return; mode = 'pointer'; litTarget = 0; wake(); };
    card.addEventListener('pointermove', onPointerMove); card.addEventListener('pointerleave', onPointerLeave);
    writeLit(); parkLamp(0.12); if (mode === 'orbit') startAuto('orbit'); else if (opts.intro) startAuto('intro');
    return { destroy() { disposed = true; sleep(); card.removeEventListener('pointermove', onPointerMove); card.removeEventListener('pointerleave', onPointerLeave); } };
  }

  /* ---------- mounting inside the app ---------- */
  let live = [];
  window.hxMountAll = function () {
    live.forEach(x => { try { x.destroy(); } catch (e) { } }); live = [];
    const light = document.documentElement.dataset.theme === 'light';
    document.querySelectorAll('.hx-phosphor canvas').forEach(c => {
      const t = c.closest('.hx-phosphor').dataset.tone || 'forecast';
      const pal = t === 'risk' ? { background: '#0b1022', midtone: '#7c2d5c', highlight: '#fda4af' } : { background: '#0b1022', midtone: '#1e5a8a', highlight: '#5eead4' };
      live.push(mountPhosphorFlow(c, Object.assign({ speed: 0.35, scale: 1.25, brightness: light ? 0.8 : 0.95 }, pal), () => { }));
    });
    document.querySelectorAll('.hx-glow').forEach(card => live.push(buildBorderGlow(card, { activation: 'orbit', orbitDuration: 5200 })));
  };
  /* the app may render before this script loads; mount whatever is already on the page */
  try { window.hxMountAll(); } catch (e) { }
})();
