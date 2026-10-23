/* ---------- Your own movement: OpenCap / OpenSim motion files (.mot) drive the 3D body.
   The file is read in this browser only; nothing is uploaded. Joint conventions follow the OpenCap
   LaiUhlrich2022 model (degrees; hip and knee flexion positive, ankle dorsiflexion positive, lumbar extension positive). ---------- */
const OC = { name: null, keys: null, dt: 0.0167, peaks: null, err: '', roles: 'lunge', speed: 1 };
function ocParse(text) {
  const lines = text.split(/\r?\n/); let i = lines.findIndex(l => /^\s*endheader\s*$/i.test(l));
  if (i < 0) i = lines.findIndex(l => /^\s*time\b/.test(l)) - 1;
  const header = lines.slice(0, Math.max(0, i)).join('\n'), deg = !/inDegrees\s*=\s*no/i.test(header);
  const cols = lines[i + 1].trim().split(/\s+/), rows = lines.slice(i + 2).filter(l => l.trim()).map(l => l.trim().split(/\s+/).map(Number));
  if (!cols.includes('time') || rows.length < 3) throw new Error('not a motion file: needs a time column and rows of joint angles');
  const ci = Object.fromEntries(cols.map((c, k) => [c, k])), k = deg ? 1 : 180 / Math.PI;
  const g = (r, c) => ci[c] === undefined ? 0 : r[ci[c]] * k;
  const step = Math.max(1, Math.round(rows.length / 400));   // cap at ~400 keys
  const keys = [];
  for (let n = 0; n < rows.length; n += step) {
    const r = rows[n], tilt = -g(r, 'pelvis_tilt');
    keys.push({ t: tilt, rz: g(r, 'pelvis_list') * 0.6, lum: -g(r, 'lumbar_extension') * 0.5, thx: -g(r, 'lumbar_extension') * 0.5, thy: g(r, 'lumbar_rotation') + g(r, 'pelvis_rotation') * 0.3, thz: g(r, 'lumbar_bending') * 0.5,
      hipR: g(r, 'hip_flexion_r') - tilt, hipL: g(r, 'hip_flexion_l') - tilt, habR: -g(r, 'hip_adduction_r'), habL: -g(r, 'hip_adduction_l'), hrotR: g(r, 'hip_rotation_r'), hrotL: g(r, 'hip_rotation_l'),
      kneeR: Math.abs(g(r, 'knee_angle_r')), kneeL: Math.abs(g(r, 'knee_angle_l')), ankR: g(r, 'ankle_angle_r'), ankL: g(r, 'ankle_angle_l'),
      shR: g(r, 'arm_flex_r'), shL: g(r, 'arm_flex_l'), sabR: -g(r, 'arm_add_r'), sabL: -g(r, 'arm_add_l'), elbR: g(r, 'elbow_flex_r'), elbL: g(r, 'elbow_flex_l') });
  }
  const tcol = rows.map(r => r[ci.time]), dur = tcol[tcol.length - 1] - tcol[0];
  const pk = f => Math.round(Math.max(...keys.map(f))), pkMin = f => Math.round(Math.min(...keys.map(f)));
  const peaks = [['Right hip flexion', pk(x => x.hipR + x.t)], ['Left hip flexion', pk(x => x.hipL + x.t)], ['Right knee flexion', pk(x => x.kneeR)], ['Left knee flexion', pk(x => x.kneeL)],
    ['Right ankle dorsiflexion', pk(x => x.ankR)], ['Left ankle dorsiflexion', pk(x => x.ankL)], ['Trunk flexion', pk(x => x.lum + x.thx)], ['Right shoulder flexion', pk(x => x.shR)], ['Right plantarflexion', -pkMin(x => x.ankR)]];
  return { keys, dt: Math.max(0.008, dur / keys.length), peaks, dur };
}
/* a built-in sample so the feature can be tried without a capture: synthetic, labelled as such */
function ocSample() {
  let s = 'Sample lateral lunge (synthetic, not a real capture)\nversion=1\nnRows=121\nnColumns=12\ninDegrees=yes\nendheader\ntime\tpelvis_tilt\tpelvis_list\thip_flexion_r\thip_adduction_r\tknee_angle_r\tankle_angle_r\thip_flexion_l\thip_adduction_l\tknee_angle_l\tlumbar_extension\tarm_flex_r\n';
  for (let i = 0; i <= 120; i++) { const t = i / 60, p = (1 - Math.cos(2 * Math.PI * i / 120)) / 2; s += [t.toFixed(4), (-22 * p).toFixed(2), (4 * p).toFixed(2), (78 * p).toFixed(2), (-24 * p).toFixed(2), (88 * p).toFixed(2), (24 * p).toFixed(2), (12 * p).toFixed(2), (-32 * p).toFixed(2), (6 * p).toFixed(2), (-14 * p).toFixed(2), (40 * p).toFixed(2)].join('\t') + '\n'; }
  return s;
}
function ocLoad(text, name) {
  try { const r = ocParse(text); Object.assign(OC, { name, keys: r.keys, dt: r.dt, peaks: r.peaks, dur: r.dur, err: '' }); ocPlay(); audit('Played a motion file', name.replace(/[^\w .-]/g, '').slice(0, 40)); }
  catch (e) { OC.err = e.message; }
  const p = document.getElementById('oc-panel'); if (p) p.outerHTML = ocPanel();
}
function ocPlay() {
  if (!OC.keys || !window.AnatomyLab) return; const L = AnatomyLab;
  L.flow(OC.keys, OC.dt); L.set('move', 'flow'); L.set('playing', true); L.set('speed', OC.speed); L.set('heat', !OC.roles);
  if (OC.roles && typeof MOTIONS !== 'undefined') { const m = MOTIONS.find(x => x.id === OC.roles); L.roles(m ? roleMap(m) : null); } else L.roles(null);
}
function ocPanel() {
  return `<div class="oc" id="oc-panel"><span class="eyebrow">Your own movement</span>
    <p class="muted" style="margin:0;font-size:12.5px">Load an OpenCap motion file (.mot) from a phone capture. It plays on this body with your real joint angles. The file stays on this device.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><label class="btn sm primary" style="cursor:pointer">Load .mot file<input type="file" accept=".mot,.sto,.txt" data-oc="file" hidden></label><button class="btn sm" data-oc="sample">Try a sample</button>${OC.keys ? `<button class="btn sm" data-oc="stop">Stop</button>` : ''}</div>
    ${OC.err ? `<p class="login-err" style="margin:0">${esc(OC.err)}</p>` : ''}
    ${OC.keys ? `<div class="oc-now"><b>${esc(OC.name)}</b><span>${OC.dur ? OC.dur.toFixed(1) + ' s · ' : ''}${OC.keys.length} frames</span></div>
      <label class="range">Show muscle roles as<select data-oc="roles"><option value="">Activation heat</option>${MOTIONS.map(m => `<option value="${m.id}" ${OC.roles === m.id ? 'selected' : ''}>${esc(m.sub)}</option>`).join('')}</select></label>
      <div class="oc-peaks">${OC.peaks.filter(p => isFinite(p[1]) && p[1] > 0).map(([l, v]) => `<div><span>${esc(l)}</span><b>${v}°</b></div>`).join('')}</div>` : ''}
    <p class="muted" style="margin:0;font-size:11.5px">OpenCap (Uhlrich et al. 2023, PLOS Comput Biol) turns two-phone video into joint angles; its accuracy is a few degrees for most lower-limb joints. Use it to compare sessions, not as a lab-grade measure.</p></div>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.oc) return;
  if (t.dataset.oc === 'file' && t.files[0]) { const f = t.files[0]; if (f.size > 20e6) { OC.err = 'File too large'; return; } f.text().then(x => ocLoad(x, f.name)); }
  if (t.dataset.oc === 'roles') { OC.roles = t.value; ocPlay(); }
});
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-oc]'); if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  if (t.dataset.oc === 'sample') ocLoad(ocSample(), 'Sample lateral lunge (synthetic)');
  else if (t.dataset.oc === 'stop') { OC.keys = null; if (window.AnatomyLab) { AnatomyLab.roles(null); AnatomyLab.set('move', 'idle'); } const p = document.getElementById('oc-panel'); if (p) p.outerHTML = ocPanel(); }
});
