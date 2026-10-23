/* ---------- v44 Fascia routines on the 3D anatomy model: each step is a keyframed movement pattern on the rigged Z-Anatomy body.
   Activation heat shows which muscles shorten and lengthen through the pattern (the fascial lines in motion). Camera per step. ---------- */
const FLOWS = {
  morning: [
    { view: 'front', line: 'Spiral and lateral lines', keys: [{}, { sh: 165, sab: 10, thx: -10 }, { sh: 165, sab: 10, thy: 35 }, { sh: 165, sab: 10, thz: 22 }, { sh: 165, sab: 10, thy: -35 }, { sh: 165, sab: 10, thz: -22 }] },
    { view: 'front', line: 'Deep front and lateral lines', keys: [{}, { hipR: 70, kneeR: 85, habR: 10 }, { hipR: 55, kneeR: 85, habR: 40, hrotR: 25 }, {}, { hipL: 70, kneeL: 85, habL: 10 }, { hipL: 55, kneeL: 85, habL: 40, hrotL: 25 }] },
    { view: 'lateral', line: 'Arm lines and thoracic spine', keys: [{}, { sh: 90 }, { sh: 170, thx: -8 }, { sh: 90, sab: 85 }, { sh: 0, sab: 20 }, { sh: -35, elb: 10 }] },
    { view: 'ankle', line: 'Superficial back line from the foot', keys: [{}, { ank: -28 }, {}, { kneeR: 35, ankR: 28, hipR: 15, hipL: -5 }, { kneeR: 45, ankR: 34, hipR: 20, hipL: -5 }, {}] },
    { view: 'front', line: 'Every line together', keys: [{}, { t: 34, hip: 80, knee: 112, ank: 30, sh: 90 }, { sh: 172, thx: -8 }, { thy: 40, shR: 95, sabR: 80, shL: 40 }, { thy: -40, shL: 95, sabL: 80, shR: 40 }, {}] }
  ],
  warmup: [
    { view: 'front', line: 'Deep front line: hip rotators', keys: [{ t: 20, hip: 85, knee: 100, ank: 25 }, { t: 20, hipR: 85, kneeR: 100, habR: 35, hrotR: 30, hipL: 85, kneeL: 100, habL: 5, hrotL: -25, ank: 25, thy: 20 }, { t: 20, hip: 85, knee: 100, ank: 25 }, { t: 20, hipL: 85, kneeL: 100, habL: 35, hrotL: 30, hipR: 85, kneeR: 100, habR: 5, hrotR: -25, ank: 25, thy: -20 }] },
    { view: 'lateral', line: 'Four lines in one: hip, hamstring, thorax, shoulder', keys: [{}, { t: 40, hipR: 95, kneeR: 95, ankR: 25, hipL: -25, kneeL: 15, sh: 20 }, { t: 40, hipR: 95, kneeR: 95, ankR: 25, hipL: -25, kneeL: 15, thy: 45, shR: 170, sabR: 70, shL: 10 }, { t: 40, hipR: 95, kneeR: 95, ankR: 25, hipL: -25, kneeL: 15, sh: 20 }, {}] },
    { view: 'ankle', line: 'Superficial back line: calf and Achilles', keys: [{ hipR: 25, kneeR: 30, ankR: 15, hipL: -12, kneeL: 8, ankL: 5 }, { hipR: 30, kneeR: 55, ankR: 34, hipL: -12, kneeL: 8, ankL: 5, t: 6 }, { hipR: 25, kneeR: 30, ankR: 15, hipL: -12, kneeL: 8, ankL: 5 }] },
    { view: 'lateral', line: 'Superficial front and back lines of the trunk', keys: [{ t: 70, hip: 25, knee: 80, sh: 80 }, { t: 70, hip: 25, knee: 80, sh: 80, lum: 16, thx: 20 }, { t: 70, hip: 25, knee: 80, sh: 80, lum: -14, thx: -16 }, { t: 70, hip: 25, knee: 80, shL: 80, shR: 40, sabR: -30, thy: 40 }, { t: 70, hip: 25, knee: 80, sh: 80 }] },
    { view: 'front', line: 'Deep front line: groin, hips, ankles', keys: [{}, { t: 38, hip: 108, knee: 132, ank: 34, hab: 22, sh: 55 }, { t: 36, hip: 106, knee: 130, ank: 34, hab: 24, sh: 60, thx: -4 }, { t: 38, hip: 108, knee: 132, ank: 34, hab: 22, sh: 55 }] }
  ],
  evening: [
    { view: 'front', line: 'Spiral line through the obliques', keys: [{ sab: 85 }, { sab: 85, thy: 45 }, { sab: 85 }, { sab: 85, thy: -45 }] },
    { view: 'front', line: 'Long, winding whole-body lines', keys: [{}, { thz: 25, sh: 160, sab: 30, rz: -3 }, { t: 25, hipR: 60, kneeR: 70, hipL: -15, thy: 30, shR: 140 }, { thz: -25, sh: 160, sab: 30, rz: 3 }, { t: 25, hipL: 60, kneeL: 70, hipR: -15, thy: -30, shL: 140 }, {}] },
    { view: 'ankle', line: 'Calf compartments under release', keys: [{ hipR: 20, kneeR: 25, ankR: 10, hipL: -10 }, { hipR: 20, kneeR: 25, ankR: -25, hipL: -10 }, { hipR: 20, kneeR: 25, ankR: 22, hipL: -10 }] },
    { view: 'lateral', line: 'Knee and thigh compartments: flossing', keys: [{}, { kneeR: 115, hipR: 5 }, { kneeR: 20, hipR: 50 }, { kneeR: 115, hipR: 5 }, {}] },
    { view: 'front', line: 'Proprioception: the foot and lateral line', keys: [{ hipR: 45, kneeR: 65, sab: 30 }, { hipR: 45, kneeR: 65, sab: 30, rz: 3, thz: -4 }, { hipR: 45, kneeR: 65, sab: 30, rz: -3, thz: 4 }, { hipR: 45, kneeR: 65, sab: 30 }] }
  ]
};
function rp3dMount(host, rid, i) {
  const f = (FLOWS[rid] || [])[i]; if (!f || !window.AnatomyLab) return false;
  const L = AnatomyLab; host.innerHTML = '<div class="rp3d-load">Loading the 3D body…</div>';
  L.init(host, { onLoad: () => { const l = host.querySelector('.rp3d-load'); if (l) l.remove(); rp3dPose(rid, i); } }); L.start();
  if (L.ready()) { const l = host.querySelector('.rp3d-load'); if (l) l.remove(); rp3dPose(rid, i); }
  return true;
}
function rp3dPose(rid, i) {
  const f = FLOWS[rid][i], L = AnatomyLab; L.roles && L.roles(null); L.set('lens', null); L.set('peel', 0); L.set('region', null); L.set('heat', true); L.flow(f.keys, 1.9); L.set('move', 'flow'); L.set('playing', true); L.set('speed', 1);
  try { if (f.view === 'ankle') L.view('ankle'); else L.setCamera(f.view === 'lateral' ? [-2.7, 1.05, 2.4] : [0.9, 1.05, 3.5], [0, 0.82, 0]); } catch (e) { }
}
