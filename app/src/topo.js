/* Topographic Flow shader, exported from HorizonX (horizonx.so/shaders/topographic-flow) under the member commercial licence.
   Used once, as the live element of the Command hero. Colours follow the theme tokens --topo-bg / --topo-fg. */
const TOPO = (function () {
  const defaults = { background: '#080808', foreground: '#eeeeee', speed: 0.45, scale: 1, density: 28, thickness: 0.85, relief: 1, distortion: 1, focus: 0.54, depthOfField: 1.3, exposure: 1, phase: 0, animate: true };
  const controls = [
    { key: 'speed', min: -2, max: 2 }, { key: 'scale', min: 0.4, max: 2.5 }, { key: 'density', min: 8, max: 60 }, { key: 'thickness', min: 0.3, max: 2.5 },
    { key: 'relief', min: 0, max: 2 }, { key: 'distortion', min: 0, max: 2 }, { key: 'focus', min: 0, max: 1 }, { key: 'depthOfField', min: 0, max: 3 },
    { key: 'exposure', min: 0.3, max: 1.8 }, { key: 'phase', min: 0, max: 60 }];
  const colourControls = [{ key: 'background' }, { key: 'foreground' }];
  function resolveState(input) {
    input = input || {}; const state = Object.assign({}, defaults);
    for (const c of controls) { const v = Number(input[c.key] ?? defaults[c.key]); state[c.key] = Number.isFinite(v) ? Math.min(c.max, Math.max(c.min, v)) : defaults[c.key]; }
    for (const { key } of colourControls) state[key] = /^#[0-9a-f]{6}$/i.test(input[key] ?? '') ? input[key] : defaults[key];
    state.animate = typeof input.animate === 'boolean' ? input.animate : defaults.animate;
    return state;
  }
  const rgb = hex => [1, 3, 5].map(o => parseInt(hex.slice(o, o + 2), 16) / 255);
  const vertexSource = 'attribute vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 0.99999); }';
  const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 u_colors[2];
uniform vec4 u_scene;
uniform vec4 u_shape;
uniform vec4 u_lens;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}
float terrain(vec2 p, float t) {
  vec2 warp = vec2(noise(p * 0.65 + vec2(t, 4.3)), noise(p * 0.65 + vec2(7.1, -t * 0.7)));
  p += (warp - 0.5) * 1.8 * u_lens.z;
  float h = 0.0, amplitude = 0.56;
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) { h += amplitude * noise(p); p = turn * p * 2.03 + vec2(5.2, 9.7); amplitude *= 0.43; }
  return h;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_scene.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_scene.xy) / min(u_scene.x, u_scene.y);
  p *= 3.5 * u_scene.w; p.y *= 1.35;
  float t = u_scene.z * 0.055;
  p += vec2(t * 0.18, -t * 0.12) + vec2(2.15, 0.4);
  float base = terrain(p, t);
  p.y += (base - 0.4) * u_shape.z * 1.4;
  float h = terrain(p, t);
  float epsilon = 0.006;
  vec2 slope = vec2(terrain(p + vec2(epsilon, 0.0), t) - h, terrain(p + vec2(0.0, epsilon), t) - h) / epsilon;
  float gradient = max(length(slope), 0.018);
  float distanceToLine = abs(fract(h * u_shape.x + 0.5) - 0.5) / (u_shape.x * gradient);
  float pixel = 3.5 * u_scene.w / min(u_scene.x, u_scene.y);
  float sharpWidth = pixel * u_shape.y * 0.72;
  float defocus = pow(abs(uv.y - u_lens.x), 1.6) * u_lens.y * 0.22;
  float width = sqrt(sharpWidth * sharpWidth + defocus * defocus + pixel * pixel * 0.25);
  float line = exp(-0.5 * pow(distanceToLine / width, 2.0)) * sharpWidth / width;
  vec3 normal = normalize(vec3(-slope.x * u_shape.z, -slope.y * u_shape.z, 1.0));
  float light = max(dot(normal, normalize(vec3(-0.3, 0.7, 0.6))), 0.0);
  float rim = pow(max(0.0, -normal.y), 2.0);
  float focusLight = 0.55 + 0.45 * exp(-pow((uv.y - u_lens.x) * 4.0, 2.0));
  vec3 color = u_colors[0] * (0.65 + 1.1 * light);
  color += u_colors[1] * (0.035 * light * light + 0.08 * rim) * u_shape.z;
  color += u_colors[1] * line * focusLight * (0.6 + 0.4 * light);
  float vignette = 1.0 - 0.28 * smoothstep(0.25, 0.75, length(uv - 0.5));
  gl_FragColor = vec4(clamp(color * vignette * u_shape.w, 0.0, 1.0), 1.0);
}`;
  function mount(canvas, initial) {
    let state = resolveState(initial), gl, program, buffer, shaders = [], uniforms = {};
    let frame = 0, last = null, time = 0, visible = true, destroyed = false, lost = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function release() { if (gl) { shaders.forEach(s => gl.deleteShader(s)); if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); } shaders = []; program = null; buffer = null; }
    function initialize() {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL is unavailable');
      const compile = (type, src) => { const s = gl.createShader(type); shaders.push(s); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('compile'); return s; };
      program = gl.createProgram(); gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link'); gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const pos = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      for (const k of ['u_colors[0]', 'u_scene', 'u_shape', 'u_lens']) uniforms[k] = gl.getUniformLocation(program, k);
    }
    function draw() {
      if (destroyed || lost || !program) return;
      const box = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rw = Math.max(1, Math.round(box.width * dpr)), rh = Math.max(1, Math.round(box.height * dpr));
      const ps = Math.min(1, Math.sqrt(1200000 / (rw * rh))), w = Math.max(1, Math.round(rw * ps)), h = Math.max(1, Math.round(rh * ps));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.useProgram(program);
      gl.uniform3fv(uniforms['u_colors[0]'], new Float32Array(colourControls.map(({ key }) => rgb(state[key])).flat()));
      gl.uniform4f(uniforms.u_scene, w, h, time + state.phase, state.scale);
      gl.uniform4f(uniforms.u_shape, state.density, state.thickness, state.relief, state.exposure);
      gl.uniform4f(uniforms.u_lens, state.focus, state.depthOfField, state.distortion, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function tick(now) { frame = 0; if (last !== null) time += Math.min((now - last) / 1000, 0.1) * state.speed; last = now; draw(); schedule(); }
    function schedule() { if (!frame && !destroyed && !lost && program && visible && !document.hidden && state.animate && Math.abs(state.speed) > 0.0001 && !motion.matches) frame = requestAnimationFrame(tick); }
    function refresh() { cancelAnimationFrame(frame); frame = 0; last = null; draw(); schedule(); }
    try { initialize(); } catch (e) { release(); return null; }
    const ro = new ResizeObserver(refresh); ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; refresh(); }); io.observe(canvas);
    document.addEventListener('visibilitychange', refresh);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; });
    refresh();
    return {
      update(next) { state = resolveState(Object.assign({}, state, next)); refresh(); },
      destroy() { destroyed = true; cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', refresh); release(); }
    };
  }
  let scene = null;
  const base = { speed: 0.22, scale: 1.15, density: 22, thickness: 0.7, relief: 0.9, distortion: 0.8, focus: 0.5, depthOfField: 1.1, exposure: 0.85 };
  function isLight(h) { const [r, g, b] = rgb(/^#[0-9a-f]{6}$/i.test(h) ? h : '#101010'); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5; }
  function colours() { const cs = getComputedStyle(document.documentElement); const v = n => cs.getPropertyValue(n).trim().toLowerCase(); return { background: v('--topo-bg') || '#101010', foreground: v('--topo-fg') || '#8a8380' }; }
  return {
    attach() {
      if (scene) { scene.destroy(); scene = null; }
      const c = document.querySelector('.hero-shader'); if (!c) return;
      const col = colours(); const light = isLight(col.background);
      scene = mount(c, Object.assign({}, base, col, light ? { exposure: 1.0, relief: 0.6 } : {}));
    },
    retheme() { if (!scene) return; const col = colours(); const light = isLight(col.background); scene.update(Object.assign({}, col, light ? { exposure: 1.0, relief: 0.6 } : { exposure: 0.85, relief: 0.9 })); }
  };
})();
