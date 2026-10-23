/* ---------- Anatomy lab: clinical viewer chrome (structure tree, search, tool bar, leader-line label) ---------- */
const AN_SYS = [['all', 'All', null], ['bone', 'Bones', ['bone']], ['musc', 'Muscles', ['sup', 'deep']], ['conn', 'Ligaments and tendons', ['conn']], ['cart', 'Cartilage', ['cart']], ['art', 'Arteries', ['art']], ['vein', 'Veins', ['vein']], ['nerve', 'Nervous', ['nerve']], ['organ', 'Organs', ['organ']], ['ins', 'Attachments', ['ins']]];
const AN_SYSLAYERS = ['art', 'vein', 'nerve', 'organ', 'ins'];
const AN_REGIONS = ['Head and neck', 'Trunk and spine', 'Shoulder and upper limb', 'Pelvis and hip', 'Thigh and knee', 'Leg', 'Ankle and foot'];
const AN_COL = { bone: '#D9CDB4', cart: '#A9C4CC', conn: '#B9C3CF', sup: '#B45A4E', deep: '#9A483E', art: '#B8302A', vein: '#34508F', nerve: '#E3BC45', organ: '#C48778', ins: '#D8463A' };
const AN_ICON = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
  ghost: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  reset: '<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/>',
  snap: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.3 6.3C3.7 8 2 12 2 12s3.6 7 10 7a9.6 9.6 0 004.3-1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  measure: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  labels: '<path d="M3 7h9l4 5-4 5H3z"/><circle cx="7" cy="12" r="1.2" fill="currentColor"/><path d="M19 8v8"/>'
};
const anSvg = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AN_ICON[k]}</svg>`;
const AN_SYSNOTE = () => { const L = window.AnatomyLab; return L && L.systemsLoaded && !L.systemsLoaded() ? '<div class="muted an-more">Vessels, nerves, organs and muscle attachments are loading…</div>' : ''; };
const anClean = n => n.replace(/^(right|left) /, '').replace(/ of (right|left) /, ' of ').replace(/^./, c => c.toUpperCase());

function anTree() {
  const L = window.AnatomyLab, list = L && L.ready && L.ready() ? L.list() : [];
  const count = k => { const ly = AN_SYS.find(x => x[0] === k)[2]; return ly ? list.filter(s => ly.includes(s.layer)).length : list.length; };
  const regs = AN_REGIONS;
  const launcher = `<div class="an-models" role="group" aria-label="Open a region"><button class="an-model" data-av="region" data-arg="" aria-pressed="${AN.region === null}"><b>Full body</b><span>${list.length ? list.length.toLocaleString() + ' structures' : 'All regions'}</span></button>${regs.map((r, i) => `<button class="an-model" data-av="region" data-arg="${i}" aria-pressed="${AN.region === i}"><b>${r}</b><span>${list.length ? list.filter(s => s.region === i).length + ' structures' : ''}</span></button>`).join('')}</div>`;
  return `<div class="an-tree"><span class="eyebrow">Models</span>${launcher}<label class="an-search">${anSvg('search', 16)}<input id="an-q" type="search" autocomplete="off" placeholder="Search ${list.length ? list.length.toLocaleString() : '1,185'} structures" value="${esc(AN.q)}" aria-label="Search structures"></label>
    <div class="an-sys" role="group" aria-label="System">${AN_SYS.map(([k, l]) => `<button class="pill" data-av="sys" data-arg="${k}" aria-pressed="${AN.sys === k}">${l}${list.length ? ` <span class="num">${count(k)}</span>` : ''}</button>`).join('')}</div>
    <div class="an-list" id="an-list">${anListHTML()}</div></div>`;
}
function anRows(items, L, st) {
  return items.map(s => { const hid = L.isHidden(s.id), on = st.selected === s.id;
    return `<div class="an-row${on ? ' on' : ''}${hid ? ' off' : ''}" data-row="${s.id}"><button class="an-name" data-av="pick" data-arg="${s.id}"><i style="background:${AN_COL[s.layer]}"></i><span>${esc(anClean(s.name))}</span>${s.side ? `<em>${s.side}</em>` : ''}</button><button class="an-eye" data-av="eye" data-arg="${s.id}" aria-pressed="${!hid}" aria-label="${hid ? 'Show' : 'Hide'} ${esc(s.name)}">${anSvg(hid ? 'eyeOff' : 'eye', 16)}</button></div>`; }).join('');
}
function anFiltered() {
  const L = window.AnatomyLab; if (!L || !L.ready || !L.ready()) return null;
  const ly = AN_SYS.find(x => x[0] === AN.sys)[2];
  let list = L.list().filter(s => !ly || ly.includes(s.layer));
  const q = AN.q.trim().toLowerCase();
  if (q) { const w = q.split(/\s+/); list = list.filter(s => { const h = s.name + ' ' + (s.key || '').replace(/_/g, ' ') + ' ' + ((typeof DB !== 'undefined' && DB[s.key]) ? DB[s.key].name.toLowerCase() : ''); return w.every(x => h.includes(x)); }).sort((a, b) => anClean(a.name).localeCompare(anClean(b.name)) || (b.side || '').localeCompare(a.side || '')); }
  else list.sort((a, b) => anClean(a.name).localeCompare(anClean(b.name)) || (b.side || '').localeCompare(a.side || ''));
  return list;
}
function anListHTML() {
  const L = window.AnatomyLab, list = anFiltered();
  if (!list) return '<div class="muted" style="padding:10px 4px;font-size:13px">Loading the atlas…</div>';
  if (AN_SYSLAYERS.includes(AN.sys) && !list.length) return AN_SYSNOTE();
  const st = L.get();
  if (AN.q.trim()) return list.length ? `<div class="an-group-body">${anRows(list.slice(0, 150), L, st)}</div>${list.length > 150 ? `<div class="muted an-more">${list.length - 150} more. Keep typing to narrow.</div>` : ''}` : '<div class="muted an-more">No structure by that name.</div>';
  return AN_REGIONS.map((r, i) => { const items = list.filter(s => s.region === i); if (!items.length) return '';
    const hidN = items.filter(s => L.isHidden(s.id)).length, open = !!AN.open[i];
    return `<div class="an-group${open ? ' open' : ''}"><div class="an-ghead"><button class="an-gname" data-av="grp" data-arg="${i}" aria-expanded="${open}"><svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>${r}<span class="num muted">${items.length}</span></button><button class="an-eye" data-av="eyeg" data-arg="${i}" aria-pressed="${hidN < items.length}" aria-label="${hidN === items.length ? 'Show' : 'Hide'} ${r}">${anSvg(hidN === items.length ? 'eyeOff' : 'eye', 16)}</button></div>
      ${open ? `<div class="an-group-body">${anRows(items, L, st)}</div>` : ''}</div>`; }).join('');
}
function anRefreshTree(reveal) {
  const box = $('#an-list'); if (!box) return;
  const ml = document.querySelector('.an-models'); if (ml && window.AnatomyLab && AnatomyLab.ready()) { const list = AnatomyLab.list(); ml.querySelectorAll('[data-av="region"]').forEach(b => { const sp = b.querySelector('span'); if (sp) sp.textContent = (b.dataset.arg === '' ? list.length : list.filter(x => x.region === +b.dataset.arg).length).toLocaleString() + ' structures'; }); }
  const L = window.AnatomyLab, st = L && L.get();
  if (reveal && st && st.selected) { const i = L.info(st.selected); if (i && i.region !== undefined && !AN.q) AN.open[i.region] = true; }
  const top = box.scrollTop; box.innerHTML = anListHTML(); box.scrollTop = top;
  const q = $('#an-q'); if (q && L && L.ready()) q.placeholder = 'Search ' + L.list().length.toLocaleString() + ' structures';
  if (reveal && st && st.selected) { const row = box.querySelector(`[data-row="${st.selected}"]`); if (row) { const r = row.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 2; } }
}
function anToolbar() {
  const L = window.AnatomyLab, st = L ? L.get() : {};
  const b = (k, act, label, on, dis) => `<button data-av="${act}" ${on !== undefined ? `aria-pressed="${!!on}"` : ''} ${dis ? 'disabled' : ''} title="${label}"><span>${anSvg(k)}</span><em>${label}</em></button>`;
  return `<div class="glass an-tools" id="an-tools" role="toolbar" aria-label="Viewer tools">${b('select', 'tool', 'Select', st.tool !== 'hide')}${b('cut', 'cuttool', 'Hide tool', st.tool === 'hide')}${b('measure', 'measure', 'Measure', st.tool === 'measure')}${b('ghost', 'ghost', 'Ghost', !!st.ghost)}${b('labels', 'labels', 'Labels', !!AN.labels)}<i></i>${b('undo', 'undo', 'Undo', undefined, !(L && L.canUndo && L.canUndo()))}${b('reset', 'reset', 'Reset view')}<i></i>${b('snap', 'snap', 'Snapshot')}${b('full', 'full', 'Full screen')}</div>`;
}
function anRefreshTools() { const t = $('#an-tools'); if (t) t.outerHTML = anToolbar(); }
let AN_LBL = null;
function anLabel(a) {
  const lb = $('#an-label'), line = $('#an-line'), dot = $('#an-dot'); if (!lb) return;
  if (!a || !AN.sel || AN.quiz) { lb.hidden = true; line && line.setAttribute('visibility', 'hidden'); dot && dot.setAttribute('visibility', 'hidden'); return; }
  if (AN_LBL !== AN.sel) { AN_LBL = AN.sel; const i = LABI(AN.sel); lb.innerHTML = `<b>${esc(i ? anClean(i.name) : NAME(AN.sel))}</b><span>${i ? esc((i.side === 'R' ? 'Right · ' : i.side === 'L' ? 'Left · ' : '') + i.kind + ' · ' + AnatomyLab.regions()[i.region]) : ''}</span>`; }
  lb.hidden = false;
  const lw = lb.offsetWidth, lh = lb.offsetHeight, dir = a.x < a.w * 0.58 ? 1 : -1;
  let lx = dir > 0 ? a.x + 110 : a.x - 110 - lw, ly = a.y - 96 - lh / 2;
  lx = Math.max(12, Math.min(a.w - lw - 12, lx)); ly = Math.max(70, Math.min(a.h - lh - 70, ly));
  lb.style.transform = `translate3d(${lx}px,${ly}px,0)`;
  const ex = dir > 0 ? lx : lx + lw, ey = ly + lh / 2;
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', ex); line.setAttribute('y2', ey);
  dot.setAttribute('cx', a.x); dot.setAttribute('cy', a.y);
  line.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
}
function anSelect(id, fly) {
  const L = window.AnatomyLab; if (!L) return;
  if (L.isHidden(id)) L.hideMany([id], false);
  const inf = L.info(id); if (inf && inf.layer !== 'ins' && L.get().layers[inf.layer] === false) { L.set(inf.layer, true); anSyncLayerBoxes(); }
  if (inf && L.get().region !== null && L.get().region !== inf.region) { AN.region = null; L.focusRegion(null); }
  L.select(id); if (fly) L.focusOn(id);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-av]'); if (!t) return;
  const L = window.AnatomyLab, act = t.dataset.av, arg = t.dataset.arg; if (!L) return;
  switch (act) {
    case 'ltab': AN.ltab = arg; keepRender(); break;
    case 'sys': if (AN_SYSLAYERS.includes(arg)) L.loadSystems(); AN.sys = arg; document.querySelectorAll('[data-av="sys"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === arg)); anRefreshTree(); break;
    case 'grp': AN.open[arg] = !AN.open[arg]; anRefreshTree(); break;
    case 'pick': anSelect(arg, true); break;
    case 'eye': L.hideMany([arg], !L.isHidden(arg) ? true : false); break;
    case 'eyeg': { const items = (anFiltered() || []).filter(s => s.region === +arg).map(s => s.id); const allHid = items.every(id => L.isHidden(id)); L.hideMany(items, !allHid); toast((allHid ? 'Showing ' : 'Hid ') + items.length + ' structures in ' + L.regions()[+arg].toLowerCase()); break; }
    case 'tool': L.set('tool', 'select'); L.clearMeasure(); anRefreshTools(); break;
    case 'measure': { const on = L.get().tool !== 'measure'; L.set('tool', on ? 'measure' : 'select'); if (!on) L.clearMeasure(); anRefreshTools(); if (on) toast('Measure: click two points on the model'); break; }
    case 'labels': AN.labels = !AN.labels; AN_LK = ''; anRefreshTools(); if (!AN.labels) anDrawLabels([]); break;
    case 'region': { const i = arg === '' ? null : +arg; AN.region = i; L.focusRegion(i); document.querySelectorAll('[data-av="region"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === (i === null ? '' : String(i)))); if (i !== null) { AN.open = {}; AN.open[i] = true; } anRefreshTree(); break; }
    case 'syson': L.set(arg, true); anSyncLayerBoxes(); anRefreshTree(); break;
    case 'cuttool': L.set('tool', L.get().tool === 'hide' ? 'select' : 'hide'); anRefreshTools(); if (L.get().tool === 'hide') toast('Hide tool: click structures to peel them away. Undo brings them back.'); break;
    case 'ghost': L.set('ghost', !L.get().ghost); anRefreshTools(); if (L.get().ghost && !L.get().selected) toast('Pick a structure; everything else turns translucent.'); if ($('#an-right')) $('#an-right').innerHTML = anatomyRight(); break;
    case 'undo': L.undo(); break;
    case 'reset': L.resetView(); break;
    case 'snap': (async () => {
      const dl = window.claude && claude.use ? await claude.use('downloads') : null;
      if (!dl) { toast('Saving files is not available in this view'); return; }
      const blob = await (await fetch(L.snapshot())).blob();
      const name = 'anatomy-' + (AN.sel ? anClean(LABI(AN.sel).name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' : '') + new Date().toISOString().slice(0, 10) + '.png';
      try { await dl.save({ filename: name, data: blob }); audit('Saved anatomy snapshot', AN.sel ? NAME(AN.sel) : 'Full view'); toast('Snapshot saved'); }
      catch (err) { if (err && err.code === 'rate_limited') toast('A save is already open'); else if (!err || err.code !== 'declined') toast('Snapshot could not be saved here'); }
    })(); break;
    case 'full': { const st = $('#stage'); if (!document.fullscreenElement && st && st.requestFullscreen) st.requestFullscreen().catch(() => toast('Full screen is blocked in this view')); else if (document.exitFullscreen) document.exitFullscreen(); break; }
  }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'an-q') { AN.q = e.target.value; anRefreshTree(); } });
document.addEventListener('keydown', e => {
  const L = window.AnatomyLab; if (!L || !$('#stage') || !L.ready()) return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) { if (e.key === 'Escape' && e.target.id === 'an-q') { AN.q = ''; e.target.value = ''; anRefreshTree(); } return; }
  const k = e.key.toLowerCase(), sel = L.get().selected;
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); L.undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'escape') { L.select(null); if (L.get().tool === 'hide') { L.set('tool', 'select'); anRefreshTools(); } }
  else if (k === 'h' && sel) L.hide(sel);
  else if (k === 'i' && sel) L.isolate(sel);
  else if (k === 'f' && sel) L.focusOn(sel);
  else if (k === 'g') { L.set('ghost', !L.get().ghost); anRefreshTools(); }
  else if (k === '/') { e.preventDefault(); AN.ltab = 'structures'; if (!$('#an-q')) keepRender(); setTimeout(() => $('#an-q') && $('#an-q').focus(), 30); }
});

/* atlas labels: placed in two columns either side of the body, sorted by height, each with a leader line */
let AN_LK = '', AN_LT = 0;
function anAutoLabels() {
  const L = window.AnatomyLab; if (!AN.labels || !L || !L.ready()) return;
  const k = L.camKey(); const now = performance.now();
  if (k !== AN_LK) { AN_LK = k; AN_LT = now; anDrawLabels([]); return; }
  if (AN_LT && now - AN_LT > 280) { AN_LT = 0; anDrawLabels(L.autoLabels(12)); }
}
function anDrawLabels(list) {
  const box = $('#an-labels'), svg = $('#an-lead'); if (!box || !svg) return;
  svg.querySelectorAll('.al').forEach(n => n.remove()); box.innerHTML = '';
  if (!list.length) return;
  const st = $('#stage'), W = st.clientWidth, H = st.clientHeight, mid = list.reduce((a, l) => a + l.x, 0) / list.length;
  const cols = [list.filter(l => l.x < mid).sort((a, b) => a.y - b.y), list.filter(l => l.x >= mid).sort((a, b) => a.y - b.y)];
  cols.forEach((col, ci) => {
    let lastY = 60;
    col.forEach(l => {
      const el = document.createElement('div'); el.className = 'an-al'; el.textContent = anClean(l.name); el.dataset.id = l.id; box.appendChild(el);
      const w = el.offsetWidth, h = el.offsetHeight; const y = Math.max(lastY, Math.min(H - 70, l.y - h / 2)); lastY = y + h + 6;
      const x = ci === 0 ? Math.max(12, Math.min(l.x - 70 - w, W * 0.32 - w)) : Math.min(W - w - 12, Math.max(l.x + 70, W * 0.68));
      el.style.left = x + "px"; el.style.top = y + "px";
      const ns = 'http://www.w3.org/2000/svg', ln = document.createElementNS(ns, 'polyline'), ex = ci === 0 ? x + w : x;
      ln.setAttribute('points', `${l.x},${l.y} ${ex + (ci === 0 ? 10 : -10)},${y + h / 2} ${ex},${y + h / 2}`); ln.setAttribute('class', 'al'); svg.appendChild(ln);
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', l.x); c.setAttribute('cy', l.y); c.setAttribute('r', 2.6); c.setAttribute('class', 'al'); svg.appendChild(c);
    });
  });
}
document.addEventListener('click', e => { const t = e.target.closest('.an-al'); if (t && window.AnatomyLab) anSelect(t.dataset.id, true); });
function anMeasure(m) {
  const el = $('#an-meas'); if (!el) return;
  if (!m || m.mm === null) { el.hidden = !m; if (m) el.textContent = 'Pick the second point'; return; }
  el.hidden = false; el.innerHTML = `<b class="num">${m.mm.toFixed(1)} mm</b><span>straight line</span>`; audit('Measured on the anatomy model', m.mm.toFixed(1) + ' mm');
}
function anMeasurePos() {
  const el = $('#an-meas'), L = window.AnatomyLab; if (!el || el.hidden || !L) return; const p = L.measureScreen();
  if (p) el.style.transform = `translate3d(${p.x + 14}px,${p.y - 14}px,0)`; else el.style.transform = 'translate3d(16px,72px,0)';
}
function anSyncLayerBoxes() { const L = window.AnatomyLab; if (!L) return; document.querySelectorAll('[data-act="layer"]').forEach(b => { b.checked = L.get().layers[b.dataset.arg] !== false; }); }
function anAttachHTML(id) {
  const L = window.AnatomyLab, i = L && L.info(id); if (!i || (i.layer !== 'sup' && i.layer !== 'deep')) return '';
  if (!L.systemsLoaded()) return '<div class="an-attach muted">Loading origin and insertion maps…</div>';
  const at = L.attachments(id); if (!at.length) return '';
  const o = at.filter(a => a.kind === 'Origin').length, n = at.filter(a => a.kind === 'Insertion').length;
  return `<div class="an-attach"><span class="eyebrow">Attachments on the skeleton</span><div class="an-leg"><span><i style="background:#D8463A"></i>Origin${o > 1 ? ' · ' + o + ' areas' : ''}</span><span><i style="background:#3A6FD8"></i>Insertion${n > 1 ? ' · ' + n + ' areas' : ''}</span></div><span class="muted" style="font-size:12.5px">Painted on the bones. Use Ghost to see them through the muscle.</span></div>`;
}
