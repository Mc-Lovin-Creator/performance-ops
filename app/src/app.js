(function () {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('plos.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('plos.' + k, JSON.stringify(v)); } catch (e) { } } };
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const dayLabel = (back) => { const d = new Date(TODAY); d.setDate(d.getDate() - back); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

/* ---------- people, roles, permissions ---------- */
const PEOPLE = [
  { id: 'jp', name: 'JP', full: 'JP · Biokineticist', role: 'lead', init: 'JP' },
  { id: 'olivia', name: 'Olivia', full: 'Olivia · Biokineticist', role: 'biokineticist', init: 'OL' },
  { id: 'physio2', name: 'Physio 2', full: 'Physio 2 · Physiotherapist', role: 'physio', init: 'P2' },
  { id: 'dr', name: 'Physician', full: 'Team physician', role: 'physician', init: 'DR' },
  { id: 'javi', name: 'Javi', full: 'Javi · Head coach', role: 'coach', init: 'JA' },
  { id: 'andre', name: 'Andre', full: 'Andre · Padel coach', role: 'coach', init: 'AN' },
  { id: 'pablo', name: 'Pablo', full: 'Pablo · Padel coach', role: 'coach', init: 'PA' },
  { id: 'carlos', name: 'Carlos', full: 'Carlos · Padel coach', role: 'coach', init: 'CA' },
  { id: 'davidc', name: 'David', full: 'David · Padel coach', role: 'coach', init: 'DA' },
  { id: 'ops', name: 'Operations', full: 'Operations manager', role: 'manager', init: 'OM' },
  { id: 'p1', name: 'Player 1', full: 'Player 1 · Athlete', role: 'athlete', init: 'P1', athlete: 'p1' }
];
const ROLE = {
  lead: { label: 'Biokineticist', clinical: true, load: true, staff: true, editAccess: true },
  biokineticist: { label: 'Biokineticist', clinical: true, load: true, staff: false },
  physio: { label: 'Physiotherapist', clinical: true, load: true, staff: false },
  physician: { label: 'Physician', clinical: true, load: true, staff: false },
  coach: { label: 'Coach', clinical: false, load: true, staff: false },
  manager: { label: 'Manager', clinical: false, load: true, staff: true },
  athlete: { label: 'Athlete', clinical: false, load: false, staff: false }
};
const S = {
  me: store.get('me', 'jp'), priv: store.get('priv', false), track: 'clinical', route: 'command',
  audit: [], toast: null
};
const me = () => PEOPLE.find(p => p.id === S.me);
const perm = () => ROLE[me().role];

/* ---------- athletes ---------- */
const ATH = [
  { id: 'p1', name: 'Player 1', pos: 'Padel · right side', tier: 4, status: 'Modify', hrv: -18, sleep: '5h 40', sore: 6, device: 'Oura', private: true, access: ['jp', 'olivia', 'dr'], plan: 'Technical only, no jumps or sprints',
    case: { region: 'Right inner arch', dx: 'Spring ligament sprain, mild (graded return to padel)', stage: 'Court', pain: [4, 3, 3, 2, 2], since: '24 Sep', structure: 'spring_ligament_R', next: 'Re-test single-leg calf raise and hop tolerance Friday' }, base: 400, spike: 1.85 },
  { id: 'ls', name: 'Lina S.', pos: 'Padel · left side', tier: 3, status: 'Ready', hrv: 4, sleep: '7h 55', sore: 2, device: 'WHOOP', private: false, access: [], plan: 'Full session', case: null, base: 410, spike: 1.0 },
  { id: 'ok', name: 'Omar K.', pos: 'Padel · right side', tier: 3, status: 'Hold', hrv: -9, sleep: '6h 30', sore: 7, device: 'Garmin', private: false, access: [], plan: 'Physio review 08:30 before court',
    case: { region: 'Lower back', dx: 'Acute lumbar pain, non-specific; screen for pars stress', stage: 'Assess', pain: [7, 7], since: 'Today', structure: 'erector_spinae_R', next: 'Assessment 08:30' }, base: 360, spike: 2.1 },
  { id: 'sr', sex: 'f', name: 'Sara R.', pos: 'Padel · left side', tier: 2, status: 'Ready', hrv: 1, sleep: '8h 10', sore: 3, device: 'Oura', private: false, access: [], plan: 'Strength block week 3', case: null, base: 360, spike: 0.95 },
  { id: 'km', name: 'Karim M.', pos: 'Padel · right side', tier: 3, status: 'Ready', hrv: -3, sleep: '7h 05', sore: 4, device: 'Apple Watch', private: false, access: [], plan: 'Full session',
    case: { region: 'Right elbow', dx: 'Lateral elbow tendinopathy', stage: 'Build', pain: [5, 4, 4, 3, 3, 2], since: '28 Sep', structure: 'forearm_extensors_R', next: 'Grip strength re-test, racket review' }, base: 400, spike: 1.1 },
  { id: 'na', sex: 'f', name: 'Noor A.', pos: 'Rehab · ACL month 7', tier: 2, status: 'Modify', hrv: 2, sleep: '7h 40', sore: 3, device: 'Oura', private: true, access: ['jp', 'olivia'], plan: 'Stage 3, change of direction capped',
    case: { region: 'Left knee', dx: 'ACL reconstruction, month 7', stage: 'Court', pain: [2, 2, 1, 1, 1, 1], since: 'Mar', structure: 'acl_L', next: 'Hop test battery Thursday' }, base: 280, spike: 1.2 },
  { id: 'dv', name: 'David V.', pos: 'Padel · left side', tier: 3, status: 'Hold', hrv: -22, sleep: '4h 50', sore: 5, device: 'WHOOP', private: false, access: [], plan: 'Rest, doctor review',
    case: { region: 'Systemic', dx: 'Illness symptoms at check-in', stage: 'Assess', pain: [0], since: 'Today', structure: null, next: 'Doctor review 09:00' }, base: 400, spike: 1.5 },
  { id: 'ht', sex: 'f', name: 'Hana T.', pos: 'Padel · right side', tier: 2, status: 'Ready', hrv: 6, sleep: '8h 20', sore: 1, device: 'Oura', private: false, access: [], plan: 'Full session', case: null, base: 250, spike: 0.85 },
  { id: 'yb', name: 'Yousef B.', pos: 'Padel · left side', tier: 2, status: 'Ready', hrv: 0, sleep: '7h 15', sore: 3, device: 'Garmin', private: false, access: [], plan: 'Full session', case: null, base: 390, spike: 1.05 },
  { id: 'mf', name: 'Maya F.', pos: 'Padel · right side', tier: 1, status: 'No check-in', hrv: null, sleep: null, sore: null, device: 'Not connected', private: false, access: [], plan: 'Reminder sent 07:00', case: null, base: 330, spike: 1.0 }
];
// 42 days of session load (sRPE x minutes), last week scaled by spike
for (const a of ATH) {
  a.loads = [];
  for (let d = 41; d >= 0; d--) {
    const dow = (TODAY.getDay() - d % 7 + 7) % 7;
    const rest = dow === 5 || (dow === 2 && rnd() < 0.5);
    let v = rest ? 0 : a.base * (0.75 + rnd() * 0.6);
    if (d < 7) v *= a.spike;
    if (d === 0) v = 0;
    a.loads.push(Math.round(v / 10) * 10);
  }
  const la = 2 / 8, lc = 2 / 29; let ac = a.loads[0], ch = a.loads[0];
  a.acute = []; a.chronic = [];
  for (const v of a.loads) { ac = v * la + (1 - la) * ac; ch = v * lc + (1 - lc) * ch; a.acute.push(ac); a.chronic.push(ch); }
  a.acwr = +(a.acute[41] / a.chronic[41]).toFixed(2);
  const wk = a.loads.slice(-8, -1); const mean = wk.reduce((x, y) => x + y, 0) / 7; const sd = Math.sqrt(wk.reduce((x, y) => x + (y - mean) ** 2, 0) / 7);
  a.week = Math.round(mean * 7); a.monotony = +(mean / (sd || 1)).toFixed(2); a.strain = Math.round(a.week * a.monotony);
}
const TIERS = ['Sedentary', 'Recreationally active', 'Trained / developmental', 'Highly trained / national', 'Elite / international', 'World class'];

/* ---------- staff (non-clinical) ---------- */
const STAFF = [
  { id: 'jp', name: 'JP', role: 'Biokineticist', status: 'On duty', sessions: 19, hours: 46, streak: 6, leave: 21.5, cpd: 14, load: 82 },
  { id: 'olivia', name: 'Olivia', role: 'Biokineticist', status: 'On duty', sessions: 24, hours: 42, streak: 5, leave: 18.0, cpd: 9, load: 76 },
  { id: 'physio2', name: 'Physio 2', role: 'Physio', status: 'Vacation', sessions: 0, hours: 0, streak: 0, leave: 6.5, cpd: 11, load: 12 },
  { id: 'javi', name: 'Javi', role: 'Coach', status: 'On duty', sessions: 22, hours: 38, streak: 4, leave: 24.0, cpd: 6, load: 68 }
];
const FACILITY = [['Court 1', 0.82], ['Court 2', 0.64], ['Gym', 0.71], ['Physio lab', 0.88], ['Recovery station adherence', 0.74]];

/* ---------- treatment updates ---------- */
const MODS = ['Manual therapy', 'Exercise therapy', 'Shockwave', 'Dry needling', 'Ice and compression', 'Taping', 'Education', 'Hydrotherapy'];
const STAGES = ['Assess', 'Calm', 'Restore', 'Build', 'Court', 'Compete'];
let UPDATES = store.get('updates', null) || [
  { id: 'u1', ath: 'p1', by: 'olivia', at: 'Today 07:41', pain: 3, mods: ['Exercise therapy', 'Education'], response: 'Better', plan: 'Intrinsic foot and calf loading daily. Follow the plan colour on court.', stage: 'Court', shared: true },
  { id: 'u2', ath: 'km', by: 'jp', at: 'Today 07:20', pain: 2, mods: ['Exercise therapy', 'Shockwave'], response: 'Better', plan: 'Progress eccentric wrist extension. Grip test Friday.', stage: 'Build', shared: false },
  { id: 'u3', ath: 'na', by: 'olivia', at: 'Yesterday 16:10', pain: 1, mods: ['Exercise therapy'], response: 'Same', plan: 'Hop battery Thursday; target limb symmetry 90% or more.', stage: 'Court', shared: true },
  { id: 'u4', ath: 'ok', by: 'jp', at: 'Today 07:05', pain: 7, mods: ['Education'], response: 'New case', plan: 'Assessment 08:30. No court until reviewed.', stage: 'Assess', shared: true }
];

/* ---------- messages ---------- */
let CHANNELS = [
  { id: 'team', name: 'Lab team', members: ['jp', 'olivia', 'physio2', 'javi', 'ops'], private: false, kind: 'channel' },
  { id: 'physio', name: 'Physio room', members: ['jp', 'olivia', 'physio2'], private: false, kind: 'channel' },
  { id: 'case-p1', name: 'Player 1 · clinical (JP, Olivia, physician)', members: ['jp', 'olivia', 'dr'], private: true, kind: 'case', ath: 'p1' },
  { id: 'case-ok', name: 'Omar K. · lower back', members: ['jp', 'olivia', 'physio2'], private: false, kind: 'case', ath: 'ok' },
  { id: 'case-na', name: 'Noor A. · ACL', members: ['jp', 'olivia'], private: true, kind: 'case', ath: 'na' },
  { id: 'dm-p1', name: 'Player 1', members: ['jp', 'p1'], private: true, kind: 'dm' }
];
let MSGS = store.get('msgs', null) || {
  team: [['javi', '06:50', 'Court 2 booked from 08:00. Player 1 on technical only if physio agrees.'], ['jp', '07:02', 'Recovery station rota for next week is in Learn. Swap requests by Thursday please.']],
  physio: [['olivia', 'Yesterday', 'Hop test protocol is now version 3 in the library. Please read before Thursday.', 'Protocol · Hop test v3'], ['olivia', '07:10', 'Two notes waiting for co-sign.']],
  'case-p1': [['jp', '07:38', 'Check-in flagged: HRV 18% under baseline, slept 5h 40, arch still sore.', 'Check-in 07:31'], ['olivia', '07:41', 'Agreed. Technical only, no jumps or sprints. I will see him at 13:00.', 'Treatment update'], ['dr', '07:52', 'Reviewed. No imaging needed at this stage. I will see him with Olivia on Friday.']],
  'case-ok': [['jp', '07:05', 'Back pain rated "limits me" at check-in. Review at 08:30, no court until then.', 'Body map · lower back']],
  'case-na': [['olivia', 'Yesterday', 'Month 7. Hop battery Thursday. Quad symmetry last test 86%.']],
  'dm-p1': [['jp', '07:45', 'Lighter day today. Your foot exercises are in the app.'], ['p1', '07:50', 'Thanks. Arch feels better than yesterday.']]
};

/* ---------- innovation ---------- */
let IDEAS = store.get('ideas', null) || [
  { id: 'i1', name: 'Force plate testing as a paid service', stage: 'Evidence review', owner: 'JP', impact: 8, conf: 6, ease: 5, value: '[AED per test]', note: 'Jump and strength profiling for outside clubs' },
  { id: 'i2', name: 'AI readiness briefing at 07:00', stage: 'Pilot', owner: 'JP', impact: 7, conf: 7, ease: 7, value: 'Staff time', note: 'Summarises check-ins and wearables per athlete' },
  { id: 'i3', name: 'Sensory surface lane around the walking track', stage: 'Pilot', owner: 'JP', impact: 6, conf: 5, ease: 6, value: 'Member offer', note: 'Barefoot proprioception circuit' },
  { id: 'i4', name: 'VR anatomy sessions for athlete education', stage: 'Idea', owner: 'Olivia', impact: 5, conf: 4, ease: 4, value: 'Engagement', note: 'Uses the same 3D model' },
  { id: 'i5', name: 'Closed-client lab membership tiers', stage: 'Evidence review', owner: 'Operations', impact: 9, conf: 5, ease: 4, value: '[AED per member]', note: 'Private high-performance clients' },
  { id: 'i6', name: 'Post-padel recovery station adherence tracking', stage: 'Scale', owner: 'Javi', impact: 6, conf: 8, ease: 8, value: 'Retention', note: 'Five stations, logged per athlete' }
];
[{ id: 'i7', name: 'LINC connected supplement dispenser and biomarker test', stage: 'Idea', owner: 'JP', impact: 6, conf: 4, ease: 5, value: 'Player 1 nutrition', note: 'By Paul O\'Connor; early-access waitlist, 2027 launch' },
 { id: 'i8', name: 'Blaze smart hydration bottle', stage: 'Idea', owner: 'JP', impact: 5, conf: 5, ease: 8, value: 'Hydration tracking in the heat', note: 'Screen on the lid, intake tracking, UV sterilisation' },
 { id: 'i9', name: 'Sonar unified wearable data app', stage: 'Idea', owner: 'JP', impact: 7, conf: 5, ease: 6, value: 'One feed for Whoop, Garmin, Oura, Apple Watch', note: 'Could feed the load page once wearables go in' }].forEach(x => { if (!IDEAS.some(i => i.id === x.id)) IDEAS.push(x); });
const ISTAGES = ['Idea', 'Evidence review', 'Pilot', 'Scale'];

/* ---------- learning ---------- */
const TRACKS = [
  { name: 'Clinical', pct: 35, color: 'var(--health)', modules: [['Lower limb muscle and tendon injuries', 'Done', 2.5], ['ACL return to sport decision making', 'In progress', 3], ['Shoulder in overhead athletes', 'Next', 2], ['Concussion recognition (SCAT6)', 'Next', 1.5]] },
  { name: 'Performance', pct: 50, color: 'var(--load)', modules: [['Training load: methods and limits', 'Done', 2], ['Force plate testing in practice', 'In progress', 3], ['Sleep and recovery', 'Done', 1.75], ['Heat and hydration in the Gulf', 'Next', 0.75]] },
  { name: 'Strategy', pct: 15, color: 'var(--warn)', modules: [['Running a high-performance unit as a business', 'In progress', 4], ['Data governance and consent', 'Next', 2]] },
  { name: 'Wilderness and remote medicine', pct: 10, color: 'var(--risk)', modules: [['Remote trauma assessment', 'Next', 4], ['Environmental emergencies', 'Next', 3]] }
];
const PROTOCOLS = [
  ['Calf strain: return to run', 'Staged loading, calf raise targets, hop criteria', 'v2 · Olivia'],
  ['Hop test battery', 'Single, triple, crossover and 6 m timed hop; limb symmetry index', 'v3 · Olivia'],
  ['Lateral elbow tendinopathy', 'Isometric to eccentric progression, grip and racket review', 'v1 · JP'],
  ['Daily readiness rules', 'When check-in and wearable data trigger a review', 'v4 · JP'],
  ['Concussion pathway', 'SCAT6 on the day, graded return to sport', 'v1 · JP']
];

/* ---------- audit ---------- */
function audit(action, target, result) {
  S.audit.unshift({ at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), who: me().name, action, target, result: result || 'Allowed' });
  S.audit = S.audit.slice(0, 60);
}

/* ---------- access checks ---------- */
function seesAthlete(a) {
  const p = me();
  if (p.role === 'athlete') return a.id === p.athlete;
  if ((S.priv || a.id === 'p1') && a.private) return a.access.includes(p.id) || p.role === 'lead';
  return true;
}
function seesClinical(a) {
  const p = me();
  if (p.role === 'athlete') return a.id === p.athlete;
  if (!ROLE[p.role].clinical) return false;
  if ((S.priv || a.id === 'p1') && a.private) return a.access.includes(p.id) || p.role === 'lead';
  return true;
}
function aName(a) {
  if (seesAthlete(a)) return a.name;
  return 'Restricted athlete';
}
function aInit(a) { return seesAthlete(a) ? (a.id === 'p1' ? 'P1' : a.name.split(' ').map(x => x[0]).join('').slice(0, 2)) : '··'; }
function seesChannel(c) { return c.members.includes(S.me) && (!S.priv || !c.private || c.members.includes(S.me)); }

/* ---------- helpers ---------- */
const statusChip = s => `<span class="chip ${s === 'Ready' ? 'c-ok' : s === 'Modify' ? 'c-warn' : s === 'Hold' ? 'c-risk' : 'c-muted'}">${esc(s)}</span>`;
const lockIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const locked = (msg) => `<div class="locked">${lockIcon}<span>${esc(msg)}</span></div>`;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(S.toast); S.toast = setTimeout(() => el.classList.remove('show'), 2200); }

function spark(vals, w, h, color) {
  const max = Math.max(...vals, 1); const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - v / max * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="width:${w}px" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${w}" cy="${(h - 2 - vals[vals.length - 1] / max * (h - 4)).toFixed(1)}" r="2.6" fill="${color}"/></svg>`;
}
/* ratio gauge: the acute to chronic ratio on its four bands, with the parts that make it */
function loadGauge(a, au, mono) {
  const n = a.loads.length, r = a.acwr, lo = 0.5, hi = 2.0, ang = v => Math.PI * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  const P = (v, R) => [100 + Math.cos(ang(v)) * R, 100 - Math.sin(ang(v)) * R];
  const arc = (v0, v1, col) => { const [x0, y0] = P(v0, 80), [x1, y1] = P(v1, 80); return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A80,80 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="${col}" stroke-width="14" fill="none" stroke-linecap="butt"/>`; };
  const deg = ((Math.min(hi, Math.max(lo, r)) - lo) / (hi - lo)) * 180;
  const rb = RT.band(r);
  return `<section class="cmd gauge-hero"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">Acute to chronic ratio · today</span><h2 class="cmd-word" style="font-size:clamp(56px,7vw,104px)">${r.toFixed(2)}</h2><p class="cmd-why">${rb ? esc(rb[1]) + '. ' + esc(rb[2]) : ''} Read it against the plan: a graded return rises on purpose.</p>
      <div class="cmd-chips"><span class="cmd-chip"><em>Today</em>${au} min</span><span class="cmd-chip"><em>Acute 7-day</em>${Math.round(a.acute[n - 1])} min</span><span class="cmd-chip"><em>Chronic 28-day</em>${Math.round(a.chronic[n - 1])} min</span><span class="cmd-chip"><em>Monotony</em>${mono.toFixed(2)}</span></div></div>
    <div class="cmd-r"><svg class="gauge" viewBox="0 0 200 118" width="300" aria-label="Ratio ${r.toFixed(2)} on the band scale">${arc(lo, 0.8, '#7FA2C0')}${arc(0.8, 1.1, '#10B981')}${arc(1.1, 1.25, '#F59E0B')}${arc(1.25, hi, '#EF4444')}
      <g class="needle" style="--deg:${deg}deg"><line x1="100" y1="100" x2="30" y2="100" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="7" fill="currentColor"/></g>
      <text x="16" y="116" class="gl">0.5</text><text x="184" y="116" class="gl" text-anchor="end">2.0</text></svg>
      <div class="cmd-legend"><span><i style="background:#7FA2C0"></i>Under 0.80 de-load</span><span><i style="background:#10B981"></i>0.80 to 1.10 stable</span><span><i style="background:#F59E0B"></i>1.10 to 1.25 moderate rise</span><span><i style="background:#EF4444"></i>Above 1.25 large rise</span></div></div></section>`;
}
function loadChart(a, days) {
  days = days || 28;
  const L = a.loads.slice(-days), A = a.acute.slice(-days), C = a.chronic.slice(-days);
  const W = 760, H = 230, pl = 44, pr = 12, pt = 12, pb = 26;
  const max = Math.ceil(Math.max(...L, ...A) / 200) * 200 || 200;
  const x = i => pl + (i + 0.5) * (W - pl - pr) / days, y = v => pt + (H - pt - pb) * (1 - v / max);
  const bw = (W - pl - pr) / days * 0.62;
  let g = '';
  for (let t = 0; t <= max; t += max / 4) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  const bars = L.map((v, i) => `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" rx="2" fill="var(--load)" opacity="${i >= days - 7 ? 0.95 : 0.45}"/>`).join('');
  const line = (arr, c, dash) => `<polyline points="${arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.2" ${dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
  let xl = ''; for (let i = days - 1; i >= 0; i -= 7) xl += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${dayLabel(days - 1 - i)}</text>`;
  const cid = 'lc' + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart cine-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily session load with acute and chronic averages for ${esc(aName(a))}"><defs><clipPath id="${cid}"><rect class="clipr" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>${g}<g class="cb2">${bars}</g><g clip-path="url(#${cid})">${line(C, 'var(--ink-2)', true)}${line(A, 'var(--warn)')}<circle cx="${x(days - 1)}" cy="${y(A[days - 1])}" r="4" fill="var(--warn)" class="pulse-dot"/></g>${xl}</svg>
  <div class="legend"><span><i style="background:var(--load)"></i>${a.id === 'p1' ? 'Court minutes per day' : 'Daily load (sRPE × min, AU)'}</span><span><i style="background:var(--warn)"></i>Acute, 7-day EWMA</span><span><i style="background:var(--ink-2)"></i>Chronic, 28-day EWMA</span></div>`;
}
function acwrChart(a) {
  const days = 28, W = 760, H = 150, pl = 44, pr = 12, pt = 10, pb = 12;
  const R = a.acute.slice(-days).map((v, i) => v / a.chronic.slice(-days)[i]);
  const lo = 0.6, hi = 1.9, x = i => pl + i * (W - pl - pr) / (days - 1), y = v => pt + (H - pt - pb) * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Acute to chronic ratio trend">
  <rect x="${pl}" y="${y(1.3)}" width="${W - pl - pr}" height="${y(0.8) - y(1.3)}" fill="var(--ok-soft)"/>
  ${[0.8, 1.0, 1.3, 1.6].map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`).join('')}
  <polyline points="${R.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2"/>
  <circle cx="${x(days - 1)}" cy="${y(R[days - 1])}" r="4.5" fill="${R[days - 1] > 1.3 ? 'var(--risk)' : 'var(--ok)'}"/>
  <text x="${W - pr}" y="${y(R[days - 1]) - 10}" text-anchor="end" style="font-weight:800;fill:var(--ink)">${R[days - 1].toFixed(2)}</text></svg>
  <p class="muted" style="margin:0;font-size:12.5px">Shaded band 0.8 to 1.3 is the commonly cited range. The ratio is a trend for a clinician, not an injury predictor; its validity is debated (Impellizzeri et al., 2020).</p>`;
}

/* ---------- navigation ---------- */
const NAV = [
  ['§', 'Player 1 · private'],
  ['player1', 'Dashboard', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  ['calendar', 'Duty calendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['return', 'Return plan', '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>'],
  ['loadlab', 'Load', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ['p1tx', 'Treatment', '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'],
  ['p1rec', 'Records', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'],
  ['p1inj', 'Injuries', '<path d="M12 3v18M3 12h18" opacity=".35"/><circle cx="12" cy="12" r="4"/>'],
  ['p1test', 'Testing', '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>'],
  ['p1rx', 'Prescription', '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>'],
  ['p1edu', 'Education', '<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v6c3 2 9 2 12 0V9"/>'],
  ['p1anat', 'Anatomy', '<circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7M12 14l-4 7M12 14l4 7M5 10l7-1 7 1"/>'],
  ['p1kit', 'Kit and trials', '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'],
  ['p1chat', 'Chat and privacy', '<path d="M4 5h16v11H8l-4 4z"/><path d="M12 8.5v3"/>'],
  ['§', 'Squad'],
  ['command', 'Squad overview', '<path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/>'],
  ['athletes', 'Athletes and coaches', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'],
  ['book', 'Book a session', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>'],
  ['treatment', 'Squad treatment', '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'],
  ['records', 'Patient records', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'],
  ['classify', 'Classify and prescribe', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ['anatomy', 'Anatomy lab', '<circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7M12 14l-4 7M12 14l4 7M5 10l7-1 7 1"/>'],
  ['learn', 'Education hub', '<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v6c3 2 9 2 12 0V9"/>'],
  ['members', 'Members by population', '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 10 0"/>'],
  ['ask', 'Ask', '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><path d="M9 9.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M11 15h.01"/>'],
  ['messages', 'Messages', '<path d="M4 5h16v11H8l-4 4z"/>'],
  ['§', 'Admin'],
  ['pilot', 'Pilot metrics', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><circle cx="16" cy="6" r="2"/>'],
  ['audit', 'Evidence audit', '<path d="M9 12l2 2 4-4"/><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'],
  ['trust', 'Trust and access', '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'],
  ['§', 'Labs'],
  ['recovery', 'Recovery and track', '<path d="M12 21c-4-3-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7-7 10z"/><path d="M9 11h6"/>'],
  ['build', 'Build status', '<path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 17 2 2 4-4"/>'],
  ['agents', 'Agents', '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M3 13v2M21 13v2"/>'],
  ['innovation', 'Innovation', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>']
];
const P1_ROUTES = ['player1', 'calendar', 'return', 'loadlab', 'p1tx', 'p1rec', 'p1inj', 'p1test', 'p1rx', 'p1edu', 'p1anat', 'p1kit', 'p1chat'];
function allowedRoutes() {
  const r = me().role;
  if (r === 'athlete') return ['command', 'myfoot', 'book', 'anatomy', 'learn', 'ask', 'messages'];
  if (r === 'coach') return ['command', 'recovery', 'members', 'book', 'athletes', 'anatomy', 'classify', 'learn', 'ask', 'messages', 'innovation'];
  if (r === 'physician') return [...P1_ROUTES, 'command', 'members', 'book', 'athletes', 'calendar', 'treatment', 'records', 'assess', 'classify', 'anatomy', 'learn', 'ask', 'messages', 'agents', 'innovation'];
  if (r === 'manager') return ['command', 'recovery', 'members', 'book', 'athletes', 'classify', 'learn', 'ask', 'messages', 'agents', 'innovation', 'trust', 'build', 'audit', 'pilot'];
  return [...NAV.filter(n => n[0] !== '§').map(n => n[0]), 'assess'];
}
const NAVP = { assess: 'treatment' };
const ATH_NAV = [['command', 'Today', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'], ['myfoot', 'Your recovery', '<path d="M7 20c-2-3-2-8 1-12s7-4 8 0-2 6-1 9 1 4-1 5"/>'], ['book', 'Book a session', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'], ['learn', 'Education', '<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v6c3 2 9 2 12 0V9"/>'], ['anatomy', 'Anatomy', '<circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7M12 14l-4 7M12 14l4 7M5 10l7-1 7 1"/>'], ['ask', 'Ask', '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'], ['messages', 'Messages', '<path d="M4 5h16v11H8l-4 4z"/>']];
function renderNav() {
  const ok = allowedRoutes();
  const unread = Object.keys(MSGS).filter(k => CHANNELS.find(c => c.id === k && c.members.includes(S.me))).length;
  const allowed = n => ok.includes(n[0]) && (!P1_ROUTES.includes(n[0]) || seesAthlete(P1()));
  let src = [];
  if (me().role === 'athlete') src = ATH_NAV.filter(allowed);
  else { let grp = null; for (const n of NAV) { if (n[0] === '§') { grp = [n]; src.push(grp); } else if (allowed(n)) grp.push(n); } src = src.filter(g => g.length > 1).flat(); }
  let inLabs = false; const labsOpen = store.get('labsOpen', false) || NAV.slice(NAV.findIndex(n => n[1] === 'Labs')).some(n => n[0] === (S.route || '').split('-')[0]);
  $('#nav').innerHTML = src.map(([k, l, ic]) => { if (k === '§') inLabs = l === 'Labs'; return [k, l, ic]; }).map(([k, l, ic], i, arr) => k === '§' ? (l === 'Labs' ? `<button class="nav-h nav-labs" data-labs aria-expanded="${labsOpen}">Labs <em>experimental</em><i>${labsOpen ? '−' : '+'}</i></button>` : `<span class="nav-h">${l === 'Player 1 · private' ? lockIcon : ''}${l}</span>`) : (arr.slice(0, i).reverse().find(x => x[0] === '§') || [])[1] === 'Labs' && !labsOpen ? '' : `<a href="#${k}" data-route="${k}" class="${P1_ROUTES.includes(k) && k !== 'player1' ? 'nav-sub' : ''}" ${(NAVP[S.route] || S.route.split('-')[0]) === k || (k === 'athletes' && S.route.startsWith('athlete-')) ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg>${l}${k === 'messages' ? `<span class="count">${unread}</span>` : k === 'treatment' ? `<span class="count">${UPDATES.length}</span>` : ''}</a>`).join('');
  $('#foot-who').textContent = 'Viewing as ' + me().full;
}

/* ---------- pages ---------- */
function greet() { return 'Good morning, ' + (me().role === 'athlete' ? 'Player 1' : me().name); }
function pageCommand() {
  const p = perm(), r = me().role;
  if (r === 'athlete') return pageReturn();
  if (!p.clinical && S.track === 'clinical') S.track = 'nonclinical';
  const vis = ATH.filter(seesAthlete);
  const decisions = ATH.filter(a => a.status !== 'Ready');
  const head = `<section class="hero has-shader"><canvas class="hero-shader" aria-hidden="true"></canvas>
    <div style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">Wednesday 21 October · 07:40 · sample data</span>
      <div style="display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap"><span class="big num">${S.track === 'clinical' ? decisions.length : Math.round(ATH.reduce((s, a) => s + a.week, 0) / 1000) + 'k'}</span>
      <span class="hero-sub">${S.track === 'clinical' ? 'athletes need a clinical decision before training' : 'AU of squad session load in the last 7 days'}</span></div>
      <span class="muted">${greet()}. ${S.track === 'clinical' ? '9 of 10 checked in. 2 notes waiting for your signature.' : `${ATH.filter(a => a.acwr > 1.3).length} athletes above the usual load range. 3 of 4 staff on duty.`}</span>
    </div>
    <div class="seg" role="group" aria-label="Track">
      <button data-act="track" data-arg="clinical" aria-pressed="${S.track === 'clinical'}" ${p.clinical ? '' : 'disabled title="Clinical track needs clinical access"'}>${p.clinical ? '' : lockIcon + ' '}Clinical</button>
      <button data-act="track" data-arg="nonclinical" aria-pressed="${S.track === 'nonclinical'}">Non-clinical</button>
    </div></section>`;
  if (S.track === 'clinical') {
    const open = ATH.filter(a => a.case);
    return head + `<div class="kpis">
      <div class="kpi"><span class="eyebrow">Open cases</span><b>${open.length}</b><small>2 new this week</small></div>
      <div class="kpi"><span class="eyebrow">Seen today</span><b>3</b><small>of 6 booked</small></div>
      <div class="kpi"><span class="eyebrow">Notes to sign</span><b>2</b><small>oldest 16 h</small></div>
      <div class="kpi"><span class="eyebrow">Return to play this week</span><b>1</b><small>Noor A. hop battery</small></div>
      <div class="kpi"><span class="eyebrow">Restricted records</span><b>${ATH.filter(a => a.private).length}</b><small>${S.priv ? 'private mode on' : 'private mode off'}</small></div></div>
    <div class="grid2">
      <section class="stack"><div class="sec-head"><h2>Decisions before training</h2><a class="btn sm" href="#athletes">All athletes</a></div>
        <div class="rows">${decisions.map(a => `<button class="row row-btn" data-act="open" data-arg="${a.id}">
          <span class="av">${aInit(a)}</span><span class="grow"><b>${esc(aName(a))}</b>${a.private && S.priv ? ' <span class="chip plain c-health" style="margin-left:6px">' + lockIcon + ' Private</span>' : ''}<br><span class="muted" style="font-size:13px">${seesClinical(a) && a.case ? esc(a.case.dx) : seesAthlete(a) ? esc(a.plan) : 'You do not have access to this record'}</span></span>
          ${statusChip(a.status)}</button>`).join('')}</div>
      </section>
      <aside class="stack">
        <div class="ink-panel"><span class="eyebrow" style="color:inherit;opacity:.7">Case pipeline</span>
          ${STAGES.map(st => { const n = ATH.filter(a => a.case && a.case.stage === st).length; return `<div style="display:grid;grid-template-columns:90px 1fr 24px;gap:12px;align-items:center;font-size:14px"><span>${st}</span><span style="height:8px;border-radius:9px;background:rgba(127,127,127,.25);overflow:hidden"><span style="display:block;height:100%;width:${n * 30}%;background:var(--accent)"></span></span><b class="num">${n}</b></div>`; }).join('')}
        </div>
        <div class="panel"><div class="sec-head"><h3>Treatment updates today</h3><a class="btn sm" href="#treatment">Open board</a></div>
          <div class="rows">${UPDATES.slice(0, 4).map(u => { const a = ATH.find(x => x.id === u.ath); return `<div class="row"><span class="av">${aInit(a)}</span><span class="grow" style="font-size:13.5px"><b>${esc(aName(a))}</b> · ${esc(u.at)}<br>${seesClinical(a) ? `<span class="muted">${esc(u.plan)}</span>` : '<span class="muted">Clinical detail restricted</span>'}</span></div>`; }).join('')}</div>
        </div>
      </aside></div>`;
  }
  // non-clinical
  const squad = { loads: [], acute: [], chronic: [] };
  for (let i = 0; i < 42; i++) { squad.loads.push(ATH.reduce((s, a) => s + a.loads[i], 0) / ATH.length); squad.acute.push(ATH.reduce((s, a) => s + a.acute[i], 0) / ATH.length); squad.chronic.push(ATH.reduce((s, a) => s + a.chronic[i], 0) / ATH.length); }
  squad.name = 'Squad average';
  return head + `<div class="kpis">
    <div class="kpi"><span class="eyebrow">Squad load, 7 days</span><b class="num">${ATH.reduce((s, a) => s + a.week, 0).toLocaleString()}</b><small>AU, sRPE × minutes</small></div>
    <div class="kpi"><span class="eyebrow">Above 1.3 ratio</span><b>${ATH.filter(a => a.acwr > 1.3).length}</b><small>acute vs chronic</small></div>
    <div class="kpi"><span class="eyebrow">Staff on duty</span><b>3 / 4</b><small>Physio 2 on vacation</small></div>
    <div class="kpi"><span class="eyebrow">Facility use</span><b>76%</b><small>booked hours this week</small></div>
    <div class="kpi"><span class="eyebrow">Recovery adherence</span><b>74%</b><small>5-station protocol</small></div></div>
  <section class="panel"><div class="sec-head"><div><h2>Squad training load</h2><span class="muted" style="font-size:13px">Average per athlete · last 28 days</span></div><span class="chip c-load">EWMA method</span></div>${loadChart(squad)}</section>
  <div class="grid2">
    <section class="stack"><h2>Load by athlete</h2><div class="table-wrap"><table><thead><tr><th>Athlete</th><th>7-day load</th><th>Trend</th><th>Acute : chronic</th><th>Monotony</th><th>Strain</th><th>Today</th></tr></thead><tbody>
      ${ATH.map(a => `<tr class="click" data-act="open" data-arg="${a.id}"><td><b>${esc(aName(a))}</b></td><td>${a.week.toLocaleString()}</td><td>${spark(a.loads.slice(-14), 90, 26, 'var(--load)')}</td><td><b style="color:${a.acwr > 1.3 ? 'var(--risk)' : a.acwr < 0.8 ? 'var(--warn)' : 'var(--ok)'}">${a.acwr.toFixed(2)}</b></td><td>${a.monotony}</td><td>${a.strain.toLocaleString()}</td><td>${statusChip(a.status)}</td></tr>`).join('')}
    </tbody></table></div><p class="muted" style="font-size:12.5px;margin:0">Monotony is the weekly mean divided by its standard deviation, strain is weekly load times monotony (Foster, 1998).</p></section>
    <aside class="stack">
      <div class="panel"><h3>Staff workload</h3><div class="rows">${STAFF.map(s => `<div class="row"><span class="av">${s.name.slice(0, 2).toUpperCase()}</span><span class="grow"><b>${s.name}</b> <span class="muted" style="font-size:12px">${s.role}</span><div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${s.load}%;background:${s.load > 80 ? 'var(--warn)' : 'var(--accent)'}"></div></div></span><span style="text-align:right;font-size:12.5px"><span class="chip ${s.status === 'On duty' ? 'c-ok' : 'c-load'}">${s.status}</span><br><span class="muted">${s.sessions} sessions · ${s.hours} h</span></span></div>`).join('')}</div></div>
      <div class="panel"><h3>Facility</h3>${FACILITY.map(([n, v]) => `<div style="display:grid;grid-template-columns:1fr 46px;gap:10px;align-items:center;font-size:13.5px"><span>${n}<div class="bar-track" style="margin-top:6px"><div class="bar-fill" style="width:${v * 100}%;background:var(--load)"></div></div></span><b class="num" style="text-align:right">${Math.round(v * 100)}%</b></div>`).join('')}</div>
    </aside></div>`;
}

function pageAthletes() {
  const rows = ATH.filter(a => me().role !== 'athlete' || seesAthlete(a));
  return `<div class="sec-head"><div><span class="eyebrow">Squad · sample data</span><h1 style="font-size:34px;letter-spacing:-.6px">Athletes</h1></div>
    <div class="pills"><span class="chip c-health">${lockIcon} ${ATH.filter(a => a.private).length} private records</span></div></div>
  <div class="table-wrap"><table><thead><tr><th>Athlete</th><th>Classification</th><th>HRV vs baseline</th><th>Sleep</th><th>Soreness</th><th>Acute : chronic</th><th>Case</th><th>Today</th></tr></thead><tbody>
  ${rows.map(a => { const vis = seesAthlete(a), cl = seesClinical(a); return `<tr class="click" data-act="open" data-arg="${a.id}">
    <td><div style="display:flex;gap:12px;align-items:center"><span class="av">${aInit(a)}</span><span><b>${esc(aName(a))}</b>${a.private && S.priv ? ' ' + lockIcon : ''}<br><span class="muted" style="font-size:12.5px">${vis ? esc(a.pos) : 'Ask JP for access'}</span></span></div></td>
    <td>${vis ? popChip(tierPop(a.tier), 'tier ' + a.tier) : '—'}</td>
    <td style="color:${a.hrv < -10 ? 'var(--risk)' : 'inherit'}">${vis && a.hrv != null ? (a.hrv > 0 ? '+' : '') + a.hrv + '%' : '—'}</td><td>${vis ? a.sleep || '—' : '—'}</td><td>${vis && a.sore != null ? a.sore + ' / 10' : '—'}</td>
    <td><b>${vis ? a.acwr.toFixed(2) : '—'}</b></td>
    <td>${a.case ? (cl ? `<span class="chip plain c-health">${esc(a.case.region)}</span>` : '<span class="chip plain c-muted">' + lockIcon + ' Clinical</span>') : '<span class="muted">None</span>'}</td>
    <td>${statusChip(a.status)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}

function pageAthlete(id) {
  const a = ATH.find(x => x.id === id); if (!a) return pageAthletes();
  if (!seesAthlete(a)) { audit('Open record', 'Restricted athlete', 'Denied'); return `<a class="btn sm" href="#athletes">Back to athletes</a><div class="hero"><div class="stack"><span class="eyebrow">Private record</span><span class="big" style="font-size:64px">Restricted</span><span class="hero-sub">Private mode is on and you are not on this record's access list. The attempt was logged.</span></div><button class="btn primary" data-act="request" data-arg="${a.id}">Request access from JP</button></div>`; }
  audit('Open record', a.name, 'Allowed');
  const cl = seesClinical(a);
  const ups = UPDATES.filter(u => u.ath === a.id);
  return `<a class="btn sm" href="#athletes" style="align-self:flex-start">Back to athletes</a>
  <section class="hero"><div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">${esc(a.pos)} · Tier ${a.tier} · ${TIERS[a.tier]}</span><h1 style="font-size:48px;letter-spacing:-1px">${esc(a.name)}</h1>
    <div class="pills">${statusChip(a.status)}${a.private ? `<span class="chip c-health">${lockIcon} Private · ${a.access.length} people</span>` : ''}${a.case && cl ? `<span class="chip c-health">${esc(a.case.region)} · ${esc(a.case.stage)}</span>` : ''}</div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="#messages" data-act="thread" data-arg="${a.id}">Message team</a>${cl && a.case && a.case.structure ? `<button class="btn primary" data-act="focus" data-arg="${a.case.structure}">Open in 3D</button>` : ''}</div></section>
  <div class="kpis"><div class="kpi"><span class="eyebrow">HRV vs baseline</span><b>${a.hrv != null ? (a.hrv > 0 ? '+' : '') + a.hrv + '%' : '—'}</b></div><div class="kpi"><span class="eyebrow">Sleep</span><b>${a.sleep || '—'}</b></div><div class="kpi"><span class="eyebrow">Soreness</span><b>${a.sore != null ? a.sore + '/10' : '—'}</b></div><div class="kpi"><span class="eyebrow">Acute : chronic</span><b>${a.acwr}</b></div><div class="kpi"><span class="eyebrow">Plan today</span><b style="font-size:16px;letter-spacing:0">${esc(a.plan)}</b></div></div>
  <div class="grid2"><section class="stack"><div class="panel"><h2>Training load</h2>${loadChart(a)}</div><div class="panel"><h3>Acute to chronic ratio</h3>${acwrChart(a)}</div></section>
  <aside class="stack">
    <div class="panel"><h3>Clinical</h3>${!a.case ? '<p class="muted" style="margin:0">No open case.</p>' : cl ? `<div class="facts"><div><span>Diagnosis</span><span>${esc(a.case.dx)}</span></div><div><span>Since</span><span>${esc(a.case.since)}</span></div><div><span>Stage</span><span>${esc(a.case.stage)}</span></div><div><span>Pain trend</span><span>${spark(a.case.pain, 120, 28, 'var(--health)')} now ${a.case.pain[a.case.pain.length - 1]}/10</span></div><div><span>Next</span><span>${esc(a.case.next)}</span></div></div>
      <div class="rows">${ups.map(u => `<div class="row" style="font-size:13.5px"><span class="grow"><b>${esc(PEOPLE.find(p => p.id === u.by).name)}</b> · ${esc(u.at)}<br><span class="muted">${esc(u.mods.join(', '))}. ${esc(u.plan)}</span></span><span class="chip plain c-muted">Pain ${u.pain}</span></div>`).join('')}</div>` : locked('Clinical notes are visible to the clinical team. You see the plan and status only.')}</div>
    <div class="panel"><div class="sec-head"><h3>Who can see this record</h3>${a.private ? '<span class="chip c-health">Private</span>' : '<span class="chip plain c-muted">Team default</span>'}</div>
      ${PEOPLE.filter(p => p.role !== 'athlete').map(p => { const on = !a.private || a.access.includes(p.id) || p.role === 'lead'; return `<label class="layer" style="justify-content:space-between"><span style="display:flex;gap:10px;align-items:center"><span class="av" style="width:28px;height:28px;font-size:11px">${p.init}</span>${esc(p.full)}</span><input type="checkbox" data-act="grant" data-arg="${a.id}:${p.id}" ${on ? 'checked' : ''} ${perm().editAccess && a.private && p.role !== 'lead' ? '' : 'disabled'}></label>`; }).join('')}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${perm().editAccess ? `<button class="btn sm" data-act="mkprivate" data-arg="${a.id}">${a.private ? 'Make team-visible' : 'Make private'}</button>` : '<span class="muted" style="font-size:12.5px">Only the lead can change access.</span>'}</div></div>
  </aside></div>`;
}

function pageTreatment() {
  const can = perm().clinical;
  const list = ATH.filter(a => a.case && seesClinical(a));
  return `<div class="sec-head"><div><span class="eyebrow">Daily treatment updates · ${UPDATES.length} updates · cases move left to right</span><h1 style="font-size:34px;letter-spacing:-.6px">Treatment</h1></div>${txTabs('treatment')}</div>
  <div class="board">${STAGES.map(st => `<div class="col"><div class="sec-head"><b>${st}</b><span class="muted num">${ATH.filter(a => a.case && a.case.stage === st).length}</span></div>
    ${ATH.filter(a => a.case && a.case.stage === st).map(a => seesClinical(a) ? `<button class="card" data-act="open" data-arg="${a.id}"><b>${esc(a.name)}</b><span class="muted" style="font-size:12.5px">${esc(a.case.region)} · pain ${a.case.pain[a.case.pain.length - 1]}/10</span><span style="font-size:12.5px">${esc(a.case.next)}</span></button>` : `<div class="card">${locked('Private case')}</div>`).join('')}</div>`).join('')}</div>
  <div class="grid2"><section class="panel"><h2>Log today's update</h2>${can ? `<form id="upd" class="stack">
    <div class="grid3" style="gap:14px"><label class="field">Athlete<select id="u-ath">${list.map(a => `<option value="${a.id}">${esc(a.name)} · ${esc(a.case.region)}</option>`).join('')}</select></label>
    <label class="field">Pain now: <output id="u-pain-o">3</output> / 10<input id="u-pain" type="range" min="0" max="10" value="3" oninput="document.getElementById('u-pain-o').textContent=this.value"></label>
    <label class="field">Stage<select id="u-stage">${STAGES.map(s => `<option>${s}</option>`).join('')}</select></label></div>
    <div class="field">Treatment given<div class="pills" id="u-mods">${MODS.map(m => `<button type="button" class="pill" data-act="mod" data-arg="${m}" aria-pressed="false">${m}</button>`).join('')}</div></div>
    <label class="field">Response<select id="u-resp"><option>Better</option><option>Same</option><option>Worse</option></select></label>
    <label class="field">Plan and next step<textarea id="u-plan" placeholder="What happens next, and what the coach needs to know"></textarea></label>
    <label class="layer"><input type="checkbox" id="u-share" checked> Send a summary to the physician (clinical thread)</label>
    <div><button class="btn primary" type="submit">Save update</button></div></form>` : locked('Only the clinical team logs treatment. You see the plan in each athlete record.')}</section>
  <aside class="panel"><h3>Recent updates</h3><div class="rows">${UPDATES.map(u => { const a = ATH.find(x => x.id === u.ath); const cl = seesClinical(a); return `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="av">${aInit(a)}</span><span class="grow"><b>${esc(aName(a))}</b> · ${esc(u.at)} · ${esc(PEOPLE.find(p => p.id === u.by).name)}<br>${cl ? `<span class="muted">${esc(u.mods.join(', '))}</span><br>${esc(u.plan)}` : '<span class="muted">Clinical detail restricted</span>'}</span>${cl ? `<span class="chip plain ${u.response === 'Better' ? 'c-ok' : u.response === 'Worse' ? 'c-risk' : 'c-muted'}">${esc(u.response)}</span>` : ''}</div>`; }).join('')}</div></aside></div>`;
}

/* ---------- anatomy page ---------- */
const PEEL_L = ['Everything', 'Superficial muscle removed', 'All muscle removed', 'Skeleton only'];
const CUST = [['hip', 'Hip flexion', -20, 120], ['knee', 'Knee flexion', 0, 140], ['ankle', 'Ankle dorsiflexion', -40, 30], ['trunk', 'Trunk flexion', -20, 90], ['shoulder', 'Shoulder flexion', -40, 180], ['elbow', 'Elbow flexion', 0, 145], ['abd', 'Hip abduction', -20, 45], ['rot', 'Trunk rotation', -45, 45]];
const AN = { region: null, labels: false, ltab: 'structures', q: '', sys: 'all', open: {}, cust: {}, sel: null, hover: null, pins: [], clip: 'none', off: 0, flip: false, quiz: null, score: [0, 0], lastTop: 0 };
function anBuildPanel(st) {
  const looks = [['cinematic', 'Cinematic', 'Black stage, wet tissue, rim light'], ['clinical', 'Clinical', 'Bright atlas colours'], ['cadaver', 'Cadaver', 'Fixed-specimen tones'], ['hologram', 'Hologram', 'Glass and light']];
  return `<div class="stack" style="gap:12px"><span class="eyebrow">Look</span><div class="an-looks">${looks.map(([k, l, d]) => `<button data-act="look" data-arg="${k}" aria-pressed="${(st.style || 'cinematic') === k}" class="an-look an-look-${k}"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
    <span class="eyebrow">Construct and deconstruct</span>
    <div style="display:flex;gap:8px"><button class="btn sm primary" data-act="assemble">Assemble</button><button class="btn sm" data-act="deconstruct">Deconstruct</button></div>
    <label class="range">Explode<input type="range" id="an-ex" min="0" max="1" step="0.01" value="${st.explode || 0}"></label>
    <label class="range">Dissect, peel from outside in<input type="range" id="an-peel" min="0" max="3" step="1" value="${st.peel || 0}"><span id="an-peel-l" class="muted">${PEEL_L[st.peel || 0]}</span></label>
    <label class="layer"><input type="checkbox" data-act="layer" data-arg="fascia" ${st.layers.fascia ? 'checked' : ''}><span class="sw" style="background:#F1ECE2"></span>Fascia web over the muscles</label>
    <p class="muted" style="font-size:12px;margin:0">Assemble rebuilds the body from bone outwards: cartilage, ligaments, deep then superficial muscle, fascia, then vessels and nerves. Explode fans every layer away from its region so each structure can be picked on its own.</p></div>`;
}
function pageAnatomy() {
  const st = window.AnatomyLab ? AnatomyLab.get() : { move: 'idle', layers: {}, peel: 0 };
  const moves = [['idle', 'Stance'], ['squat', 'Squat'], ['gait', 'Gait'], ['smash', 'Overhead'], ['landing', 'Landing'], ['lunge', 'Lateral lunge'], ['custom', 'Your angles']];
  const layers = [['fascia', 'Fascia, sheaths and capsules', '#F1ECE2'], ['bone', 'Skeletal', '#E6DDC7'], ['cart', 'Cartilage and discs', '#B9D0D6'], ['conn', 'Ligaments and tendons', '#D5DCE3'], ['sup', 'Superficial muscle', '#B04238'], ['deep', 'Deep muscle', '#8E342E'], ['art', 'Arterial', '#B8302A'], ['vein', 'Venous', '#34508F'], ['nerve', 'Nervous', '#E3BC45'], ['organ', 'Visceral organs', '#C48778'], ['ins', 'All muscle attachments', '#D8463A']];
  const forP1 = S.route === 'p1anat';
  return `<div class="sec-head"><div><span class="eyebrow">${forP1 ? lockIcon + ' Player 1 · right spring ligament (plantar calcaneonavicular) · ' : ''}Z-Anatomy atlas · about 3,000 named structures · 10 systems · rigged to 17 joints</span><h1 style="font-size:34px;letter-spacing:-.6px">${forP1 ? 'Player 1 anatomy' : 'Anatomy lab'}</h1></div>
   <div class="pills"><button class="btn sm accent" data-hb="story">${AN.story ? 'Stop story' : 'Player 1\'s injury'}</button><button class="btn sm" data-act="pinmode" aria-pressed="${st.pinMode ? 'true' : 'false'}">${st.pinMode ? 'Pinning: click the model' : 'Pin a finding'}</button><button class="btn sm primary" data-act="quiz">${AN.quiz ? 'Stop quiz' : 'Quiz me'}</button></div></div>
  <div class="lab">
    <div class="lab-side left">
      <nav class="seg an-ltabs" aria-label="Lab panels">${[['structures', 'Structures'], ['layers', 'Layers'], ['build', 'Build'], ['movement', 'Motion']].map(([k, l]) => `<button data-av="ltab" data-arg="${k}" aria-pressed="${AN.ltab === k}">${l}</button>`).join('')}</nav>
      ${AN.ltab === 'structures' ? anTree() : AN.ltab === 'build' ? anBuildPanel(st) : AN.ltab === 'layers' ? `<div class="stack" style="gap:6px"><span class="eyebrow">Systems</span>${layers.map(([k, l, c]) => `<label class="layer"><input type="checkbox" data-act="layer" data-arg="${k}" ${st.layers[k] !== false ? 'checked' : ''}><span class="sw" style="background:${c}"></span>${l}</label>`).join('')}
        <label class="range">Dissect, peel from outside in<input type="range" id="an-peel" min="0" max="3" step="1" value="${st.peel || 0}"><span id="an-peel-l" class="muted">${PEEL_L[st.peel || 0]}</span></label>
        <label class="layer"><input type="checkbox" data-act="xray" ${st.xray ? 'checked' : ''}> X-ray muscles</label>
        <span class="eyebrow" style="margin-top:8px">Holo scan lens</span><div class="seg holo-seg">${[['', 'Off'], ['deep', 'Deep muscle'], ['bone', 'Skeleton']].map(([k, l]) => `<button data-act="lens" data-arg="${k}" aria-pressed="${(st.lens || '') === k}">${l}</button>`).join('')}</div><span class="muted" style="font-size:12px">Move the cursor over the body to see beneath the surface. Shift and scroll to resize.</span></div>
      <div class="stack" style="gap:10px"><span class="eyebrow">Section plane</span><div class="seg" style="flex-wrap:wrap">${['none', 'sagittal', 'coronal', 'transverse'].map(m => `<button data-act="clip" data-arg="${m}" aria-pressed="${AN.clip === m}">${m === 'none' ? 'Off' : m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
        <label class="range">Cut position<input type="range" id="an-off" min="-0.25" max="0.25" step="0.005" value="${AN.off}"></label><label class="layer"><input type="checkbox" data-act="flip" ${AN.flip ? 'checked' : ''}> Flip side kept</label></div>` : `<div class="stack" style="gap:10px"><span class="eyebrow">Movement</span><div class="pills">${moves.map(([k, l]) => `<button class="pill" data-act="move" data-arg="${k}" aria-pressed="${st.move === k}">${l}</button>`).join('')}</div>
        <div style="display:flex;gap:8px"><button class="btn sm" data-act="play">${st.playing === false ? 'Play' : 'Pause'}</button><label class="range" style="flex:1">Speed<input type="range" id="an-speed" min="0.2" max="2" step="0.1" value="${st.speed || 1}"></label></div>
        <label class="range">Scrub<input type="range" id="an-phase" min="0" max="1" step="0.005" value="0"></label>
        ${st.move === 'custom' ? `<div class="stack" style="gap:8px">${CUST.map(([k, l, mn, mx]) => `<label class="range">${l} <b id="cv-${k}">${AN.cust[k] || 0}°</b><input type="range" min="${mn}" max="${mx}" value="${AN.cust[k] || 0}" data-cust="${k}"></label>`).join('')}<span class="muted" style="font-size:12px">Right side. Type or drag angles to place the body in any position.</span></div>` : ''}
        ${st.move === 'landing' ? `<label class="layer"><input type="checkbox" data-act="valgus" ${st.valgus ? 'checked' : ''}> Show dynamic knee valgus fault</label>` : ''}
        <label class="layer"><input type="checkbox" data-act="heat" ${st.heat !== false ? 'checked' : ''}> Activation heat (shortening and lengthening speed)</label>${typeof ocPanel === 'function' ? ocPanel() : ''}</div>`}
    </div>
    <div class="lab-stage${st.lens ? ' holo-on' : ''}" id="stage" data-look="${st.style || 'cinematic'}"><div class="an-quick"><button data-act="assemble" title="Rebuild the body layer by layer">Assemble</button><button data-act="deconstruct" title="Take it apart from the outside in">Deconstruct</button><button data-act="lookcycle" title="Change the look">${({ cinematic: 'Cinematic', clinical: 'Clinical', cadaver: 'Cadaver', hologram: 'Hologram' })[st.style || 'cinematic']}</button></div><button class="holo-fab" data-act="lenscycle" title="Holo scan: see beneath the surface"><i></i><span>${st.lens === 'bone' ? 'Scanning skeleton' : st.lens === 'deep' ? 'Scanning deep muscle' : 'Holo scan'}</span></button><svg class="an-lead" id="an-lead" aria-hidden="true"><line id="an-line"/><circle id="an-dot" r="4"/></svg><div class="an-label" id="an-label" hidden></div><div class="an-labels" id="an-labels"></div><div class="an-meas glass" id="an-meas" hidden></div><div id="story-cap" class="story-cap" aria-live="polite"></div><div id="an-loading" class="glass" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;padding:14px 18px;font-weight:700">${window.AnatomyLab && AnatomyLab.ready && AnatomyLab.ready() ? '' : 'Loading full-body model, about 5 MB…'}</div>
      <div class="stage-top"><div class="glass angles" id="angles"><span class="muted">Hip</span><span class="muted">Knee</span><span class="muted">Ankle</span><b id="ag-hip">0°</b><b id="ag-knee">0°</b><b id="ag-ankle">0°</b><span class="muted">Trunk</span><span class="muted">Shoulder</span><span class="muted">Valgus</span><b id="ag-trunk">0°</b><b id="ag-sh">0°</b><b id="ag-val">0°</b></div>
        <div class="glass views" role="group" aria-label="Camera views">${['anterior', 'posterior', 'lateral', 'knee', 'ankle', 'shoulder', 'elbow', 'spine'].map(v => `<button class="pill" data-act="view" data-arg="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
      <div class="stage-bot"><div id="alarm" class="alarm" hidden>Dynamic knee valgus: hip adduction, internal rotation and knee abduction load the ACL. This pattern predicted ACL injury in a prospective study (Hewett et al., 2005).</div><span id="an-move-name" class="glass" style="padding:8px 12px;font-weight:800;font-size:13px">Neutral stance</span>${anToolbar()}</div>
    </div>
    <div class="lab-side right" id="an-right">${anatomyRight()}</div>
  </div>`;
}
function anatomyRight() {
  if (AN.quiz) {
    const q = AN.quiz;
    return `<div class="stack"><span class="eyebrow">Quiz · ${AN.score[0]} of ${AN.score[1]} correct</span><h2 class="serif" style="font-size:28px;font-weight:400">Name the glowing structure</h2>
      <div class="stack" style="gap:8px">${q.options.map(o => `<button class="btn" style="justify-content:flex-start;${q.answered ? (o === q.id ? 'background:var(--ok-soft);color:var(--ok);border-color:transparent' : o === q.picked ? 'background:var(--risk-soft);color:var(--risk);border-color:transparent' : '') : ''}" data-act="answer" data-arg="${o}" ${q.answered ? 'disabled' : ''}>${esc(NAME(o))}</button>`).join('')}</div>
      ${q.answered ? `<p style="margin:0">${q.picked === q.id ? 'Correct.' : 'Not quite. It is the ' + esc(NAME(q.id).toLowerCase()) + '.'} ${esc(DB[KEY(q.id)].a || '')}</p><button class="btn primary" data-act="quiznext">Next structure</button>` : ''}</div>`;
  }
  if (AN.sel) {
    const li = LABI(AN.sel); const d = DB[KEY(AN.sel)] ? Object.assign({}, DB[KEY(AN.sel)], li ? { name: li.name.replace(/^(right|left) /, '').replace(/^./, c => c.toUpperCase()) } : {}) : { name: li ? li.name.replace(/^(right|left) /, '').replace(/^./, c => c.toUpperCase()) : AN.sel, kind: li ? li.kind : 'Structure', region: li && window.AnatomyLab && AnatomyLab.regions ? (AnatomyLab.regions()[li.region] || '') : '', what: li && typeof TISSUE_LABEL !== 'undefined' ? TISSUE_LABEL[li.kind] || '' : '', note: 'Full clinical card not written yet. Shape and position are from the Z-Anatomy atlas (cadaver-derived BodyParts3D scans).' };
    const LBL = { Ligament: ['Attaches above', 'Attaches below', 'Function'], Tendon: ['From', 'Inserts', 'Function'], Fascia: ['Attaches', 'Links', 'Function'], Artery: ['Arises from', 'Ends as', 'Supplies'], Vein: ['Begins', 'Drains into', 'Drains'], Nerve: ['From', 'Supplies', 'Function'] }[d.kind] || ['Origin', 'Insertion', 'Action'];
    const rows = [['What it is', d.what], ['Region', d.region], [LBL[0], d.o], [LBL[1], d.i], [LBL[2], d.a], ['Nerve supply', d.n], ['Injuries', d.inj], ['Tests', d.tests], ['Rehab', d.rehab], ['Padel', d.padel]].filter(r => r[1]);
    return `<div class="stack"><span class="eyebrow">${esc(d.kind)}${SIDE(AN.sel) ? ' · ' + SIDE(AN.sel) : ''}</span><h2 class="serif" style="font-size:30px;font-weight:400;letter-spacing:-.3px">${esc(d.name)}</h2>
      <div class="pills"><button class="btn sm" data-act="isolate">Isolate</button><button class="btn sm" data-act="hide">Hide</button><button class="btn sm" data-av="ghost" aria-pressed="${AnatomyLab.get().ghost}">Ghost others</button><button class="btn sm" data-act="focusSel">Zoom</button><button class="btn sm" data-act="showall">Show all</button></div>${LABI(AN.sel) && LABI(AN.sel).region !== undefined ? `<span class="muted" style="font-size:12.5px">${esc(AnatomyLab.regions()[LABI(AN.sel).region])} · ${esc(LABI(AN.sel).kind)}</span>` : ''}
      ${anAttachHTML(AN.sel)}<div class="facts">${rows.map(r => `<div><span>${r[0]}</span><span>${esc(r[1])}</span></div>`).join('')}</div>${d.note ? `<p class="muted" style="margin:0;font-size:13px">${esc(d.note)}</p>` : ''}
      ${perm().clinical ? `<button class="btn primary" data-act="tonote">Add to Player 1 note</button>` : ''}</div>`;
  }
  return `<div class="stack"><span class="eyebrow">Live</span><h3>Most active muscles</h3><div class="rows" id="an-top"><div class="row muted">Pick a movement to see activation.</div></div>
    <span class="eyebrow" style="margin-top:8px">Pinned findings</span><div class="rows">${AN.pins.length ? AN.pins.map(p => `<div class="row" style="font-size:13.5px"><span class="sw" style="background:#5b6cff;border-radius:50%"></span><span class="grow">${esc(NAME(p.on))}</span></div>`).join('') : '<div class="row muted" style="font-size:13.5px">Use "Pin a finding", then click the model.</div>'}</div>
    ${AN.pins.length ? '<button class="btn sm" data-act="clearpins">Clear pins</button>' : ''}
    <span class="eyebrow" style="margin-top:8px">Browse</span><div class="pills">${['gastrocnemius_med_R', 'acl_R', 'forearm_extensors_R', 'supraspinatus_R', 'glute_med_R', 'achilles_R', 'adductor_magnus_R', 'patellar_tendon_R'].map(id => `<button class="pill" data-act="pick" data-arg="${id}">${esc(DB[KEY(id)].name)}</button>`).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin:0">Click any structure; double-click to fly to it. Drag to rotate, right-drag to pan, scroll to zoom. Keys: H hide, I isolate, G ghost, F focus, Ctrl Z undo, Esc clear.</p><p class="muted" style="font-size:11.5px;margin:0">Model: Z-Anatomy, the libre 3D atlas of anatomy (CC BY-SA 4.0), built on BodyParts3D © Life Science Integrated Database Center (CC BY-SA 2.1 Japan).</p></div>`;
}
function mountAnatomy() {
  const stage = $('#stage'); if (!stage) return;
  const go = () => {
    AnatomyLab.init(stage, {
      onSelect: id => { AN.sel = id; AN_LBL = null; if (id) audit('Viewed structure', NAME(id)); $('#an-right').innerHTML = anatomyRight(); anRefreshTree(true); },
      onHover: h => { const t = $('#tip'); if (!h) { t.hidden = true; return; } t.hidden = false; t.textContent = NAME(h.id); t.style.left = h.x + 'px'; t.style.top = h.y + 'px'; },
      onPin: list => { AN.pins = list; if (!AN.sel && !AN.quiz) $('#an-right').innerHTML = anatomyRight(); },
      onQuizClick: () => { },
      onAnchor: a => { anLabel(a); anAutoLabels(); anMeasurePos(); },
      onMeasure: anMeasure,
      onSystems: st => { if (st === 'ready') { anRefreshTree(); if ($('#an-right')) $('#an-right').innerHTML = anatomyRight(); } if (st === 'error') toast('Could not load vessels and nerves'); },
      onVis: () => { anRefreshTree(); anRefreshTools(); },
      onLoad: () => { const l = $('#an-loading'); if (l) l.hidden = true; anRefreshTree(); setTimeout(() => AnatomyLab.loadSystems(), 1200); if (AN.pending) { const id = AN.pending; AN.pending = null; setTimeout(() => { AnatomyLab.select(id); AnatomyLab.focusOn(id); }, 200); } if (AN.quiz) AnatomyLab.set('quiz', { id: AN.quiz.id }); },
      onError: e => { const l = $('#an-loading'); if (l) l.textContent = 'Could not load the model: ' + e.message; },
      onFrame: f => {
        const now = performance.now(); if (now - AN.lastTop < 200) return; AN.lastTop = now;
        const a = f.angles, set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v || 0) + '°'; };
        set('ag-hip', a.hip); set('ag-knee', a.knee); set('ag-ankle', a.ankle); set('ag-trunk', a.trunk); set('ag-sh', a.shoulder); set('ag-val', a.valgus);
        const al = $('#alarm'); if (al) al.hidden = !a.aclAlarm;
        const ph = $('#an-phase'); if (ph && AnatomyLab.get().playing) ph.value = f.phase;
        const top = $('#an-top'); if (top) top.innerHTML = f.top.length ? f.top.map(([k, v]) => `<div class="row" style="font-size:13.5px;min-height:40px"><span class="grow">${esc(DB[k] ? DB[k].name : k.charAt(0).toUpperCase() + k.slice(1))}</span><span style="width:90px" class="bar-track"><span class="bar-fill" style="display:block;width:${Math.round(v * 100)}%;background:var(--warn)"></span></span></div>`).join('') : '<div class="row muted">Pick a movement to see activation.</div>';
      }
    });
    AnatomyLab.start();
    const mv = AnatomyLab.moves().find(m => m.key === AnatomyLab.get().move); if ($('#an-move-name')) $('#an-move-name').textContent = mv ? mv.name : '';
    if (AN.pending && AnatomyLab.ready()) { const id = AN.pending; AN.pending = null; setTimeout(() => { AnatomyLab.select(id); AnatomyLab.focusOn(id); }, 300); }
  };
  if (window.AnatomyLab) go(); else window.addEventListener('anatomy-ready', go, { once: true });
}
function startQuiz() {
  const ids = Object.keys(DB).filter(k => DB[k].kind === 'Muscle' || DB[k].kind === 'Ligament' || DB[k].kind === 'Tendon').map(k => k + '_R').filter(id => !AnatomyLab.resolve || AnatomyLab.resolve(id));
  const id = ids[Math.floor(Math.random() * ids.length)];
  const opts = new Set([id]); while (opts.size < 4) opts.add(ids[Math.floor(Math.random() * ids.length)]);
  AN.quiz = { id, options: [...opts].sort(() => Math.random() - 0.5), answered: false };
  AnatomyLab.set('quiz', { id }); AnatomyLab.set('selected', null); AN.sel = null; AnatomyLab.focusOn(id);
}

/* ---------- classify and test ---------- */
const CL = store.get('cl', { age: 34, sex: 'Male', mod: 90, vig: 20, str: 1, sit: 9, ses: 1, sport: false, level: 'none', active: false, disease: false, symptoms: false, sbp: 132, dbp: 84, waist: 99, grip: 38 });
function classify(c) {
  const whoMet = (+c.mod + 2 * +c.vig) >= 150 && +c.str >= 2;
  let tier = 0, why = [];
  if (c.level === 'world') { tier = 5; why.push('Medals or finals at major international events, or within about 2% of world-best performance'); }
  else if (c.level === 'international') { tier = 4; why.push('Competes internationally; typically ranked about 4th to 300th in the world'); }
  else if (c.level === 'national') { tier = 3; why.push('Competes at national level; trains to improve sport-specific skill'); }
  else if (c.sport && +c.ses >= 3) { tier = 2; why.push('Identifies with a sport and trains 3 or more times a week to compete locally'); }
  else if (whoMet) { tier = 1; why.push('Meets WHO 2020 activity guidelines, without a sport-specific training focus'); }
  else { tier = 0; why.push('Does not meet WHO 2020 guidelines: 150 to 300 min moderate (or 75 to 150 vigorous) a week plus 2 strength days'); }
  // ACSM 2015 preparticipation screening
  let acsm;
  if (c.symptoms) acsm = { t: 'Medical clearance needed', d: c.active ? 'Stop exercise and seek medical clearance before resuming.' : 'Seek medical clearance before starting.', c: 'c-risk' };
  else if (c.disease) acsm = c.active ? { t: 'Clearance before vigorous work', d: 'Continue moderate exercise. Medical clearance recommended before vigorous intensity.', c: 'c-warn' } : { t: 'Medical clearance recommended', d: 'Then start light to moderate and progress gradually.', c: 'c-warn' };
  else acsm = c.active ? { t: 'No clearance needed', d: 'Continue moderate or vigorous exercise and progress gradually.', c: 'c-ok' } : { t: 'No clearance needed', d: 'Start light to moderate and progress gradually.', c: 'c-ok' };
  // BP, ACC/AHA (category set by the higher of systolic and diastolic)
  const s = +c.sbp, d = +c.dbp;
  let bp = s >= 140 || d >= 90 ? ['Stage 2 hypertension', 'c-risk'] : s >= 130 || d >= 80 ? ['Stage 1 hypertension', 'c-warn'] : s >= 120 ? ['Elevated', 'c-warn'] : ['Normal', 'c-ok'];
  const w = +c.waist, male = c.sex === 'Male';
  const waist = w > (male ? 102 : 88) ? ['Substantially increased risk', 'c-risk'] : w > (male ? 94 : 80) ? ['Increased risk', 'c-warn'] : ['Low risk', 'c-ok'];
  const grip = +c.grip < (male ? 27 : 16) ? ['Low (probable sarcopenia threshold)', 'c-risk'] : ['Above threshold', 'c-ok'];
  const sitting = +c.sit >= 8 ? ['High sitting time', +c.mod / 7 >= 60 ? 'c-warn' : 'c-risk'] : ['Moderate or low', 'c-ok'];
  return { tier, why, whoMet, acsm, bp, waist, grip, sitting };
}
const BATTERY = {
  0: [['Resting blood pressure', 'ACC/AHA categories, 2017, kept in 2025'], ['Waist circumference', 'WHO 2008: men > 94 cm, women > 80 cm increased risk'], ['Grip strength', 'EWGSOP2 2019: < 27 kg men, < 16 kg women'], ['5 chair rises', 'EWGSOP2: > 15 s indicates low strength'], ['6-minute walk', 'Compare with a reference equation (Enright and Sherrill, 1998)'], ['Daily sitting time', 'SBRN 2017 definition; > 8 h a day raises risk unless offset by 60 to 75 min of activity (Ekelund 2016)']],
  1: [['Blood pressure, waist, grip', 'As tier 0'], ['Estimated VO2max', 'Submaximal cycle or step test, against ACSM norms'], ['Push-up and plank', 'Track individual change'], ['Mobility screen', 'Ankle dorsiflexion, hip rotation, thoracic rotation']],
  2: [['Countermovement jump', 'Force plate; track against own baseline'], ['Isometric mid-thigh pull', 'Peak force relative to body mass'], ['5-0-5 change of direction', 'Both sides; deficit against linear speed'], ['Yo-Yo intermittent recovery 1', 'Track individual change'], ['Hop battery', 'Limb symmetry index']],
  3: [['As tier 2, plus', 'Monthly re-test'], ['Reactive strength index', 'Drop jump on force plate'], ['Isokinetic or isometric knee and hip', 'Limb symmetry index'], ['Sport-specific', 'No consensus padel norms; build in-house reference data']],
  4: [['As tier 3', 'Fortnightly neuromuscular check'], ['Daily wellness and HRV', 'Individual baseline and smallest worthwhile change'], ['Shoulder ER and IR strength', 'Overhead athletes; ratio and side difference']],
  5: [['As tier 4', 'Individualised, with medical oversight']],
  rtp: [['Quadriceps strength symmetry', '≥ 90% before return after ACL reconstruction (Grindem 2016)'], ['Hop tests', 'Single, triple, crossover, 6 m timed: ≥ 90% limb symmetry'], ['Time from surgery', 'Return before 9 months raised reinjury risk (Grindem 2016)'], ['Psychological readiness', 'ACL-RSI questionnaire']]
};
function pageClassify() {
  const r = classify(CL);
  const f = (id, label, type, extra) => `<label class="field">${label}<input id="cl-${id}" data-cl="${id}" type="${type}" value="${esc(CL[id])}" ${extra || ''}></label>`;
  const chk = (id, label) => `<label class="layer"><input type="checkbox" data-cl="${id}" ${CL[id] ? 'checked' : ''}> ${label}</label>`;
  return `<div class="sec-head"><div><span class="eyebrow">Participant classification and test selection</span><h1 style="font-size:34px;letter-spacing:-.6px">Classify and prescribe</h1></div><span class="muted">Every rule below names its source</span></div>
  <div class="grid2"><section class="panel"><h2>Person</h2><div class="grid3" style="gap:14px">
    ${f('age', 'Age', 'number', 'min="10" max="100"')}<label class="field">Sex<select data-cl="sex"><option ${CL.sex === 'Male' ? 'selected' : ''}>Male</option><option ${CL.sex === 'Female' ? 'selected' : ''}>Female</option></select></label>${f('ses', 'Training sessions a week', 'number', 'min="0" max="21"')}
    ${f('mod', 'Moderate activity, min a week', 'number', 'min="0"')}${f('vig', 'Vigorous activity, min a week', 'number', 'min="0"')}${f('str', 'Strength days a week', 'number', 'min="0" max="7"')}
    ${f('sit', 'Sitting, hours a day', 'number', 'min="0" max="20"')}${f('sbp', 'Systolic BP, mmHg', 'number')}${f('dbp', 'Diastolic BP, mmHg', 'number')}
    ${f('waist', 'Waist, cm', 'number')}${f('grip', 'Grip strength, kg', 'number')}
    <label class="field">Highest competition<select data-cl="level">${[['none', 'None'], ['local', 'Local or club'], ['national', 'National'], ['international', 'International'], ['world', 'World class']].map(([v, l]) => `<option value="${v}" ${CL.level === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="stack" style="gap:2px">${chk('sport', 'Identifies with a specific sport and trains to compete')}${chk('active', 'Exercised regularly for the last 3 months (30 min moderate, 3 days a week)')}${chk('disease', 'Known cardiovascular, metabolic or renal disease')}${chk('symptoms', 'Signs or symptoms suggesting such disease')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="preset" data-arg="sed">Example: desk worker</button><button class="btn sm" data-act="preset" data-arg="club">Example: club player</button><button class="btn sm" data-act="preset" data-arg="pro">Example: touring pro</button></div></section>
  <aside class="stack"><div class="ink-panel"><span class="eyebrow" style="color:inherit;opacity:.7">McKay et al. 2022 · participant classification</span><div style="display:flex;align-items:baseline;gap:14px"><span class="serif" style="font-size:88px;line-height:.9">${r.tier}</span><span style="font-size:22px;font-weight:800">${TIERS[r.tier]}</span></div><span class="muted">${esc(r.why.join('. '))}.</span>
      <div style="display:flex;gap:4px">${TIERS.map((t, i) => `<span title="${t}" style="flex:1;height:8px;border-radius:9px;background:${i <= r.tier ? 'var(--accent)' : 'rgba(127,127,127,.3)'}"></span>`).join('')}</div></div>
    <div class="panel"><div class="facts">
      <div><span>WHO 2020</span><span><span class="chip ${r.whoMet ? 'c-ok' : 'c-warn'}">${r.whoMet ? 'Meets guidelines' : 'Below guidelines'}</span></span></div>
      <div><span>Sitting</span><span><span class="chip ${r.sitting[1]}">${r.sitting[0]}</span></span></div>
      <div><span>ACSM screen</span><span><span class="chip ${r.acsm.c}">${r.acsm.t}</span><br><span class="muted" style="font-size:12.5px">${r.acsm.d}</span></span></div>
      <div><span>Blood pressure</span><span><span class="chip ${r.bp[1]}">${r.bp[0]}</span></span></div>
      <div><span>Waist</span><span><span class="chip ${r.waist[1]}">${r.waist[0]}</span></span></div>
      <div><span>Grip</span><span><span class="chip ${r.grip[1]}">${r.grip[0]}</span></span></div></div></div></aside></div>
  <section class="stack"><div class="sec-head"><h2>Test battery for tier ${r.tier}</h2><span class="chip c-accent">Selected automatically</span></div>
    <div class="table-wrap"><table><thead><tr><th>Test</th><th>Standard or threshold</th></tr></thead><tbody>${BATTERY[r.tier].map(t => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="stack"><h2>Return to sport after ACL reconstruction</h2><div class="table-wrap"><table><thead><tr><th>Criterion</th><th>Standard</th></tr></thead><tbody>${BATTERY.rtp.map(t => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td></tr>`).join('')}</tbody></table></div></section>
  ${rxPanel()}
  ${clinicalComponents()}
  <section class="panel"><h3>Sources</h3><ol style="margin:0;padding-left:18px;color:var(--ink-2);font-size:13px;display:flex;flex-direction:column;gap:4px">
    <li>McKay AKA et al. Defining training and performance caliber: a participant classification framework. Int J Sports Physiol Perform. 2022;17(2):317–331.</li>
    <li>Bull FC et al. WHO 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54:1451–1462.</li>
    <li>Tremblay MS et al. Sedentary Behavior Research Network terminology consensus. Int J Behav Nutr Phys Act. 2017;14:75.</li>
    <li>Riebe D et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc. 2015;47(11):2473–2479.</li>
    <li>Whelton PK et al. 2017 ACC/AHA high blood pressure guideline; categories retained in the 2025 AHA/ACC guideline.</li>
    <li>Cruz-Jentoft AJ et al. Sarcopenia: revised European consensus (EWGSOP2). Age Ageing. 2019;48:16–31.</li>
    <li>Grindem H et al. Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction. Br J Sports Med. 2016;50:804–808.</li>
    <li>Ekelund U et al. Does physical activity attenuate the association of sitting time with mortality? Lancet. 2016;388:1302–1310.</li></ol></section>`;
}

/* ---------- learn ---------- */
function pageLearn() {
  return `<div class="sec-head"><div><span class="eyebrow">Squad and team · Performance Library · team CPD</span><h1 style="font-size:34px;letter-spacing:-.6px">Education hub</h1></div><button class="btn primary" data-act="learnquiz">Anatomy quiz in 3D</button></div>
  ${eduHub('team')}
  <div class="sec-head" style="margin-top:8px"><div><span class="eyebrow">Team upskilling · 5-year plan · year 1</span><h2>Team CPD</h2></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${TRACKS.map(t => `<section class="panel"><div class="sec-head"><h3>${t.name}</h3><b class="num">${t.pct}%</b></div><div class="bar-track"><div class="bar-fill" style="width:${t.pct}%;background:${t.color}"></div></div>
    <div class="rows">${t.modules.map(m => `<div class="row" style="font-size:13.5px"><span class="grow">${esc(m[0])}<br><span class="muted">${m[2]} h CPD</span></span><span class="chip plain ${m[1] === 'Done' ? 'c-ok' : m[1] === 'In progress' ? 'c-load' : 'c-muted'}">${m[1]}</span></div>`).join('')}</div></section>`).join('')}</div>
  <div class="grid2"><section class="stack"><h2>Protocol library</h2><div class="rows">${PROTOCOLS.map(p => `<div class="row"><span class="grow"><b>${esc(p[0])}</b><br><span class="muted" style="font-size:13px">${esc(p[1])}</span></span><span class="chip plain c-muted">${esc(p[2])}</span></div>`).join('')}</div></section>
  <aside class="panel"><h3>Sample progress</h3><p class="muted" style="margin:0;font-size:13.5px">Percentages and CPD hours are examples. In the build they come from completed modules and logged CPD for each person.</p>
  <div class="rows">${STAFF.map(s => `<div class="row"><span class="av">${s.name.slice(0, 2).toUpperCase()}</span><span class="grow">${s.name}</span><b class="num">${s.cpd} h</b></div>`).join('')}</div></aside></div>`;
}

/* ---------- messages ---------- */
S.ch = 'case-p1';
function pageMessages() {
  const mine = CHANNELS.filter(c => c.members.includes(S.me));
  if (!mine.find(c => c.id === S.ch)) S.ch = mine[0] ? mine[0].id : null;
  const c = CHANNELS.find(x => x.id === S.ch);
  const a = c && c.ath ? ATH.find(x => x.id === c.ath) : null;
  const group = (k, t) => { const l = mine.filter(x => x.kind === k); return l.length ? `<span class="eyebrow" style="padding:10px 10px 4px">${t}</span>` + l.map(x => `<button class="ch" data-act="ch" data-arg="${x.id}" aria-current="${x.id === S.ch}"><span class="av" style="width:30px;height:30px;font-size:11px">${x.kind === 'case' ? '+' : x.kind === 'dm' ? 'DM' : '#'}</span><span class="grow" style="min-width:0"><b style="font-size:14px">${esc(x.name)}</b><br><span class="muted" style="font-size:12px">${x.members.length + (x.external ? x.external.length : 0)} members</span></span>${x.private ? lockIcon : ''}</button>`).join('') : ''; };
  return `<div class="sec-head"><div><span class="eyebrow">Direct messages encrypted end to end · team threads in the build</span><h1 style="font-size:34px;letter-spacing:-.6px">Messages</h1></div><span class="muted">${me().role === 'coach' ? 'Coaches see plans and status, never diagnoses' : 'Case threads link to the athlete record'}</span></div>
  <div class="msg-shell"><div class="msg-list"><label class="field" style="padding:4px 4px 10px">New encrypted direct message<select id="newdm"><option value="">Choose a person</option>${PEOPLE.filter(p => p.id !== S.me && !CHANNELS.find(x => x.kind === 'dm' && x.members.includes(p.id) && x.members.includes(S.me))).map(p => `<option value="${p.id}">${esc(p.full)}</option>`).join('')}</select></label>${group('channel', 'Channels')}${group('case', 'Case threads')}${group('dm', 'Direct')}</div>
  <div class="thread">${c ? `<div style="padding:16px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><h2 style="font-size:19px">${esc(c.name)} ${c.private ? lockIcon : ''} ${c.kind === 'dm' ? '<span class="chip c-health" style="vertical-align:3px;margin-left:6px">Encrypted end to end</span>' : ''}</h2><span class="muted" style="font-size:12.5px">${c.members.map(m => PEOPLE.find(p => p.id === m).name).join(', ')}${c.external ? ' + ' + c.external.map(esc).join(', ') + ' (read only)' : ''}</span></div>${a ? `<button class="btn sm" data-act="open" data-arg="${a.id}">Open record</button>` : ''}</div>
    <div class="thread-body" id="tb">${c.kind === 'dm' ? dmThread(c) : (MSGS[c.id] || []).map(m => { const p = PEOPLE.find(x => x.id === m[0]); return `<div class="bubble"><span class="av">${p.init}</span><div style="min-width:0"><div><b>${esc(p.name)}</b> <span class="muted" style="font-size:12px">${esc(m[1])}</span></div><div style="white-space:pre-line">${esc(m[2])}</div>${m[3] ? `<span class="chip plain c-health" style="margin-top:6px">${esc(m[3])}</span>` : ''}</div></div>`; }).join('')}</div>
    <form class="composer" id="composer"><label class="sr" for="msg-in">Message</label><input id="msg-in" placeholder="Write to ${esc(c.name)}" autocomplete="off"><button class="btn primary" type="submit">Send</button></form>` : '<p class="muted" style="padding:24px">No threads for this person.</p>'}</div>
  <div class="msg-ctx">${c && c.kind === 'dm' ? dmContext(c) : ''}${c && c.kind !== 'dm' ? `<span class="eyebrow">Thread security</span>` : ''}${c && c.kind !== 'dm' ? `<div class="facts"><div><span>Visibility</span><span>${c.private ? 'Private: members only' : 'Team members'}</span></div><div><span>Members</span><span>${c.members.length + (c.external ? c.external.length : 0)}</span></div><div><span>Retention</span><span>Follows the clinical record policy</span></div><div><span>Agent</span><span>Grok agent slot, connects in the build</span></div></div>` : ''}</div></div>`;
}

/* ---------- innovation ---------- */
function pageInnovation() {
  const sc = i => Math.round((i.impact * i.conf * i.ease) / 10);
  const list = IDEAS.slice().sort((a, b) => sc(b) - sc(a));
  return `<div class="sec-head"><div><span class="eyebrow">Pipeline · ICE score = impact × confidence × ease</span><h1 style="font-size:34px;letter-spacing:-.6px">Innovation</h1></div><span class="muted">Ideas move only when evidence supports them</span></div>
  ${popFilterBar('Show ideas for')}<div class="board" style="grid-template-columns:repeat(4,minmax(220px,1fr))">${ISTAGES.map(st => `<div class="col"><div class="sec-head"><b>${st}</b><span class="muted">${IDEAS.filter(i => i.stage === st && popMatch(IDEA_POPS[i.id])).length}</span></div>${IDEAS.filter(i => i.stage === st && popMatch(IDEA_POPS[i.id])).map(i => `<div class="card"><b>${esc(i.name)}</b>${popTags(IDEA_POPS[i.id] || ['sedentary', 'trained', 'competitive', 'elite'])}<span class="muted" style="font-size:12.5px">${esc(i.note)}</span><div style="display:flex;justify-content:space-between;align-items:center"><span class="chip plain c-accent">ICE ${sc(i)}</span><span class="muted" style="font-size:12px">${esc(i.owner)}</span></div>
    <div style="display:flex;gap:6px">${ISTAGES.indexOf(st) > 0 ? `<button class="btn sm" data-act="istage" data-arg="${i.id}:-1">Back</button>` : ''}${ISTAGES.indexOf(st) < 3 ? `<button class="btn sm" data-act="istage" data-arg="${i.id}:1">Advance</button>` : ''}</div></div>`).join('')}</div>`).join('')}</div>
  <section class="stack"><h2>Ranking</h2><div class="table-wrap"><table><thead><tr><th>Idea</th><th>Impact</th><th>Confidence</th><th>Ease</th><th>ICE</th><th>Value</th></tr></thead><tbody>${list.map(i => `<tr><td><b>${esc(i.name)}</b></td>${['impact', 'conf', 'ease'].map(k => `<td><input aria-label="${k} for ${esc(i.name)}" type="range" min="1" max="10" value="${i[k]}" data-ice="${i.id}:${k}" style="width:110px;accent-color:var(--accent)"> <b class="num">${i[k]}</b></td>`).join('')}<td><b class="num">${sc(i)}</b></td><td class="muted">${esc(i.value)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

/* ---------- trust ---------- */
function pageTrust() {
  const M = [['Readiness status and plan', '●', '●', '●', '●', '◐'], ['Training load and wearables', '●', '●', '●', '◐', '◐'], ['Diagnosis and treatment notes', '●', '●', '—', '—', '◐'], ['Private records (private mode on)', '●', 'List', 'List', '—', 'Own'], ['Staff workload and leave', '●', '—', '—', '●', '—'], ['Audit log', '●', '—', '—', '●', '—']];
  return `<div class="sec-head"><div><span class="eyebrow">Safe and secure</span><h1 style="font-size:34px;letter-spacing:-.6px">Trust and access</h1></div><span class="chip ${S.priv ? 'c-health' : 'c-muted'}">${lockIcon} Private mode ${S.priv ? 'on' : 'off'}</span></div>
  <div class="grid2"><section class="stack"><div class="panel"><h2>How private mode works</h2><p style="margin:0">With private mode on, records marked private are visible only to the people on their access list. Everyone else sees a locked placeholder and their attempt is logged. With it off, role rules still apply: coaches never see diagnoses and athletes see only their own data.</p>
    <div class="table-wrap"><table style="min-width:620px"><thead><tr><th>Data</th><th>Lead</th><th>Biokineticist</th><th>Coach</th><th>Manager</th><th>Athlete</th></tr></thead><tbody>${M.map(r => `<tr>${r.map((c, i) => `<td>${i ? `<b style="color:${c === '●' ? 'var(--ok)' : c === '—' ? 'var(--ink-3)' : 'var(--warn)'}">${c}</b>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="muted" style="margin:0;font-size:12.5px">● full · ◐ own or summary only · List: only if on the record's access list · — none</p></div>
    <div class="panel"><h3>Controls</h3><div class="rows">${[['Sign-in with two-factor, single sign-on', 'Build phase'], ['Server-side role checks on every request', 'In starter app'], ['Per-record access lists and private mode', 'In this prototype'], ['Every read and write logged', 'In this prototype'], ['Encryption at rest and in transit', 'Build phase'], ['Hosting in a UAE cloud region', 'Build phase'], ['ADHICS control mapping (Abu Dhabi DoH)', 'Before launch'], ['Malaffi exchange, if the lab is DoH-licensed', 'To confirm']].map(([t, s]) => `<div class="row"><span class="grow">${t}</span><span class="chip plain ${s.startsWith('In') ? 'c-ok' : s === 'To confirm' ? 'c-warn' : 'c-muted'}">${s}</span></div>`).join('')}</div></div></section>
  <aside class="panel"><div class="sec-head"><h3>Audit log, this session</h3><span class="muted num">${S.audit.length}</span></div><div class="rows" style="max-height:640px;overflow-y:auto">${S.audit.length ? S.audit.map(e => `<div class="row" style="font-size:13px;align-items:flex-start"><span class="mono muted">${e.at}</span><span class="grow"><b>${esc(e.who)}</b> · ${esc(e.action)}<br><span class="muted">${esc(e.target)}</span></span><span class="chip plain ${e.result === 'Denied' ? 'c-risk' : 'c-ok'}">${e.result}</span></div>`).join('') : '<div class="row muted">Nothing yet. Open a record or switch person.</div>'}</div></aside></div>`;
}

/* ===================== Player 1 daily cover · Load algorithms · Duty calendar ===================== */
const ISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const PD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const TODAY_ISO = ISO(TODAY);
const STAFF2 = [{ id: 'jp', name: 'JP', joined: '2025-03-01' }, { id: 'olivia', name: 'Olivia', joined: '2025-06-01' }];
const ACCRUAL = 2.5; // vacation days per month, PadelOps rule

let EVENTS = store.get('events', null) || [
  { id: 'e0', type: 'leave', who: ['jp'], from: '2026-07-06', to: '2026-07-24', note: 'Summer vacation' },
  { id: 'e00', type: 'leave', who: ['olivia'], from: '2026-08-03', to: '2026-08-21', note: 'Summer vacation' },
  { id: 'e1', type: 'leave', who: ['olivia'], from: '2026-10-05', to: '2026-10-06', note: 'Vacation' },
  { id: 'e2', type: 'trip', who: ['jp', 'olivia'], from: '2026-10-27', to: '2026-10-30', dest: '[Tournament city]', purpose: 'Travelling with Player 1, tournament', access: ['jp', 'olivia', 'ops'] },
  { id: 'e3', type: 'leave', who: ['olivia'], from: '2026-11-02', to: '2026-11-06', note: 'Vacation' },
  { id: 'e4', type: 'trip', who: ['jp'], from: '2026-11-12', to: '2026-11-15', dest: '[Conference city]', purpose: 'Conference, sports medicine', access: ['jp', 'ops'] },
  { id: 'e5', type: 'leave', who: ['jp'], from: '2026-11-23', to: '2026-11-26', note: 'Vacation' }
];
const DUTY_HOURS = { duty: 2.5, trip: 4 };
function baseDuty(d, who) {
  const dow = d.getDay(); // 0 Sun ... 6 Sat
  if (dow >= 1 && dow <= 5) return 'duty';
  // weekends: one person covers each day, alternating by week
  const wk = Math.floor((d - new Date(2026, 0, 4)) / (7 * 864e5));
  const satJP = wk % 2 === 0;
  if (dow === 6) return (who === 'jp') === satJP ? 'duty' : 'off';
  return (who === 'jp') === !satJP ? 'duty' : 'off';
}
function statusOn(iso, who) {
  for (const e of EVENTS) if (!e.status && e.who.includes(who) && iso >= e.from && iso <= e.to) return { s: e.type, e };
  return { s: baseDuty(PD(iso), who) };
}
const seesTrip = e => (e.access || []).includes(S.me);
const working = s => s === 'duty' || s === 'trip';

function staffLoad(who, year, month) {
  // PadelOps load score: 40% days worked, 35% recent density (14 days), 20% court hours, 5% protocols delivered
  const dim = new Date(year, month + 1, 0).getDate();
  const end = (year === TODAY.getFullYear() && month === TODAY.getMonth()) ? TODAY.getDate() : dim;
  const calc = id => {
    let dw = 0, hrs = 0, prot = 0;
    for (let d = 1; d <= dim; d++) { const st = statusOn(ISO(new Date(year, month, d)), id).s; if (working(st)) { dw++; hrs += DUTY_HOURS[st]; prot += st === 'duty' ? 1 : 0.5; } }
    let rd = 0; const ref = new Date(year, month, end);
    for (let k = 0; k < 14; k++) { const d = new Date(ref); d.setDate(d.getDate() - k); if (working(statusOn(ISO(d), id).s)) rd++; }
    return { dw, hrs, prot, rd };
  };
  const all = STAFF2.map(s => calc(s.id)), me_ = calc(who);
  const maxH = Math.max(...all.map(x => x.hrs), 1), maxP = Math.max(...all.map(x => x.prot), 1);
  const parts = { days: 40 * me_.dw / dim, density: 35 * me_.rd / 14, court: 20 * me_.hrs / maxH, protocol: 5 * me_.prot / maxP };
  const score = Math.round(parts.days + parts.density + parts.court + parts.protocol);
  const cat = score >= 85 ? 'Very high' : score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
  return { score, cat, parts, raw: me_, dim };
}
function balances(who) {
  const s = STAFF2.find(x => x.id === who), j = PD(s.joined);
  const months = (TODAY - j) / (30.44 * 864e5);
  const accrued = +(months * ACCRUAL).toFixed(1);
  let taken = 0;
  for (const e of EVENTS) if (e.type === 'leave' && !e.status && e.who.includes(who) && e.from <= TODAY_ISO) for (let d = PD(e.from); d <= PD(e.to) && ISO(d) <= TODAY_ISO; d.setDate(d.getDate() + 1)) if (d.getDay() >= 1 && d.getDay() <= 5) taken++;
  let booked = 0;
  for (const e of EVENTS) if (e.type === 'leave' && !e.status && e.who.includes(who) && e.to > TODAY_ISO) for (let d = PD(e.from); d <= PD(e.to); d.setDate(d.getDate() + 1)) if (ISO(d) > TODAY_ISO && d.getDay() >= 1 && d.getDay() <= 5) booked++;
  return { accrued, taken, booked, remaining: +(accrued - taken).toFixed(1) };
}
function coverChecks(year, month) {
  const out = [], dim = new Date(year, month + 1, 0).getDate();
  let soloRun = null;
  for (let d = 1; d <= dim + 1; d++) {
    const iso = ISO(new Date(year, month, d));
    const a = d <= dim ? statusOn(iso, 'jp').s : 'x', b = d <= dim ? statusOn(iso, 'olivia').s : 'x';
    const dow = new Date(year, month, d).getDay();
    const solo = d <= dim && dow >= 1 && dow <= 5 && (working(a) !== working(b));
    if (solo) { const who = working(a) ? 'JP' : 'Olivia'; if (!soloRun || soloRun.who !== who) { if (soloRun && soloRun.n >= 3) out.push(soloRun); soloRun = { who, from: d, n: 0 }; } soloRun.n++; soloRun.to = d; }
    else { if (soloRun && soloRun.n >= 3) out.push(soloRun); soloRun = null; }
    if (d <= dim && !working(a) && !working(b)) out.push({ none: true, d });
  }
  const mon = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'short' });
  return out.map(x => x.none ? { level: 'risk', text: `${x.d} ${mon}: nobody on duty for Player 1. Assign cover or confirm Player 1 is off.` } : { level: 'warn', text: `${x.from} to ${x.to} ${mon}: ${x.who} covers Player 1 alone for ${x.n} working days. Expect a higher load score; consider lighter court days.` });
}

/* ---------- Player 1 daily data ---------- */
const OBS_FLAGS = ['Late split step when fatigued', 'Landing on a stiff knee', 'Overhead arm path drops', 'Slow recovery between points', 'Grimace on push-off', 'Good movement quality'];
const SOFT_REGIONS = ['Right foot and arch', 'Right calf', 'Left calf', 'Hamstrings', 'Hip and glutes', 'Lower back', 'Thoracic spine', 'Shoulder', 'Forearm and elbow', 'Neck', 'Feet'];
const SOFT_TECH = ['Manual therapy', 'Massage', 'Soft tissue release', 'Instrument-assisted', 'Myofascial release', 'Trigger point', 'Massage, flush', 'Joint mobilisation', 'Stretching, assisted', 'Compression', 'Other'];
const PROTO_PARTS = [['Muscle stimulation', 'Compex on calf and lower leg', 'Pads over the calf; strong comfortable contractions that support the arch'], ['Red and near-infrared light', 'Over the inner ankle and foot', 'Comfort add-on through the session; it does not replace loading'], ['Active control', 'Intrinsic foot work', 'Short-foot holds and arch control, driven into each contraction']];
let DAILY = store.get('daily', null) || {
  [TODAY_ISO]: { court: { type: 'lowload', min: 22, rpe: 4 }, proto: { done: true, kind: 'Mechanic', note: 'Split step timing: land as the opponent strikes' }, obs: { flags: ['Late split step when fatigued'], note: 'Movement sharp for 60 min, slower after' }, soft: { regions: ['Right foot and arch'], tech: ['Soft tissue release', 'Compression'], min: 20, response: 'Better' }, sent: false }
};
let GROUP = { name: 'the team physician', recipients: [] };
const todayRec = () => (DAILY[TODAY_ISO] = DAILY[TODAY_ISO] || { court: { kind: 'Training', min: 0, rpe: 0 }, proto: { done: false, kind: 'Mechanic', note: '' }, obs: { flags: [], note: '' }, soft: { regions: [], tech: [], min: 0, response: 'Better' }, sent: false });
const P1 = () => ATH.find(a => a.id === 'p1');
function agentDraft() {
  const T = rtSync(), r = todayRec(), a = P1(), au = p1AU(r), st = RT_STW[T.s.st][0];
  const cover = STAFF2.filter(s => working(statusOn(TODAY_ISO, s.id).s)).map(s => s.name).join(' and ') || 'nobody';
  let next = T.s.st === 'RED' ? 'No high-impact padel tomorrow until reviewed.' : T.s.st === 'AMBER' ? 'Keep tomorrow at or below plan; no match play.' : 'Follow the plan colour for tomorrow.';
  { const rr = todayRec(), cy = T.p && rr.court.min > 0 ? p1Carry({ court: Object.assign({}, rr.court, { allowed: T.mins, guided: T.eb || T.p.band }) }) : null; if (cy) next = 'Auto-adjusted: ' + p1CarryText(cy); }
  return [
    `Player 1 · ${TODAY.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · covered by ${cover}`,
    `Status: ${st}${T.s.trig.length ? ' (' + T.s.trig.join('; ') + ')' : ''}. Plan: ${T.p ? RT.BAND[T.eb || T.p.band].label.toLowerCase() + ', ' + T.mins + ' min' + (T.mins !== T.p.min ? ' (cut from ' + T.p.min + ')' : '') : 'none'}`,
    `Warm-up routine: ${r.court.warm ? 'done' + (r.court.wgrade ? ', ' + r.court.wgrade.toLowerCase() : '') : 'not logged'}`,
    `Court: ${RT.TLABEL[p1Type(r)]}${r.court.band ? ', his call: ' + r.court.band + ' effort' : ''}, ${r.court.min} min played (plan ${T.mins} min) · felt ${r.court.feel ? r.court.feel + '/10' : 'not logged'} · ${r.court.inc ? 'incident: ' + (r.court.incNote || 'see notes') : 'no incident'}. Acute to chronic ${a.acwr.toFixed(2)}.`,
    `Court observation: ${[...r.obs.flags, r.obs.note].filter(Boolean).join('; ') || 'nothing logged'}`,
    `Other training: ${r.other && r.other.type ? r.other.type + (r.other.min ? ', ' + r.other.min + ' min' : '') + (r.other.note ? ' · ' + r.other.note : '') : 'none logged'}`,
    `7-minute protocol: ${r.proto.done ? (r.proto.type || r.proto.kind) + ', ' + (r.proto.note || 'no note') : 'not done'}`,
    `Soft tissue: ${r.soft.regions.length ? r.soft.regions.join(', ') + ' · ' + r.soft.tech.join(', ') + ' · ' + r.soft.min + ' min · ' + r.soft.response : 'not needed today'}`,
    `Tomorrow: ${next}`
  ];
}
// private group thread
if (!CHANNELS.find(c => c.id === 'p1-daily')) CHANNELS.splice(2, 0, { id: 'p1-daily', name: 'Player 1 · daily update to the physician', members: ['jp', 'olivia', 'dr'], private: true, kind: 'case', ath: 'p1' });
MSGS['p1-daily'] = MSGS['p1-daily'] || [['olivia', 'Yesterday', 'Player 1 · Tue 20 Oct · covered by JP and Olivia\nStatus: Modify\nCourt: Technical movement, 34 min at RPE 6 = 204 AU\nSoft tissue: Right foot and arch, 25 min, better', 'Daily update']];

/* ---------- pages ---------- */
const PROTO = { t: 420, running: false, timer: null };
function pagePlayer1() {
  if (me().role === 'athlete') return pageReturn();
  { const g = p1Gate(); if (g) return g; }
  const T = rtSync(), r = todayRec(), a = P1(), au = p1AU(r), p = T.p;
  if (!p) return `<section class="hero"><div class="stack"><span class="eyebrow">Player 1</span><span class="big">No active plan today</span></div></section>`;
  const cov = STAFF2.map(s => ({ s, st: statusOn(TODAY_ISO, s.id).s }));
  const pill = (act, val, on) => `<button type="button" class="pill" data-act="${act}" data-arg="${esc(val)}" aria-pressed="${on}">${esc(val)}</button>`;
  const step = (n, title, done, body) => `<section class="panel cov-step" id="cov-${n}" data-step="${n}" data-title="${esc(title.split(':')[0].split('·')[0].trim())}" data-done="${done ? 1 : 0}" style="gap:16px"><div class="sec-head"><div style="display:flex;gap:14px;align-items:center"><span class="av" style="background:${done ? 'var(--ok-soft)' : 'var(--sunk)'};color:${done ? 'var(--ok)' : 'var(--ink-2)'}">${done ? '✓' : n}</span><h2 style="font-size:19px">${title}</h2></div>${done ? '<span class="chip c-ok">Done</span>' : '<span class="chip c-muted">Open</span>'}</div>${body}</section>`;
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const planAU = T.mins; /* load is time only, so the plan is in minutes */
  if (r.court.min > 0 && T.p) { r.court.allowed = T.mins; r.court.guided = T.eb || T.p.band; }
  const vs = au === 0 ? ['Not logged', 'c-muted'] : au > planAU * 1.1 ? ['Above plan', 'c-warn'] : au < planAU * 0.9 ? ['Below plan', 'c-load'] : ['In plan', 'c-ok'];
  const rb = RT.band(a.acwr);
  const duty = `<span class="muted" style="font-size:14px">On duty: ${cov.map(c => `<b style="color:var(--ink)">${c.s.name}</b> ${c.st === 'duty' ? 'on duty' : c.st === 'trip' ? 'away, official' : c.st}`).join(' · ')}</span>`;
  const dash = p1Dash(T, cov, au, planAU);
  if (!perm().clinical) return p1Hero(T, '') + `<div>${p1Tabs('player1')}</div>` + dash + rtRibbon(T.idx) + `<section class="panel"><h3>For the coach</h3><p style="margin:0">Today's colour, minutes and stop rule are above. Clinical notes, symptoms and treatment stay with JP and Olivia.</p></section>`;
  return p1Command(T, au, planAU) + p1Wins(T, r) + p1Brief() + (typeof p1LearnStrip === 'function' ? p1LearnStrip() : '') + p1GuideScale(T, r) + p1Forecast(T, r) + p1Switchboard() + `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">${p1Tabs('player1')}</div>${dash}<div class="sec-head" style="margin-top:4px"><div><span class="eyebrow">Today's log</span><h2>Daily cover</h2></div></div><nav class="hxs-rail" aria-label="Daily cover steps"></nav>
  <div class="grid2"><div class="stack" style="gap:16px">
    ${step(1, 'Morning check-in', RS.at === TODAY_ISO, p1CheckIn(T))}
    ${step(2, 'Warm-up routine', !!r.court.warm, `<div class="grid3" style="gap:14px;align-items:end"><div class="ftc-wrap"><input id="ftc-warm" type="checkbox" data-dy="court.warm" ${r.court.warm ? 'checked' : ''}><label for="ftc-warm">Warm-up routine done</label></div>
        <label class="field">Quality<select data-dy="court.wgrade" ${r.court.warm ? '' : 'disabled'}>${['', 'Excellent', 'Average', 'Poor'].map(g => `<option value="${g}" ${(r.court.wgrade || '') === g ? 'selected' : ''}>${g || 'Choose'}</option>`).join('')}</select></label>
        <button class="btn sm" type="button" data-rp="open" data-r="warmup" data-i="0">Open the warm-up routine</button></div>`)}
    ${step(3, 'Time on court', r.court.min > 0, `<div class="grid3" style="gap:14px"><label class="field">Session type<select data-dy="court.type">${RT.TYPES.map(t => `<option value="${t[0]}" ${p1Type(r) === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label>
      <label class="field">Minutes played<input type="number" min="0" max="300" value="${r.court.min}" data-dy="court.min"></label><label class="field">How he felt (1 to 10)<input type="number" min="1" max="10" value="${r.court.feel || ''}" data-dy="court.feel"></label></div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><span class="serif num" style="font-size:44px;line-height:1">${au}</span><span class="muted">min played · plan ${T.mins} min today<br>Load is time on court for now · ratio ${a.acwr.toFixed(2)} · <a href="#loadlab">threshold guard</a></span>
      <span class="chip ${vs[1]}" style="margin-left:auto">${vs[0]}</span></div>
      ${p1Choice(T, r)}
      <label class="field">Session RPE, recorded for later (0 to 10)<input type="number" min="0" max="10" value="${r.court.rpe}" data-dy="court.rpe"></label>
      <label class="layer"><input type="checkbox" data-dy="court.inc" ${r.court.inc ? 'checked' : ''}> Incident during the session</label>${r.court.inc ? `<label class="field">What happened<input value="${esc(r.court.incNote || '')}" data-dy="court.incNote" placeholder="Mechanism, time in session, action taken"></label>` : ''}`)}
    ${step(4, 'Court observation', r.obs.flags.length > 0 || !!r.obs.note, `<div class="pills">${OBS_FLAGS.map(f => pill('dy-obs', f, r.obs.flags.includes(f))).join('')}</div><label class="field">Notes<input value="${esc(r.obs.note)}" data-dy="obs.note" placeholder="What you saw, and when in the session"></label>`)}
    ${step(5, 'Other training today', !!(r.other && r.other.type), `<div class="grid3" style="gap:14px"><label class="field">What<select data-dy="other.type">${['', 'Gym, strength', 'Rehab strength', 'Bike', 'Pool', 'Running', 'Mobility, yoga', 'Other'].map(o => `<option value="${o}" ${(r.other && r.other.type || '') === o ? 'selected' : ''}>${o || 'None'}</option>`).join('')}</select></label><label class="field">Minutes<input type="number" min="0" max="300" value="${(r.other && r.other.min) || 0}" data-dy="other.min"></label><label class="field">Notes<input value="${esc((r.other && r.other.note) || '')}" data-dy="other.note" placeholder="Main lifts, intensity, anything to flag"></label></div>
      <span class="muted" style="font-size:12.5px">Logged next to court time so the team sees his whole day. Heart rate and strain from Whoop, Garmin, Polar or Suunto join here later.</span>`)}
    ${step(6, 'Soft tissue: manual therapy, massage or other', r.soft.regions.length > 0, `<div class="field">Region<div class="pills">${SOFT_REGIONS.map(f => pill('dy-reg', f, r.soft.regions.includes(f))).join('')}</div></div><div class="field">Technique<div class="pills">${SOFT_TECH.map(f => pill('dy-tech', f, r.soft.tech.includes(f))).join('')}</div></div>
      <div class="grid3" style="gap:14px"><label class="field">Minutes<input type="number" min="0" max="120" value="${r.soft.min}" data-dy="soft.min"></label><label class="field">Response<select data-dy="soft.response">${['Better', 'Same', 'Worse'].map(k => `<option ${r.soft.response === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <div style="display:flex;align-items:flex-end"><button class="btn sm" data-act="focus" data-arg="spring_ligament_R">Show in 3D</button></div></div>`)}
    ${step(7, '7-minute protocol · one focused dose', r.proto.done, `<p class="nr-note">Why it exists: 7 minutes is enough focused work to start a response. Pick one aim for today: a modality (for example red light), neuromuscular stimulation for a potentiation effect in the muscle, teaching a mechanical loading technique or principle, or something else. Short enough to do every day and before play, without tiring him.</p>
      <div class="field">Today's aim<div class="pills">${['Modality', 'Neuromuscular stimulation', 'Loading technique', 'Loading principle', 'Other'].map(t => pill('dy-proto-type', t, (r.proto.type || '') === t)).join('')}</div></div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><span class="serif num" id="proto-clock" style="font-size:56px;line-height:1">${mmss(PROTO.t)}</span>
      <div style="display:flex;gap:8px"><button class="btn primary sm" data-act="proto-go">${PROTO.running ? 'Pause' : 'Start 7:00'}</button><button class="btn sm" data-act="proto-reset">Reset</button></div></div>
      <span class="eyebrow" style="margin-top:4px">Worked example · spring ligament: three aims running together</span>
      <div class="rows">${PROTO_PARTS.map(s => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${s[0]}</b> · <span class="muted">${s[1]}</span><br><span style="font-size:12.5px">${s[2]}</span><span class="bar-track" style="display:block;margin-top:6px"><span class="bar-fill proto-bar" style="display:block;width:${Math.round((420 - PROTO.t) / 4.2)}%;background:var(--accent)"></span></span></span></div>`).join('')}</div>
      <span class="muted" style="font-size:12.5px">In this example all three ran together for the full 7 minutes; the active part made it count, with him pushing into each stimulated contraction and controlling the arch.</span>
      <details class="howload"><summary><b>Why 7 minutes, and the example's weekly rhythm</b><span class="muted">From his spring ligament plan</span></summary><div class="rows" style="font-size:13px">
        <div class="row"><span class="grow"><b>Long enough</b> for the stimulation to work the supporting muscles and for the light to give a useful dose.</span></div>
        <div class="row"><span class="grow"><b>Short enough</b> to prime the foot without tiring it, so it can go before training or play.</span></div>
        <div class="row"><span class="grow"><b>Easy to stick to:</b> a short daily habit gets done; a long one gets skipped. More is not better.</span></div>
        <div class="row"><span class="grow"><b>Week:</b> 7-minute protocol 3 times (weights days), 7-minute rehab strengthening 2 times (foot and lower leg, separate from gym weights), hands-on therapy 3 times, Game Ready 2 times (15 to 20 min), 1 active rest day.</span></div></div></details>
      <div class="field">If teaching: focus<div class="pills">${pill('dy-proto-kind', 'Mechanic', r.proto.kind === 'Mechanic')}${pill('dy-proto-kind', 'Principle', r.proto.kind === 'Principle')}</div></div>
      <label class="field">What was done<input value="${esc(r.proto.note)}" data-dy="proto.note" placeholder="What was done or taught, in one line"></label>
      <div class="ftc-wrap"><input id="ftc-proto" type="checkbox" data-dy="proto.done" ${r.proto.done ? 'checked' : ''}><label for="ftc-proto">Protocol delivered today</label></div>`)}
  </div>
  <aside class="stack" style="gap:16px">
    <div class="ink-panel"><div class="sec-head"><span class="eyebrow" style="color:inherit;opacity:.75">Agent · daily update draft</span><span class="chip plain" style="background:rgba(127,127,127,.25);color:inherit">${r.sent ? 'Sent' : 'Draft'}</span></div>
      <div style="font-size:14px;line-height:1.6;display:flex;flex-direction:column;gap:6px" id="draft">${agentDraft().map((l, i) => `<div style="${i === 0 ? 'font-weight:800' : ''}">${esc(l)}</div>`).join('')}</div>
      <span class="muted" style="font-size:12px">Drafted from today's entries by fixed rules. In the build, the Grok agent writes this and can answer questions about the week.</span>
      <button class="btn accent spg-button" data-state="auto" data-act="send-group" ${r.sent ? 'disabled' : ''}>${r.sent ? 'Sent to the physician' : 'Send to the physician'}</button><button class="btn sm" data-act="show-p1" style="background:transparent;color:inherit;border-color:rgba(127,127,127,.4)">Show Player 1 a short summary</button></div>
    <div class="panel"><div class="sec-head"><h3>${lockIcon} Daily update to the physician</h3><span class="chip c-health">Clinical only</span></div>
      <div class="rows"><div class="row"><span class="av">JP</span><span class="grow">JP · writes</span></div><div class="row"><span class="av">OL</span><span class="grow">Olivia · writes</span></div><div class="row"><span class="av">DR</span><span class="grow">Team physician · receives</span><span class="chip plain c-muted">Reads</span></div></div>
      <span class="muted" style="font-size:12.5px">Our clinical update goes to the physician only. Player 1 and the coaches never receive it.</span></div>
    <div class="panel"><div class="sec-head"><h3>Load ratio</h3><a href="#loadlab" class="muted" style="font-size:12.5px">Load</a></div><div style="display:flex;align-items:baseline;gap:12px"><span class="serif num" style="font-size:44px;line-height:1">${a.acwr.toFixed(2)}</span><span>${rb ? esc(rb[1]) : ''}</span></div>
      <span class="muted" style="font-size:12.5px">${rb ? esc(rb[2]) + ' ' : ''}A trend flag, never a clearance rule.</span>${spark(a.loads.slice(-14), 280, 40, 'var(--load)')}<div class="legend"><span>Court minutes, last 14 days</span></div></div>
  </aside></div>`;
}

function pageLoadLab() {
  { const g = p1Gate(); if (g) return g; }
  const a = P1(), n = (rtSync(), a.loads.length);
  const L = a.loads, last7 = L.slice(-8, -1), mean = last7.reduce((x, y) => x + y, 0) / 7;
  const sd = Math.sqrt(last7.reduce((x, y) => x + (y - mean) ** 2, 0) / 7);
  const r = todayRec(), au = p1AU(r), rb = RT.band(a.acwr);
  const lamA = 2 / (7 + 1), lamC = 2 / (28 + 1);
  const algo = (title, formula, live, src, note) => `<section class="panel"><div class="sec-head"><h2 style="font-size:18px">${title}</h2><span class="chip plain c-muted">${src}</span></div>
    <div class="mono" style="font-size:15px;background:var(--surface-2);border-radius:12px;padding:14px 16px;overflow-x:auto">${formula}</div><div style="display:flex;gap:16px;align-items:baseline;flex-wrap:wrap"><span class="serif num" style="font-size:40px;line-height:1">${live}</span><span class="muted" style="font-size:13.5px;max-width:52ch">${note}</span></div></section>`;
  const T = rtSync();
  return p1Head('loadlab', 'Load', 'on-court load') + p1Guard(T) + p1GuideScale(T, todayRec()) + p1Forecast(T, todayRec()) + loadGauge(a, au, mean / (sd || 1)) + `
  <section class="panel"><div class="sec-head"><h2>Session load, last 42 days</h2><span class="chip c-load">Player 1</span></div>${loadChart(a)}</section>
  ${p1SessionLog(T)}
  <details class="howload"><summary><b>How load is measured</b><span class="muted">Formulas, sources and multipliers</span></summary><p class="nr-note">Evidence check: the acute:chronic ratio is a monitoring aid, not a validated injury predictor; its maths and the injury link have been criticised (<a href="${SRC.impel.url}" target="_blank" rel="noopener">Impellizzeri et al. 2020, IJSPP</a>). The guard uses it alongside minutes caps, symptoms and next-morning pain, never on its own (<a href="${SRC.bourdon.url}" target="_blank" rel="noopener">Bourdon et al. 2017 consensus</a>).</p>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    ${algo('1 · Session load', 'load = minutes on court (time only, for now)', `${au} min`, 'Time on court', `Today: ${r.court.min} min. Effort, heart rate and strain from Whoop, Garmin, Polar or Suunto join the calculation later; RPE is recorded but not yet used. ${'' && RT.MULT[p1Type(r)].toFixed(2)} (${RT.TLABEL[p1Type(r)].toLowerCase()}). With a multiplier of 1 this is Foster's session RPE. RPE is asked 30 minutes after the session.`)}
    ${algo('2 · Acute load (EWMA, 7 days)', `acute<sub>t</sub> = λ·load<sub>t</sub> + (1 − λ)·acute<sub>t−1</sub>, λ = 2/(7+1) = ${lamA.toFixed(3)}`, Math.round(a.acute[n - 1]) + ' min', 'Williams 2017', 'Recent days weigh more than older ones, unlike a rolling 7-day sum.')}
    ${algo('3 · Chronic load (EWMA, 28 days)', `chronic<sub>t</sub> = λ·load<sub>t</sub> + (1 − λ)·chronic<sub>t−1</sub>, λ = 2/(28+1) = ${lamC.toFixed(3)}`, Math.round(a.chronic[n - 1]) + ' min', 'Williams 2017', 'What the player is prepared for.')}
    ${algo('4 · Acute to chronic ratio', 'ratio = acute ÷ chronic', a.acwr.toFixed(2), 'Gabbett 2016', `${rb ? rb[1] + '. ' + rb[2] : ''} Bands: under 0.80 de-load, 0.80 to 1.10 stable, 1.10 to 1.25 moderate rise, above 1.25 large rise. A graded return rises on purpose, so read this against the plan, never as an injury prediction (Impellizzeri 2020).`)}
    ${algo('5 · Monotony', 'monotony = mean(daily load, 7 d) ÷ SD(daily load, 7 d)', (mean / (sd || 1)).toFixed(2), 'Foster 1998', 'High values mean every day looks the same. Above about 2 is a common caution point.')}
    ${algo('6 · Strain', 'strain = weekly load × monotony', Math.round(mean * 7 * mean / (sd || 1)).toLocaleString(), 'Foster 1998', 'Combines how much and how unvaried the week was.')}
  </div>
  <div class="grid2"><section class="panel"><h2>Mechanical multiplier by session type</h2><div class="rows">${RT.TYPES.map(t => `<div class="row" style="font-size:13.5px;min-height:40px"><span class="grow"><b>${t[1]}</b><br><span class="muted" style="font-size:12.5px">${t[2]}</span></span><span class="mult-bar"><i style="width:${t[3] / 1.5 * 100}%"></i></span><b class="num">× ${t[3].toFixed(2)}</b></div>`).join('')}</div></section>
  <section class="panel"><h2>Daily decision rules</h2><p class="muted" style="margin:0">Hard stops first, then the score. Any one of these makes the day Hold: pain at rest or during play 4/10 or more, new limp, instability, moderate swelling, foot symptom score 10 or more. Modify: foot score 6 to 9, next-morning pain 3 or more, or any wellness flag (HRV, sleep, soreness). Otherwise Ready. Modify cuts court minutes by 25%; wellness flags take a further 15%.</p>
    <div class="facts"><div><span>Source</span><span>Threshold engine (Emergent build), wellness rules from the Player 1 daily cover</span></div></div></section></div></details>`;
}

const CALV = { y: 2026, m: 9 };
function pageCalendar() {
  const { y, m } = CALV, first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7; // Monday first
  const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const lane = (iso, who) => {
    const { s, e } = statusOn(iso, who);
    const name = who === 'jp' ? 'JP' : 'Olivia';
    const map = { duty: ['c-ok', 'On duty'], off: ['c-muted', 'Off'], leave: ['c-load', 'Leave'], trip: ['c-health', e && seesTrip(e) ? 'Trip · ' + e.dest.replace(/[\[\]]/g, '') : 'Away, official'], sick: ['c-warn', 'Sick'] };
    const [c, t] = map[s];
    return `<span class="chip plain ${c}" style="font-size:10.5px;padding:2px 6px;justify-content:flex-start;overflow:hidden;text-overflow:ellipsis;max-width:100%" title="${name}: ${esc(t)}"><b style="margin-right:4px">${name === 'JP' ? 'JP' : 'OL'}</b>${esc(t)}</span>`;
  };
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<div></div>';
  for (let d = 1; d <= dim; d++) {
    const iso = ISO(new Date(y, m, d)), today = iso === TODAY_ISO, wkend = [0, 6].includes(new Date(y, m, d).getDay());
    cells += `<div style="min-height:96px;border:1px solid ${today ? 'var(--ink)' : 'var(--line)'};border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;background:${wkend ? 'var(--surface-2)' : 'var(--surface)'};min-width:0"><b class="num" style="font-size:13px">${d}${today ? ' · today' : ''}</b>${UAE_HOL[iso] ? `<span class="muted" style="font-size:10.5px;line-height:1.2">${esc(UAE_HOL[iso])}</span>` : ''}${lane(iso, 'jp')}${lane(iso, 'olivia')}</div>`;
  }
  const loads = STAFF2.map(s => ({ s, l: staffLoad(s.id, y, m), b: balances(s.id) }));
  const checks = coverChecks(y, m);
  const myEvents = EVENTS.filter(e => e.to >= TODAY_ISO).sort((a, b) => a.from.localeCompare(b.from));
  return `<div class="sec-head"><div><span class="eyebrow">Player 1 · who covers him · JP, Olivia and the physician · duty, leave and official trips</span><h1 style="font-size:34px;letter-spacing:-.6px">Duty calendar</h1></div>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn sm" data-act="cal" data-arg="-1" aria-label="Previous month">‹</button><b style="min-width:140px;text-align:center">${label}</b><button class="btn sm" data-act="cal" data-arg="1" aria-label="Next month">›</button></div></div>
  <section class="stack"><div style="overflow-x:auto"><div style="display:grid;grid-template-columns:repeat(7,minmax(118px,1fr));gap:6px;min-width:860px">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div style="padding:0 4px 4px;font-size:11px;font-weight:800;color:var(--ink-2);letter-spacing:1px;text-transform:uppercase">${d}</div>`).join('')}${cells}</div></div>
    <div class="legend"><span><i style="background:var(--ok)"></i>On duty</span><span><i style="background:var(--load)"></i>Leave</span><span><i style="background:var(--health)"></i>Official trip (details only for its access list)</span><span><i style="background:var(--ink-3)"></i>Off</span><span>Weekends alternate: one person covers Player 1 for the whole weekend.</span></div>
  </section>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
    ${loads.map(({ s, l, b }) => `<div class="panel"><div class="sec-head"><div style="display:flex;gap:12px;align-items:center"><span class="av">${s.id === 'jp' ? 'JP' : 'OL'}</span><h3>${s.name}</h3></div><span class="chip ${l.score >= 85 ? 'c-risk' : l.score >= 70 ? 'c-warn' : 'c-ok'}">${l.cat}</span></div>
      <div style="display:flex;align-items:baseline;gap:10px"><span class="serif num" style="font-size:48px;line-height:1">${l.score}</span><span class="muted">load score · ${l.raw.dw} working days · ${l.raw.hrs} court h</span></div>
      <div style="display:flex;height:10px;border-radius:9px;overflow:hidden;background:var(--sunk)"><span style="width:${l.parts.days}%;background:var(--accent)"></span><span style="width:${l.parts.density}%;background:var(--load)"></span><span style="width:${l.parts.court}%;background:var(--warn)"></span><span style="width:${l.parts.protocol}%;background:var(--health)"></span></div>
      <div class="legend" style="font-size:11.5px"><span><i style="background:var(--accent)"></i>Days ${l.parts.days.toFixed(0)}</span><span><i style="background:var(--load)"></i>Density ${l.parts.density.toFixed(0)}</span><span><i style="background:var(--warn)"></i>Court ${l.parts.court.toFixed(0)}</span><span><i style="background:var(--health)"></i>Protocol ${l.parts.protocol.toFixed(0)}</span></div>
      ${['jp', 'olivia', 'ops'].includes(S.me) ? `<div class="facts"><div><span>Leave left</span><span><b>${b.remaining}</b> days (accrued ${b.accrued}, taken ${b.taken})</span></div><div><span>Booked</span><span>${b.booked} working days ahead</span></div></div>` : locked('Leave balances are visible to JP, Olivia and operations.')}</div>`).join('')}
    <div class="ink-panel"><span class="eyebrow" style="color:inherit;opacity:.75">Agent · cover check, ${label}</span>${checks.length ? checks.map(c => `<div style="display:flex;gap:10px;font-size:14px"><span style="flex:none;width:8px;height:8px;border-radius:50%;margin-top:7px;background:${c.level === 'risk' ? 'var(--risk)' : 'var(--warn)'}"></span><span>${esc(c.text)}</span></div>`).join('') : '<span>No cover gaps this month.</span>'}<span class="muted" style="font-size:12px">Rule-based today; the Grok agent takes this over in the build and proposes swaps.</span></div>
  </div>
  <section class="panel"><h2>How the staff load score works</h2><div class="mono" style="font-size:14px;background:var(--surface-2);border-radius:12px;padding:14px 16px;overflow-x:auto">score = 40 × days worked ÷ days in month + 35 × working days in last 14 ÷ 14 + 20 × court hours ÷ team max + 5 × protocols ÷ team max</div><span class="muted" style="font-size:13.5px">Same formula as the padel coaches. Bands: under 40 low, 40 to 69 moderate, 70 to 84 high, 85 or more very high. Official trips count as working days with 4 court hours.</span></section>
  <div class="grid2"><section class="panel"><h2>Add leave or an official trip</h2>${perm().editAccess || ['physio', 'biokineticist'].includes(me().role) ? `<form id="evform" class="stack"><div class="grid3" style="gap:14px">
      <label class="field">Type<select id="ev-type"><option value="leave">Leave</option><option value="sick">Sick day</option><option value="trip">Official trip</option></select></label>
      <label class="field">From<input id="ev-from" type="date" value="2026-12-07"></label><label class="field">To<input id="ev-to" type="date" value="2026-12-10"></label></div>
      <div class="field">Who<div class="pills"><button type="button" class="pill" data-act="evwho" data-arg="jp" aria-pressed="true">JP</button><button type="button" class="pill" data-act="evwho" data-arg="olivia" aria-pressed="false">Olivia</button></div></div>
      <label class="field">Destination and purpose (trips only, restricted)<input id="ev-dest" placeholder="Visible only to the people ticked below"></label>
      <div class="field">Trip details visible to<div class="pills">${PEOPLE.filter(p => p.role !== 'athlete').map(p => `<button type="button" class="pill" data-act="evacc" data-arg="${p.id}" aria-pressed="${['jp', 'olivia', 'ops'].includes(p.id)}">${esc(p.name)}</button>`).join('')}</div></div>
      <div><button class="btn primary" type="submit">Add to calendar</button></div></form>` : locked('Only JP and Olivia add leave and trips.')}</section>
    <aside class="panel"><h3>Upcoming</h3><div class="rows">${myEvents.map(e => `<div class="row" style="font-size:13.5px"><span class="chip plain ${e.type === 'trip' ? 'c-health' : 'c-load'}">${e.type === 'trip' ? 'Trip' : 'Leave'}</span><span class="grow"><b>${e.who.map(w => w === 'jp' ? 'JP' : 'Olivia').join(' and ')}</b> · ${PD(e.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${PD(e.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}<br><span class="muted">${e.type === 'trip' ? (seesTrip(e) ? esc(e.purpose + ' · ' + e.dest) : lockIcon + ' Details restricted') : esc(e.note || '')}</span></span></div>`).join('')}</div></aside></div>`;
}

/* ===================== End-to-end encrypted direct messages =====================
   Each person has an ECDH P-256 key pair. A conversation key is derived from one
   person's private key and the other's public key (ECDH), then every message is
   sealed with AES-256-GCM and a fresh 96-bit IV. Only ciphertext is stored.
   Prototype note: all key pairs live in this one browser so the demo can switch
   people; in the build each private key is created on, and never leaves, its
   owner's device, and the Signal double ratchet adds forward secrecy.           */
const CRY = { keys: {}, plain: {}, store: {}, ready: false, showRaw: false, verified: {}, ttl: {}, guard: true };
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const dmOther = c => c.members.find(m => m !== S.me);
async function cryKey(a, b) {
  return crypto.subtle.deriveKey({ name: 'ECDH', public: CRY.keys[b].publicKey }, CRY.keys[a].privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function crySeal(chan, from, text, at) {
  const c = CHANNELS.find(x => x.id === chan), to = c.members.find(m => m !== from);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryKey(from, to), new TextEncoder().encode(text));
  const ttl = CRY.ttl[chan] || 0;
  (CRY.store[chan] = CRY.store[chan] || []).push({ from, at, iv: b64(iv), ct: b64(ct), exp: ttl ? Date.now() + ttl * 3600e3 : 0 });
}
async function cryOpen(chan) {
  const c = CHANNELS.find(x => x.id === chan);
  if (!c || !c.members.includes(S.me)) { CRY.plain[chan] = null; return; }
  const k = await cryKey(S.me, dmOther(c)), out = [];
  CRY.store[chan] = (CRY.store[chan] || []).filter(m => !m.exp || m.exp > Date.now());
  for (const m of CRY.store[chan]) {
    try { out.push(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, k, unb64(m.ct)))); }
    catch (e) { out.push(null); }
  }
  CRY.plain[chan] = { who: S.me, list: out };
}
async function crySafety(a, b) {
  const [x, y] = [a, b].sort();
  const pa = new Uint8Array(await crypto.subtle.exportKey('raw', CRY.keys[x].publicKey)), pb = new Uint8Array(await crypto.subtle.exportKey('raw', CRY.keys[y].publicKey));
  const all = new Uint8Array(pa.length + pb.length); all.set(pa); all.set(pb, pa.length);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
  let s = ''; for (let i = 0; i < 30; i++) s += String(h[i] % 100).padStart(2, '0');
  return s.match(/.{5}/g).join(' ');
}
async function cryInit() {
  if (!(window.crypto && crypto.subtle)) return;
  for (const p of PEOPLE) CRY.keys[p.id] = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  if (!CHANNELS.find(c => c.id === 'dm-jp-olivia')) CHANNELS.push({ id: 'dm-jp-olivia', name: 'JP and Olivia', members: ['jp', 'olivia'], private: true, kind: 'dm' });
  const seed = { 'dm-jp-olivia': [['olivia', '07:12', 'Can you take Player 1\'s 13:00 foot session? I am with Omar at 13:00.'], ['jp', '07:15', 'Yes. I will send you the soft tissue notes after.'], ['olivia', '07:16', 'Thanks. Keep this between us until the rota is final.']],
    'dm-p1': (MSGS['dm-p1'] || []).map(m => m.slice(0, 3)) };
  delete MSGS['dm-p1'];
  for (const [chan, list] of Object.entries(seed)) for (const [f, at, t] of list) await crySeal(chan, f, t, at);
  CRY.ready = true;
}
function dmThread(c) {
  const p = CRY.plain[c.id], store_ = CRY.store[c.id] || [];
  if (!CRY.ready) return '<p class="muted">Setting up encryption keys…</p>';
  if (!p || p.who !== S.me) { cryOpen(c.id).then(() => { if (S.route === 'messages' && S.ch === c.id) render(); }); return '<p class="muted">Decrypting on this device…</p>'; }
  const left = m => { if (!m.exp) return ''; const h = Math.max(0, Math.round((m.exp - Date.now()) / 3600e3)); return ` · disappears in ${h} h`; };
  return `<div class="banner" style="font-weight:600">${lockIcon} Encrypted end to end. Only ${esc(PEOPLE.find(x => x.id === c.members[0]).name)} and ${esc(PEOPLE.find(x => x.id === c.members[1]).name)} hold the keys. The server, admins and the Grok agent cannot read it.</div>` +
    store_.map((m, i) => { const who = PEOPLE.find(x => x.id === m.from); return `<div class="bubble"><span class="av">${who.init}</span><div style="min-width:0"><div><b>${esc(who.name)}</b> <span class="muted" style="font-size:12px">${esc(m.at)}${left(m)}</span></div>
      ${CRY.showRaw ? `<div class="mono" style="word-break:break-all;color:var(--ink-2)">iv ${m.iv}<br>${m.ct}</div>` : `<div class="dm-text" style="white-space:pre-line">${p.list[i] == null ? '<i>Could not decrypt</i>' : esc(p.list[i])}</div>`}</div></div>`; }).join('');
}
function dmContext(c) {
  const other = dmOther(c), key = [...c.members].sort().join('-');
  if (CRY.ready && !CRY.safety) CRY.safety = {};
  if (CRY.ready && !CRY.safety[key]) { CRY.safety[key] = '…'; crySafety(c.members[0], c.members[1]).then(s => { CRY.safety[key] = s; if (S.route === 'messages' && S.ch === c.id) render(); }); }
  const v = CRY.verified[key];
  return `<span class="eyebrow">Encryption</span><div class="facts">
    <div><span>Method</span><span>ECDH P-256 key agreement, AES-256-GCM per message, fresh 96-bit IV</span></div>
    <div><span>Keys</span><span>Held by the two people only</span></div>
    <div><span>Agent</span><span><span class="chip plain c-risk">Blocked</span></span></div>
    <div><span>Search</span><span>Excluded; content is never indexed</span></div>
    <div><span>Audit log</span><span>Records that a message was sent, never its content</span></div></div>
  <span class="eyebrow">Safety number</span><div class="mono" style="font-size:14px;line-height:1.9;letter-spacing:.5px">${esc((CRY.safety && CRY.safety[key]) || '…')}</div>
  <span class="muted" style="font-size:12.5px">Compare in person with ${esc(PEOPLE.find(x => x.id === other).name)}. If the numbers match, nobody is in the middle.</span>
  <button class="btn sm ${v ? '' : 'primary'}" data-act="dm-verify" data-arg="${key}">${v ? 'Verified ✓' : 'Mark as verified'}</button>
  <label class="field">Disappearing messages<select id="dm-ttl">${[[0, 'Off'], [1, '1 hour'], [24, '24 hours'], [168, '7 days']].map(([h, l]) => `<option value="${h}" ${(CRY.ttl[c.id] || 0) == h ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="layer"><input type="checkbox" data-act="dm-raw" ${CRY.showRaw ? 'checked' : ''}> Show what the server stores</label>
  <label class="layer"><input type="checkbox" data-act="dm-guard" ${CRY.guard ? 'checked' : ''}> Hide messages when this window loses focus</label>
  <span class="muted" style="font-size:12px">Prototype: keys live in this browser so you can switch people. In the build, each private key is created on and never leaves its owner's phone, with forward secrecy (Signal protocol via Matrix).</span>`;
}
async function dmSend(chan, text) { await crySeal(chan, S.me, text, 'Now'); CRY.plain[chan] = null; audit('Sent encrypted message', CHANNELS.find(c => c.id === chan).name + ' · content not logged'); render(); }
window.addEventListener('blur', () => { if (CRY.guard) document.querySelectorAll('.dm-text').forEach(e => e.classList.add('blur')); });
window.addEventListener('focus', () => document.querySelectorAll('.dm-text').forEach(e => e.classList.remove('blur')));

/* ---------- search ---------- */
function searchIndex() {
  const out = [];
  for (const a of ATH) if (seesAthlete(a)) out.push({ t: 'Athlete', title: a.name, sub: a.pos + (a.case && seesClinical(a) ? ' · ' + a.case.region : ''), go: () => go('athlete-' + a.id) });
  for (const k in DB) { const d = DB[k]; out.push({ t: d.kind, title: d.name, sub: [d.region, d.a].filter(Boolean).join(' · '), go: () => { AN.pending = (d.kind === 'Bone' || d.kind === 'Cartilage') ? null : k + '_R'; go('anatomy'); } }); }
  if (window.AnatomyLab && AnatomyLab.list) for (const s of AnatomyLab.list()) if (!s.key || !DB[s.key]) out.push({ t: s.kind, title: s.name.charAt(0).toUpperCase() + s.name.slice(1), sub: 'Anatomy lab · ' + ({ sup: 'superficial', deep: 'deep', conn: 'connective', cart: 'cartilage', bone: 'skeleton' }[s.layer]), go: () => { AN.pending = s.id; go('anatomy'); } });
  for (const b of Object.values(BATTERY).flat()) out.push({ t: 'Test', title: b[0], sub: b[1], go: () => go('classify') });
  for (const tr of TRACKS) for (const m of tr.modules) out.push({ t: 'Module', title: m[0], sub: tr.name + ' track · ' + m[2] + ' h', go: () => go('learn') });
  for (const p of PROTOCOLS) out.push({ t: 'Protocol', title: p[0], sub: p[1], go: () => go('learn') });
  for (const c of CHANNELS) if (c.members.includes(S.me)) for (const m of (MSGS[c.id] || [])) out.push({ t: 'Message', title: m[2], sub: c.name, go: () => { S.ch = c.id; go('messages'); } });
  for (const i of IDEAS) out.push({ t: 'Idea', title: i.name, sub: i.stage, go: () => go('innovation') });
  for (const n of NAV) if (allowedRoutes().includes(n[0])) out.push({ t: 'Page', title: n[1], sub: 'Go to page', go: () => go(n[0]) });
  return out;
}
function openPalette(q) {
  const wrap = document.createElement('div'); wrap.className = 'palette';
  wrap.innerHTML = `<div class="palette-box" role="dialog" aria-label="Search"><label class="sr" for="pq">Search</label><input id="pq" placeholder="Search athletes, muscles, tests, protocols, messages" autocomplete="off"><div class="palette-res" id="pr"></div></div>`;
  document.body.appendChild(wrap);
  const idx = searchIndex(); let sel = 0, res = [];
  const draw = () => {
    const s = $('#pq').value.toLowerCase().trim();
    res = (s ? idx.filter(r => (r.title + ' ' + r.sub + ' ' + r.t).toLowerCase().includes(s)) : idx.filter(r => r.t === 'Page' || r.t === 'Athlete')).slice(0, 14);
    $('#pr').innerHTML = res.length ? res.map((r, i) => `<button class="res" data-i="${i}" aria-selected="${i === sel}"><span class="chip plain ${r.t === 'Athlete' ? 'c-accent' : r.t === 'Muscle' || r.t === 'Tendon' || r.t === 'Ligament' || r.t === 'Nerve' || r.t === 'Bone' ? 'c-health' : r.t === 'Test' ? 'c-load' : 'c-muted'}" style="min-width:76px;justify-content:center">${r.t}</span><span style="min-width:0"><b>${esc(r.title)}</b><br><span class="muted" style="font-size:12.5px">${esc(r.sub)}</span></span></button>`).join('') : '<p class="muted" style="padding:16px">Nothing matches. Try a body part, a test or a name.</p>';
  };
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); const b = e.target.closest('.res'); if (b) { close(); res[+b.dataset.i].go(); } });
  $('#pq').addEventListener('input', () => { sel = 0; draw(); });
  $('#pq').addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && res[sel]) { close(); res[sel].go(); } });
  if (q) $('#pq').value = q;
  draw(); $('#pq').focus();
  return { type: t => { $('#pq').value = t; sel = 0; draw(); }, pick: i => { const r = res[i]; close(); r && r.go(); } };
}
window.__palette = openPalette;

/* ---------- router ---------- */
function go(r) { if (location.hash.slice(1) !== r) location.hash = r; else render(); }
function render() {
  const next = location.hash.slice(1);
  if (document.startViewTransition && S.route && next && next !== S.route && !window.__filming && !matchMedia('(prefers-reduced-motion: reduce)').matches) { document.startViewTransition(() => renderNow()); return; }
  renderNow();
}
function renderNow() {
  let r = location.hash.slice(1) || (me().role === 'athlete' || !seesAthlete(P1()) ? 'command' : 'player1');
  if (r === 'p1anat' && !seesAthlete(P1())) r = 'anatomy';
  if (r === 'p1anat' && S.route !== 'p1anat') { AN.pending = 'spring_ligament_R'; AN.sel = 'spring_ligament_R'; }
  const base = r.startsWith('athlete-') ? 'athletes' : r;
  if (!allowedRoutes().includes(base)) r = 'command';
  S.route = r;
  if (r !== 'anatomy' && r !== 'p1anat' && window.AnatomyLab) AnatomyLab.stop();
  const page = $('#page');
  page.innerHTML = (S.priv ? `<div class="banner">${lockIcon} Private mode is on. ${ATH.filter(a => a.private).length} private records and ${CHANNELS.filter(c => c.private).length} private threads are limited to their access lists.</div>` : '') + (
    r === 'command' ? pageCommand() : r === 'player1' ? pagePlayer1() : r === 'return' ? pageReturn() + (perm().clinical ? transitionCard() : '') : r === 'loadlab' ? pageLoadLab() + wearPanel() : r === 'calendar' ? pageCalendar() + leaveRequests() : r === 'assess' ? pageAssess() : r === 'p1tx' ? pageP1Tx() : r === 'p1inj' ? pageP1Inj() : r === 'p1test' ? pageP1Test() : r === 'p1edu' ? pageP1Edu() : r === 'p1chat' ? pageP1Chat() : r === 'myfoot' ? pageMyFoot() : r === 'learn' && me().role === 'athlete' ? pageLearnAthlete() : r === 'athletes' ? pageTeam() : r.startsWith('athlete-') ? athleteHub(r.slice(8)) : r === 'treatment' ? pageTreatment() : r === 'anatomy' || r === 'p1anat' ? pageAnatomy() :
      r === 'book' ? pageBook() : r === 'classify' ? pageClassify() : r === 'learn' ? pageLearn() : r === 'messages' ? pageMessages() : r === 'innovation' ? innovationInbox() + pageInnovation() + equipmentPanel() : r === 'agents' ? pageAgents() : r === 'p1rx' ? pageP1Rx() : r === 'p1kit' ? pageP1Kit() : r === 'recovery' ? pageRecovery() : r === 'build' ? pageBuild() : r === 'pilot' ? pagePilot() : r === 'audit' ? pageAudit() : r === 'members' ? pageMembers() : r === 'records' ? pageRecords('all') : r === 'p1rec' ? pageRecords('p1') + consentCard(P1()) : r === 'ask' ? pageAsk() : pageTrust());
  renderNav(); syncMode(); document.body.dataset.role = me().role;
  if (r === 'anatomy' || r === 'p1anat') mountAnatomy();
  cineAfterRender(); chapterSlate(r); holoMount(); if (window.AnatomyLab && AnatomyLab.roles && !document.getElementById('mo-host') && !(typeof OC !== 'undefined' && OC.keys && OC.roles)) AnatomyLab.roles(null);
  if (window.TOPO) TOPO.attach();
  rtCentre(); if (r === 'athletes') mountDrift(); countUp();
  if (r === 'messages') { const tb = $('#tb'); if (tb) tb.scrollTop = tb.scrollHeight; }
  bindForms();
}
function bindForms() {
  const upd = $('#upd');
  if (upd) upd.addEventListener('submit', e => {
    e.preventDefault();
    const mods = [...document.querySelectorAll('#u-mods .pill[aria-pressed="true"]')].map(b => b.dataset.arg);
    const ath = $('#u-ath').value, a = ATH.find(x => x.id === ath);
    const u = { id: 'u' + Date.now(), ath, by: S.me, at: 'Now', pain: +$('#u-pain').value, mods: mods.length ? mods : ['Exercise therapy'], response: $('#u-resp').value, plan: $('#u-plan').value || 'Continue current plan.', stage: $('#u-stage').value, shared: $('#u-share').checked };
    UPDATES.unshift(u); a.case.stage = u.stage; a.case.pain.push(u.pain);
    if (u.shared) { const c = CHANNELS.find(x => x.ath === ath); if (c) { (MSGS[c.id] = MSGS[c.id] || []).push([S.me, 'Now', `Treatment update: ${u.mods.join(', ')}. ${u.plan}`, 'Treatment update · pain ' + u.pain + '/10']); } }
    store.set('updates', UPDATES); store.set('msgs', MSGS); audit('Logged treatment', a.name);
    toast(u.shared ? 'Update saved and sent to the physician' : 'Update saved'); render();
  });
  const comp = $('#composer');
  if (comp) comp.addEventListener('submit', e => { e.preventDefault(); const v = $('#msg-in').value.trim(); if (!v) return; const cc = CHANNELS.find(x => x.id === S.ch); if (cc && cc.kind === 'dm') { dmSend(S.ch, v); return; } (MSGS[S.ch] = MSGS[S.ch] || []).push([S.me, 'Now', v]); store.set('msgs', MSGS); render(); setTimeout(() => $('#msg-in') && $('#msg-in').focus(), 0); });
  document.querySelectorAll('[data-cl]').forEach(el => el.addEventListener('change', () => { const k = el.dataset.cl; CL[k] = el.type === 'checkbox' ? el.checked : el.value; store.set('cl', CL); const y = scrollY; render(); scrollTo(0, y); }));
  document.querySelectorAll('[data-ice]').forEach(el => el.addEventListener('change', () => { const [id, k] = el.dataset.ice.split(':'); IDEAS.find(i => i.id === id)[k] = +el.value; store.set('ideas', IDEAS); const y = scrollY; render(); scrollTo(0, y); }));
  document.querySelectorAll('[data-dy]').forEach(el => el.addEventListener('change', () => { const [g, k] = el.dataset.dy.split('.'); const r = todayRec(); r[g] = r[g] || {}; r[g][k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; r.sent = false; if (el.closest('.ftc-wrap') && el.checked) setTimeout(saveDaily, 750); else saveDaily(); }));
  document.querySelectorAll('[data-rec-off]').forEach(el => el.addEventListener('change', () => { GROUP.recipients[+el.dataset.rec] = el.value || '[Recipient]'; store.set('group', GROUP); const c = CHANNELS.find(x => x.id === 'p1-daily'); if (c) c.external = GROUP.recipients; toast('Group updated'); }));
  const ev = $('#evform');
  if (ev) ev.addEventListener('submit', e => {
    e.preventDefault();
    const who = [...document.querySelectorAll('[data-act="evwho"][aria-pressed="true"]')].map(b => b.dataset.arg);
    const acc = [...document.querySelectorAll('[data-act="evacc"][aria-pressed="true"]')].map(b => b.dataset.arg);
    const type = $('#ev-type').value, from = $('#ev-from').value, to = $('#ev-to').value;
    if (!who.length || !from || !to || to < from) { toast('Pick who, and an end date on or after the start'); return; }
    const d = $('#ev-dest').value || (type === 'trip' ? '[Destination]' : 'Vacation');
    EVENTS.push(type === 'trip' ? { id: 'e' + Date.now(), type, who, from, to, dest: d, purpose: 'Official trip', access: acc.includes('jp') ? acc : ['jp', ...acc] } : Object.assign({ id: 'e' + Date.now(), type, who, from, to, note: d }, me().role === 'lead' || type !== 'leave' ? {} : { status: 'pending' }));
    store.set('events', EVENTS); audit(type === 'trip' ? 'Added official trip' : 'Added leave', who.join(', ') + ' · ' + from + ' to ' + to);
    const p = PD(from); CALV.y = p.getFullYear(); CALV.m = p.getMonth();
    toast(type === 'trip' ? 'Trip added. The calendar now shows them away; details stay restricted.' : me().role === 'lead' || type !== 'leave' ? (type === 'sick' ? 'Sick day added. The cover check updates.' : 'Leave added to the calendar') : 'Leave requested. JP approves it before it reaches the calendar.'); render();
  });
  const ttl = $('#dm-ttl'); if (ttl) ttl.addEventListener('change', () => { CRY.ttl[S.ch] = +ttl.value; toast(+ttl.value ? 'New messages disappear after ' + ttl.options[ttl.selectedIndex].text : 'Disappearing messages off'); });
  const nd = $('#newdm'); if (nd) nd.addEventListener('change', () => { if (!nd.value) return; const o = PEOPLE.find(p => p.id === nd.value); const id = 'dm-' + [S.me, o.id].sort().join('-'); if (!CHANNELS.find(x => x.id === id)) CHANNELS.push({ id, name: [me().name, o.name].join(' and '), members: [S.me, o.id], private: true, kind: 'dm' }); S.ch = id; audit('Started encrypted conversation', o.name); render(); });
  const sp = $('#an-speed'); if (sp) sp.addEventListener('input', () => AnatomyLab.set('speed', +sp.value));
  const ph = $('#an-phase'); if (ph) ph.addEventListener('input', () => { AnatomyLab.set('playing', false); AnatomyLab.set('phase', +ph.value); });
  document.querySelectorAll('[data-cust]').forEach(el => el.addEventListener('input', () => { const k = el.dataset.cust; AN.cust[k] = +el.value; AnatomyLab.custom(k, +el.value); const o = document.getElementById('cv-' + k); if (o) o.textContent = el.value + '°'; }));
  const pe = $('#an-peel'); if (pe) pe.addEventListener('input', () => { AnatomyLab.set('peel', +pe.value); $('#an-peel-l').textContent = PEEL_L[+pe.value]; });
  const ex = $('#an-ex'); if (ex) ex.addEventListener('input', () => AnatomyLab.explode(+ex.value));
  const of = $('#an-off'); if (of) of.addEventListener('input', () => { AN.off = +of.value; AnatomyLab.clip(AN.clip, AN.off, AN.flip); });
}

function toggleIn(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
function keepRender() { const y = scrollY; render(); scrollTo(0, y); }
function saveDaily() { store.set('daily', DAILY); keepRender(); }
function protoToggle() {
  if (PROTO.running) { clearInterval(PROTO.timer); PROTO.running = false; keepRender(); return; }
  PROTO.running = true; keepRender();
  PROTO.timer = setInterval(() => {
    PROTO.t = Math.max(0, PROTO.t - 1);
    const c = document.getElementById('proto-clock'); if (c) c.textContent = Math.floor(PROTO.t / 60) + ':' + String(PROTO.t % 60).padStart(2, '0');
    document.querySelectorAll('.proto-bar').forEach(b => { b.style.width = Math.round((420 - PROTO.t) / 4.2) + '%'; });
    if (PROTO.t === 0) { clearInterval(PROTO.timer); PROTO.running = false; todayRec().proto.done = true; toast('7-minute protocol complete'); saveDaily(); }
  }, 1000);
}
/* ---------- actions ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, arg = t.dataset.arg;
  const L = window.AnatomyLab;
  switch (act) {
    case 'track': S.track = arg; render(); break;
    case 'open': go('athlete-' + arg); break;
    case 'request': audit('Requested access', ATH.find(a => a.id === arg).name, 'Pending'); toast('Access request sent to JP'); break;
    case 'grant': { const [aid, pid] = arg.split(':'); const a = ATH.find(x => x.id === aid); if (t.checked) a.access.push(pid); else a.access = a.access.filter(x => x !== pid); audit(t.checked ? 'Granted access' : 'Removed access', a.name + ' → ' + PEOPLE.find(p => p.id === pid).name); toast(t.checked ? 'Access granted' : 'Access removed'); break; }
    case 'mkprivate': { const a = ATH.find(x => x.id === arg); a.private = !a.private; if (a.private && !a.access.length) a.access = ['jp']; audit(a.private ? 'Made private' : 'Made team-visible', a.name); render(); break; }
    case 'thread': { const c = CHANNELS.find(x => x.ath === arg && x.members.includes(S.me)); if (c) S.ch = c.id; break; }
    case 'focus': AN.pending = arg; AN.sel = arg; go('anatomy'); break;
    case 'mod': t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); break;
    case 'ch': S.ch = arg; audit('Opened thread', CHANNELS.find(c => c.id === arg).name); render(); break;
    case 'istage': { const [id, d] = arg.split(':'); const i = IDEAS.find(x => x.id === id); i.stage = ISTAGES[Math.max(0, Math.min(3, ISTAGES.indexOf(i.stage) + +d))]; store.set('ideas', IDEAS); render(); break; }
    case 'preset': Object.assign(CL, arg === 'sed' ? { age: 46, sex: 'Male', mod: 40, vig: 0, str: 0, sit: 10, ses: 0, sport: false, level: 'none', active: false, disease: false, symptoms: false, sbp: 136, dbp: 86, waist: 104, grip: 34 } : arg === 'club' ? { age: 29, sex: 'Female', mod: 180, vig: 90, str: 2, sit: 7, ses: 4, sport: true, level: 'local', active: true, disease: false, symptoms: false, sbp: 116, dbp: 74, waist: 74, grip: 31 } : { age: 26, sex: 'Male', mod: 300, vig: 400, str: 3, sit: 5, ses: 11, sport: true, level: 'international', active: true, disease: false, symptoms: false, sbp: 118, dbp: 70, waist: 80, grip: 56 }); store.set('cl', CL); render(); break;
    case 'dy-proto-kind': todayRec().proto.kind = arg; saveDaily(); break;
    case 'dy-proto-type': todayRec().proto.type = arg; saveDaily(); break;
    case 'dy-obs': toggleIn(todayRec().obs.flags, arg); saveDaily(); break;
    case 'dy-reg': toggleIn(todayRec().soft.regions, arg); saveDaily(); break;
    case 'dy-tech': toggleIn(todayRec().soft.tech, arg); saveDaily(); break;
    case 'proto-go': protoToggle(); break;
    case 'proto-reset': clearInterval(PROTO.timer); PROTO.running = false; PROTO.t = 420; keepRender(); break;
    case 'send-group': { const r = todayRec(); (MSGS['p1-daily'] = MSGS['p1-daily'] || []).push([S.me, 'Now', agentDraft().join('\n'), 'Daily update · agent draft']); r.sent = true; store.set('msgs', MSGS); saveDaily(); audit('Sent daily update', 'Team physician'); toast('Sent to the team physician'); break; }
    case 'cal': CALV.m += +arg; if (CALV.m > 11) { CALV.m = 0; CALV.y++; } if (CALV.m < 0) { CALV.m = 11; CALV.y--; } render(); break;
    case 'evwho': case 'evacc': t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); break;
    case 'dm-verify': CRY.verified[arg] = !CRY.verified[arg]; toast(CRY.verified[arg] ? 'Safety number verified' : 'Verification removed'); render(); break;
    case 'dm-raw': CRY.showRaw = t.checked; render(); break;
    case 'dm-guard': CRY.guard = t.checked; break;
    case 'learnquiz': go('anatomy'); setTimeout(() => { if (window.AnatomyLab) { startQuiz(); $('#an-right').innerHTML = anatomyRight(); } }, 600); break;
    // anatomy
    case 'move': L.set('move', arg); L.set('playing', true); if (arg === 'idle') L.set('heat', true); render(); break;
    case 'play': L.set('playing', !L.get().playing); t.textContent = L.get().playing ? 'Pause' : 'Play'; break;
    case 'valgus': L.set('valgus', t.checked); break;
    case 'heat': L.set('heat', t.checked); break;
    case 'layer': L.set(arg, t.checked); break;
    case 'xray': L.set('xray', t.checked); break;
    case 'assemble': L.assemble(); { const e = document.getElementById('an-ex'); if (e) e.value = 0; } break;
    case 'deconstruct': L.deconstruct(); { const e = document.getElementById('an-ex'); if (e) e.value = 1; } break;
    case 'look': L.style(arg); document.querySelectorAll('[data-act="look"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === arg)); { const q = document.querySelector('[data-act="lookcycle"]'); if (q) q.textContent = ({ cinematic: 'Cinematic', clinical: 'Clinical', cadaver: 'Cadaver', hologram: 'Hologram' })[arg]; } break;
    case 'lookcycle': { const order = ['cinematic', 'clinical', 'cadaver', 'hologram'], nx = order[(order.indexOf(L.get().style) + 1) % 4]; L.style(nx); t.textContent = ({ cinematic: 'Cinematic', clinical: 'Clinical', cadaver: 'Cadaver', hologram: 'Hologram' })[nx]; document.querySelectorAll('[data-act="look"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === nx)); break; }
    case 'lenscycle': { const nx = { '': 'deep', deep: 'bone', bone: '' }[L.get().lens || '']; L.set('lens', nx || null); t.querySelector('span').textContent = nx === 'bone' ? 'Scanning skeleton' : nx === 'deep' ? 'Scanning deep muscle' : 'Holo scan'; document.querySelectorAll('[data-act="lens"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === (nx || ''))); document.getElementById('stage').classList.toggle('holo-on', !!nx); break; }
    case 'lens': L.set('lens', arg || null); document.querySelectorAll('[data-act="lens"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === arg)); document.getElementById('stage') && document.getElementById('stage').classList.toggle('holo-on', !!arg); break;
    case 'clip': AN.clip = arg; L.clip(AN.clip, AN.off, AN.flip); document.querySelectorAll('[data-act="clip"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === arg)); break;
    case 'flip': AN.flip = t.checked; L.clip(AN.clip, AN.off, AN.flip); break;
    case 'view': L.view(arg); break;
    case 'pick': L.select(arg); L.focusOn(arg); break;
    case 'isolate': L.isolate(AN.sel); break;
    case 'hide': L.hide(AN.sel); toast('Dissected away. Use Show all to restore.'); break;
    case 'focusSel': L.focusOn(AN.sel); break;
    case 'showall': L.showAll(); break;
    case 'pinmode': L.set('pinMode', !L.get().pinMode); t.textContent = L.get().pinMode ? 'Pinning: click the model' : 'Pin a finding'; t.setAttribute('aria-pressed', L.get().pinMode); break;
    case 'clearpins': L.clearPins(); break;
    case 'tonote': audit('Added structure to note', NAME(AN.sel) + ' → Player 1'); toast(NAME(AN.sel) + ' added to Player 1 note'); break;
    case 'quiz': if (AN.quiz) { AN.quiz = null; L.set('quiz', null); } else startQuiz(); render(); break;
    case 'answer': AN.quiz.answered = true; AN.quiz.picked = arg; AN.score[1]++; if (arg === AN.quiz.id) AN.score[0]++; $('#an-right').innerHTML = anatomyRight(); break;
    case 'quiznext': startQuiz(); $('#an-right').innerHTML = anatomyRight(); break;
  }
});

/* ---------- top bar ---------- */
function initTop() {
  $('#who').innerHTML = PEOPLE.map(p => `<option value="${p.id}" ${p.id === S.me ? 'selected' : ''}>${esc(p.full)}</option>`).join('');
  $('#who').addEventListener('change', e => { S.me = e.target.value; store.set('me', S.me); $('#who-av').textContent = me().init; audit('Switched person', me().full); toast('Now viewing as ' + me().full); render(); });
  $('#who-av').textContent = me().init;
  const sw = $('#priv-switch');
  const setPriv = v => { S.priv = v; store.set('priv', v); sw.setAttribute('aria-checked', v); $('#priv').dataset.on = v; $('#priv-label').textContent = v ? 'Private mode on' : 'Private mode'; };
  setPriv(S.priv);
  sw.addEventListener('click', () => { setPriv(!S.priv); audit(S.priv ? 'Private mode on' : 'Private mode off', 'Workspace'); toast(S.priv ? 'Private mode on. Restricted records follow their access lists.' : 'Private mode off'); render(); });
  $('#open-search').addEventListener('click', () => openPalette());
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
  $('#theme').addEventListener('click', () => { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', r.dataset.theme); if (window.TOPO) TOPO.retheme(); });
  const th = store.get('theme', null); document.documentElement.dataset.theme = th || 'dark';
}
window.addEventListener('hashchange', render);
initTop(); render(); cryInit().then(() => { if (S.route === 'messages') render(); });
window.__app = { go, S, ATH, setMe: id => { $('#who').value = id; $('#who').dispatchEvent(new Event('change')); }, priv: () => $('#priv-switch').click(), startQuiz };
})();
