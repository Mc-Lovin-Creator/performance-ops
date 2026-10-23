import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

/* ---------- Anatomy Lab v3: Z-Anatomy full-body atlas (on BodyParts3D), skinned to a movement rig ----------
   1185 named structures (bones, muscles, cartilage, tendons, ligaments), joint centres measured
   from the bones themselves. Units metres, y up, z anterior, model's right = -x.          */
const D2R = Math.PI / 180;
const Lab = {}; window.AnatomyLab = Lab;
let renderer, scene, camera, controls, hostEl, canvasEl, rig, skeleton, root;
const J = {}; let P0 = new THREE.Vector3(), ANK0 = 0.062, ANKZ0 = 0;
let meta = null, meshes = [], byId = {}, pins = [], loaded = false, loading = null;
const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), clipPlanes = [];
const state = { peel: 0, style: 'cinematic', explode: 0, layers: { fascia: false, sup: true, deep: true, conn: true, cart: true, bone: true, art: false, vein: false, nerve: false, organ: false, ins: false }, xray: false, heat: true, move: 'idle', playing: true, speed: 1, phase: 0, valgus: false,
  selected: null, hidden: new Set(), isolate: null, pinMode: false, quiz: null, ghost: false, tool: 'select', hover: null, region: null };
let sysLoaded = false, sysLoading = null, measure = { pts: [], line: null, dots: [] };
const undoStack = []; let outline = null, anchor = null;
let hooks = {}, running = false, lastT = 0, started = false, userMoved = false, camAnim = null;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const COL = { bone: 0xE6DCC8, cart: 0xC9D9DE, conn: 0xD5DCE3, sup: 0xB45A4E, deep: 0x9A483E, art: 0xB8302A, vein: 0x34508F, nerve: 0xE3BC45, organ: 0xC48778, ins: 0xD8463A, fascia: 0xF1ECE2 };
/* v45 tissue looks. cinematic: wet, glossy, low-key (the reference look); clinical: bright atlas; cadaver: fixed-specimen tones */
const TISSUE = {
  muscle:   { col: { cinematic: 0xA2271F, clinical: 0xB8402F, cadaver: 0x7B3A2E }, deep: { cinematic: 0x86201B, clinical: 0x9A3428, cadaver: 0x6A3127 }, r: 0.42, cc: 0.42, ccr: 0.28, sh: 0.75, shc: 0xFFB2A0, mode: 0 },
  tendon:   { col: { cinematic: 0xEFE6D4, clinical: 0xF1EDE4, cadaver: 0xD8CBAA }, r: 0.26, cc: 0.7, ccr: 0.18, sh: 1.0, shc: 0xFFFFFF, mode: 1 },
  ligament: { col: { cinematic: 0xE6D8BC, clinical: 0xE9E1CF, cadaver: 0xCDBB95 }, r: 0.32, cc: 0.55, ccr: 0.22, sh: 0.8, shc: 0xFFF8EC, mode: 1 },
  fascia:   { col: { cinematic: 0xF4EEE2, clinical: 0xF4F1EA, cadaver: 0xDCCDAE }, r: 0.22, cc: 0.85, ccr: 0.15, sh: 0.9, shc: 0xFFFFFF, mode: 3, op: { cinematic: 0.42, clinical: 0.32, cadaver: 0.5 } },
  cart:     { col: { cinematic: 0xE6E3D8, clinical: 0xE2E2D8, cadaver: 0xD8D3C0 }, r: 0.3, cc: 0.4, ccr: 0.3, sh: 0.2, shc: 0xFFFFFF, mode: -1 },
  bone:     { col: { cinematic: 0xE9DCC0, clinical: 0xEEE5D0, cadaver: 0xD7C79F }, r: 0.55, cc: 0.12, ccr: 0.5, sh: 0, shc: 0xFFFFFF, mode: 2 },
  art:      { col: { cinematic: 0xC0161E, clinical: 0xC8232B, cadaver: 0x8A3A33 }, r: 0.24, cc: 0.85, ccr: 0.15, sh: 0.2, shc: 0xFFFFFF, mode: -1 },
  vein:     { col: { cinematic: 0x2A4BA8, clinical: 0x2F56B0, cadaver: 0x4A4A66 }, r: 0.26, cc: 0.85, ccr: 0.15, sh: 0.2, shc: 0xFFFFFF, mode: -1 },
  nerve:    { col: { cinematic: 0xF0C23E, clinical: 0xF4C542, cadaver: 0xD8C27A }, r: 0.38, cc: 0.5, ccr: 0.3, sh: 0.6, shc: 0xFFF3C4, mode: 1 },
  organ:    { col: null, r: 0.45, cc: 0.4, ccr: 0.3, sh: 0, shc: 0xFFFFFF, mode: -1 },
  ins:      { col: null, r: 0.7, cc: 0, ccr: 0.5, sh: 0, shc: 0xFFFFFF, mode: -1 }
};
function tissueOf(s) {
  if (s.layer === 'sup' || s.layer === 'deep') return 'muscle';
  if (s.layer === 'fascia') return 'fascia';
  if (s.layer === 'conn') return /tendon|tendinous|aponeuros/.test(s.name) || s.kind === 'Tendon' || s.kind === 'Aponeurosis' ? 'tendon' : /retinacul/.test(s.name) ? 'fascia' : 'ligament';
  if (s.layer === 'nerve' && s.kind !== 'Nerve') return 'organ';
  return TISSUE[s.layer] ? s.layer : 'organ';
}
const HOLO_U = { uHolo: { value: 0 }, uTime: { value: 0 }, uHoloCol: { value: new THREE.Color(0x5eead4) } };
const ORGAN_COL = [[/lung|lobe of lung|pleura/, 0xD9A5A0], [/bronch|trachea/, 0xD9C7B8], [/liver|segment of liver/, 0x7E3128], [/gallbladder|bile/, 0x5E7A3A], [/kidney|renal|suprarenal/, 0x8C3A2E], [/heart|atrium|ventricle|valve|leaflet|papillary|cusp/, 0xA6423A],
  [/stomach|oesophagus|duodenum|jejunum|ileum|colon|caecum|appendix|rectum|pharynx/, 0xD49A86], [/pancrea|salivary|parotid|submandibular|sublingual|thyroid|parathyroid|thymus|hypophysis|pineal/, 0xD8B07C], [/bladder|ureter/, 0xD7B3A3], [/tongue|palate|epiglottis|uvula|gingiva/, 0xC9706A],
  [/gyr|lobule|cerebell|culmen|declive|vermis|flocculus|nodule|lingula|tonsil|pons|midbrain|medulla|corpus callosum|cuneus|insula/, 0xE6CBC2], [/spinal cord/, 0xEFE2C8], [/eyeball|cornea|lens|retina|iris/, 0xF1EFEA]];
