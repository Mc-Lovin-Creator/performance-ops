/* ---------- v45 Muscles in Motion: real movement on the 3D body, with agonist, antagonist, synergist and fixator lit in colour.
   Roles from standard kinesiology (Neumann 2017) and EMG studies of each task. A role belongs to a task, not to a muscle. ---------- */
const ROLES_ = [['agonist', 'Agonist', '#ff3b2f', 'Prime mover: does most of the work'], ['antagonist', 'Antagonist', '#3b82f6', 'Opposes the movement, or brakes and controls it'], ['synergist', 'Synergist', '#f59e0b', 'Helps the agonist or refines the movement'], ['fixator', 'Fixator', '#14b8a6', 'Holds a body part still so the movement has a stable base']];
const MOTIONS = [
  { id: 'curl', name: 'Elbow flexion', sub: 'Biceps curl', pops: ['sedentary', 'trained', 'competitive', 'elite'],
    move: { flow: [{ elbR: 4, shR: 4 }, { elbR: 132, shR: 12 }], sec: 1.7 }, cam: 'elbow',
    phase: f => f.i === 0 ? ['Lifting', 'concentric: the biceps shortens'] : ['Lowering', 'eccentric: the biceps lengthens under load, braking the weight'],
    roles: { agonist: ['biceps_brachii'], synergist: ['brachialis', 'brachioradialis'], antagonist: ['triceps'], fixator: ['deltoid_ant', 'supraspinatus', 'infraspinatus', 'subscapularis', 'trapezius_upper', 'trapezius_lower', 'rhomboids', 'serratus_ant'] },
    simple: 'The biceps pulls the forearm up. Brachialis does nearly as much work underneath it and brachioradialis helps most when the thumb points up. The triceps on the back lets go to allow it, then brakes at the top. Shoulder and shoulder-blade muscles hold the upper arm still so the elbow has something to pull against.',
    tip: 'Turn the palm up and the biceps works hardest; thumb up (hammer curl) shifts work to brachioradialis.', padel: 'Elbow flexors hold the racket head up in volleys; the triceps then extends the elbow in the smash.', src: ['neumann'] },
  { id: 'calf', name: 'Plantarflexion', sub: 'Calf raise', pops: ['sedentary', 'trained', 'competitive', 'elite'],
    move: { flow: [{}, { ank: -34, lift: 0.075 }], sec: 1.5 }, cam: 'calf',
    phase: f => f.i === 0 ? ['Rising', 'concentric: calf muscles shorten, Achilles transmits the force'] : ['Lowering', 'eccentric: the calf lengthens and the Achilles stores and releases energy'],
    roles: { agonist: ['gastrocnemius_med', 'gastrocnemius_lat', 'soleus'], synergist: ['tib_post', 'fibularis_longus', 'fibularis_brevis', 'fhl', 'fdl'], antagonist: ['tibialis_anterior', 'edl'], fixator: ['abductor_hallucis', 'fdb', 'glute_med', 'vastus_lateralis', 'vastus_medialis'] },
    simple: 'Gastrocnemius and soleus pull up on the heel through the Achilles tendon. The deep calf muscles help and keep the ankle from rolling out. The shin muscles at the front ease off to let the heel rise and then control the way down. Small foot muscles and the hip hold the foot and leg steady.',
    tip: 'Bent knee shifts the work to soleus; straight knee uses gastrocnemius more. Single-leg raises are the standard calf endurance test.', padel: 'Every split step and push-off is a fast calf raise; the calf and Achilles are among the most loaded tissues on court.', src: ['neumann', 'hebert'] },
  { id: 'squat', name: 'Hip and knee extension', sub: 'Back squat', pops: ['sedentary', 'trained', 'competitive', 'elite'],
    move: { name: 'squat' }, cam: 'lateral',
    phase: f => f.phase < 0.5 ? ['Descending', 'eccentric: glutes and quadriceps lengthen under load'] : ['Rising', 'concentric: glutes and quadriceps shorten to drive up'],
    roles: { agonist: ['glute_max', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius', 'rectus_femoris'], synergist: ['adductor_magnus', 'soleus', 'semitendinosus', 'semimembranosus', 'biceps_femoris'], antagonist: ['iliopsoas', 'tibialis_anterior'], fixator: ['erector_spinae', 'rectus_abdominis', 'ext_oblique', 'transversus_abd', 'multifidus', 'glute_med'] },
    simple: 'Glutes extend the hip and the quadriceps extend the knee. Adductor magnus and the hamstrings help at the hip; the hamstrings also co-contract at the knee, which helps protect the ACL. The trunk muscles brace so the spine stays still while the hips and knees do the work.',
    tip: 'Deeper squats load the glutes and adductors more; a forward knee shifts load to the quadriceps.', padel: 'The low ready position and every recovery from a low ball are partial squats under time pressure.', src: ['neumann', 'escamilla01'] },
  { id: 'lunge', name: 'Lateral deceleration', sub: 'Lateral lunge', pops: ['trained', 'competitive', 'elite'],
    move: { name: 'lunge' }, cam: 'anterior',
    phase: f => f.phase < 0.5 ? ['Loading', 'eccentric: lead-leg glutes and quadriceps brake the body'] : ['Pushing back', 'concentric: they drive the body back to centre'],
    roles: { agonist: ['glute_max', 'vastus_lateralis', 'vastus_medialis', 'rectus_femoris'], synergist: ['adductor_magnus', 'glute_med', 'semitendinosus', 'biceps_femoris'], antagonist: ['adductor_longus', 'gracilis'], fixator: ['ext_oblique', 'quadratus_lumborum', 'rectus_abdominis', 'tibialis_anterior', 'fibularis_longus'] },
    simple: 'The lead leg catches the body: glutes and quadriceps lengthen under load to slow it down, then shorten to push back. Gluteus medius keeps the knee in line. The trailing leg\'s adductors are stretched under tension and are the muscles most often strained in this move. The trunk and ankle muscles keep the body balanced over the foot.',
    tip: 'Strong adductors reduce groin injuries: the Copenhagen adduction exercise is the evidence-based choice.', padel: 'This is padel defence: wide, fast, repeated, and the reason adductor and knee control matter.', src: ['neumann'] },
  { id: 'smash', name: 'Overhead acceleration', sub: 'Padel smash', pops: ['competitive', 'elite'],
    move: { name: 'smash' }, cam: 'smash',
    phase: f => f.phase < 0.42 ? ['Cocking', 'arm externally rotates; the chest and front shoulder are stretched'] : f.phase < 0.55 ? ['Acceleration', 'internal rotators and triceps fire to swing the racket'] : f.phase < 0.78 ? ['Deceleration', 'the posterior cuff and back shoulder brake the arm eccentrically'] : ['Recovery', 'back to ready'],
    roles: { agonist: ['pec_major', 'lat_dorsi', 'subscapularis', 'triceps'], synergist: ['deltoid_ant', 'ext_oblique', 'rectus_abdominis'], antagonist: ['infraspinatus', 'teres_minor', 'deltoid_post'], fixator: ['serratus_ant', 'trapezius_lower', 'trapezius_upper', 'rhomboids', 'supraspinatus'] },
    simple: 'Chest, latissimus and subscapularis rotate the arm forward and the triceps straightens the elbow. The trunk rotators add speed from the legs and hips. After contact the back of the shoulder (infraspinatus, teres minor, rear deltoid) brakes the arm. The shoulder blade muscles hold the socket in place throughout.',
    tip: 'The braking muscles are smaller than the accelerators, so they need their own strength work: eccentric external rotation.', padel: 'Bandeja, vibora and smash all follow this pattern; overload of the posterior cuff is a common overhead complaint.', src: ['escamilla09', 'neumann'] }
];
const MO = { id: store.get('motion') || 'curl', focus: null, mounted: false };
const roleMap = m => { const out = {}; for (const [r, keys] of Object.entries(m.roles)) for (const k of keys) out[k] = r; return out; };
const keyName = k => (DB[k] && DB[k].name) || k.replace(/_/g, ' ');
function motionLesson(m) {
  return `<div class="mo">
    <div class="mo-stage"><div class="mo-host" id="mo-host"><div class="mo-load">Loading the 3D body…</div></div>
      <div class="mo-title"><span>${esc(m.sub)}</span><b>${esc(m.name)}</b></div>
      <div class="mo-phase" id="mo-phase"><b>…</b><span></span></div>
      <div class="mo-legend">${ROLES_.map(([k, l, c]) => `<button data-mo-role="${k}" style="--c:${c}" aria-pressed="${MO.focus === k}"><i></i>${l}</button>`).join('')}</div>
      <div class="mo-ctl"><button data-mo-act="play" aria-label="Play or pause">❚❚</button><button data-mo-act="slow">0.5×</button><button data-mo-act="norm">1×</button><button data-mo-act="lab">Open in the lab</button></div></div>
    <div class="mo-side">
      <p class="mo-simple">${esc(m.simple)}</p>
      <div class="mo-roles">${ROLES_.map(([k, l, c, d]) => `<article class="mo-role${MO.focus === k ? ' on' : ''}" data-mo-role="${k}" style="--c:${c}"><header><i></i><b>${l}</b><span>${d}</span></header><div>${m.roles[k].map(x => `<button class="mo-m" data-mo-pick="${x}">${esc(keyName(x))}</button>`).join('')}</div></article>`).join('')}</div>
      <div class="mo-note"><span class="eyebrow">Try it</span><p>${esc(m.tip)}</p></div>
      <div class="mo-note"><span class="eyebrow">On court</span><p>${esc(m.padel)}</p></div>
      <p class="lab-src">${m.src.map(srcLink).join(' · ')} · Roles change with the task: a muscle that is an agonist in one movement can be an antagonist or a fixator in another.</p>
    </div></div>`;
}
const MO_CAM = { elbow: null, calf: [[0.05, 0.42, -1.25], [-0.09, 0.3, 0]], lateral: [[-2.6, 1.0, 0.6], [0, 0.78, 0]], anterior: [[0.2, 1.0, 3.2], [0, 0.82, 0]], smash: [[-1.7, 1.45, 1.7], [-0.15, 1.25, 0]] };
function motionMount() {
  const host = document.getElementById('mo-host'); if (!host || !window.AnatomyLab) return;
  const m = MOTIONS.find(x => x.id === MO.id) || MOTIONS[0], L = AnatomyLab;
  const go = () => {
    const l = host.querySelector('.mo-load'); if (l) l.remove();
    L.style(L.get().style || 'cinematic'); L.set('lens', null); L.set('peel', 0); L.set('region', null); L.set('fascia', false); L.set('heat', false); L.set('xray', false); L.set('ghost', false); L.select(null);
    if (m.move.flow) { L.flow(m.move.flow, m.move.sec); L.set('move', 'flow'); } else L.set('move', m.move.name);
    L.set('playing', true); L.set('speed', 1); L.roles(roleMap(m), MO.focus);
    const c = MO_CAM[m.cam]; if (c) L.setCamera(c[0], c[1]); else L.viewNow(m.cam);
  };
  L.init(host, { onLoad: go, onFrame: () => { const ph = document.getElementById('mo-phase'); if (!ph) return; const f = L.flowPhase(), t = m.phase(f); if (ph.dataset.t !== t[0]) { ph.dataset.t = t[0]; ph.innerHTML = `<b>${esc(t[0])}</b><span>${esc(t[1])}</span>`; } } });
  L.start(); if (L.ready()) go();
}
function motionHub() {
  const m = MOTIONS.find(x => x.id === MO.id) || MOTIONS[0];
  return `<div class="mo-pick">${MOTIONS.filter(x => x.id === m.id || popMatch(x.pops)).map(x => `<button data-mo="${x.id}" aria-pressed="${x.id === m.id}"><b>${esc(x.sub)}</b><span>${esc(x.name)}</span></button>`).join('')}</div>${motionLesson(m)}`;
}
/* the domain, first in the hub */
EDU_DOMAINS.splice(1, 0, { id: 'motion', label: 'Muscles in motion', sections: [{ id: 'movements', label: 'Movements', title: 'Muscles in motion', description: 'Watch the real 3D body move. The prime mover glows red, the opposing muscle blue, helpers amber and stabilisers teal. Tap any muscle to fly to it.', render: () => (setTimeout(motionMount, 40), motionHub()) }] });
EDU_POPS.motion = ['sedentary', 'trained', 'competitive', 'elite'];
if (typeof HOLO_DOM !== 'undefined') HOLO_DOM.motion = 'body';
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-mo],[data-mo-role],[data-mo-pick],[data-mo-act]'); if (!t || !window.AnatomyLab) return; const L = AnatomyLab;
  if (t.dataset.mo) { MO.id = t.dataset.mo; MO.focus = null; store.set('motion', MO.id); keepRender(); return; }
  if (t.dataset.moRole) { MO.focus = MO.focus === t.dataset.moRole ? null : t.dataset.moRole; L.roleFocus(MO.focus); document.querySelectorAll('[data-mo-role]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.moRole === MO.focus); b.classList.toggle('on', b.dataset.moRole === MO.focus && b.tagName === 'ARTICLE'); }); return; }
  if (t.dataset.moPick) { e.stopPropagation(); const id = t.dataset.moPick + '_R'; L.select(id); L.focusOn(id); toast(keyName(t.dataset.moPick)); return; }
  const a = t.dataset.moAct;
  if (a === 'play') { L.set('playing', !L.get().playing); t.textContent = L.get().playing ? '❚❚' : '▶'; }
  else if (a === 'slow') L.set('speed', 0.5); else if (a === 'norm') L.set('speed', 1);
  else if (a === 'lab') { L.roles(null); go('anatomy'); }
});
