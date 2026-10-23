/* ---------- v43: every member classified (McKay 2022 tiers -> sedentary, trained, competitive, elite), and population tags across hubs ---------- */
const POPS = [['sedentary', 'Sedentary', '#94a3b8', 'Tier 0'], ['trained', 'Trained', '#38bdf8', 'Tiers 1 to 2'], ['competitive', 'Competitive', '#a78bfa', 'Tier 3'], ['elite', 'Elite', '#f59e0b', 'Tiers 4 to 5']];
const tierPop = t => t == null || t === '' ? null : t <= 0 ? 'sedentary' : t <= 2 ? 'trained' : t === 3 ? 'competitive' : 'elite';
const popOf = id => (POPS.find(p => p[0] === id) || [id, 'To classify', '#64748b', '']);
const popChip = (pop, extra) => { const p = popOf(pop); return `<span class="popc" style="--pc:${p[2]}"><i></i>${esc(p[1])}${extra ? ' · ' + esc(extra) : ''}</span>`; };
let MTIER = store.get('mtier') || {};
/* every member of the domain: athletes, Player 1, clinicians, coaches, operations */
function members() {
  const out = ATH.map(a => ({ id: a.id, name: aName(a), kind: a.id === 'p1' ? 'Player 1' : 'Athlete', role: a.pos, tier: MTIER[a.id] != null ? MTIER[a.id] : a.id === 'p1' ? 4 : a.tier, ath: a }));
  PEOPLE.filter(p => p.role !== 'athlete').forEach(p => out.push({ id: 'pp-' + p.id, name: p.name, kind: ROLE[p.role] ? ROLE[p.role].label : 'Staff', role: p.full.split('·').pop().trim(), tier: MTIER['pp-' + p.id] != null ? MTIER['pp-' + p.id] : null }));
  return out;
}
let POPF = store.get('popf') || 'all';
function popFilterBar(label) {
  return `<div class="popbar" role="group" aria-label="${esc(label || 'Show for population')}"><span class="eyebrow">${esc(label || 'Show for')}</span><button data-popf="all" aria-pressed="${POPF === 'all'}">Everyone</button>${POPS.map(p => `<button data-popf="${p[0]}" aria-pressed="${POPF === p[0]}" style="--pc:${p[2]}"><i></i>${p[1]}</button>`).join('')}</div>`;
}
const popMatch = pops => POPF === 'all' || !pops || !pops.length || pops.includes(POPF);
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-popf]'); if (!b) return; POPF = b.dataset.popf; store.set('popf', POPF); keepRender(); });

function pageMembers() {
  const M = members(), canEdit = perm().clinical || me().role === 'lead', cols = [...POPS.map(p => p[0]), null];
  const card = m => `<article class="mcard" style="--pc:${popOf(tierPop(m.tier))[2]}"><header><span class="av">${esc(m.name.slice(0, 2).toUpperCase())}</span><div><b>${esc(m.name)}</b><span>${esc(m.kind)} · ${esc(m.role || '')}</span></div></header>
    ${m.tier != null ? `<span class="mt">McKay tier ${m.tier}</span>` : '<span class="mt">Not classified yet</span>'}
    ${canEdit ? `<div class="mtiers" role="group" aria-label="Set tier for ${esc(m.name)}">${[0, 1, 2, 3, 4, 5].map(t => `<button data-mt="${m.id}|${t}" aria-pressed="${m.tier === t}" title="${esc(TIERS[t])}">${t}</button>`).join('')}</div>` : ''}
    ${m.ath ? `<a class="mlink" href="#athlete-${m.ath.id}~tests">Tests and prescription</a>` : `<a class="mlink" href="#classify">Classify with the questionnaire</a>`}</article>`;
  return `<div class="sec-head"><div><span class="eyebrow">Everyone in the domain · McKay 2022 tiers · tests and prescription follow the population</span><h1 style="font-size:34px;letter-spacing:-.6px">Members by population</h1></div></div>
  <div class="popsum">${POPS.map(p => `<div style="--pc:${p[2]}"><b>${M.filter(m => tierPop(m.tier) === p[0]).length}</b><span>${p[1]}</span><em>${p[3]}</em></div>`).join('')}<div style="--pc:#64748b"><b>${M.filter(m => m.tier == null).length}</b><span>To classify</span><em>staff and coaches</em></div></div>
  <div class="mboard">${cols.map(c => `<section class="mcol" style="--pc:${popOf(c)[2]}"><h2>${c ? popOf(c)[1] : 'To classify'}<span>${M.filter(m => tierPop(m.tier) === c).length}</span></h2>${M.filter(m => tierPop(m.tier) === c).map(card).join('') || '<p class="muted">Nobody yet</p>'}</section>`).join('')}</div>
  <p class="muted" style="font-size:12.5px">Tier 0 sedentary; 1 recreationally active and 2 trained (our "trained"); 3 highly trained, national (our "competitive"); 4 elite, international and 5 world class (our "elite"). Staff and coaches start unclassified: set a tier, or run the questionnaire in Classify. <a href="${SRC.mckay.url}" target="_blank" rel="noopener">McKay et al. 2022</a></p>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mt]'); if (!b) return; const [id, t] = b.dataset.mt.split('|'); MTIER[id] = MTIER[id] === +t ? null : +t; if (MTIER[id] == null) delete MTIER[id]; store.set('mtier', MTIER); audit('Population set', id + ' tier ' + t); keepRender(); });

/* population tags for innovation ideas (seeded) and scout items (inferred when the scout did not tag them) */
const IDEA_POPS = { i1: ['competitive', 'elite'], i2: ['trained', 'competitive', 'elite'], i3: ['sedentary', 'trained', 'competitive', 'elite'], i4: ['sedentary', 'trained'], i5: ['sedentary', 'trained', 'competitive'], i6: ['competitive', 'elite'], i7: ['competitive', 'elite'], i8: ['sedentary', 'trained', 'competitive', 'elite'], i9: ['trained', 'competitive', 'elite'] };
function inferPops(text) {
  const t = (text || '').toLowerCase(), p = new Set();
  if (/elite|professional|pro |olympic|world tour|premier padel|national team/.test(t)) { p.add('elite'); p.add('competitive'); }
  if (/athlete|performance|competition|team sport|padel|speed|power/.test(t)) { p.add('competitive'); p.add('trained'); }
  if (/longevity|health|beginner|general population|older|sedentary|weight|blood pressure|wellbeing/.test(t)) { p.add('sedentary'); p.add('trained'); }
  return p.size ? [...p] : ['sedentary', 'trained', 'competitive', 'elite'];
}
const EDU_POPS = { routines: ['sedentary', 'trained', 'competitive', 'elite'], recovery: ['sedentary', 'trained', 'competitive', 'elite'], biomech: ['trained', 'competitive', 'elite'], physiology: ['sedentary', 'trained', 'competitive', 'elite'], coaching: ['competitive', 'elite'], evidence: ['sedentary', 'trained', 'competitive', 'elite'], body: ['sedentary', 'trained', 'competitive', 'elite'], levers: ['sedentary', 'trained', 'competitive', 'elite'] };
const popTags = pops => `<span class="poptags">${(pops || []).map(p => `<i style="--pc:${popOf(p)[2]}" title="${popOf(p)[1]}"></i>`).join('')}</span>`;
