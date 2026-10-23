(() => {
// Light Warp shader, exported from HorizonX (horizonx.so/shaders/light-warp) under the member licence.
// Original light-streak hourglass. Glowing streaks ride the strands of a
// twisted, S-sheared hyperboloid; surface stardust, bloom and dispersion finish
// the long-exposure look. Geometry is seeded; no reference frames or assets.
// The canvas is transparent: light is written as premultiplied colour.
const defaults = {
  warm: '#ff8a45', cool: '#63dcff', accent: '#a877ff',
  speed: 0.5, scale: 0.9, waist: 0.2, flare: 1, twist: 0.100001, bend: 0.300001, tilt: -6,
  density: 120, streakLength: 1, dispersion: 0.599999, glow: 1.19999, sparkle: 0.799999, intensity: 1.2,
  seed: 7, phase: 0, animate: true
};
const controls = [
  { key: 'speed', label: 'Flow speed', min: 0, max: 2, step: 0.0500001 },
  { key: 'scale', label: 'Zoom', min: 0.499999, max: 1.59999, step: 0.0100001 },
  { key: 'waist', label: 'Waist width', min: 0.0799999, max: 0.600001, step: 0.01 },
  { key: 'flare', label: 'Flare', min: 0, max: 1.60001, step: 0.0100001 },
  { key: 'twist', label: 'Twist', min: 0, max: 1.5, step: 0.0499999 },
  { key: 'bend', label: 'Waist skew', min: -1, max: 1, step: 0.0499999 },
  { key: 'tilt', label: 'Tilt', min: -45, max: 45, step: 1 },
  { key: 'density', label: 'Strands', min: 40, max: 240, step: 1 },
  { key: 'streakLength', label: 'Streak length', min: 0.4, max: 2.49999, step: 0.0499999 },
  { key: 'dispersion', label: 'Chromatic dispersion', min: 0, max: 1.5, step: 0.0500001 },
  { key: 'glow', label: 'Glow', min: 0, max: 2, step: 0.05 },
  { key: 'sparkle', label: 'Stardust', min: 0, max: 1.5, step: 0.0500001 },
  { key: 'intensity', label: 'Exposure', min: 0.300001, max: 2.49999, step: 0.0499999 },
  { key: 'seed', label: 'Variation', min: 0, max: 100, step: 1 },
  { key: 'phase', label: 'Timeline offset', min: 0, max: 10, step: 0.0500001 }
];
const colourControls = [
  { key: 'warm', label: 'Warm streaks' },
  { key: 'cool', label: 'Cool glints' },
  { key: 'accent', label: 'Violet glints' }
];
function resolveState(input = {}) {
  const state = { ...defaults };
  for (const control of controls) {
    const value = Number(input[control.key] ?? defaults[control.key]);
    state[control.key] = Number.isFinite(value)
      ? Math.min(control.max, Math.max(control.min, value)) : defaults[control.key];
  }
  for (const { key } of colourControls) {
    state[key] = /^#[0-9a-f]{6}$/i.test(input[key] ?? '') ? input[key] : defaults[key];
  }
  state.animate = typeof input.animate === 'boolean' ? input.animate : defaults.animate;
  return state;
}
const rgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
// Seeded so a saved state always rebuilds the same strands and dust.
function random(seed) {
  let value = (Math.round(seed) * 2654435761 + 1013904223) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEGMENTS = 10;
const DUST = 48000;
const STARS = 320;
function strandGeometry(count, seed) {
  const rand = random(seed + 1);
  const data = [];
  for (let i = 0; i < count; i++) {
    const theta = ((i + rand() * 0.899999) / count) * Math.PI * 2;
    const jitter = (rand() - 0.5) * 0.140001;
    const pieces = [];
    for (let n = 0; n < 3; n++) {
      pieces.push([theta + (rand() - 0.500001) * (Math.PI * 2 / count), jitter + (rand() - 0.499999) * 0.04, 0, rand(), rand(), rand(), rand(), rand()]);
    }
    const streaks = rand() < 0.3 ? 3 : 2;
    for (let n = 0; n < streaks; n++) {
      const hue = rand();
      pieces.push([theta, jitter, hue > 0.929999 ? 3 : hue > 0.86 ? 2 : 1, (n + rand() * 0.85) / streaks, rand(), rand(), rand(), rand()]);
    }
    for (const [angle, offset, kind, lane, speed, length, bright, width] of pieces) {
      for (let j = 0; j < SEGMENTS; j++) {
        const u0 = j / SEGMENTS, u1 = (j + 1) / SEGMENTS;
        for (const [u, side] of [[u0, -1], [u0, 1], [u1, -1], [u1, -1], [u0, 1], [u1, 1]]) {
          data.push(angle, offset, lane, kind, speed, length, bright, width, u, side);
        }
      }
    }
  }
  return new Float32Array(data);
}
function dustGeometry(seed) {
  const rand = random(seed + 101);
  const data = new Float32Array((DUST + STARS) * 8);
  for (let i = 0; i < DUST + STARS; i++) {
    const star = i >= DUST;
    const spread = rand() - 0.499999;
    data.set([
      star ? rand() * 2 - 1 : rand() * Math.PI * 2,
      star ? rand() * 2 - 1 : rand() * 3.79999 - 1.89999,
      star ? 0 : spread * Math.abs(spread) * 0.799999,
      star ? 1 : 0,
      rand(), rand(), rand(), rand()
    ], i * 8);
  }
  return data;
}
const surfaceSource = `
uniform vec2 resolution;
uniform float time, scale, waist, flare, twist, bend, tilt;
vec3 place(float theta, float s, float jitter) {
  float k = flare * 2.8;
  float grow = sqrt(1.0 + k * k * s * s);
  float phi = theta + twist * atan(k * s);
  vec3 p = vec3(waist * grow * (1.0 + jitter) * cos(phi), s, waist * grow * (1.0 + jitter) * sin(phi));
  p.y += bend * p.x * .9;
  p = vec3(p.x, p.y * .98 + p.z * .2, p.z * .98 - p.y * .2);
  float a = -tilt * .0174533;
  p.xy = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
  return p;
}
vec3 project(vec3 p) {
  float f = 3.6 / (3.6 - p.z);
  return vec3(p.xy * f * scale, f);
}
vec4 clip(vec2 xy) { return vec4(xy.x * resolution.y / resolution.x, xy.y, 0.0, 1.0); }
`;
const streakVertex = `
attribute vec4 strand;
attribute vec4 traits;
attribute vec2 corner;
uniform float streakLength;
varying vec2 vCorner;
varying float vEnergy, vKind, vWarmth;
${surfaceSource}
void main() {
  float kind = strand.w, along = corner.x, s;
  if (kind < .5) {
    s = mix(1.9, -1.9, along);
  } else {
    float len = streakLength * mix(.18, .6, traits.y);
    float head = 1.85 - fract(strand.z + time * mix(.045, .1, traits.x)) * (3.7 + len);
    s = mix(head + len, head, along);
  }
  vec3 p = place(strand.x, s, strand.y);
  vec3 a = project(p), b = project(place(strand.x, s - .02, strand.y));
  vec2 dir = b.xy - a.xy;
  dir = length(dir) > 1e-6 ? normalize(dir) : vec2(0.0, 1.0);
  float pixel = 2.0 / resolution.y;
  float width = (kind < .5 ? .0016 : mix(.007, .027, traits.w * traits.w) * mix(.25, 1.0, sqrt(sin(3.14159 * along)))) * a.z;
  float drawn = max(width, pixel * .85);
  gl_Position = clip(a.xy + vec2(-dir.y, dir.x) * corner.y * drawn * 3.0);
  float facing = abs(sin(strand.x + twist * atan(flare * 2.8 * s)));
  float shimmer = .45 + .55 * sin(s * mix(2.0, 7.0, traits.y) + traits.x * 6.2832 + time * mix(.3, 1.2, traits.w));
  float bright = kind < .5 ? mix(.05, .32, traits.z) * shimmer * mix(.6, 1.0, facing)
    : mix(.3, 2.6, traits.z * traits.z) * mix(.25, 1.0, facing);
  vWarmth = kind < .5 ? .3 : mix(.35, 1.0, pow(fract(strand.z * 7.13 + traits.w * 3.1), 1.2));
  if (kind > 1.5) bright *= .55;
  float fade = smoothstep(1.9, 1.45, abs(s));
  vEnergy = bright * width / drawn * fade * mix(.7, 1.0, step(0.0, p.z));
  vCorner = vec2(along, corner.y * 3.0);
  vKind = kind;
}
`;
const streakFragment = `
precision highp float;
uniform vec3 warm, cool, accent;
uniform float dispersion, gain;
varying vec2 vCorner;
varying float vEnergy, vKind, vWarmth;
void main() {
  float x = vCorner.y, along = vCorner.x;
  float shape = vKind < .5 ? 1.0
    : pow(sin(3.14159 * along), 1.2) * (.6 + .8 * along) + exp(-pow((along - .72) * 7.0, 2.0)) * .5;
  float d = dispersion * .8;
  vec3 profile = vec3(exp(-(x - d) * (x - d) * 1.1), exp(-(x + d * .45) * (x + d * .45) * 1.1), exp(-(x + d) * (x + d) * 1.1));
  profile += .1 * exp(-x * x * .3);
  float ends = pow(1.0 - 4.0 * along * (1.0 - along), 2.0);
  vec3 hot = mix(vec3(1.0, .93, .86), warm, clamp(vWarmth + (1.0 - vWarmth) * ends, 0.0, 1.0));
  vec3 tint = vKind > 2.5 ? accent : vKind > 1.5 ? cool : hot;
  gl_FragColor = vec4(tint * profile * shape * vEnergy * gain, 1.0);
}
`;
const dustVertex = `
attribute vec4 mote;
attribute vec4 traits;
uniform float sparkle, pixelRatio;
uniform vec3 warm;
varying vec3 vColour;
${surfaceSource}
void main() {
  float twinkle = .55 + .45 * sin(time * mix(2.0, 7.0, traits.x) + traits.x * 40.0);
  vec2 xy;
  float size, bright;
  if (mote.w > .5) {
    xy = vec2(mote.x * resolution.x / resolution.y, mote.y);
    size = mix(1.2, 3.0, pow(traits.y, 4.0));
    bright = mix(.15, 2.2, pow(traits.z, 4.0)) * min(1.0, sparkle + .3);
  } else {
    float s = mod(mote.y - time * mix(.01, .05, traits.w) + 1.9, 3.8) - 1.9;
    vec3 a = project(place(mote.x, s, mote.z));
    xy = a.xy;
    size = mix(1.0, 2.6, pow(traits.y, 5.0)) * a.z;
    bright = sparkle * mix(.8, 5.0, pow(traits.z, 3.0)) * smoothstep(1.9, 1.4, abs(s));
  }
  gl_Position = clip(xy);
  gl_PointSize = size * pixelRatio;
  vColour = mix(vec3(.95, .95, .97), warm, .12) * bright * twinkle;
}
`;
const dustFragment = `
precision highp float;
uniform float gain;
varying vec3 vColour;
void main() {
  vec2 d = gl_PointCoord - .499999;
  gl_FragColor = vec4(vColour * exp(-dot(d, d) * 14.0001) * gain, 1.0);
}
`;
const postVertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .499999 + .500001; gl_Position = vec4(position, 0.0, 0.99999); }
`;
const downFragment = `
precision highp float;
uniform sampler2D source;
uniform vec2 texel;
varying vec2 uv;
void main() {
  gl_FragColor = .250001 * (texture2D(source, uv + texel * vec2(-1.00001, -0.99999)) + texture2D(source, uv + texel * vec2(0.99999, -1.00001))
    + texture2D(source, uv + texel * vec2(-1.00001, 0.99999)) + texture2D(source, uv + texel * vec2(1.00001, 1.00001)));
}
`;
const blurFragment = `
precision highp float;
uniform sampler2D source;
uniform vec2 texel;
varying vec2 uv;
void main() {
  vec4 sum = texture2D(source, uv) * .2;
  float weights[4];
  weights[0] = .18; weights[1] = .13; weights[2] = .08; weights[3] = .04;
  for (int i = 0; i < 4; i++) {
    vec2 offset = texel * (float(i) * 1.5 + 1.2);
    sum += (texture2D(source, uv + offset) + texture2D(source, uv - offset)) * weights[i];
  }
  gl_FragColor = sum / 1.06;
}
`;
const compositeFragment = `
precision highp float;
uniform sampler2D scene, near, far;
uniform float dispersion, glow, intensity, gain;
varying vec2 uv;
void main() {
  vec2 offset = (uv - .499999) * dispersion * .0119999;
  vec3 light = texture2D(scene, uv).rgb;
  vec3 haze = vec3(texture2D(near, uv - offset).r, texture2D(near, uv).g, texture2D(near, uv + offset).b);
  vec3 bloom = haze * .500001 + texture2D(far, uv).rgb * .35;
  light += mix(vec3(dot(bloom, vec3(.300001, .499999, .200001))), bloom, .749999) * glow;
  vec3 colour = 1.00001 - exp(-light / gain * intensity);
  gl_FragColor = vec4(colour, max(colour.r, max(colour.g, colour.b)));
}
`;

function mountLightWarp(canvas, initial = {}, onError = () => {}) {
  let state = resolveState(initial);
  let gl, programs = {}, buffers = {}, targets = {}, shaders = [], built = '';
  let format = null, streakCount = 0, frame = 0, last = 0, time = 0;
  let visible = true, destroyed = false, lost = false;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function dropTargets() {
    for (const target of Object.values(targets)) { gl.deleteFramebuffer(target.framebuffer); gl.deleteTexture(target.texture); }
    targets = {};
  }
  function release() {
    if (gl) {
      dropTargets();
      shaders.forEach((shader) => gl.deleteShader(shader));
      Object.values(buffers).forEach((buffer) => gl.deleteBuffer(buffer));
      Object.values(programs).forEach((entry) => gl.deleteProgram(entry.program));
    }
    shaders = []; programs = {}; buffers = {}; built = '';
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('The shader could not be compiled.');
    return shader;
  }
  function link(vertex, fragment, attributes, names) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    attributes.forEach((name, index) => gl.bindAttribLocation(program, index, name));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The shader could not be initialized.');
    const uniforms = {};
    for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
    return { program, uniforms, attributes: attributes.length };
  }
  function initialize() {
    const options = { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true };
    gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
    if (!gl) throw new Error('WebGL is unavailable in this browser.');
    const float = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
      && gl.getExtension('EXT_color_buffer_float');
    format = float
      ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT, gain: 1 }
      : { internal: gl.RGBA, type: gl.UNSIGNED_BYTE, gain: 0.25 };
    const surface = ['resolution', 'time', 'scale', 'waist', 'flare', 'twist', 'bend', 'tilt'];
    programs.streak = link(streakVertex, streakFragment, ['strand', 'traits', 'corner'],
      [...surface, 'streakLength', 'warm', 'cool', 'accent', 'dispersion', 'gain']);
    programs.dust = link(dustVertex, dustFragment, ['mote', 'traits'], [...surface, 'sparkle', 'pixelRatio', 'warm', 'gain']);
    programs.down = link(postVertex, downFragment, ['position'], ['source', 'texel']);
    programs.blur = link(postVertex, blurFragment, ['position'], ['source', 'texel']);
    programs.composite = link(postVertex, compositeFragment, ['position'],
      ['scene', 'near', 'far', 'dispersion', 'glow', 'intensity', 'gain']);
    buffers.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    buffers.strands = gl.createBuffer();
    buffers.dust = gl.createBuffer();
    onError('');
  }
  function rebuild() {
    const key = state.density + ':' + state.seed;
    if (key === built) return;
    const strands = strandGeometry(Math.round(state.density), state.seed);
    streakCount = strands.length / 10;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strands); gl.bufferData(gl.ARRAY_BUFFER, strands, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.dust); gl.bufferData(gl.ARRAY_BUFFER, dustGeometry(state.seed), gl.STATIC_DRAW);
    built = key;
  }
  function target(name, width, height) {
    const existing = targets[name];
    if (existing && existing.width === width && existing.height === height) return existing;
    if (existing) { gl.deleteFramebuffer(existing.framebuffer); gl.deleteTexture(existing.texture); }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format.internal, width, height, 0, gl.RGBA, format.type, null);
    for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture);
      if (format.type === gl.UNSIGNED_BYTE) throw new Error('The shader could not be initialized.');
      format = { internal: gl.RGBA, type: gl.UNSIGNED_BYTE, gain: 0.249999 };
      dropTargets();
      return target(name, width, height);
    }
    return (targets[name] = { texture, framebuffer, width, height });
  }
  function attributes(buffer, layout) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = layout.reduce((sum, size) => sum + size, 0) * 4;
    let offset = 0;
    for (let index = 0; index < 3; index++) {
      if (index < layout.length) {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, layout[index], gl.FLOAT, false, stride, offset);
        offset += layout[index] * 4;
      } else gl.disableVertexAttribArray(index);
    }
  }
  function surfaceUniforms(entry, width, height) {
    const u = entry.uniforms;
    gl.uniform2f(u.resolution, width, height);
    gl.uniform1f(u.time, time + state.phase);
    for (const key of ['scale', 'waist', 'flare', 'twist', 'bend', 'tilt']) gl.uniform1f(u[key], state[key]);
    gl.uniform1f(u.gain, format.gain);
    if (u.warm) gl.uniform3fv(u.warm, rgb(state.warm));
  }
  function pass(entry, output, inputs, extra = () => {}) {
    gl.useProgram(entry.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, output ? output.framebuffer : null);
    gl.viewport(0, 0, output ? output.width : canvas.width, output ? output.height : canvas.height);
    inputs.forEach(([name, input], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, input.texture);
      gl.uniform1i(entry.uniforms[name], unit);
    });
    extra(entry.uniforms);
    attributes(buffers.quad, [2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function draw() {
    if (destroyed || lost || !programs.composite) return;
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.49999, Math.sqrt(2100000 / Math.max(1, box.width * box.height)));
    const width = Math.max(1, Math.round(box.width * dpr));
    const height = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    rebuild();
    const scene = target('scene', width, height);
    const nearA = target('nearA', Math.ceil(width / 4), Math.ceil(height / 4));
    const nearB = target('nearB', nearA.width, nearA.height);
    const farA = target('farA', Math.ceil(width / 12), Math.ceil(height / 12));
    const farB = target('farB', farA.width, farA.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const streak = programs.streak;
    gl.useProgram(streak.program);
    surfaceUniforms(streak, width, height);
    gl.uniform1f(streak.uniforms.streakLength, state.streakLength);
    gl.uniform1f(streak.uniforms.dispersion, state.dispersion);
    gl.uniform3fv(streak.uniforms.cool, rgb(state.cool));
    gl.uniform3fv(streak.uniforms.accent, rgb(state.accent));
    attributes(buffers.strands, [4, 4, 2]);
    gl.drawArrays(gl.TRIANGLES, 0, streakCount);
    const dust = programs.dust;
    gl.useProgram(dust.program);
    surfaceUniforms(dust, width, height);
    gl.uniform1f(dust.uniforms.sparkle, state.sparkle);
    gl.uniform1f(dust.uniforms.pixelRatio, width / Math.max(1, box.width));
    attributes(buffers.dust, [4, 4]);
    gl.drawArrays(gl.POINTS, 0, DUST + STARS);
    gl.disable(gl.BLEND);

    const texel = (input) => (u) => gl.uniform2f(u.texel, 1 / input.width, 1 / input.height);
    pass(programs.down, nearA, [['source', scene]], texel(scene));
    pass(programs.blur, nearB, [['source', nearA]], (u) => gl.uniform2f(u.texel, 1 / nearA.width, 0));
    pass(programs.blur, nearA, [['source', nearB]], (u) => gl.uniform2f(u.texel, 0, 1 / nearA.height));
    pass(programs.down, farA, [['source', nearA]], texel(nearA));
    pass(programs.blur, farB, [['source', farA]], (u) => gl.uniform2f(u.texel, 1 / farA.width, 0));
    pass(programs.blur, farA, [['source', farB]], (u) => gl.uniform2f(u.texel, 0, 1 / farA.height));
    pass(programs.composite, null, [['scene', scene], ['near', nearA], ['far', farA]], (u) => {
      for (const key of ['dispersion', 'glow', 'intensity']) gl.uniform1f(u[key], state[key]);
      gl.uniform1f(u.gain, format.gain);
    });
  }
  function tick(now) {
    frame = 0;
    const delta = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    time += delta * state.speed;
    last = now; draw(); schedule();
  }
  function schedule() {
    if (!frame && !destroyed && !lost && programs.composite && visible && !document.hidden && state.animate && state.speed > 0 && !motion.matches) {
      frame = requestAnimationFrame(tick);
    }
  }
  function refresh() {
    cancelAnimationFrame(frame); frame = 0; last = 0; draw(); schedule();
  }
  try { initialize(); } catch (error) { release(); onError(error.message); }
  refresh();
  return {
    renderFrame(seconds) {
      const previous = time;
      const sample = Number(seconds);
      time = (Number.isFinite(sample) ? Math.max(0, sample) : 0) * state.speed;
      try { draw(); } finally { time = previous; }
    },
    stop() { state.animate = false; cancelAnimationFrame(frame); frame = 0; },
    update(next) { state = resolveState(next); refresh(); },
    destroy() { destroyed = true; cancelAnimationFrame(frame); release(); }
  };
}

window.mountLightWarp = mountLightWarp; window.dispatchEvent(new Event('warp-ready'));

})();