let composer = null, aoPass = null; Lab.quality = (window.matchMedia && matchMedia('(max-width: 760px)').matches) ? 'fast' : 'cinematic';
/* Tissue surface: fine striation along the muscle or collagen fibre direction, faded out by screen-space frequency so it only appears close up; porous mottling on bone */
function tissue(mat, mode, fib) {
  const perp = new THREE.Vector3().crossVectors(fib, Math.abs(fib.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFib = { value: fib }; sh.uniforms.uPerp = { value: perp }; sh.uniforms.uMode = { value: mode };
    Object.assign(sh.uniforms, HOLO_U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vPerpV; uniform vec3 uPerp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vPerpV = normalize((modelViewMatrix * vec4(uPerp, 0.0)).xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRest; varying vec3 vPerpV; uniform vec3 uFib; uniform vec3 uPerp; uniform float uMode; uniform float uHolo; uniform float uTime; uniform vec3 uHoloCol;
float hn(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hn(i), hn(i+vec3(1,0,0)), f.x), mix(hn(i+vec3(0,1,0)), hn(i+vec3(1,1,0)), f.x), f.y), mix(mix(hn(i+vec3(0,0,1)), hn(i+vec3(1,0,1)), f.x), mix(hn(i+vec3(0,1,1)), hn(i+vec3(1,1,1)), f.x), f.y), f.z); }
float band(float ph, float w){ return clamp(1.0 - fwidth(ph) * w, 0.0, 1.0); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float along = dot(vRest, uFib), across = dot(vRest, uPerp);
if (uMode > -0.5 && uMode < 0.5) {
  /* muscle: coarse fascicles (about 3 mm) always visible, fine fibres (about 1 mm) close up, both wandering slightly */
  float warp = 2.6 * vn(vRest * 55.0) + 1.1 * sin(along * 40.0);
  float p1 = across * 1700.0 + warp, a1 = 0.20 * band(p1, 0.6);
  float p2 = across * 5600.0 + 2.0 * vn(vRest * 180.0) + warp, a2 = 0.10 * band(p2, 0.9);
  normal = normalize(normal + vPerpV * (cos(p1) * a1 + cos(p2) * a2));
  float groove = smoothstep(0.55, 1.0, 0.5 + 0.5 * cos(p1));
  diffuseColor.rgb *= 1.0 - 0.22 * a1 / 0.20 * groove - 0.06 * a2 / 0.10 * (0.5 + 0.5 * sin(p2));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 0.9, 0.86), 0.25 * vn(vRest * 30.0));
} else if (uMode < 1.5) {
  /* tendon, ligament, nerve: tight parallel collagen bundles with crimp */
  float crimp = 0.8 * sin(along * 900.0);
  float p1 = across * 3000.0 + crimp + 1.2 * vn(vRest * 120.0), a1 = 0.14 * band(p1, 0.7);
  float p2 = across * 9000.0 + 1.5 * vn(vRest * 300.0), a2 = 0.06 * band(p2, 0.9);
  normal = normalize(normal + vPerpV * (cos(p1) * a1 + cos(p2) * a2));
  diffuseColor.rgb *= 1.0 - 0.10 * a1 / 0.14 * (0.5 + 0.5 * cos(p1));
} else if (uMode < 2.5) {
  /* bone: cortical mottling and pores */
  float n = vn(vRest * 900.0) * 0.6 + vn(vRest * 260.0) * 0.4; float fw = clamp(1.0 - fwidth(vRest.x * 900.0) * 0.5, 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - 0.05 * n * fw - 0.03 * vn(vRest * 40.0);
} else {
  /* fascia: crossed collagen lattice, the white web over muscle */
  float pa = (across + along * 0.55) * 1500.0 + 2.0 * vn(vRest * 90.0), pb = (across - along * 0.55) * 1500.0 + 2.0 * vn(vRest * 95.0);
  float la = smoothstep(0.75, 1.0, 0.5 + 0.5 * cos(pa)) * band(pa, 0.6), lb = smoothstep(0.8, 1.0, 0.5 + 0.5 * cos(pb)) * band(pb, 0.6);
  float web = max(la, lb * 0.8);
  diffuseColor.a *= 0.7 + 0.45 * web; diffuseColor.rgb *= 0.96 + 0.06 * web;
  normal = normalize(normal + vPerpV * (cos(pa) * 0.08 * band(pa, 0.6)));
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (uHolo > 0.5) {
  float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
  float scan = 0.82 + 0.18 * sin(gl_FragCoord.y * 1.4 - uTime * 5.0);
  vec3 hc = uHoloCol * (0.06 + 1.7 * fr) * scan + vec3(0.8, 1.0, 1.0) * pow(fr, 6.0) * 0.6;
  gl_FragColor = vec4(hc, clamp(0.05 + 0.85 * fr, 0.0, 1.0));
}`);
  };
  mat.customProgramCacheKey = () => 'tissue' + mode;
}

/* ---------- loading ---------- */
async function fetchPack(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Model file not found (' + res.status + ')');
  let raw = new Uint8Array(await res.arrayBuffer());
  if (raw[0] === 0x48 && raw[1] === 0x34) { // base64 text of a gzip stream ("H4sI")
    const s = atob(new TextDecoder().decode(raw)); const u = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); raw = u;
  }
  let buf;
  if (raw[0] === 0x1f && raw[1] === 0x8b) buf = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  else buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const dv = new DataView(buf); const jl = dv.getUint32(0, true);
  const m = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jl)));
  let o = 4 + jl;
  m.pos = new Int16Array(buf, o, m.nv * 3); o += m.nv * 6;
  m.si = new Uint8Array(buf, o, m.nv * 4); o += m.nv * 4;
  m.sw = new Uint8Array(buf, o, m.nv * 4); o += m.nv * 4;
  m.idx = new Uint32Array(buf.slice(o, o + m.ni * 4));
  return m;
}

function buildRig() {
  rig = new THREE.Group(); scene.add(rig);
  const bones = [];
  meta.joints.forEach((name, i) => {
    const b = new THREE.Bone(); b.name = name; J[name] = b; bones.push(b);
    const p = new THREE.Vector3(...meta.jointPos[i]), par = meta.parent[i];
    if (par) { const pi = meta.joints.indexOf(par); b.position.copy(p.sub(new THREE.Vector3(...meta.jointPos[pi]))); J[par].add(b); }
    else { b.position.copy(p); rig.add(b); root = b; }
  });
  rig.updateMatrixWorld(true);
  skeleton = new THREE.Skeleton(bones);
  P0.copy(root.position);
  ANK0 = new THREE.Vector3(...meta.jointPos[meta.joints.indexOf('ankle_R')]).y;
  ANKZ0 = new THREE.Vector3(...meta.jointPos[meta.joints.indexOf('ankle_R')]).z;
}

const REGIONS = ['Head and neck', 'Trunk and spine', 'Shoulder and upper limb', 'Pelvis and hip', 'Thigh and knee', 'Leg', 'Ankle and foot'];
const FOOT_RE = /talus|calcane|navicular|cuneiform|cuboid|metatars|of foot|toe|plantar|hallucis|digiti minimi of foot|quadratus plantae|spring|deltoid ligament|talofibular|tibiocalcaneal|tibionavicular|bifurcate|sesamoid/;
const ARM_RE = /scapula|clavicle|deltoid muscle|^(right|left) deltoid$|supraspinatus|infraspinatus|teres|subscapularis|acromio|coracoid|glenohumeral|coracoclavicular/;
function regionOf(n, c) {
  const ax = Math.abs(c.x), y = c.y;
  if (FOOT_RE.test(n) && y < 0.3) return 6;
  if (ARM_RE.test(n) || (ax > 0.155 && y > 0.7)) return 2;
  if (y > 1.47 && ax < 0.13) return 0;
  if (y >= 0.95) return 1;
  if (y >= 0.75) return 3;
  if (y >= 0.38) return 4;
  return y < 0.11 ? 6 : 5;
}
Lab.regions = () => REGIONS;
function hashTint(i) { return ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1; }
function buildMeshes(pk = meta, off0 = 0) {
  const inv = 1 / pk.scale;
  pk.structs.forEach((s, j0) => {
    const i = off0 + j0;
    if (!s.key && window.ANAT_KEYMAP) { const nm = s.name.replace(/^(right|left) /, ''); for (const [re, k] of window.ANAT_KEYMAP) if (re.test(nm)) { s.key = k; break; } }
    const [v0, vn] = s.v, [i0, inum] = s.i;
    const pos = new Float32Array(vn * 3);
    for (let k = 0; k < vn * 3; k++) pos[k] = pk.pos[v0 * 3 + k] * inv;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(pk.si.subarray(v0 * 4, (v0 + vn) * 4)), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(Array.from(pk.sw.subarray(v0 * 4, (v0 + vn) * 4), x => x / 255)), 4));
    const ix = pk.idx.subarray(i0, i0 + inum);
    g.setIndex(vn < 65536 ? new THREE.BufferAttribute(Uint16Array.from(ix), 1) : new THREE.BufferAttribute(Uint32Array.from(ix), 1));
    g.computeVertexNormals();
    const tt = tissueOf(s), T = TISSUE[tt];
    const base = new THREE.Color(s.layer === 'ins' ? (s.kind === 'Origin' ? 0xD8463A : 0x3A6FD8) : tt === 'organ' ? ((ORGAN_COL.find(([re]) => re.test(s.name)) || [0, COL.organ])[1]) : (s.layer === 'deep' ? T.deep : T.col)[state.style === 'hologram' ? 'cinematic' : state.style] || T.col.cinematic);
    if (tt === 'muscle') base.offsetHSL((hashTint(i) - 0.5) * 0.02, (hashTint(i + 3) - 0.5) * 0.06, (hashTint(i + 7) - 0.5) * 0.06);
    const layerOff = { fascia: -3, sup: 0, conn: -1, deep: 2, cart: 3, bone: 4, art: -2, vein: -2, nerve: -2, organ: 1, ins: -6 }[s.layer];
    const mat = new THREE.MeshPhysicalMaterial({ color: base, metalness: 0, side: THREE.DoubleSide, shadowSide: THREE.FrontSide, clippingPlanes: null, polygonOffset: true, polygonOffsetFactor: layerOff, polygonOffsetUnits: layerOff * 2,
      roughness: T.r, envMapIntensity: tt === 'bone' ? 0.6 : 0.85, sheen: T.sh, sheenRoughness: 0.45, sheenColor: new THREE.Color(T.shc), clearcoat: T.cc, clearcoatRoughness: T.ccr });
    if (tt === 'fascia') { const op = T.op[state.style] || 0.4; Object.assign(mat, { transparent: true, opacity: op, depthWrite: false }); mat.userData.op = op; }
    // fibre direction: the structure's longest axis
    { const P = g.attributes.position, c = new THREE.Vector3(); for (let k = 0; k < vn; k++) c.add(tmpV.fromBufferAttribute(P, k)); c.divideScalar(vn);
      let a = 0, bst = -1; for (let k = 0; k < vn; k += 3) { const dd = tmpV.fromBufferAttribute(P, k).distanceToSquared(c); if (dd > bst) { bst = dd; a = k; } }
      const A = new THREE.Vector3().fromBufferAttribute(P, a); let b = 0; bst = -1; for (let k = 0; k < vn; k += 3) { const dd = tmpV.fromBufferAttribute(P, k).distanceToSquared(A); if (dd > bst) { bst = dd; b = k; } }
      const fib = new THREE.Vector3().fromBufferAttribute(P, b).sub(A).normalize(); if (!isFinite(fib.x) || fib.lengthSq() < 0.5) fib.set(0, 1, 0);
      tissue(mat, T.mode, fib); }
    mat.userData.tissue = tt;
    mat.userData.base = base.clone();
    const m = new THREE.SkinnedMesh(g, mat);
    m.bindMode = THREE.DetachedBindMode; m.bind(skeleton, new THREE.Matrix4());
    m.frustumCulled = false;
    const id = 's' + i;
    m.userData = { id, s, layer: s.layer, veil: /retinacul|aponeuro/.test(s.name) && s.layer !== 'fascia', muscleOf: s.muscle || null, ex: 0, exT: 0, exDelay: 0 };
    { const P = g.attributes.position, c = new THREE.Vector3(); for (let k = 0; k < vn; k++) c.add(tmpV.fromBufferAttribute(P, k)); c.divideScalar(vn);
      let r = 0; for (let k = 0; k < vn; k += 3) r = Math.max(r, tmpV.fromBufferAttribute(P, k).distanceTo(c));
      m.userData.c0 = c; m.userData.r0 = r; s.region = regionOf(s.name, c); }
    if (s.layer === 'sup' || s.layer === 'deep') {
      // two end vertices along the main axis, for live length and activation
      let a = 0, b = 0, best = -1;
      const P = g.attributes.position; const c = new THREE.Vector3(); for (let k = 0; k < vn; k += 1) c.add(tmpV.fromBufferAttribute(P, k)); c.divideScalar(vn);
      for (let k = 0; k < vn; k += 3) { const d = tmpV.fromBufferAttribute(P, k).distanceToSquared(c); if (d > best) { best = d; a = k; } }
      best = -1; const A = new THREE.Vector3().fromBufferAttribute(P, a);
      for (let k = 0; k < vn; k += 3) { const d = tmpV.fromBufferAttribute(P, k).distanceToSquared(A); if (d > best) { best = d; b = k; } }
      m.userData.ends = [a, b]; m.userData.L0 = null; m.userData.act = 0;
    }
    rig.add(m); meshes.push(m); byId[id] = m;
  });
}

/* ---------- ids: struct ids (s123) or clinical keys with side (gastrocnemius_med_R) ---------- */
function resolve(id) {
  if (!id || !meta) return null;
  if (byId[id]) return id;
  const m = id.match(/^(.*)_([RL])$/); const key = m ? m[1] : id, side = m ? m[2] : '';
  const i = meta.structs.findIndex(s => s.key === key && (!side || s.side === side));
  return i >= 0 ? 's' + i : null;
}
Lab.resolve = resolve;
Lab.info = id => { const r = resolve(id); if (!r) return null; const s = byId[r].userData.s; return { id: r, name: s.name, kind: s.kind, layer: s.layer, key: s.key, side: s.side, region: s.region }; };
Lab.list = () => meta ? meta.structs.map((s, i) => ({ id: 's' + i, name: s.name, kind: s.kind, key: s.key, side: s.side, layer: s.layer, region: s.region })) : [];
Lab.credit = () => meta ? meta.credit : '';

/* ---------- motion library (same conventions as v1) ---------- */
const S = x => (1 - Math.cos(2 * Math.PI * x)) / 2;
const G = (p, c, w) => Math.exp(-Math.pow((p - c) / w, 2));
const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
const ease = x => x * x * (3 - 2 * x);
const MOVES = {
  idle: { name: 'Anatomical position', dur: 4, pose: p => ({ breathe: Math.sin(p * Math.PI * 2) }) },
  squat: { name: 'Back squat', dur: 3.2, pose: p => { const s = S(p); return { tilt: 38 * s, hipF: 82 * s, kneeF: 118 * s, shF: 85 * s, lumb: -6 * s, keepFeet: true }; } },
  gait: { name: 'Walking gait', dur: 1.15, pose: p => ({ gait: p }) },
  smash: { name: 'Padel overhead (bandeja)', dur: 2.4, pose: p => ({ smash: p }) },
  landing: { name: 'Single-leg landing', dur: 2.2, pose: p => ({ landing: p }) },
  lunge: { name: 'Lateral lunge (padel defence)', dur: 2.6, pose: p => ({ lunge: S(p) }) },
  custom: { name: 'Custom joint angles', dur: 4, pose: () => ({ custom: true }) },
  flow: { name: 'Routine flow', dur: 6, pose: p => ({ flow: p }) }
};
/* v44: keyframed movement patterns for the fascia routines; each key is a whole-body pose, eased between, looped */
const FLOW = { keys: [{}] };
Lab.flow = (keys, secPerKey) => { FLOW.keys = keys && keys.length ? keys : [{}]; MOVES.flow.dur = FLOW.keys.length * (secPerKey || 1.8); state.phase = 0; };
const CUSTOM = { hip: 0, knee: 0, ankle: 0, trunk: 0, shoulder: 0, elbow: 0, abd: 0, rot: 0 };
function abd(s, deg) { return (s === 'R' ? -1 : 1) * deg * D2R; }
let angles = {};
function resetPose() { for (const k in J) if (k !== 'pelvis') J[k].rotation.set(0, 0, 0); root.rotation.set(0, 0, 0); root.position.copy(P0); }
function applyPose(p) {
  resetPose();
  const q = MOVES[state.move].pose(p);
  for (const s of ['R', 'L']) J['elbow_' + s].rotation.x = -6 * D2R;
  angles = { hip: 0, knee: 0, ankle: 0, trunk: 0, shoulder: 0, valgus: 0 };
  let acl = false; const y0 = P0.y;
  if (q.breathe !== undefined) J.thorax.rotation.x = -0.01 * q.breathe;
  if (q.custom) {
    const c = CUSTOM;
    root.rotation.x = c.trunk * 0.5 * D2R; J.lumbar.rotation.x = c.trunk * 0.5 * D2R; J.thorax.rotation.y = c.rot * D2R;
    J.hip_R.rotation.set(-(c.hip + c.trunk * 0.5) * D2R, 0, abd('R', c.abd)); J.knee_R.rotation.x = c.knee * D2R; J.ankle_R.rotation.x = -c.ankle * D2R;
    J.shoulder_R.rotation.set(-c.shoulder * D2R, 0, 0); J.elbow_R.rotation.x = -c.elbow * D2R;
    angles = { hip: c.hip + c.trunk * 0.5, knee: c.knee, ankle: c.ankle, trunk: c.trunk, shoulder: c.shoulder, valgus: 0 };
  }
  if (q.flow !== undefined) {
    const K = FLOW.keys, n = K.length, x = Number.isFinite(q.flow) ? q.flow * n : 0, i = ((Math.floor(x) % n) + n) % n, f = x - Math.floor(x), e = (1 - Math.cos(Math.PI * f)) / 2, A = K[i] || {}, B = K[(i + 1) % n] || {};
    const gv = (o, k, sd) => (sd && (k + sd) in o) ? o[k + sd] : (o[k] || 0), v = (k, sd) => gv(A, k, sd) + (gv(B, k, sd) - gv(A, k, sd)) * e;
    root.rotation.x = v('t') * D2R; root.rotation.z = v('rz') * D2R; J.lumbar.rotation.x = v('lum') * D2R; J.lumbar.rotation.y = v('thy') * 0.35 * D2R;
    J.thorax.rotation.set(v('thx') * D2R, v('thy') * D2R, v('thz') * D2R);
    for (const sd of ['R', 'L']) {
      J['hip_' + sd].rotation.set(-(v('hip', sd) + v('t')) * D2R, (sd === 'R' ? 1 : -1) * v('hrot', sd) * D2R, abd(sd, v('hab', sd)));
      J['knee_' + sd].rotation.x = v('knee', sd) * D2R; J['ankle_' + sd].rotation.x = -v('ank', sd) * D2R;
      J['shoulder_' + sd].rotation.set(-v('sh', sd) * D2R, 0, abd(sd, v('sab', sd))); J['elbow_' + sd].rotation.x = -(6 + v('elb', sd)) * D2R;
    }
    FLOW.lift = v('lift'); FLOW.f = f; FLOW.i = i;
    angles = { hip: v('hip', 'R') + v('t'), knee: v('knee', 'R'), ankle: v('ank', 'R'), trunk: v('t'), shoulder: v('sh', 'R'), elbow: v('elb', 'R'), valgus: 0 };
  }
  if (q.tilt !== undefined) {
    root.rotation.x = q.tilt * D2R; J.lumbar.rotation.x = q.lumb * D2R;
    for (const s of ['R', 'L']) {
      const hipLocal = q.hipF + q.tilt;
      J['hip_' + s].rotation.set(-hipLocal * D2R, 0, abd(s, 8));
      J['knee_' + s].rotation.x = q.kneeF * D2R;
      J['ankle_' + s].rotation.x = -(q.kneeF - hipLocal + q.tilt) * D2R;
      J['shoulder_' + s].rotation.set(-(q.shF + q.tilt) * D2R, 0, abd(s, -4));
    }
    angles = { hip: q.hipF + q.tilt, knee: q.kneeF, ankle: q.kneeF - q.hipF, trunk: q.tilt, shoulder: q.shF, valgus: 0 };
  }
  if (q.gait !== undefined) {
    const g = ph => { ph = ((ph % 1) + 1) % 1; return { hip: 10 + 20 * Math.cos(2 * Math.PI * ph), knee: 4 + 14 * G(ph, 0.14, 0.07) + 58 * G(ph, 0.73, 0.11), ank: 9 * G(ph, 0.45, 0.13) - 17 * G(ph, 0.63, 0.06) + 3 * G(ph, 0.85, 0.1) }; };
    for (const s of ['R', 'L']) {
      const v = g(q.gait + (s === 'L' ? 0.5 : 0));
      J['hip_' + s].rotation.set(-v.hip * D2R, 0, abd(s, 1)); J['knee_' + s].rotation.x = v.knee * D2R; J['ankle_' + s].rotation.x = -v.ank * D2R;
      const arm = -18 * Math.cos(2 * Math.PI * (q.gait + (s === 'L' ? 0 : 0.5)));
      J['shoulder_' + s].rotation.set(-arm * D2R, 0, abd(s, -3)); J['elbow_' + s].rotation.x = -(18 + 8 * Math.max(0, Math.sin(2 * Math.PI * (q.gait + (s === 'L' ? 0 : 0.5))))) * D2R;
      if (s === 'R') angles = { hip: v.hip, knee: v.knee, ankle: v.ank, trunk: 2, shoulder: arm, valgus: 0 };
    }
    J.thorax.rotation.y = 6 * Math.sin(2 * Math.PI * q.gait) * D2R; root.rotation.y = -4 * Math.sin(2 * Math.PI * q.gait) * D2R;
  }
  if (q.smash !== undefined) {
    const p2 = q.smash, prep = ease(seg(p2, 0, 0.42)), hit = ease(seg(p2, 0.42, 0.55)), follow = ease(seg(p2, 0.55, 0.78)), back = ease(seg(p2, 0.78, 1));
    const k = (a, b, c, d, e) => a + (b - a) * prep + (c - b) * hit + (d - c) * follow + (e - d) * back;
    const shF = k(0, 150, 172, 70, 0), shAb = k(0, 30, 6, -18, 0), elb = k(6, 105, 5, 25, 6), trY = k(0, -32, 10, 38, 0), trX = k(0, -12, 4, 14, 0), knee = k(4, 30, 8, 22, 4);
    J.thorax.rotation.set(trX * D2R, trY * D2R, 0); J.lumbar.rotation.y = trY * 0.4 * D2R;
    J.shoulder_R.rotation.set(-shF * D2R, 0, abd('R', shAb)); J.elbow_R.rotation.x = -elb * D2R;
    J.shoulder_L.rotation.set(-k(0, 120, 60, 20, 0) * D2R, 0, abd('L', k(0, 12, 4, -8, 0))); J.elbow_L.rotation.x = -k(6, 40, 60, 80, 6) * D2R;
    for (const s of ['R', 'L']) { J['hip_' + s].rotation.set(-knee * 0.55 * D2R, 0, abd(s, 6)); J['knee_' + s].rotation.x = knee * D2R; J['ankle_' + s].rotation.x = -knee * 0.45 * D2R; }
    angles = { hip: knee * 0.55, knee, ankle: knee * 0.45, trunk: trX, shoulder: shF, valgus: 0 };
  }
  if (q.landing !== undefined) {
    const p2 = q.landing, air = 1 - ease(seg(p2, 0.12, 0.22)), load = ease(seg(p2, 0.18, 0.42)) * (1 - ease(seg(p2, 0.55, 0.9)));
    const hipF = 25 * air + 48 * load, kneeF = 18 * air + 62 * load, dors = 24 * load, v = state.valgus ? load : 0;
    J.hip_R.rotation.set(-hipF * D2R, -14 * v * D2R, abd('R', 3 - 14 * v)); J.knee_R.rotation.set(kneeF * D2R, -6 * v * D2R, abd('R', 12 * v)); J.ankle_R.rotation.x = -(dors - 12 * air) * D2R;
    J.hip_L.rotation.set(-(30 + 20 * load) * D2R, 0, abd('L', 10)); J.knee_L.rotation.x = 75 * D2R; J.ankle_L.rotation.x = 10 * D2R;
    root.rotation.x = 18 * load * D2R; root.rotation.z = -(state.valgus ? 6 : 2) * load * D2R;
    for (const s of ['R', 'L']) J['shoulder_' + s].rotation.set(-(20 + 25 * load) * D2R, 0, abd(s, 18));
    angles = { hip: hipF + 18 * load, knee: kneeF, ankle: dors, trunk: 18 * load, shoulder: 20, valgus: 12 * v };
    acl = state.valgus && v > 0.35 && kneeF < 70;
  }
  if (q.lunge !== undefined) {
    const l = q.lunge; root.position.x = P0.x - 0.16 * l;
    J.hip_R.rotation.set(-70 * l * D2R, 0, abd('R', 22 * l)); J.knee_R.rotation.x = 85 * l * D2R; J.ankle_R.rotation.set(-20 * l * D2R, 0, abd('R', -16 * l));
    J.hip_L.rotation.set(-10 * l * D2R, 0, abd('L', 34 * l)); J.knee_L.rotation.x = 4 * l * D2R; J.ankle_L.rotation.set(0, 0, abd('L', -30 * l));
    root.rotation.x = 28 * l * D2R;
    J.shoulder_R.rotation.set(-(60 * l) * D2R, 0, abd('R', 30 * l)); J.elbow_R.rotation.x = -40 * l * D2R; J.shoulder_L.rotation.set(-(30 * l) * D2R, 0, abd('L', 12 * l));
    angles = { hip: 98 * l, knee: 85 * l, ankle: 20 * l, trunk: 28 * l, shoulder: 60 * l, valgus: 0 };
  }
  rig.updateMatrixWorld(true);
  if (state.move !== 'idle') {
    const yR = J.ankle_R.getWorldPosition(tmpV).y, zR = tmpV.z, yL = J.ankle_L.getWorldPosition(tmpV2).y;
    let dy = q.landing !== undefined ? ANK0 - yR + 0.16 * (1 - ease(seg(q.landing, 0.12, 0.22))) : ANK0 - Math.min(yR, yL);
    if (q.smash !== undefined) dy += 0.05 * Math.max(0, Math.sin(Math.PI * seg(q.smash, 0.4, 0.62)));
    if (q.gait !== undefined) dy += 0.006 * Math.cos(4 * Math.PI * q.gait);
    root.position.y += dy + (q.flow !== undefined ? FLOW.lift || 0 : 0); if (q.keepFeet) root.position.z += ANKZ0 - zR;
    rig.updateMatrixWorld(true);
  }
  angles.aclAlarm = acl; Lab._acl = acl;
}

/* ---------- visibility & colour ---------- */
const PEEL = [[], ['fascia', 'sup'], ['fascia', 'sup', 'deep'], ['fascia', 'sup', 'deep', 'conn', 'cart']];
function applyVisibility() {
  const peeled = new Set(PEEL[Math.min(3, state.peel)] || []);
  const iso = state.isolate;
  const selName = state.selected && byId[state.selected] ? byId[state.selected].userData.s.name : null;
  for (const m of meshes) {
    const L = m.userData.layer, id = m.userData.id;
    let v = state.layers[L] !== false && !peeled.has(L) && !state.hidden.has(id);
    if (L === 'ins') v = !state.hidden.has(id) && (state.layers.ins || (selName && m.userData.muscleOf === selName));
    if (state.region !== null && state.region !== undefined && m.userData.s.region !== state.region && !(L === 'ins' && v)) v = false;
    if (iso && id !== iso && L !== 'bone' && !(L === 'ins' && m.userData.muscleOf === selName)) v = false;
    m.visible = v;
    const front = state.ghost && (state.selected === id || (L === 'ins' && v && m.userData.muscleOf === selName)); /* drawn after the ghosts so they cannot wash it out */
    const x = !front && ((state.xray && (L === 'sup' || L === 'deep') && state.selected !== id) || (state.ghost && state.selected && state.selected !== id));
    const op = state.ghost && state.selected ? (L === 'bone' ? 0.22 : L === 'conn' || L === 'cart' ? 0.12 : 0.09) : 0.18;
    const veil = !x && !front && m.userData.veil && state.selected !== id; /* retinacula and aponeuroses read as thin translucent bands */
    const fasc = !x && !front && L === 'fascia' && state.selected !== id, holo = state.style === 'hologram';
    m.material.transparent = holo || x || front || veil || fasc; m.material.opacity = holo ? 1 : x ? op : veil ? 0.55 : fasc ? (m.material.userData.op || 0.4) : 1;
    m.material.depthWrite = !holo && !x && !veil && !fasc; m.material.blending = holo ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.renderOrder = front ? 50 : fasc ? 8 : veil ? 5 : 0;
  }
}
function syncOutline() {
  if (!outline) return; const sel = [];
  if (state.selected && byId[state.selected] && byId[state.selected].visible) sel.push(byId[state.selected]);
  if (state.hover && state.hover !== state.selected && byId[state.hover] && byId[state.hover].visible) sel.push(byId[state.hover]);
  outline.selectedObjects = sel;
  outline.visibleEdgeColor.set(state.tool === 'hide' && state.hover && !state.selected ? 0xE0563B : 0x4B5BFF);
}
const SEL = new THREE.Color(0x5560F0);
function colourFrame(dt) {
  const quizId = state.quiz && resolve(state.quiz.id);
  const now = performance.now();
  for (const m of meshes) {
    const glow = m.userData.s.key === 'acl' && m.userData.s.side === 'R' && Lab._acl;
    if (m.material.depthTest === glow) { m.material.depthTest = !glow; m.renderOrder = glow ? 999 : 0; m.material.needsUpdate = true; }
    if (!m.visible) continue;
    const u = m.userData, mat = m.material;
    if (u.ends) {
      const a = m.getVertexPosition(u.ends[0], tmpV), b = m.getVertexPosition(u.ends[1], tmpV2);
      const L = a.distanceTo(b); if (u.L0 === null) { u.L0 = L; u.Lp = L; }
      const vel = dt > 0 ? (L - u.Lp) / (u.L0 * dt) : 0; u.Lp = L;
      const target = state.move === 'idle' ? 0 : Math.min(1, Math.max(0, Math.abs(vel) * 1.6 - 0.08));
      u.act += (target - u.act) * Math.min(1, dt * 6);
    }
    if (u.id === state.selected) { mat.color.copy(mat.userData.base).lerp(SEL, 0.72); mat.emissive.setHex(0x3a44ff); mat.emissiveIntensity = 0.16 + 0.05 * Math.sin(now / 420); }
    else if (u.id === state.hover && !STORY.on) { mat.emissive.setHex(state.tool === 'hide' ? 0xff4a2a : 0x5a6cff); mat.emissiveIntensity = 0.12; }
    else if (u.s.key === 'acl' && u.s.side === 'R' && Lab._acl) { mat.emissive.setHex(0xff2a1a); mat.emissiveIntensity = 1.4; }
    else if (quizId === u.id) { mat.emissive.setHex(0x2fd18f); mat.emissiveIntensity = 0.45 + 0.35 * Math.sin(now / 180); }
    else if (state.roles && u.s.key && ROLE_COL[state.roles[u.s.key]]) { const rc = ROLE_COL[state.roles[u.s.key]], pulse = state.roleFocus === state.roles[u.s.key] ? 1 : 0.55; mat.color.copy(mat.userData.base).lerp(rc, 0.62); mat.emissive.copy(rc); mat.emissiveIntensity = (0.2 + 0.12 * Math.sin(now / 300)) * pulse + (u.ends ? u.act * 0.5 : 0); }
    else if (state.roles && (u.layer === 'sup' || u.layer === 'deep' || u.layer === 'conn' || u.layer === 'fascia')) { mat.emissiveIntensity = 0; mat.color.copy(mat.userData.base).lerp(DIM, 0.82); }
    else if (state.heat && u.ends && state.move !== 'idle') { mat.emissive.setRGB(1, 0.62, 0.15); mat.emissiveIntensity = u.act * u.act * 0.9; }
    else if (STORY.on && u.s.key === STORY.key && u.s.side === 'R') { mat.color.copy(mat.userData.base).lerp(HL, STORY.glow); mat.emissive.setHex(0x3A3ED8); mat.emissiveIntensity = STORY.glow * (0.12 + 0.08 * Math.sin(now / 260)); }
    else { mat.emissiveIntensity = 0; if (!mat.color.equals(mat.userData.base)) mat.color.copy(mat.userData.base); }
  }
}

/* ---------- GPU picking: render ids into one pixel ---------- */
let pickRT, pickMats = new Map();
function pickId(clientX, clientY) {
  const r = canvasEl.getBoundingClientRect();
  const x = (clientX - r.left) * renderer.getPixelRatio(), y = (clientY - r.top) * renderer.getPixelRatio();
  const w = canvasEl.width, h = canvasEl.height;
  if (!pickRT) pickRT = new THREE.WebGLRenderTarget(1, 1);
  const saved = [], inLens = state.lens && LENS.p && Math.hypot(clientX - r.left - LENS.p.x, clientY - r.top - LENS.p.y) <= LENS.r, lh = inLens ? new Set(LENS_DEPTH[state.lens] || []) : null;
  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i]; if (!m.visible || (lh && lh.has(m.userData.layer))) continue;
    let pm = pickMats.get(i);
    if (!pm) { pm = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHex(i + 1, THREE.LinearSRGBColorSpace), side: THREE.DoubleSide, clippingPlanes: clipPlanes, toneMapped: false }); pickMats.set(i, pm); }
    pm.clippingPlanes = clipPlanes.length ? clipPlanes : null;
    saved.push([m, m.material]); m.material = pm;
  }
  const lensHid = lh ? meshes.filter(m => m.visible && lh.has(m.userData.layer)) : []; lensHid.forEach(m => m.visible = false);
  const bg = scene.background; scene.background = new THREE.Color(0);
  const oe = renderer.outputColorSpace; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  camera.setViewOffset(w, h, Math.round(x), Math.round(y), 1, 1);
  renderer.setRenderTarget(pickRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
  camera.clearViewOffset(); scene.background = bg; renderer.outputColorSpace = oe;
  for (const [m, mat] of saved) m.material = mat; lensHid.forEach(m => m.visible = true);
  const px = new Uint8Array(4); renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, px);
  const idx = (px[0] << 16 | px[1] << 8 | px[2]) - 1;
  return idx >= 0 && idx < meshes.length ? 's' + idx : null;
}
function addPin(id, clientX, clientY) {
  const m = byId[id]; if (!m) return;
  const r = canvasEl.getBoundingClientRect();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
  const P = m.geometry.attributes.position; let best = Infinity, bi = 0;
  for (let k = 0; k < P.count; k += 2) { const p = m.getVertexPosition(k, tmpV); const d = ray.ray.distanceSqToPoint(p) + 0.0004 * ray.ray.origin.distanceTo(p); if (d < best) { best = d; bi = k; } }
  const wp = m.getVertexPosition(bi, new THREE.Vector3());
  const ji = m.geometry.attributes.skinIndex.getX(bi), joint = skeleton.bones[ji];
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5b6cff, depthTest: false }));
  dot.renderOrder = 10; dot.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5b6cff, transparent: true, opacity: 0.25, depthTest: false })));
  dot.position.copy(joint.worldToLocal(wp)); joint.add(dot);
  pins.push({ id: 'pin' + (pins.length + 1), on: id, mesh: dot });
  hooks.onPin && hooks.onPin(pins.map(p => ({ id: p.id, on: p.on })));
}

/* ---------- camera ---------- */
function jp(name) { return J[name] ? J[name].getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.9, 0); }
function views() {
  const k = jp('knee_R'), a = jp('ankle_R'), s = jp('shoulder_R'), e = jp('elbow_R'), t = jp('thorax');
  return { anterior: [[0, 1.0, 3.1], [0, 0.86, 0]], posterior: [[0, 1.0, -3.1], [0, 0.86, 0]], lateral: [[-3.1, 1.0, 0.05], [0, 0.86, 0]],
    knee: [[k.x - 0.45, k.y + 0.12, k.z + 0.62], [k.x, k.y, k.z]], ankle: [[a.x - 0.42, a.y + 0.14, a.z + 0.48], [a.x, a.y, a.z + 0.04]],
    shoulder: [[s.x - 0.6, s.y + 0.15, s.z + 0.62], [s.x, s.y - 0.05, s.z]], elbow: [[e.x - 0.6, e.y + 0.1, e.z + 0.45], [e.x, e.y, e.z]], spine: [[0.85, t.y + 0.15, t.z - 1.15], [0, t.y, t.z]] };
}
function flyTo(name) { const v = views()[name]; if (!v) return; userMoved = true; camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v[0]), t1: new THREE.Vector3(...v[1]) }; }
function fitCamera() {
  const need = 1.0 / Math.tan(camera.fov * D2R / 2), dist = Math.max(need, need * 0.6 / Math.min(1, camera.aspect));
  controls.target.set(0, 0.85, 0); camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(-0.42, 0.1, 1).normalize(), dist);
}
function resize() {
  if (!hostEl || !renderer) return; const w = hostEl.clientWidth, h = hostEl.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); if (!userMoved && !camAnim) fitCamera();
}

/* ---------- loop ---------- */
let lastTop = 0, topCache = [];
function frame(t) {
  if (!running) return; requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (loaded) {
    if (state.playing) state.phase = (state.phase + dt * state.speed / MOVES[state.move].dur) % 1;
    applyPose(state.phase); colourFrame(state.playing ? dt : 0.0001); explodeFrame(); HOLO_U.uTime.value = t / 1000;
  }
  if (camAnim) { camAnim.t = Math.min(1, camAnim.t + dt * 1.1); const e = camAnim.t < 0.5 ? 4 * camAnim.t ** 3 : 1 - Math.pow(-2 * camAnim.t + 2, 3) / 2; camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.t >= 1) camAnim = null; }
  if (STORY.on && STORY.live) { STORY.t += dt; Lab.story(STORY.t); }
  controls.update(); draw();
  if (loaded && hooks.onFrame) {
    if (t - lastTop > 250) { lastTop = t; const agg = {}; for (const m of meshes) if (m.userData.ends && m.visible) { const k = m.userData.s.name.replace(/^(right|left) /, '').replace(/ of (right|left) /, ' of ').replace(/(right|left) /, ''); agg[k] = Math.max(agg[k] || 0, m.userData.act); } topCache = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).filter(x => x[1] > 0.02); }
    hooks.onFrame({ angles, phase: state.phase, top: state.move === 'idle' ? [] : topCache });
  }
  if (loaded && hooks.onAnchor) hooks.onAnchor(STORY.on ? null : anchorScreen());
}

/* Opaque stage colour. Through the post chain the background is tone mapped too, so feed it the inverse of ACES so it lands on the exact theme colour */
function acesGrey(x) {
  const e = x * renderer.toneMappingExposure / 0.6;
  const a = [0.59719 * e + 0.35458 * e + 0.04823 * e, 0.07600 * e + 0.90834 * e + 0.01566 * e, 0.02840 * e + 0.13383 * e + 0.83777 * e];
  const f = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  const b = a.map(f); return Math.min(1, Math.max(0, 1.60475 * b[0] - 0.53108 * b[1] - 0.07367 * b[2]));
}
function invAces(t) { let lo = 0, hi = 64; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (acesGrey(m) < t) lo = m; else hi = m; } return (lo + hi) / 2; }
function syncBg() {
  const mode = (composer && Lab.quality === 'cinematic' && !Lab._clipOn) ? 'post' : 'direct';
  const v = STYLE_BG[state.style] || getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#FAFAF8';
  if (v === Lab._bg && mode === Lab._bgMode) return; Lab._bg = v; Lab._bgMode = mode;
  const c = new THREE.Color(v); if (mode === 'post') { c.r = invAces(c.r); c.g = invAces(c.g); c.b = invAces(c.b); }
  scene.background = c;
}
function draw() { syncBg(); syncOutline(); if (outline) outline.enabled = !STORY.on; if (composer && Lab.quality === 'cinematic' && !Lab._clipOn) composer.render(); else renderer.render(scene, camera);  if (state.lens && LENS.p && loaded) drawLens(); }
/* ---------- v44 holographic dissection lens: under the cursor the body is re-rendered one or two layers deeper and drawn as a hologram ---------- */
const LENS = { p: null, r: 120, rt: null, q: null, qs: null, qc: null, t0: performance.now() };
const LENS_DEPTH = { deep: ['sup', 'organ'], bone: ['sup', 'deep', 'organ', 'art', 'vein', 'nerve', 'ins'], nerve: ['sup', 'deep', 'organ', 'art', 'vein', 'ins', 'conn', 'cart'] };
function lensInit() {
  LENS.rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  LENS.q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tB: { value: LENS.rt.texture }, c: { value: new THREE.Vector2() }, r: { value: 120 }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, tint: { value: new THREE.Color(0x5eead4) } },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D tB;uniform vec2 c;uniform float r;uniform vec2 res;uniform float time;uniform vec3 tint;
      void main(){vec2 f=gl_FragCoord.xy;float d=distance(f,c);if(d>r+3.)discard;vec2 uv=f/res;vec2 dir=(f-c)/max(r,1.);float k=.004*dot(dir,dir);
      vec4 b=texture2D(tB,uv);float lr=texture2D(tB,uv+dir*k).r,lb=texture2D(tB,uv-dir*k).b;vec3 col=vec3(lr,b.g,lb);
      float l=dot(col,vec3(.3,.59,.11));float a=b.a;
      vec3 holo=tint*(.35+l*1.9)+vec3(.85,1.,1.)*pow(l,2.6)*1.4;
      float scan=.82+.18*sin(f.y*1.15-time*7.);float grid=(step(fract(f.x/26.),.04)+step(fract(f.y/26.),.04))*.05;
      vec3 bg=vec3(.015,.04,.09)+tint*grid;vec3 o=mix(bg,holo*scan,a);
      float edge=smoothstep(r*.55,r,d);o+=tint*edge*.22;float ring=smoothstep(r-4.,r-1.,d)*(1.-smoothstep(r+.5,r+3.,d));o+=vec3(.7,1.,1.)*ring*1.3;
      float sweep=smoothstep(.0,.02,abs(fract(time*.35)-((f.y-c.y)/(2.*r)+.5)));o+=tint*(1.-sweep)*.5*step(d,r);
      gl_FragColor=vec4(o,step(d,r)*.96+ring);}` }));
  LENS.qs = new THREE.Scene(); LENS.qs.add(LENS.q); LENS.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
