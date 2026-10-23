/* ---------- Records vault: an encrypted patient record. Everything clinical is encrypted in the browser (AES-256-GCM, key from a team passphrase via PBKDF2-SHA-256, 310,000 rounds) before it is saved; the store only ever holds ciphertext. Every unlock, open, save, sign and amendment is written to the audit log by patient code, never by name. ---------- */
const VAULT = { key: null, meta: undefined, lockAt: 0, idleMs: 10 * 60 * 1000, patients: [], recs: [], sel: null, tab: 'notes', edit: null, q: '', busy: false, err: '', mem: {}, audit: [] };
const V_IT = 310000;
const vb64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const vub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const vRole = () => ['lead', 'physio', 'physician'].includes(me().role);
/* storage adapter: the artifact's shared store when present, otherwise memory (demo) */
const VDB = {
  live: () => !!(typeof AG !== 'undefined' && AG.cap && AG.cap.db && AG.cap.db.collection),
  async get(col, id) { if (this.live()) { const s = await AG.cap.db.doc(col + '/' + id).get(); return s.exists ? s.data() : null; } return (VAULT.mem[col] || {})[id] || null; },
  async set(col, id, data) { if (this.live()) return AG.cap.db.doc(col + '/' + id).set(data); (VAULT.mem[col] = VAULT.mem[col] || {})[id] = JSON.parse(JSON.stringify(data)); },
  async add(col, data) { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); await this.set(col, id, data); return id; },
  async list(col, n) { if (this.live()) { const s = await AG.cap.db.collection(col).orderBy('at', 'desc').limit(n || 500).get(); return s.docs.map(d => Object.assign({ id: d.id }, d.data())); } return Object.entries(VAULT.mem[col] || {}).map(([id, d]) => Object.assign({ id }, d)).sort((a, b) => (b.at || '').localeCompare(a.at || '')); }
};
async function vKek(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: V_IT }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}
async function vEnc(obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, VAULT.key, new TextEncoder().encode(JSON.stringify(obj))); return { iv: vb64(iv), ct: vb64(ct) }; }
async function vDec(d) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vub64(d.iv) }, VAULT.key, vub64(d.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
async function vAudit(action, target) { const e = { at: new Date().toISOString(), by: (typeof AG !== 'undefined' && AG.me) || me().id, who: me().name, action, target: target || '' }; VAULT.audit.unshift(e); try { await VDB.add('audit', e); } catch (x) { } }
async function vLoadMeta() { try { VAULT.meta = await VDB.get('vault', 'meta'); } catch (e) { VAULT.meta = null; VAULT.err = e && e.code === 'not_granted' ? 'Your access level cannot open the records vault.' : ''; } }
async function vCreate(p1, p2) {
  if (p1.length < 12) throw new Error('Use at least 12 characters. A short sentence works well.');
  if (p1 !== p2) throw new Error('The two passphrases do not match.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), kek = await vKek(p1, salt);
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const wiv = crypto.getRandomValues(new Uint8Array(12)), wrapped = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: wiv });
  VAULT.meta = { salt: vb64(salt), wiv: vb64(wiv), wrapped: vb64(wrapped), kdf: 'PBKDF2-SHA-256', iterations: V_IT, alg: 'AES-256-GCM', at: new Date().toISOString(), by: me().name };
  await VDB.set('vault', 'meta', VAULT.meta);
  await vUnlock(p1, true);
}
async function vUnlock(pass, fresh) {
  const m = VAULT.meta; const kek = await vKek(pass, vub64(m.salt));
  try { VAULT.key = await crypto.subtle.unwrapKey('raw', vub64(m.wrapped), kek, { name: 'AES-GCM', iv: vub64(m.wiv) }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
  catch (e) { await vAudit('Failed unlock attempt'); throw new Error('That passphrase does not open the vault.'); }
  VAULT.lockAt = Date.now() + VAULT.idleMs; await vAudit(fresh ? 'Vault created and unlocked' : 'Vault unlocked'); await vRefresh();
}
function vLock(why) { VAULT.key = null; VAULT.patients = []; VAULT.recs = []; VAULT.sel = null; VAULT.edit = null; if (why) toast(why); if (['records', 'p1rec'].includes(S.route)) keepRender(); }
async function vNewPatient(d) { const id = vCode(); const env = await vEnc(Object.assign({ created: new Date().toISOString() }, d)); await VDB.set('emr_patients', id, Object.assign({ at: new Date().toISOString(), by: me().id }, env)); await vAudit('Created a record', id); await vRefresh(); VAULT.sel = id; VAULT.creating = false; }
async function vRefresh() {
  if (!VAULT.key) return;
  const ps = await VDB.list('emr_patients'), rs = await VDB.list('emr');
  VAULT.patients = (await Promise.all(ps.map(async p => { try { return Object.assign({ id: p.id, at: p.at }, await vDec(p)); } catch (e) { return null; } }))).filter(Boolean);
  VAULT.recs = (await Promise.all(rs.map(async r => { try { return Object.assign({ id: r.id, pid: r.pid, kind: r.kind, at: r.at, by: r.by, signed: r.signed, signedAt: r.signedAt, amends: r.amends || null }, await vDec(r)); } catch (e) { return null; } }))).filter(Boolean);
  try { VAULT.audit = (await VDB.list('audit', 200)); } catch (e) { }
}
/* idle lock */
['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, () => { if (VAULT.key) VAULT.lockAt = Date.now() + VAULT.idleMs; }, { passive: true }));
setInterval(() => { if (VAULT.key && Date.now() > VAULT.lockAt) vLock('Records locked after 10 minutes without activity'); const t = document.getElementById('v-timer'); if (t && VAULT.key) { const s = Math.max(0, Math.round((VAULT.lockAt - Date.now()) / 1000)); t.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); } }, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden && VAULT.key) VAULT.lockAt = Math.min(VAULT.lockAt, Date.now() + 2 * 60 * 1000); });
const vCode = () => 'PT-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const vAge = d => { if (!d) return ''; const b = new Date(d), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return isFinite(a) ? a + ' y' : ''; };
function pageRecords(scope) {
  const head = scope === 'p1' ? p1Head('p1rec', 'Records', 'encrypted clinical record') : `<div class="sec-head"><div><span class="eyebrow">${lockIcon} Encrypted on this device · AES-256 · every opening logged</span><h1>Patient records</h1></div></div>`;
  if (!vRole()) return head + `<section class="panel"><p class="muted" style="margin:0">Records are open to the clinical team only.</p></section>`;
  if (VAULT.meta === undefined) { vLoadMeta().then(() => keepRender()); return head + '<section class="panel"><p class="muted" style="margin:0">Opening the vault…</p></section>'; }
  if (!VAULT.key) return head + vLockScreen();
  return head + vWorkspace(scope);
}
function vLockScreen() {
  const create = !VAULT.meta;
  return `<section class="cmd vlock"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">${lockIcon} Records vault · ${VDB.live() ? 'shared store' : 'demo storage, clears on reload'}</span><span class="cmd-tag">${create ? 'Set the team passphrase.' : 'Private by design.'}</span><h1 class="cmd-word" style="font-size:clamp(48px,6vw,88px)">${create ? 'Create the vault' : 'Unlock records'}</h1>
      <p class="cmd-why">${create ? 'Choose a passphrase for JP, Olivia and the physician. It never leaves this device and cannot be recovered, so store it in a password manager. Records are encrypted with it before they are saved.' : 'Enter the team passphrase. Records decrypt only on this device and lock again after 10 minutes without activity.'}</p>
      <form class="vform" data-v="${create ? 'create' : 'unlock'}" autocomplete="off"><input type="password" id="v-p1" placeholder="${create ? 'New passphrase (12 characters or more)' : 'Team passphrase'}" autocomplete="${create ? 'new-password' : 'current-password'}" aria-label="Passphrase">${create ? '<input type="password" id="v-p2" placeholder="Type it again" autocomplete="new-password" aria-label="Confirm passphrase">' : ''}<button class="btn primary" type="submit" ${VAULT.busy ? 'disabled' : ''}>${VAULT.busy ? 'Working…' : create ? 'Create and unlock' : 'Unlock'}</button></form>
      ${VAULT.err ? `<p class="verr">${esc(VAULT.err)}</p>` : ''}
      <div class="cmd-chips"><span class="cmd-chip"><em>Cipher</em>AES-256-GCM</span><span class="cmd-chip"><em>Key</em>PBKDF2 · 310,000 rounds</span><span class="cmd-chip"><em>Audit</em>every opening logged</span></div></div></section>`;
}
function vWorkspace(scope) {
  let pts = VAULT.patients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  let only = null;
  if (scope === 'p1') { only = pts.find(x => x.athlete === 'p1') || null; if (only) VAULT.sel = only.id; pts = only ? [only] : []; }
  if (VAULT.q) pts = pts.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(VAULT.q.toLowerCase()));
  const P = scope === 'p1' ? only : VAULT.patients.find(p => p.id === VAULT.sel);
  const bar = `<div class="vbar"><span class="chip c-ok">${lockIcon} Unlocked</span><span class="muted">Locks in <b id="v-timer" class="num">10:00</b></span>${VDB.live() ? '' : '<span class="chip c-warn">Demo storage: data clears on reload</span>'}<span class="grow"></span><button class="btn sm" data-v="lock">Lock now</button></div>`;
  if (scope === 'p1' && !P) return bar + `<section class="panel"><h3>No record for Player 1 yet</h3><p class="muted" style="margin:0">Create his record. His name is encrypted; the store sees only a code.</p><button class="btn primary" data-v="newp1">Create Player 1's record</button></section>`;
  const list = scope === 'p1' ? '' : `<aside class="vlist"><label class="an-search">${anSvg('search', 16)}<input id="v-q" placeholder="Search patients" value="${esc(VAULT.q)}" autocomplete="off"></label><button class="btn primary sm" data-v="newp">New patient</button>
    <div class="vrows">${pts.map(p => `<button class="vrow${p.id === VAULT.sel ? ' on' : ''}" data-v="open" data-arg="${p.id}"><span class="av">${esc((p.name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><span class="grow"><b>${esc(p.name || 'Unnamed')}</b><em>${p.id}${p.sport ? ' · ' + esc(p.sport) : ''}</em></span></button>`).join('') || '<p class="muted" style="font-size:13px">No patients yet.</p>'}</div></aside>`;
  return bar + `<div class="vgrid${scope === 'p1' ? ' solo' : ''}">${list}<section class="vmain">${VAULT.creating ? `<form class="panel vform2" data-v="createp"><h3>New patient</h3><p class="muted" style="margin:0;font-size:13px">Everything here is encrypted before it is saved. The store sees only a code like PT-7KQ2.</p><div class="grid3" style="gap:12px"><label class="field">Full name<input name="name" required></label><label class="field">Date of birth<input name="dob" type="date"></label><label class="field">Sport<input name="sport" value="Padel"></label></div><div class="pills"><button class="btn primary" type="submit">Create encrypted record</button><button class="btn" type="button" data-v="cancelp">Cancel</button></div></form>` : P ? vPatient(P) : '<div class="panel"><p class="muted" style="margin:0">Choose a patient or create one.</p></div>'}</section></div>`;
}
function vPatient(P) {
  const recs = VAULT.recs.filter(r => r.pid === P.id);
  const tabs = [['notes', 'Notes', recs.filter(r => r.kind === 'note').length], ['injuries', 'Injuries', recs.filter(r => r.kind === 'injury').length], ['consent', 'Consent', recs.filter(r => r.kind === 'consent').length], ['audit', 'Access log', VAULT.audit.filter(a => a.target === P.id).length]];
  let body = '';
  if (VAULT.tab === 'notes') {
    const notes = recs.filter(r => r.kind === 'note');
    body = (VAULT.edit ? vEditor(P) : `<button class="btn primary" data-v="newnote">New SOAP note</button>`) + notes.map(n => { const am = notes.filter(x => x.amends === n.id);
      return `<article class="panel vnote${n.signed ? ' signed' : ''}"><div class="sec-head"><div><span class="eyebrow">${new Date(n.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${esc(n.author || '')}${n.amends ? ' · amendment' : ''}</span><h3>${esc(n.title || 'SOAP note')}</h3></div>${n.signed ? `<span class="chip c-ok">Signed ${new Date(n.signedAt).toLocaleDateString('en-GB')}</span>` : '<span class="chip c-warn">Draft</span>'}</div>
        <div class="facts">${[['Subjective', n.s], ['Objective', n.o], ['Assessment', n.a], ['Plan', n.p]].filter(x => x[1]).map(x => `<div><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('')}</div>
        <div class="pills">${n.signed ? `<button class="btn sm" data-v="amend" data-arg="${n.id}">Amend</button>` : `<button class="btn sm" data-v="editnote" data-arg="${n.id}">Edit</button><button class="btn sm primary" data-v="sign" data-arg="${n.id}">Sign</button>`}${am.length ? `<span class="muted" style="font-size:12.5px">${am.length} amendment${am.length > 1 ? 's' : ''} below</span>` : ''}</div></article>`; }).join('');
  }
  if (VAULT.tab === 'injuries') body = `<form class="panel vform2" data-v="addinj"><h3>Add an injury</h3><div class="grid3" style="gap:12px"><label class="field">Structure<input name="structure" required placeholder="e.g. Spring ligament"></label><label class="field">Side<select name="side"><option>Right</option><option>Left</option><option>Both</option><option>Not applicable</option></select></label><label class="field">Grade<select name="grade"><option>1</option><option>2</option><option>3</option><option>Not graded</option></select></label><label class="field">Onset<input name="onset" type="date"></label><label class="field">Status<select name="status"><option>Active</option><option>Rehab</option><option>Resolved</option></select></label><label class="field">Mechanism<input name="mechanism" placeholder="How it happened"></label></div><button class="btn primary" type="submit">Save encrypted</button></form>
    <div class="rows">${recs.filter(r => r.kind === 'injury').map(r => `<div class="row" style="font-size:13.5px"><span class="grow"><b>${esc(r.structure)}</b> · ${esc(r.side)} · grade ${esc(r.grade)}<br><span class="muted">${esc(r.mechanism || '')}${r.onset ? ' · onset ' + esc(r.onset) : ''}</span></span><span class="chip ${r.status === 'Resolved' ? 'c-ok' : r.status === 'Rehab' ? 'c-warn' : 'c-risk'}">${esc(r.status)}</span>${(DB[(r.structure || '').toLowerCase().replace(/ /g, '_')]) ? '' : ''}</div>`).join('')}</div>`;
  if (VAULT.tab === 'consent') body = `<form class="panel vform2" data-v="addcon"><h3>Record consent</h3><div class="grid3" style="gap:12px"><label class="field">Consent for<select name="type"><option>Assessment and treatment</option><option>Data storage in this app</option><option>Sharing with coaches</option><option>Photos and video</option><option>Research use, anonymised</option></select></label><label class="field">Given<select name="given"><option>Yes</option><option>No</option><option>Withdrawn</option></select></label><label class="field">Date<input name="date" type="date" required></label></div><button class="btn primary" type="submit">Save encrypted</button></form>
    <div class="rows">${recs.filter(r => r.kind === 'consent').map(r => `<div class="row" style="font-size:13.5px"><span class="grow"><b>${esc(r.type)}</b><br><span class="muted">${esc(r.date)} · recorded by ${esc(r.author || '')}</span></span><span class="chip ${r.given === 'Yes' ? 'c-ok' : 'c-risk'}">${esc(r.given)}</span></div>`).join('')}</div>`;
  if (VAULT.tab === 'audit') body = `<div class="rows">${VAULT.audit.filter(a => a.target === P.id || a.target === '').slice(0, 40).map(a => `<div class="row" style="font-size:13px"><span class="grow"><b>${esc(a.action)}</b>${a.target ? ' · ' + esc(a.target) : ''}</span><span class="muted">${esc(a.who || '')}</span><span class="muted num">${new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div><p class="muted" style="font-size:12.5px;margin:0">The log stores the patient code only, never the name.</p>`;
  return `<header class="vhead"><span class="av av-lg">${esc((P.name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><div class="grow"><h2>${esc(P.name || 'Unnamed')}</h2><span class="muted">${P.id}${P.dob ? ' · ' + vAge(P.dob) : ''}${P.sport ? ' · ' + esc(P.sport) : ''}${P.athlete === 'p1' ? ' · Player 1' : ''}</span></div><span class="chip plain c-muted">${lockIcon} Encrypted</span></header>
    <nav class="seg" aria-label="Record sections">${tabs.map(([k, l, n]) => `<button data-v="tab" data-arg="${k}" aria-pressed="${VAULT.tab === k}">${l}${n ? ` <span class="num muted">${n}</span>` : ''}</button>`).join('')}</nav><div class="stack" style="gap:14px">${body}</div>`;
}
function vEditor(P) {
  const e = VAULT.edit || {};
  return `<form class="panel vform2 vedit" data-v="savenote"><div class="sec-head"><h3>${e.amends ? 'Amendment' : e.id ? 'Edit draft' : 'New SOAP note'}</h3><label class="field" style="min-width:240px">Template<select id="v-tpl"><option value="">Choose a template</option>${SOAP_T.map((t, i) => `<option value="${i}">${esc(t[0])}</option>`).join('')}</select></label></div>
    <label class="field">Title<input name="title" value="${esc(e.title || '')}" placeholder="e.g. Week 5 review, right arch"></label>
    ${[['s', 'Subjective'], ['o', 'Objective'], ['a', 'Assessment'], ['p', 'Plan']].map(([k, l]) => `<label class="field">${l}<textarea name="${k}" rows="3">${esc(e[k] || '')}</textarea></label>`).join('')}
    <div class="pills"><button class="btn primary" type="submit">Save draft, encrypted</button><button class="btn" type="button" data-v="cancel">Cancel</button></div></form>`;
}
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-v]'); if (!f) return; e.preventDefault(); const k = f.dataset.v; VAULT.err = '';
  try {
    if (k === 'create' || k === 'unlock') { const p1 = (document.getElementById('v-p1') || {}).value || '', p2 = (document.getElementById('v-p2') || {}).value || ''; VAULT.busy = true; keepRender(); if (k === 'create') await vCreate(p1, p2); else await vUnlock(p1); }
    else if (k === 'createp') { const d = Object.fromEntries(new FormData(f)); await vNewPatient(d); toast('Record created, encrypted'); }
    else if (k === 'savenote') { const d = Object.fromEntries(new FormData(f)); const P = VAULT.sel; const data = Object.assign({}, d, { author: me().name });
      const env = await vEnc(data), meta = { pid: P, kind: 'note', at: VAULT.edit && VAULT.edit.id ? VAULT.edit.at : new Date().toISOString(), by: me().id, signed: false, amends: VAULT.edit && VAULT.edit.amends || null };
      if (VAULT.edit && VAULT.edit.id) await VDB.set('emr', VAULT.edit.id, Object.assign(meta, env)); else await VDB.add('emr', Object.assign(meta, env));
      await vAudit(VAULT.edit && VAULT.edit.amends ? 'Amended a note' : VAULT.edit && VAULT.edit.id ? 'Edited a draft note' : 'Created a note', P); VAULT.edit = null; await vRefresh(); toast('Saved, encrypted'); }
    else if (k === 'addinj' || k === 'addcon') { const d = Object.fromEntries(new FormData(f)); const env = await vEnc(Object.assign(d, { author: me().name })); await VDB.add('emr', Object.assign({ pid: VAULT.sel, kind: k === 'addinj' ? 'injury' : 'consent', at: new Date().toISOString(), by: me().id }, env)); await vAudit(k === 'addinj' ? 'Added an injury' : 'Recorded consent', VAULT.sel); await vRefresh(); toast('Saved, encrypted'); }
  } catch (err) { VAULT.err = err.message || 'Something went wrong'; if (k === 'savenote' || k === 'addinj' || k === 'addcon') toast(VAULT.err); }
  VAULT.busy = false; keepRender();
});
document.addEventListener('click', async e => {
  const t = e.target.closest('button[data-v]'); if (!t) return; const k = t.dataset.v, a = t.dataset.arg;
  try {
    if (k === 'lock') { await vAudit('Vault locked'); vLock(); return; }
    if (k === 'open') { VAULT.sel = a; VAULT.edit = null; VAULT.tab = 'notes'; await vAudit('Opened record', a); }
    if (k === 'tab') VAULT.tab = a;
    if (k === 'newp') { VAULT.creating = true; VAULT.sel = null; }
    if (k === 'newp1') await vNewPatient({ name: 'Player 1', athlete: 'p1', sport: 'Padel' });
    if (k === 'newnote') VAULT.edit = {};
    if (k === 'editnote') VAULT.edit = VAULT.recs.find(r => r.id === a);
    if (k === 'amend') { const n = VAULT.recs.find(r => r.id === a); VAULT.edit = { amends: a, title: 'Amendment to ' + (n.title || 'note'), s: n.s, o: n.o, a: n.a, p: n.p }; }
    if (k === 'cancel') VAULT.edit = null;
    if (k === 'cancelp') VAULT.creating = false;
    if (k === 'sign') { const n = VAULT.recs.find(r => r.id === a); const { id, pid, kind, at, by, signed, signedAt, amends, ...body } = n; const env = await vEnc(body); await VDB.set('emr', a, Object.assign({ pid, kind, at, by, amends: amends || null, signed: true, signedAt: new Date().toISOString(), signedBy: me().id }, env)); await vAudit('Signed a note', pid); await vRefresh(); toast('Signed. The note is now read-only; changes are made as amendments.'); }
  } catch (err) { toast(err.message || 'Could not do that'); }
  keepRender();
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'v-q') { VAULT.q = e.target.value; const y = scrollY; keepRender(); scrollTo(0, y); const q = document.getElementById('v-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'v-tpl' && e.target.value !== '') { const t = SOAP_T[+e.target.value], f = e.target.closest('form'); ['s', 'o', 'a', 'p'].forEach((k, i) => { const el = f.querySelector(`[name="${k}"]`); if (el && !el.value) el.value = t[i + 1]; }); const ti = f.querySelector('[name="title"]'); if (ti && !ti.value) ti.value = t[0]; } });
window.__V = VAULT;
