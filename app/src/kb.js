/* ---------- Knowledge: the team's second brain. Linked notes for protocols, evidence, decisions and how-tos.
   Staff only (scope "staff", encrypted at rest). No patient identifiers: names, dates of birth, ID numbers, phone numbers
   and emails are refused on save. Clinical records belong in Records, not here.
   [[Note title]] links two notes; #tag files a note; backlinks and the graph are worked out from the links. ---------- */
const KB_TYPES = [['protocol', 'Protocol', '#0f8a6a'], ['evidence', 'Evidence', '#3b4bd8'], ['decision', 'Decision', '#b5651d'], ['meeting', 'Meeting', '#7a3fb8'], ['howto', 'How-to', '#0e7490'], ['idea', 'Idea', '#c2410c']];
const KB_TPL = {
  protocol: '## Purpose\n\n## Who it is for\n\n## Steps\n- \n\n## Progress when\n- \n\n## Stop or refer when\n- \n\n## Sources\n- ',
  evidence: '## Question\n\n## What the paper found\n\n## Type of study and grade\n\n## What we change\n\n## Source\n- ',
  decision: '## Decision\n\n## Options we considered\n- \n\n## Why\n\n## Review on\n',
  meeting: '## Attendees\n\n## Decisions\n- \n\n## Actions (owner, date)\n- ',
  howto: '## Steps\n1. \n\n## Common problems\n- ',
  idea: '## Idea\n\n## Smallest test\n\n## Linked\n- '
};
/* starter notes: the team standards the app itself enforces, written down so people can read and link them. Read-only. */
const KB_START = [
  { id: 'start-how', title: 'How we use Knowledge', type: 'howto', tags: ['team'], body: 'Our shared second brain: protocols, evidence, decisions and how-tos, linked together.\n\n## Rules\n- No patient identifiers: no names, dates of birth, ID numbers, phone numbers or emails. The app refuses them on save.\n- Player 1 is referred to only as Player 1, and only for programme decisions. His clinical record lives in Records.\n- Link related notes with double square brackets around a title, for example [[Return-to-padel criteria]].\n- Tag notes with a hash, for example #foot or #load.\n\n## Start here\n- [[Return-to-padel criteria]]\n- [[Load monitoring rules]]\n- [[Data and privacy rules]]' },
  { id: 'start-rtp', title: 'Return-to-padel criteria', type: 'protocol', tags: ['return', 'padel'], body: 'The standard the app applies before full padel.\n\n## Testing battery\n- Single-leg calf raises, single-leg balance with eyes closed, single-leg hop, triple hop, 30-second side hop, Y-balance anterior reach.\n- Symmetry = injured side ÷ uninjured side × 100. Every test needs 90% or more.\n- Track the absolute values too: symmetry can flatter when the good side has also weakened.\n\n## On-court readiness\n- Every component rated by a clinician: stroke pain, landing, court movement, agility, endurance.\n- Clears at 80 or more overall, stroke pain 2 or less, and every component 7 or more.\n\n## Always\n- No pain during play or the next morning.\n- Clinician sign-off.\n\nSee [[Load monitoring rules]] for how minutes progress. #return' },
  { id: 'start-load', title: 'Load monitoring rules', type: 'protocol', tags: ['load'], body: 'How the app reads load for Player 1 and the squad.\n\n## What counts\n- Load is minutes on court. Effort is recorded but not multiplied in.\n\n## Ratio\n- Acute (7-day) against chronic (28-day) minutes.\n- Shown and used only after 14 logged days in the last 28. Before that it reads "needs 14 logged days".\n- Above 1.10 the week does not progress. Above 1.25 the session is reduced.\n\n## Missing data\n- No symptom check-in today means Modify, never Ready.\n- Yesterday\'s symptoms never carry over to today.\n\nLinked: [[Return-to-padel criteria]] #load' },
  { id: 'start-privacy', title: 'Data and privacy rules', type: 'protocol', tags: ['privacy'], body: 'How clinical data is handled in Performance Ops.\n\n## Access\n- Player 1 data: JP, Olivia and the team physician only, with two-step sign-in.\n- Sessions end after 15 minutes without activity for anyone with Player 1 access, and when a password or two-step setting changes.\n\n## Storage\n- Clinical data is encrypted at rest on the server and kept on a device only while the tab is open.\n- The records vault is encrypted in the browser with the team passphrase before it is saved.\n- PDFs are read on the device; only the checked summary is saved, encrypted. The file is not kept.\n\n## Never\n- No clinical data in AI tools or chats.\n- No exports of patient data to GitHub, email or messaging apps.\n\nLinked: [[How we use Knowledge]] #privacy' }
];
const KB = { q: '', type: '', sel: null, edit: null, view: 'notes', err: '' };
const kbAll = () => { const own = Object.values(store.get('kb', {}) || {}); const titles = new Set(own.map(n => n.title.toLowerCase())); return own.concat(KB_START.filter(n => !titles.has(n.title.toLowerCase()))); };
const kbFind = t => kbAll().find(n => n.title.toLowerCase() === String(t).trim().toLowerCase());
const kbLinks = n => [...new Set([...(n.body || '').matchAll(/\[\[([^\]]{1,120})\]\]/g)].map(m => m[1].trim()))];
const kbBack = n => kbAll().filter(x => x.id !== n.id && kbLinks(x).some(t => t.toLowerCase() === n.title.toLowerCase()));
const kbCanEdit = () => me().role !== 'athlete';
/* identifiers we refuse: anything that would put a patient in this note */
function kbGuard(text) {
  const hits = [];
  if (/\b784[- ]?\d{4}[- ]?\d{7}[- ]?\d\b/.test(text)) hits.push('an Emirates ID number');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) hits.push('an email address');
  if (/(\+971|00971)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b|\b0[2-9]\d?[\s-]?\d{3}[\s-]?\d{4}\b/.test(text)) hits.push('a phone number');
  if (/\b(dob|date of birth|born on)\b/i.test(text)) hits.push('a date of birth');
  if (/\b(passport|mrn|medical record number)\b/i.test(text)) hits.push('an ID or record number');
  const names = ATH.filter(a => a.id !== 'p1').map(a => a.name).filter(Boolean);
  for (const n of names) if (text.toLowerCase().includes(n.toLowerCase())) hits.push('an athlete\'s name (' + n + ')');
  return hits;
}
function kbRender(body) {
  const lines = esc(body || '').split('\n'), out = []; let list = null;
  const inline = s => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[\[([^\]]{1,120})\]\]/g, (m, t) => { const n = kbFind(t); return n ? `<button class="kb-link" data-kb="open" data-arg="${esc(n.id)}">${t}</button>` : `<span class="kb-link missing" title="No note with this title yet">${t}</span>`; }).replace(/(^|\s)#([a-z0-9-]{2,30})/gi, '$1<button class="kb-tag" data-kb="tag" data-arg="$2">#$2</button>');
  for (const l of lines) {
    const li = l.match(/^\s*(?:-|\d+\.)\s+(.*)$/);
    if (li) { if (!list) { list = []; } list.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (/^##\s+/.test(l)) out.push(`<h3>${inline(l.replace(/^##\s+/, ''))}</h3>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('');
}
function kbList() {
  const q = KB.q.toLowerCase();
  return kbAll().filter(n => (!KB.type || n.type === KB.type) && (!q || (n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q)))
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || a.title.localeCompare(b.title));
}
function pageKB() {
  const all = kbAll(), list = kbList(), sel = all.find(n => n.id === KB.sel) || null, tcol = t => (KB_TYPES.find(x => x[0] === t) || [0, 0, '#64748b'])[2];
  const head = `<div class="sec-head"><div><span class="eyebrow">Team second brain · staff only · encrypted · no patient identifiers</span><h1 style="font-size:34px;letter-spacing:-.6px">Knowledge</h1></div>
    <div class="pills"><div class="seg" role="group" aria-label="View"><button data-kb="view" data-arg="notes" aria-pressed="${KB.view === 'notes'}">Notes</button><button data-kb="view" data-arg="graph" aria-pressed="${KB.view === 'graph'}">Graph</button></div>${kbCanEdit() ? '<button class="btn primary" data-kb="new">New note</button>' : ''}</div></div>`;
  const side = `<aside class="kb-side"><label class="an-search">${anSvg('search', 16)}<input id="kb-q" placeholder="Search notes, tags, text" value="${esc(KB.q)}" autocomplete="off"></label>
    <div class="pills">${[['', 'All']].concat(KB_TYPES.map(t => [t[0], t[1]])).map(([k, l]) => `<button class="pill" data-kb="type" data-arg="${k}" aria-pressed="${KB.type === k}">${l}</button>`).join('')}</div>
    <div class="kb-list">${list.map(n => `<button class="kb-row${n.id === KB.sel ? ' on' : ''}" data-kb="open" data-arg="${esc(n.id)}"><i style="background:${tcol(n.type)}"></i><span class="grow"><b>${esc(n.title)}</b><em>${esc((KB_TYPES.find(t => t[0] === n.type) || [0, ''])[1])}${n.id.startsWith('start-') ? ' · team standard' : n.updated ? ' · ' + esc(n.updated.slice(0, 10)) : ''}${kbBack(n).length ? ' · ' + kbBack(n).length + ' linked' : ''}</em></span></button>`).join('') || '<p class="muted" style="font-size:13px">No notes match.</p>'}</div></aside>`;
  let main;
  if (KB.view === 'graph') main = `<section class="panel kb-graph"><canvas id="kb-cv" aria-label="Graph of notes and their links" role="img"></canvas><div class="kb-legend">${KB_TYPES.map(t => `<span><i style="background:${t[2]}"></i>${t[1]}</span>`).join('')}</div><p class="muted" style="margin:0;font-size:12.5px">Each dot is a note; lines are [[links]]. Tap a dot to open it.</p></section>`;
  else if (KB.edit) { const e = KB.edit;
    main = `<form class="panel kb-edit" data-kbf="save"><div class="grid3" style="gap:12px;grid-template-columns:2fr 1fr"><label class="field">Title<input name="title" required maxlength="120" value="${esc(e.title || '')}"></label><label class="field">Type<select name="type" id="kb-type">${KB_TYPES.map(t => `<option value="${t[0]}" ${e.type === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label></div>
      <label class="field">Note<textarea name="body" rows="16" id="kb-body" placeholder="Write here. Link with [[Note title]], tag with #tag.">${esc(e.body || KB_TPL[e.type || 'protocol'])}</textarea></label>
      <label class="field">Tags (comma separated)<input name="tags" value="${esc((e.tags || []).join(', '))}"></label>
      ${KB.err ? `<p class="verr">${esc(KB.err)}</p>` : ''}<p class="muted" style="margin:0;font-size:12.5px">Saved encrypted for staff only. Names, dates of birth, ID numbers, phone numbers and emails are refused.</p>
      <div class="pills"><button class="btn primary" type="submit">Save note</button><button class="btn" type="button" data-kb="cancel">Cancel</button>${e.id && !e.id.startsWith('start-') ? `<button class="btn" type="button" data-kb="delete" data-arg="${esc(e.id)}">Delete</button>` : ''}</div></form>`; }
  else if (sel) { const back = kbBack(sel), out = kbLinks(sel);
    main = `<article class="panel kb-note"><div class="sec-head"><div><span class="eyebrow" style="color:${tcol(sel.type)}">${esc((KB_TYPES.find(t => t[0] === sel.type) || [0, ''])[1])}${sel.id.startsWith('start-') ? ' · team standard enforced by the app' : sel.by ? ' · ' + esc(sel.by) + ' · ' + esc((sel.updated || '').slice(0, 10)) : ''}</span><h2>${esc(sel.title)}</h2></div>${kbCanEdit() ? `<button class="btn sm" data-kb="edit" data-arg="${esc(sel.id)}">${sel.id.startsWith('start-') ? 'Make an editable copy' : 'Edit'}</button>` : ''}</div>
      <div class="kb-body">${kbRender(sel.body)}</div>${(sel.tags || []).length ? `<div class="pills">${sel.tags.map(t => `<button class="pill" data-kb="tag" data-arg="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="kb-links"><div><span class="eyebrow">Links to</span>${out.length ? out.map(t => { const n = kbFind(t); return n ? `<button class="kb-link" data-kb="open" data-arg="${esc(n.id)}">${esc(t)}</button>` : `<span class="kb-link missing">${esc(t)}</span>`; }).join('') : '<span class="muted">nothing yet</span>'}</div>
        <div><span class="eyebrow">Linked from</span>${back.length ? back.map(n => `<button class="kb-link" data-kb="open" data-arg="${esc(n.id)}">${esc(n.title)}</button>`).join('') : '<span class="muted">nothing yet</span>'}</div></div></article>`; }
  else main = `<section class="panel"><span class="eyebrow">${all.length} notes</span><h2>Pick a note, or start one</h2><p class="muted" style="margin:0">Start with <button class="kb-link" data-kb="open" data-arg="start-how">How we use Knowledge</button>. Protocols the app enforces are already here as team standards.</p></section>`;
  if (KB.view === 'graph') setTimeout(kbGraph, 30);
  return head + `<div class="kb">${side}<div class="kb-main">${main}</div></div>`;
}
/* graph: a small force layout, notes as dots coloured by type, links as lines */
function kbGraph() {
  const cv = document.getElementById('kb-cv'); if (!cv) return;
  const g = cv.getContext('2d'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = r.width * dpr; cv.height = r.height * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, notes = kbAll(), idx = new Map(notes.map((n, i) => [n.id, i]));
  const N = notes.map((n, i) => ({ n, x: W / 2 + Math.cos(i * 2.4) * (60 + i * 9), y: H / 2 + Math.sin(i * 2.4) * (60 + i * 9), vx: 0, vy: 0 }));
  const E = []; notes.forEach((n, i) => kbLinks(n).forEach(t => { const m = kbFind(t); if (m && idx.has(m.id)) E.push([i, idx.get(m.id)]); }));
  for (let it = 0; it < 260; it++) {
    for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) { const dx = N[b].x - N[a].x, dy = N[b].y - N[a].y, d2 = dx * dx + dy * dy + 0.01, f = 2600 / d2; N[a].vx -= dx * f / 60; N[a].vy -= dy * f / 60; N[b].vx += dx * f / 60; N[b].vy += dy * f / 60; }
    for (const [a, b] of E) { const dx = N[b].x - N[a].x, dy = N[b].y - N[a].y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 110) * 0.02; N[a].vx += dx / d * f; N[a].vy += dy / d * f; N[b].vx -= dx / d * f; N[b].vy -= dy / d * f; }
    for (const p of N) { p.vx += (W / 2 - p.x) * 0.004; p.vy += (H / 2 - p.y) * 0.004; p.x = Math.max(20, Math.min(W - 20, p.x + p.vx)); p.y = Math.max(20, Math.min(H - 20, p.y + p.vy)); p.vx *= 0.6; p.vy *= 0.6; }
  }
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink').trim() || '#111', mute = css.getPropertyValue('--ink-3').trim() || '#888';
  g.clearRect(0, 0, W, H); g.strokeStyle = mute; g.globalAlpha = 0.5; g.lineWidth = 1;
  for (const [a, b] of E) { g.beginPath(); g.moveTo(N[a].x, N[a].y); g.lineTo(N[b].x, N[b].y); g.stroke(); }
  g.globalAlpha = 1; g.font = '500 12px system-ui, sans-serif'; g.textAlign = 'center';
  for (const p of N) { const deg = E.filter(e => e[0] === N.indexOf(p) || e[1] === N.indexOf(p)).length, rr = 5 + Math.min(8, deg * 1.5);
    g.fillStyle = (KB_TYPES.find(t => t[0] === p.n.type) || [0, 0, mute])[2]; g.beginPath(); g.arc(p.x, p.y, rr, 0, 6.283); g.fill(); g.fillStyle = ink; g.fillText(p.n.title.length > 28 ? p.n.title.slice(0, 26) + '…' : p.n.title, p.x, p.y + rr + 13); }
  cv.onclick = e => { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; const hit = N.find(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 196); if (hit) { KB.sel = hit.n.id; KB.view = 'notes'; KB.edit = null; keepRender(); } };
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-kb]'); if (!t) return; const k = t.dataset.kb, a = t.dataset.arg;
  if (k === 'open') { KB.sel = a; KB.edit = null; KB.view = 'notes'; if (S.route !== 'kb') { location.hash = 'kb'; return; } }
  else if (k === 'view') { KB.view = a; KB.edit = null; }
  else if (k === 'type') KB.type = a;
  else if (k === 'tag') { KB.q = '#' + a; KB.view = 'notes'; }
  else if (k === 'new') { KB.edit = { type: 'protocol', tags: [] }; KB.err = ''; KB.view = 'notes'; }
  else if (k === 'edit') { const n = kbAll().find(x => x.id === a); KB.edit = Object.assign({}, n, n.id.startsWith('start-') ? { id: null, title: n.title } : {}); KB.err = ''; }
  else if (k === 'cancel') { KB.edit = null; KB.err = ''; }
  else if (k === 'delete') { const m = Object.assign({}, store.get('kb', {})); const title = (m[a] || {}).title; delete m[a]; store.set('kb', m); audit('Deleted a knowledge note', title || a); KB.edit = null; KB.sel = null; toast('Note deleted'); }
  keepRender();
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'kb-type') { const b = document.getElementById('kb-body'); if (b && (!b.value.trim() || Object.values(KB_TPL).includes(b.value))) b.value = KB_TPL[e.target.value]; } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'kb-q') { KB.q = e.target.value; const y = scrollY; keepRender(); scrollTo(0, y); const q = document.getElementById('kb-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-kbf]'); if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f)), hits = kbGuard(d.title + '\n' + d.body + '\n' + d.tags);
  if (hits.length) { KB.err = 'Not saved: the note contains ' + [...new Set(hits)].join(', ') + '. Remove it; clinical details belong in Records.'; keepRender(); return; }
  const m = Object.assign({}, store.get('kb', {})), id = (KB.edit && KB.edit.id) || 'n' + Date.now().toString(36);
  const clash = Object.values(m).find(n => n.id !== id && n.title.toLowerCase() === d.title.trim().toLowerCase());
  if (clash) { KB.err = 'Another note already has this title. Pick a different one so links stay unambiguous.'; keepRender(); return; }
  m[id] = { id, title: d.title.trim(), type: d.type, body: d.body, tags: d.tags.split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean).slice(0, 12), by: me().name, at: (m[id] && m[id].at) || new Date().toISOString(), updated: new Date().toISOString() };
  store.set('kb', m); audit(KB.edit && KB.edit.id ? 'Edited a knowledge note' : 'Added a knowledge note', m[id].title); KB.edit = null; KB.sel = id; KB.err = ''; toast('Saved, encrypted, staff only'); keepRender();
});
window.__kb = { kbGuard, kbRender, kbLinks };