function drawLens() {
  if (!LENS.rt) lensInit();
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); if (LENS.rt.width !== sz.x || LENS.rt.height !== sz.y) LENS.rt.setSize(sz.x, sz.y);
  const hide = new Set(LENS_DEPTH[state.lens] || LENS_DEPTH.deep), was = meshes.map(m => m.visible), wasMat = meshes.map(m => [m.material.transparent, m.material.opacity, m.material.depthWrite]);
  for (const m of meshes) { if (hide.has(m.userData.layer)) m.visible = false; else if (m.visible && m.material.transparent && m.material.opacity < .5) { m.material.transparent = false; m.material.opacity = 1; m.material.depthWrite = true; } }
  const bg = scene.background, fl = scene.children.find(o => o.isMesh && o.geometry.type === 'PlaneGeometry'); scene.background = null; if (fl) fl.visible = false;
  const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(LENS.rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
  renderer.setClearColor(cc, ca); scene.background = bg; if (fl) fl.visible = true;
  meshes.forEach((m, i) => { m.visible = was[i]; [m.material.transparent, m.material.opacity, m.material.depthWrite] = wasMat[i]; });
  const pr = renderer.getPixelRatio(), u = LENS.q.material.uniforms; u.res.value.copy(sz); u.c.value.set(LENS.p.x * pr, sz.y - LENS.p.y * pr); u.r.value = LENS.r * pr; u.time.value = (performance.now() - LENS.t0) / 1000;
  u.tint.value.set(state.lens === 'bone' ? 0x93c5fd : state.lens === 'nerve' ? 0xfde68a : 0x5eead4);
  const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(LENS.qs, LENS.qc); renderer.autoClear = ac;
}
Lab.lensAt = (x, y) => { if (!canvasEl) return; const r = canvasEl.getBoundingClientRect(); LENS.p = x == null ? null : { x: x - r.left, y: y - r.top }; };
Lab.lensSize = v => { LENS.r = Math.max(50, Math.min(260, v)); };
Lab.lensInfo = () => ({ on: !!state.lens, mode: state.lens, r: LENS.r });


/* ---------- story mode: Player 1's spring ligament, deterministic in t (seconds) so it can be filmed ---------- */
const HL = new THREE.Color(0x4B4FC4);
const ROLE_COL = { agonist: new THREE.Color(0xff3b2f), antagonist: new THREE.Color(0x3b82f6), synergist: new THREE.Color(0xf59e0b), fixator: new THREE.Color(0x14b8a6) }, DIM = new THREE.Color(0x2a2726);
Lab.roles = (map, focus) => { state.roles = map || null; state.roleFocus = focus || null; };
Lab.roleFocus = f => { state.roleFocus = f || null; };
Lab.flowPhase = () => ({ i: FLOW.i, f: FLOW.f, phase: state.phase });
const STORY = { on: false, live: false, t: 0, key: 'spring_ligament', glow: 0, caption: '' };
const STORY_STEPS = [[0, 'Full body · Z-Anatomy atlas on cadaver-derived scans'], [3.5, 'The right foot of Player 1'], [7, 'Muscles peeled away'], [10.5, 'The spring ligament: a sling under the head of the talus'], [15, 'Loaded in every landing and push-off'], [21, '']];
function camLerp(p0, t0, p1, t1, e) { camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, t1, e); }
Lab.story = function (t) {
  if (!loaded) return '';
  STORY.on = true; STORY.t = t; userMoved = true; camAnim = null; hostEl && hostEl.classList.add('story-on');
  const sm = byId[resolve('spring_ligament_R')]; const c = new THREE.Vector3();
  if (sm) { const P = sm.geometry.attributes.position; let n = 0; for (let k = 0; k < P.count; k += 5) { c.add(sm.getVertexPosition(k, tmpV)); n++; } c.divideScalar(n); }
  const e = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  // move: idle first, then a slow landing
  const moving = t > 15;
  if ((state.move === 'landing') !== moving) Lab.set('move', moving ? 'landing' : 'idle');
  if (moving) state.phase = ((t - 15) / 3.2) % 1;
  // layers: hide the left leg below the knee so the medial view is clear, then peel
  state.peel = t > 9 ? 2 : t > 7 ? 1 : 0;
  if (!STORY.hid) { STORY.hid = true; for (const m of meshes) { const n = m.userData.s.name; if ((/(^|\s)left /.test(n) && /(tibia|fibula|talus|calcaneus|navicular|cuneiform|cuboid|metatarsal|phalan|toe|foot|sesamoid|soleus|gastrocnemius|tibialis|fibularis|digitorum|hallucis|plantar|calcaneal|lumbrical|interosse|abductor digiti|quadratus plantae|spring|deltoid|talofibular|plantaris|popliteus|retinaculum|ligament)/.test(n)) || /retinaculum|interosseous membrane/.test(n)) state.hidden.add(m.userData.id); } }
  if (t > 10.2 && !STORY.hid2) { STORY.hid2 = true; for (const m of meshes) { const n = m.userData.s.name; if (/^right /.test(n) && /tibionavicular|tibiocalcaneal|tibiotalar|medial ligament of ankle|deltoid ligament|bifurcate|^right calcaneonavicular ligament|tendon of tibialis posterior|tibialis posterior muscle|flexor digitorum longus|flexor hallucis longus/.test(n)) state.hidden.add(m.userData.id); } }
  applyVisibility();
  const full = [new THREE.Vector3(-1.1, 1.15, 3.0), new THREE.Vector3(0, 0.88, 0)];
  const orbit = a => new THREE.Vector3(Math.sin(a) * 3.2, 1.1, Math.cos(a) * 3.2);
  const foot = [c.clone().add(new THREE.Vector3(0.42, 0.13, 0.26)), c.clone().add(new THREE.Vector3(0, 0.01, 0))];
  const close = [c.clone().add(new THREE.Vector3(0.19, -0.02, 0.1)), c.clone()];
  const under = [c.clone().add(new THREE.Vector3(0.16, -0.12, 0.14)), c.clone().add(new THREE.Vector3(0, 0.005, 0))];
  if (t < 3.5) { const a = -0.35 + t * 0.12; camera.position.copy(orbit(a)); controls.target.copy(full[1]); }
  else if (t < 7) { const o = orbit(-0.35 + 3.5 * 0.12), mid = [new THREE.Vector3(o.x * 0.55 + c.x * 0.45 + 0.25, 0.42, o.z * 0.5 + 0.2), new THREE.Vector3(c.x, 0.32, c.z)];
    if (t < 5.2) camLerp(o, full[1], mid[0], mid[1], e((t - 3.5) / 1.7)); else camLerp(mid[0], mid[1], foot[0], foot[1], e((t - 5.2) / 1.8)); }
  else if (t < 10.5) camLerp(foot[0], foot[1], close[0], close[1], e((t - 7) / 3.5));
  else if (t < 15) camLerp(close[0], close[1], under[0], under[1], e((t - 10.5) / 4.5));
  else { camera.position.copy(foot[0]).lerp(close[0], 0.35); controls.target.copy(c); }
  STORY.glow = e((t - 9.5) / 1.5);
  const cap = STORY_STEPS.filter(s => s[0] <= t).pop(); STORY.caption = cap ? cap[1] : '';
  return STORY.caption;
};
Lab.storyPlay = function (on) { STORY.live = !!on; hostEl && hostEl.classList.toggle('story-on', !!on); if (on) { STORY.t = 0; STORY.hid = false; STORY.hid2 = false; } else { STORY.on = false; Lab.set('move', 'idle'); state.peel = 0; Lab.showAll(); } };
Lab.storyCaption = () => STORY.caption;

/* ---------- public API ---------- */
/* ---------- v45 looks, explode and assemble ---------- */
const LIGHTS = {};
const STYLE_BG = { cinematic: '#05060a', hologram: '#02070d', cadaver: '#14110f', clinical: null };
const STYLE_LIGHT = {
  cinematic: { exp: 1.08, hemi: [0x5a6b80, 0x0a0806, 0.22], key: [0xfff1e0, 2.1, [1.4, 3.2, 1.6]], rim: [0xffe2c4, 1.25, [-2.6, 2.4, -2.4]], fill: [0x8fa6c8, 0.18, [-2, 0.4, 2]], rim2: [0xdfe8ff, 0.9, [2.6, 1.4, -2.2]] },
  clinical: { exp: 0.94, hemi: [0xfffaf2, 0x8a8278, 0.85], key: [0xffffff, 1.25, [1.2, 3.4, 2.2]], rim: [0xfff4ea, 0.55, [-2.4, 2.2, -2.6]], fill: [0xfff0e2, 0.45, [-2, 0.6, 2]], rim2: [0xbfd6ff, 0, [2.6, 1.6, -2.2]] },
  cadaver: { exp: 0.9, hemi: [0xe8e2d4, 0x302820, 0.55], key: [0xfff6e6, 1.5, [0.6, 3.6, 1.4]], rim: [0xffffff, 0.35, [-2.4, 2.2, -2.6]], fill: [0xf0e6d8, 0.3, [-2, 0.6, 2]], rim2: [0xffffff, 0, [2.6, 1.6, -2.2]] },
  hologram: { exp: 1.0, hemi: [0xffffff, 0x000000, 0.2], key: [0xffffff, 0.5, [1.2, 3.4, 2.2]], rim: [0xffffff, 0.2, [-2.4, 2.2, -2.6]], fill: [0xffffff, 0.2, [-2, 0.6, 2]], rim2: [0xffffff, 0, [2.6, 1.6, -2.2]] }
};
function lightStyle() {
  const L = STYLE_LIGHT[state.style] || STYLE_LIGHT.clinical; if (!LIGHTS.key || !renderer) return;
  renderer.toneMappingExposure = L.exp; LIGHTS.hemi.color.setHex(L.hemi[0]); LIGHTS.hemi.groundColor.setHex(L.hemi[1]); LIGHTS.hemi.intensity = L.hemi[2];
  for (const k of ['key', 'rim', 'fill', 'rim2']) { LIGHTS[k].color.setHex(L[k][0]); LIGHTS[k].intensity = L[k][1]; LIGHTS[k].position.set(...L[k][2]); }
  if (outline) { outline.visibleEdgeColor.set(state.style === 'cinematic' ? 0xf5d90a : 0x4B5BFF); }
  if (hostEl) hostEl.dataset.look = state.style;
}
Lab.style = function (name) {
  if (!TISSUE.muscle.col[name] && name !== 'hologram') return; state.style = name; HOLO_U.uHolo.value = name === 'hologram' ? 1 : 0;
  const pal = name === 'hologram' ? 'cinematic' : name;
  for (const m of meshes) {
    const tt = m.material.userData.tissue, T = TISSUE[tt]; if (!T || !T.col) continue;
    const c = new THREE.Color((m.userData.layer === 'deep' ? T.deep : T.col)[pal]); if (tt === 'muscle') { const i = +m.userData.id.slice(1); c.offsetHSL((hashTint(i) - 0.5) * 0.02, (hashTint(i + 3) - 0.5) * 0.06, (hashTint(i + 7) - 0.5) * 0.06); }
    m.material.userData.base = c; m.material.color.copy(c); if (T.op) m.material.userData.op = T.op[pal] || 0.4; m.material.needsUpdate = true;
  }
  Lab._bg = null; lightStyle(); applyVisibility();
};
/* explode: every structure moves away from the centre of its body region; deeper tissue moves less, so layers fan out */
const EXP = { active: false, ready: false };
const EX_MAG = { fascia: 0.17, sup: 0.13, deep: 0.085, conn: 0.06, cart: 0.045, bone: 0.028, art: 0.11, vein: 0.11, nerve: 0.1, organ: 0.07, ins: 0.13 };
function explodePrep() {
  const cen = {};
  for (const m of meshes) { const r = m.userData.s.region, c = m.userData.c0; if (!c) continue; (cen[r] = cen[r] || [new THREE.Vector3(), 0])[0].add(c); cen[r][1]++; }
  for (const k in cen) cen[k][0].divideScalar(cen[k][1]);
  for (const m of meshes) {
    const u = m.userData; if (!u.c0) continue; const C = cen[u.s.region] ? cen[u.s.region][0] : new THREE.Vector3(0, 1, 0);
    const d = u.c0.clone().sub(C); d.y *= 0.35; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
    u.exDir = d; u.exMag = (EX_MAG[u.layer] || 0.08) * (0.85 + 0.3 * hashTint(+u.id.slice(1)));
  }
  EXP.ready = true;
}
function explodeTo(target, stagger) {
  if (!EXP.ready) explodePrep(); const now = performance.now(), order = { bone: 0, cart: 1, conn: 2, deep: 3, sup: 4, fascia: 5, art: 6, vein: 6, nerve: 6, organ: 4, ins: 7 };
  for (const m of meshes) { const u = m.userData; u.exFrom = u.ex || 0; u.exTo = target; u.exT0 = now + (stagger ? (order[u.layer] || 0) * 420 + hashTint(+u.id.slice(1) + 11) * 260 : 0); u.exDur = stagger ? 900 : 520; }
  state.explode = target; EXP.active = true;
}
function explodeFrame() {
  if (!EXP.active) return; const now = performance.now(); let busy = false;
  for (const m of meshes) {
    const u = m.userData; if (u.exTo === undefined || !u.exDir) continue;
    const k = Math.min(1, Math.max(0, (now - u.exT0) / u.exDur)); if (k < 1) busy = true;
    const e = u.exTo < u.exFrom ? 1 - Math.pow(1 - k, 3) : k * k * (3 - 2 * k); u.ex = u.exFrom + (u.exTo - u.exFrom) * e;
    m.position.copy(u.exDir).multiplyScalar(u.exMag * u.ex);
  }
  if (!busy) EXP.active = false;
}
Lab.explode = v => explodeTo(Math.max(0, Math.min(1, +v || 0)), false);
/* deterministic versions for filming: t from 0 (apart) to 1 (assembled) */
Lab.explodeAt = v => { if (!EXP.ready) explodePrep(); EXP.active = false; for (const m of meshes) { const u = m.userData; if (!u.exDir) continue; u.ex = v; u.exTo = undefined; m.position.copy(u.exDir).multiplyScalar(u.exMag * v); } state.explode = v; };
Lab.assembleAt = t => { if (!EXP.ready) explodePrep(); EXP.active = false; const order = { bone: 0, cart: 1, conn: 2, deep: 3, sup: 4, fascia: 5, art: 6, vein: 6, nerve: 6, organ: 4, ins: 7 }, T = t * (7 * 0.42 + 0.26 + 0.9);
  for (const m of meshes) { const u = m.userData; if (!u.exDir) continue; const k = Math.min(1, Math.max(0, (T - (order[u.layer] || 0) * 0.42 - hashTint(+u.id.slice(1) + 11) * 0.26) / 0.9)); u.ex = 1.25 * (1 - (1 - Math.pow(1 - k, 3))); u.exTo = undefined; m.position.copy(u.exDir).multiplyScalar(u.exMag * u.ex); } };
Lab.assemble = () => { if (!EXP.ready) explodePrep(); for (const m of meshes) { const u = m.userData; u.ex = 1.25; if (u.exDir) m.position.copy(u.exDir).multiplyScalar(u.exMag * u.ex); } explodeTo(0, true); };
Lab.deconstruct = () => { if (!EXP.ready) explodePrep(); const now = performance.now(), order = { fascia: 0, art: 0, vein: 0, nerve: 0, ins: 0, sup: 1, organ: 2, deep: 2, conn: 3, cart: 4, bone: 5 };
  for (const m of meshes) { const u = m.userData; u.exFrom = u.ex || 0; u.exTo = 1; u.exT0 = now + (order[u.layer] || 0) * 420 + hashTint(+u.id.slice(1) + 5) * 260; u.exDur = 900; } state.explode = 1; EXP.active = true; };
Lab.init = function (host, h) {
  hooks = h || {}; hostEl = host;
  if (started) { host.appendChild(canvasEl); new ResizeObserver(resize).observe(host); resize(); if (loaded) hooks.onLoad && hooks.onLoad(); return loading; }
  started = true;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.94; renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasEl = renderer.domElement; canvasEl.className = 'lab-canvas'; host.appendChild(canvasEl);
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30);
  controls = new OrbitControls(camera, canvasEl); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.25; controls.maxDistance = 7;
  controls.addEventListener('start', () => { userMoved = true; });
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  LIGHTS.hemi = new THREE.HemisphereLight(0xfffaf2, 0x8a8278, 0.85); scene.add(LIGHTS.hemi);
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })); composer.addPass(new RenderPass(scene, camera));
  try { aoPass = new GTAOPass(scene, camera, 2, 2); aoPass.updateGtaoMaterial({ radius: 0.06, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 }); aoPass.blendIntensity = 0.9; aoPass.enabled = false; composer.addPass(aoPass); } catch (e) { aoPass = null; }
  outline = new OutlinePass(new THREE.Vector2(512, 512), scene, camera); outline.edgeStrength = 3.2; outline.edgeGlow = 0.35; outline.edgeThickness = 1.2; outline.pulsePeriod = 0;
  outline.visibleEdgeColor.set(0x4B5BFF); outline.hiddenEdgeColor.set(0x2A2F7A); composer.addPass(outline);
  composer.addPass(new OutputPass());
  const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(1.2, 3.4, 2.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff4ea, 0.55); rim.position.set(-2.4, 2.2, -2.6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff0e2, 0.45); fill.position.set(-2, 0.6, 2); scene.add(fill);
  const rim2 = new THREE.DirectionalLight(0xbfd6ff, 0); rim2.position.set(2.6, 1.6, -2.2); scene.add(rim2);
  Object.assign(LIGHTS, { key, rim, fill, rim2 }); lightStyle();
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);
  let down = null, lastHover = 0;
  canvasEl.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvasEl.addEventListener('pointerup', e => {
    if (!loaded || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const id = pickId(e.clientX, e.clientY);
    if (!id) { Lab.select(null); return; }
    if (state.pinMode) { addPin(id, e.clientX, e.clientY); return; }
    if (state.quiz) { hooks.onQuizClick && hooks.onQuizClick(id); return; }
    if (state.tool === 'hide') { Lab.hide(id); state.hover = null; return; }
    if (state.tool === 'measure') { measureClick(id, e.clientX, e.clientY); return; }
    Lab.select(id);
  });
  canvasEl.addEventListener('dblclick', e => { if (!loaded) return; const id = pickId(e.clientX, e.clientY); if (id) { Lab.select(id); Lab.focusOn(id); } });
  canvasEl.addEventListener('pointermove', e => {
    if (e.buttons || !loaded) return; const now = performance.now(); if (now - lastHover < 90) return; lastHover = now;
    const id = pickId(e.clientX, e.clientY); state.hover = id; canvasEl.style.cursor = id ? (state.tool === 'hide' ? 'crosshair' : 'pointer') : ''; hooks.onHover && hooks.onHover(id ? { id, x: e.clientX, y: e.clientY } : null);
  });
  canvasEl.addEventListener('pointerleave', () => { state.hover = null; LENS.p = null; hooks.onHover && hooks.onHover(null); });
  canvasEl.addEventListener('pointermove', e => { if (state.lens) { const r = canvasEl.getBoundingClientRect(); LENS.p = { x: e.clientX - r.left, y: e.clientY - r.top }; } }, { passive: true });
  canvasEl.addEventListener('wheel', e => { if (state.lens && e.shiftKey) { e.preventDefault(); Lab.lensSize(LENS.r - Math.sign(e.deltaY) * 12); } }, { passive: false });
  new ResizeObserver(resize).observe(host); resize(); Lab.start();
  loading = fetchPack(Lab.src || 'anatomy-model.txt').then(m => {
    meta = m; buildRig(); buildMeshes(); applyVisibility(); loaded = true; resize();
    hooks.onLoad && hooks.onLoad();
  }).catch(err => { hooks.onError && hooks.onError(err); });
  return loading;
};
Lab.start = function () { if (running) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); };
Lab.stop = function () { running = false; };
Lab.ready = () => loaded;
Lab.select = function (id) { state.selected = id ? resolve(id) : null; anchor = state.selected ? anchorFor(state.selected) : null; applyVisibility(); hooks.onSelect && hooks.onSelect(state.selected); };
/* label anchor: the vertex nearest the structure's centre, pushed to the surface the camera sees */
function anchorFor(id) {
  const m = byId[id]; if (!m) return null; const P = m.geometry.attributes.position, c = m.userData.c0;
  const toCam = camera.position.clone().sub(c).normalize(); let best = -Infinity, bi = 0;
  for (let k = 0; k < P.count; k += 2) { tmpV.fromBufferAttribute(P, k); const d = tmpV.clone().sub(c); const sc = d.dot(toCam) - 1.6 * d.clone().sub(toCam.clone().multiplyScalar(d.dot(toCam))).length(); if (sc > best) { best = sc; bi = k; } }
  return { id, k: bi };
}
function anchorScreen() {
  if (!anchor || !byId[anchor.id] || !byId[anchor.id].visible || !canvasEl) return null;
  const p = byId[anchor.id].getVertexPosition(anchor.k, new THREE.Vector3()).project(camera);
  if (p.z > 1) return null; const r = canvasEl.getBoundingClientRect();
  return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, w: r.width, h: r.height };
}
Lab.anchor = anchorScreen;
Lab.hideMany = (ids, on) => { const rs = ids.map(resolve).filter(Boolean); undoStack.push(new Set(state.hidden)); for (const r of rs) on === false ? state.hidden.delete(r) : state.hidden.add(r); applyVisibility(); hooks.onVis && hooks.onVis(); };
Lab.isHidden = id => state.hidden.has(resolve(id));
Lab.undo = () => { if (!undoStack.length) return false; state.hidden = undoStack.pop(); applyVisibility(); hooks.onVis && hooks.onVis(); return true; };
Lab.canUndo = () => undoStack.length > 0;
Lab.hiddenCount = () => state.hidden.size;
Lab.resetView = () => { userMoved = false; camAnim = null; const p0 = camera.position.clone(), t0 = controls.target.clone(); fitCamera(); const p1 = camera.position.clone(), t1 = controls.target.clone(); camera.position.copy(p0); controls.target.copy(t0); userMoved = true; camAnim = { t: 0, p0, t0, p1, t1 }; };
/* render one exact frame (pose at a phase) and return it as an image: used for filming and exports */
Lab.renderFrame = (phase, w, h) => { if (!loaded) return null; if (w && h && (canvasEl.width !== w || canvasEl.height !== h)) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  if (phase != null) state.phase = phase; applyPose(state.phase); colourFrame(0.0001); explodeFrame(); controls.update(); draw(); return canvasEl.toDataURL('image/jpeg', 0.92); };
Lab.snapshot = () => { draw(); const c = document.createElement('canvas'); c.width = canvasEl.width; c.height = canvasEl.height; const g = c.getContext('2d');
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#FAFAF8'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvasEl, 0, 0); return c.toDataURL('image/png'); };
Lab.set = function (k, v) {
  if (['art', 'vein', 'nerve', 'organ', 'ins'].includes(k) && v) Lab.loadSystems();
  if (k in state.layers) state.layers[k] = v; else state[k] = v;
  if (k === 'move') { state.phase = 0; for (const m of meshes) if (m.userData.ends) { m.userData.act = 0; m.userData.L0 = null; } }
  applyVisibility();
};
Lab.custom = (k, v) => { CUSTOM[k] = v; };
Lab.get = () => state;
Lab.view = flyTo;
Lab.viewNow = name => { const v = views()[name]; if (!v) return; userMoved = true; camAnim = null; camera.position.set(...v[0]); controls.target.set(...v[1]); controls.update(); };
Lab.hide = id => { const r = resolve(id); if (!r) return; undoStack.push(new Set(state.hidden)); state.hidden.add(r); if (state.selected === r) state.selected = null; applyVisibility(); hooks.onVis && hooks.onVis(); hooks.onSelect && hooks.onSelect(state.selected); };
Lab.isolate = id => { const r = resolve(id); state.isolate = state.isolate === r ? null : r; applyVisibility(); };
Lab.showAll = () => { if (state.hidden.size) undoStack.push(new Set(state.hidden)); state.hidden.clear(); state.isolate = null; applyVisibility(); hooks.onVis && hooks.onVis(); };
Lab.clip = function (mode, off, flip) {
  clipPlanes.length = 0;
  if (mode !== 'none') {
    const f = flip ? -1 : 1;
    if (mode === 'sagittal') { clipPlane.normal.set(f, 0, 0); clipPlane.constant = -f * off; }
    else if (mode === 'coronal') { clipPlane.normal.set(0, 0, -f); clipPlane.constant = f * (off - 0.07); }
    else { const y = 0.9 + off * 3; clipPlane.normal.set(0, -f, 0); clipPlane.constant = f * y; }
    clipPlanes.push(clipPlane);
  }
  const on = clipPlanes.length > 0;
  if (on !== Lab._clipOn) { Lab._clipOn = on; for (const m of meshes) { m.material.clippingPlanes = on ? clipPlanes : null; m.material.needsUpdate = true; } }
};
Lab.clearPins = () => { for (const p of pins) p.mesh.parent.remove(p.mesh); pins = []; hooks.onPin && hooks.onPin([]); };
Lab.moves = () => Object.entries(MOVES).map(([k, v]) => ({ key: k, name: v.name }));
Lab.focusOn = id => {
  const r = resolve(id); const m = byId[r]; if (!m) return;
  const P = m.geometry.attributes.position, c = new THREE.Vector3(); let n = 0;
  for (let k = 0; k < P.count; k += 7) { c.add(m.getVertexPosition(k, tmpV)); n++; } c.divideScalar(n);
  let rad = 0; for (let k = 0; k < P.count; k += 7) rad = Math.max(rad, m.getVertexPosition(k, tmpV).distanceTo(c));
  const cur = camera.position.clone().sub(controls.target).normalize();
  /* face-on view: the structure's thinnest axis (PCA), on the side the camera is already on, blended with the current direction */
  let C = [0, 0, 0, 0, 0, 0], q = 0; for (let k = 0; k < P.count; k += 5) { const d = m.getVertexPosition(k, tmpV).sub(c); C[0] += d.x * d.x; C[1] += d.x * d.y; C[2] += d.x * d.z; C[3] += d.y * d.y; C[4] += d.y * d.z; C[5] += d.z * d.z; q++; }
  const mul = v => new THREE.Vector3(C[0] * v.x + C[1] * v.y + C[2] * v.z, C[1] * v.x + C[3] * v.y + C[4] * v.z, C[2] * v.x + C[4] * v.y + C[5] * v.z);
  let e1 = new THREE.Vector3(1, 0.3, 0.2); for (let k = 0; k < 30; k++) e1 = mul(e1).normalize();
  let e2 = new THREE.Vector3(0.2, 1, 0.3); for (let k = 0; k < 30; k++) { e2 = mul(e2); e2.addScaledVector(e1, -e2.dot(e1)).normalize(); }
  const thin = new THREE.Vector3().crossVectors(e1, e2).normalize(); if (thin.dot(cur) < 0) thin.negate();
  const flat = isFinite(thin.x) ? thin : cur.clone();
  const dir = cur.clone().lerp(flat, 0.7).normalize(); if (Math.abs(dir.y) > 0.8) { dir.y = Math.sign(dir.y) * 0.8; dir.normalize(); } dir.multiplyScalar(Math.max(0.3, rad * 4.5));
  userMoved = true; camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: c.clone().add(dir), t1: c };
};
Lab.setCamera = (p, t) => { userMoved = true; camAnim = null; camera.position.set(...p); controls.target.set(...t); controls.update(); };
Lab.tick = (phase, dt) => {
  if (!loaded) return; state.phase = phase; applyPose(phase); colourFrame(dt); controls.update(); draw();
  if (hooks.onFrame) { lastTop = 0; const agg = {}; for (const m of meshes) if (m.userData.ends && m.visible) { const k = m.userData.s.name.replace(/(right|left) /, ''); agg[k] = Math.max(agg[k] || 0, m.userData.act); } topCache = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).filter(x => x[1] > 0.02); hooks.onFrame({ angles, phase, top: state.move === 'idle' ? [] : topCache }); }
  if (hooks.onAnchor) hooks.onAnchor(STORY.on ? null : anchorScreen());
};
Lab.finishCam = () => { if (camAnim) { camera.position.copy(camAnim.p1); controls.target.copy(camAnim.t1); camAnim = null; controls.update(); } };
Lab.pick = (x, y) => pickId(x, y);
window.dispatchEvent(new Event('anatomy-ready'));
Lab._fx = () => ({ ao: aoPass, outline });

/* ---------- systems pack: muscle attachments, arteries, veins, nerves, organs (loaded on demand) ---------- */
Lab.systemsLoaded = () => sysLoaded;
Lab.loadSystems = function () {
  if (sysLoading || !loaded) return sysLoading;
  hooks.onSystems && hooks.onSystems('loading');
  sysLoading = fetchPack(Lab.srcSys || 'anatomy-systems.txt').then(pk => {
    const base = meta.structs.length; meta.structs.push(...pk.structs); buildMeshes(pk, base); EXP.ready = false;
    if (Lab._clipOn) for (let k = base; k < meshes.length; k++) { meshes[k].material.clippingPlanes = clipPlanes; meshes[k].material.needsUpdate = true; }
    sysLoaded = true; applyVisibility(); hooks.onSystems && hooks.onSystems('ready');
  }).catch(err => { sysLoading = null; hooks.onSystems && hooks.onSystems('error', err); });
  return sysLoading;
};
Lab.attachments = id => { const r = resolve(id); if (!r || !byId[r]) return []; const n = byId[r].userData.s.name; return meshes.filter(m => m.userData.muscleOf === n).map(m => ({ id: m.userData.id, kind: m.userData.s.kind })); };
/* ---------- region models (as in an atlas: open one region on its own) ---------- */
Lab.focusRegion = function (i) {
  state.region = (i === null || i === undefined) ? null : i; applyVisibility();
  const box = new THREE.Box3(); let any = false;
  for (const m of meshes) if (m.visible && m.userData.c0) { box.expandByPoint(m.userData.c0.clone().addScalar(m.userData.r0 * 0.6)); box.expandByPoint(m.userData.c0.clone().addScalar(-m.userData.r0 * 0.6)); any = true; }
  if (state.region === null || !any) { Lab.resetView(); return; }
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.62;
  const dist = r / Math.tan(camera.fov * D2R / 2) / Math.min(1, camera.aspect * 1.05);
  const dir = new THREE.Vector3(-0.35, 0.12, 1).normalize();
  userMoved = true; camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: c.clone().addScaledVector(dir, Math.max(0.35, dist)), t1: c };
  hooks.onVis && hooks.onVis();
};
/* ---------- measure: two surface points, straight-line distance in millimetres ---------- */
function surfacePoint(id, clientX, clientY) {
  const m = byId[id]; const r = canvasEl.getBoundingClientRect();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
  const P = m.geometry.attributes.position; let best = Infinity, bi = 0;
  for (let k = 0; k < P.count; k++) { const p = m.getVertexPosition(k, tmpV); const d = ray.ray.distanceSqToPoint(p) + 0.0004 * ray.ray.origin.distanceTo(p); if (d < best) { best = d; bi = k; } }
  return m.getVertexPosition(bi, new THREE.Vector3());
}
function clearMeasure() { for (const o of [measure.line, ...measure.dots]) if (o) scene.remove(o); measure = { pts: [], line: null, dots: [] }; }
function measureClick(id, x, y) {
  if (measure.pts.length >= 2) clearMeasure();
  const p = surfacePoint(id, x, y); measure.pts.push(p);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 16, 12), new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })); dot.renderOrder = 60; dot.position.copy(p); scene.add(dot); measure.dots.push(dot);
  if (measure.pts.length === 2) {
    const g = new THREE.BufferGeometry().setFromPoints(measure.pts); measure.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x111111, depthTest: false })); measure.line.renderOrder = 60; scene.add(measure.line);
    hooks.onMeasure && hooks.onMeasure({ mm: measure.pts[0].distanceTo(measure.pts[1]) * 1000, a: measure.pts[0].clone(), b: measure.pts[1].clone() });
  } else hooks.onMeasure && hooks.onMeasure({ mm: null });
}
Lab.clearMeasure = () => { clearMeasure(); hooks.onMeasure && hooks.onMeasure(null); };
Lab.measureScreen = () => { if (measure.pts.length < 2 || !canvasEl) return null; const r = canvasEl.getBoundingClientRect(); const m = measure.pts[0].clone().add(measure.pts[1]).multiplyScalar(0.5).project(camera); if (m.z > 1) return null; return { x: (m.x + 1) / 2 * r.width, y: (1 - m.y) / 2 * r.height, mm: measure.pts[0].distanceTo(measure.pts[1]) * 1000 }; };
/* ---------- atlas labels: the largest visible structures, each checked for visibility with the id buffer ---------- */
Lab.autoLabels = function (max = 12) {
  if (!loaded || !canvasEl) return [];
  const r = canvasEl.getBoundingClientRect(), out = [], cands = [];
  for (const m of meshes) {
    if (!m.visible || m.material.opacity < 0.5 || !m.userData.c0 || m.userData.layer === 'ins') continue;
    const P = m.geometry.attributes.position; const c = new THREE.Vector3(); let n = 0; for (let k = 0; k < P.count; k += 9) { c.add(m.getVertexPosition(k, tmpV)); n++; } c.divideScalar(n);
    const pr = c.clone().project(camera); if (pr.z > 1 || Math.abs(pr.x) > 0.92 || Math.abs(pr.y) > 0.9) continue;
    const d = camera.position.distanceTo(c); const px = m.userData.r0 / (d * Math.tan(camera.fov * D2R / 2)) * r.height / 2;
    if (px < 14) continue;
    cands.push({ id: m.userData.id, c, px, x: (pr.x + 1) / 2 * r.width, y: (1 - pr.y) / 2 * r.height });
  }
  cands.sort((a, b) => b.px - a.px);
  for (const c of cands.slice(0, 60)) {
    if (out.length >= max) break;
    if (out.some(o => Math.hypot(o.x - c.x, o.y - c.y) < 34)) continue;
    // anchor on the visible surface: the vertex nearest the screen-space centre that the id buffer confirms
    if (pickId(r.left + c.x, r.top + c.y) !== c.id) continue;
    out.push({ id: c.id, x: c.x, y: c.y, name: byId[c.id].userData.s.name });
  }
  return out;
};
Lab._debugBlue = () => meshes.filter(m => m.visible && (m.material.color.b > m.material.color.r + 0.05 || m.material.emissiveIntensity > 0.01)).slice(0, 40).map(m => [m.userData.s.name, m.userData.layer, m.material.color.getHexString(), m.material.emissive.getHexString(), m.material.emissiveIntensity]);
Lab.debugTint = (layer, hex) => { for (const m of meshes) if (m.userData.layer === layer) { m.material.color.setHex(hex); m.material.userData.base = m.material.color.clone(); } };
Lab.debugHide = layer => { for (const m of meshes) if (m.userData.layer === layer) m.visible = false; Lab._dbgHide = layer; };
Lab.visCount = () => { const c = {}; for (const m of meshes) if (m.visible) c[m.userData.layer] = (c[m.userData.layer] || 0) + 1; return c; };
Lab.camKey = () => camera ? camera.position.toArray().map(v => v.toFixed(3)).join(',') + controls.target.toArray().map(v => v.toFixed(3)).join(',') + state.phase.toFixed(2) : '';

