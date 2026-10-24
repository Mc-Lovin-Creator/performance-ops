/* ---------- Backend sync (production): sign-in, pull on start, push every save, poll for colleagues' changes.
   Active only when the page is served with a backend URL (window.PLOS_API). The published demo has none and stays local. ---------- */
const SYNC = (() => {
  const raw = window.PLOS_API || '', API = raw && raw.indexOf('%') !== 0 ? raw.replace(/\/$/, '') : '';
  const ss = { get: k => { try { return JSON.parse(sessionStorage.getItem('plos.' + k)); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem('plos.' + k, JSON.stringify(v)); } catch (e) { } } };
  const S2 = { on: !!API, token: ss.get('token'), user: ss.get('user'), ver: ss.get('ver') || {}, rv: ss.get('rv') || {}, timers: {}, pending: {} };
  const req = async (method, path, body) => {
    const r = await fetch(API + '/api' + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, S2.token ? { authorization: 'Bearer ' + S2.token } : {}), body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && path !== '/auth/login') { signOut(true); throw new Error('signed out'); }
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, body: j };
  };
  const clearLocal = () => { try { Object.keys(localStorage).filter(k => k.indexOf('plos.') === 0 || k.indexOf('plosSnap.') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) { } };
  function signOut(expired) { try { ['token', 'user', 'ver', 'rv'].forEach(k => sessionStorage.removeItem('plos.' + k)); } catch (e) { } clearLocal(); location.reload(); }
  async function pull(apply) {
    const r = await req('GET', '/state'); if (!r.ok) return [];
    const changed = [];
    for (const [k, d] of Object.entries(r.body.state || {})) {
      if ((S2.ver[k] || 0) < d.version) { changed.push(k); if (apply) { try { localStorage.setItem('plos.' + k, JSON.stringify(d.value)); } catch (e) { } snapSet(k, d.value); S2.ver[k] = d.version; (S2.rv = S2.rv || {})[k] = d.rv || {}; } }
    }
    if (apply) { ss.set('ver', S2.ver); ss.set('rv', S2.rv || {}); } return changed;
  }
  const snapGet = k => { try { return JSON.parse(localStorage.getItem('plosSnap.' + k)); } catch (e) { return null; } };
  const snapSet = (k, v) => { try { localStorage.setItem('plosSnap.' + k, JSON.stringify(v)); } catch (e) { } };
  const asRecs = v => v && typeof v === 'object' && !Array.isArray(v) ? ['map', v] : Array.isArray(v) && v.every(x => x && typeof x === 'object' && 'id' in x) ? ['list', Object.fromEntries(v.map(x => [String(x.id), x]))] : [null, null];
  async function pushRecords(k, value) {
    const [kind, now] = asRecs(value), [, before] = asRecs(snapGet(k) || (kind === 'map' ? {} : []));
    if (!kind) return false;
    const changes = {}; for (const id of new Set([...Object.keys(now), ...Object.keys(before || {})])) { const a = JSON.stringify(now[id]), b = JSON.stringify((before || {})[id]); if (a !== b) changes[id] = now[id] === undefined ? null : now[id]; }
    if (!Object.keys(changes).length) return true;
    const rv = (S2.rv || {})[k] || {}, base = Object.fromEntries(Object.keys(changes).map(id => [id, rv[id] || 0]));
    const r = await req('PATCH', '/state/' + k + '/records', { kind, changes, base });
    if (r.ok) { (S2.rv = S2.rv || {})[k] = r.body.rv; ss.set('rv', S2.rv); S2.ver[k] = r.body.version; ss.set('ver', S2.ver); snapSet(k, value);
      const nc = Object.keys(r.body.conflicts || {}).length; if (nc) { toast(nc + ' entr' + (nc > 1 ? 'ies were' : 'y was') + ' changed by a colleague at the same time; keeping theirs and reloading.'); localStorage.setItem('plos.' + k, JSON.stringify(r.body.value)); snapSet(k, r.body.value); setTimeout(() => location.reload(), 1600); } else syncBadge('Saved'); return true; }
    if (r.status === 409 && r.body.reason === 'shape') return false;
    handleErr(k, r); return true;
  }
  function handleErr(k, r) {
    if (r.status === 409) toast(r.body.error || 'That clashes with another booking');
    else if (r.status === 403 && r.body.reason === '2fa_required') syncBadge('Turn on two-step sign-in to save Player 1 data');
    else if (r.status === 403) syncBadge('Not shared: you do not have access to save ' + k);
    else if (r.status !== 404) syncBadge('Not saved, will retry');
  }
  function push(k) {
    clearTimeout(S2.timers[k]);
    S2.timers[k] = setTimeout(async () => {
      let value; try { value = JSON.parse(localStorage.getItem('plos.' + k)); } catch (e) { return; }
      try {
        if (await pushRecords(k, value)) return;
        const r = await req('PUT', '/state/' + k, { value, version: S2.ver[k] || 0 });
        if (r.ok) { S2.ver[k] = r.body.version; ss.set('ver', S2.ver); syncBadge('Saved'); }
        else if (r.status === 409 && r.body.reason === 'version') { const cur = r.body.current; if (cur) { localStorage.setItem('plos.' + k, JSON.stringify(cur.value)); S2.ver[k] = cur.version; ss.set('ver', S2.ver); } toast('A colleague changed this a moment ago. Loading their version.'); setTimeout(() => location.reload(), 1400); }
        else handleErr(k, r);
      } catch (e) { syncBadge('Offline: saved on this device'); }
    }, 600);
  }
  function syncBadge(t) { const b = document.getElementById('sync-badge'); if (b) { b.querySelector('em').textContent = t; b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 900); } }
  function loginOverlay(msg) {
    const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<form class="login-c" autocomplete="on"><span class="eyebrow">Performance Ops</span><p class="login-slogan">We keep punching above our weight.</p><h1>Sign in</h1><p class="muted">Private clinical system. Your access is set by your role.</p>
      <label class="field">Email<input name="email" type="email" required autocomplete="username"></label><label class="field">Password<input name="password" type="password" required autocomplete="current-password"></label>
      <label class="field login-code" ${S2.needCode ? '' : 'hidden'}>6-digit code from your authenticator app<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8"></label>
      ${msg ? `<p class="login-err">${esc(msg)}</p>` : ''}<button class="btn primary" type="submit">Sign in</button></form>`;
    document.body.appendChild(o);
    req('GET', '/setup/status').then(r => { if (r.ok && r.body.open) firstLead(o); }).catch(() => { });
    o.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const r = await req('POST', '/auth/login', { email: f.get('email'), password: f.get('password'), code: f.get('code') || undefined });
        if (!r.ok) { S2.needCode = !!r.body.need_code; const em = f.get('email'); o.remove(); loginOverlay(r.body.error || 'Could not sign in'); const n = document.querySelector('.login-c input[name=email]'); if (n) n.value = em; return; }
        clearLocal(); S2.token = r.body.token; S2.user = r.body.user; S2.ver = {}; ss.set('token', S2.token); ss.set('user', S2.user);
        await pull(true); store.set('me', S2.user.person); location.reload();
      } catch (err) { o.remove(); loginOverlay('Cannot reach the server'); }
    });
  }
  function firstLead(o) {
    const c = o.querySelector('.login-c'); const f = document.createElement('form'); f.className = 'login-c first-lead'; f.autocomplete = 'off';
    f.innerHTML = `<span class="eyebrow">Performance Ops · first run</span><p class="login-slogan">We keep punching above our weight.</p><h1>Create the first lead account</h1>
      <p class="muted">This server has no accounts yet. Use the set-up key (SETUP_TOKEN) you added to Emergent. This works once; remove SETUP_TOKEN afterwards.</p>
      <label class="field">Set-up key<input name="setup_token" type="password" required autocomplete="off"></label>
      <label class="field">Your email<input name="email" type="email" required autocomplete="username"></label>
      <label class="field">Your person in the app<select name="person">${(typeof PEOPLE !== 'undefined' ? PEOPLE : []).map(p => `<option value="${esc(p.id)}"${p.id === 'jp' ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field">New password (12+ characters)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
      <label class="field">Again<input name="again" type="password" minlength="12" required autocomplete="new-password"></label><p class="login-err" hidden></p>
      <button class="btn primary" type="submit">Create lead account</button>`;
    c.hidden = true; c.parentNode.insertBefore(f, c);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const d = new FormData(f), er = f.querySelector('.login-err'), show = m => { er.hidden = false; er.textContent = m; };
      if (d.get('password') !== d.get('again')) return show('The two passwords differ');
      const r = await req('POST', '/setup/first-lead', { setup_token: d.get('setup_token'), email: d.get('email'), person: d.get('person'), password: d.get('password') });
      if (!r.ok) return show(r.status === 403 ? 'Wrong set-up key' : r.status === 404 ? 'Set-up is closed: an account already exists' : (r.body.error || 'Not created'));
      const em = d.get('email'); f.remove(); c.hidden = false; const n = c.querySelector('input[name=email]'); if (n) n.value = em;
      const p = document.createElement('p'); p.className = 'login-ok'; p.textContent = 'Lead account created. Now remove SETUP_TOKEN in Emergent, then sign in.'; c.insertBefore(p, c.querySelector('label'));
    });
  }
  async function twoStep() {
    const r = await req('POST', '/auth/2fa/setup'); if (!r.ok) return;
    const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<form class="login-c"><span class="eyebrow">Player 1 access</span><h1>Turn on two-step sign-in</h1>
      <p class="muted">Player 1 data opens only with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).</p>
      <ol class="muted" style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.6"><li>In the app, add an account and choose "enter a setup key".</li><li>Account: ${esc(S2.user.email)}. Key:</li></ol>
      <code class="totp-key">${esc(r.body.secret.replace(/(.{4})/g, '$1 ').trim())}</code>
      <label class="field">Then type the 6-digit code it shows<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></label><p class="login-err" hidden></p>
      <div style="display:flex;gap:8px"><button class="btn primary" type="submit">Turn on</button><button class="btn" type="button" data-later>Later</button></div></form>`;
    document.body.appendChild(o);
    o.querySelector('[data-later]').onclick = () => o.remove();
    o.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const code = new FormData(e.target).get('code'); const x = await req('POST', '/auth/2fa/enable', { code });
      if (x.ok) { S2.user.needs_2fa = false; ss.set('user', S2.user); toast('Two-step sign-in is on. Signing you in again.'); setTimeout(() => signOut(), 1400); }
      else { const er = o.querySelector('.login-err'); er.hidden = false; er.textContent = x.body.error || 'That code did not match'; } });
  }
  async function accounts() {
    const lead = S2.user && S2.user.role === 'lead';
    const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<div class="login-c acct"><span class="eyebrow">Signed in as ${esc(S2.user.email)} · ${esc(S2.user.role)}</span><h1>Account</h1>
      <form data-pw class="acct-f"><b>Change your password</b><label class="field">Current password<input name="old" type="password" required autocomplete="current-password"></label>
      <label class="field">New password (12+ characters)<input name="new" type="password" minlength="12" required autocomplete="new-password"></label><p class="login-err" hidden></p><button class="btn" type="submit">Change password</button></form>
      ${lead ? `<div class="acct-team"><b>Team accounts</b><div data-list class="muted">Loading…</div>
      <form data-add class="acct-f"><b>Add a person</b><label class="field">Email<input name="email" type="email" required autocomplete="off"></label>
      <label class="field">Role<select name="role">${['physio', 'physician', 'coach', 'manager', 'athlete', 'lead'].map(r => `<option>${r}</option>`).join('')}</select></label>
      <label class="field">Person in the app<select name="person">${(typeof PEOPLE !== 'undefined' ? PEOPLE : []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="consent-i"><input type="checkbox" name="p1"><span><b>Player 1 access</b><em>Clinicians only (lead, physio, physician). They must turn on two-step sign-in.</em></span></label>
      <label class="field">Temporary password (12+ characters, give it to them in person; they change it here)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><p class="login-err" hidden></p><button class="btn primary" type="submit">Add</button></form></div>` : ''}
      <div style="display:flex;gap:8px"><button class="btn" type="button" data-close>Close</button></div></div>`;
    document.body.appendChild(o); o.querySelector('[data-close]').onclick = () => o.remove();
    const errIn = (f, m) => { const e = f.querySelector('.login-err'); e.hidden = !m; e.textContent = m || ''; };
    o.querySelector('[data-pw]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); const r = await req('POST', '/auth/password', { old: f.get('old'), new: f.get('new') });
      if (r.ok) { e.target.reset(); errIn(e.target, ''); toast('Password changed'); } else errIn(e.target, r.body.error || 'Not changed'); });
    if (!lead) return;
    const list = async () => { const r = await req('GET', '/users'); const L = o.querySelector('[data-list]'); if (!r.ok) { L.textContent = r.body.error || 'Not available'; return; }
      L.innerHTML = `<div class="acct-l">${r.body.users.map(u => `<div class="acct-r${u.active === false ? ' off' : ''}"><span><b>${esc(u.email)}</b><em>${esc(u.role)} · ${esc(u.person || '')}${u.p1 ? ' · Player 1' : ''}${u.p1 && !u.totp ? ' · two-step OFF' : u.totp ? ' · two-step on' : ''}</em></span>
        ${u.id === S2.user.id ? '<em>you</em>' : `<button class="btn sm" data-act="${u.active === false ? 'on' : 'off'}" data-id="${esc(u.id)}">${u.active === false ? 'Reactivate' : 'Deactivate'}</button>${['lead', 'physio', 'physician'].includes(u.role) ? `<button class="btn sm" data-act="${u.p1 ? 'p1off' : 'p1on'}" data-id="${esc(u.id)}">${u.p1 ? 'Remove Player 1' : 'Give Player 1'}</button>` : ''}`}</div>`).join('')}</div>`; };
    o.querySelector('[data-list]').addEventListener('click', async e => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
      const body = a === 'off' ? { active: false } : a === 'on' ? { active: true } : { p1: a === 'p1on' }; const r = await req('PATCH', '/users/' + b.dataset.id, body); toast(r.ok ? 'Updated' : (r.body.error || 'Not updated')); list(); });
    o.querySelector('[data-add]').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target);
      const r = await req('POST', '/users', { email: f.get('email'), role: f.get('role'), person: f.get('person'), p1: !!f.get('p1'), password: f.get('password') });
      if (r.ok) { e.target.reset(); errIn(e.target, ''); toast('Added ' + r.body.user.email); list(); } else errIn(e.target, r.body.error || 'Not added'); });
    list();
  }
  function init() {
    if (!S2.on) return;
    if (!S2.token) { store.set = () => { }; clearLocal(); setTimeout(clearLocal, 0); document.documentElement.classList.add('locked'); return loginOverlay(); }
    const orig = store.set; store.set = (k, v) => { orig(k, v); if (k !== 'me') push(k); };
    if (S2.user && store.get('me') !== S2.user.person) orig('me', S2.user.person);
    setTimeout(() => {
      const w = document.getElementById('who'); if (w) { w.disabled = true; w.title = 'Signed in as ' + (S2.user ? S2.user.email : ''); }
      const b = document.createElement('div'); b.id = 'sync-badge'; b.innerHTML = `<i></i><span>${esc(S2.user ? S2.user.email : '')}</span><em>Synced</em><button type="button" data-acct>Account</button><button type="button" data-out>Sign out</button>`; document.body.appendChild(b);
      b.querySelector('[data-out]').addEventListener('click', () => signOut()); b.querySelector('[data-acct]').addEventListener('click', () => accounts());
      if (S2.user && S2.user.needs_2fa) twoStep();
    }, 0);
    setInterval(async () => { try { const ch = await pull(false); if (ch.length) { syncBadge(ch.length + ' update' + (ch.length > 1 ? 's' : '') + ' from the team'); const bb = document.getElementById('sync-badge'); if (bb && !bb.querySelector('.reload')) { const r = document.createElement('button'); r.className = 'reload'; r.textContent = 'Load'; r.onclick = async () => { await pull(true); location.reload(); }; bb.appendChild(r); } } } catch (e) { } }, 60000);
  }
  return { init, on: S2.on, user: () => S2.user, api: (m, path, body) => req(m, path, body), pull: () => pull(true) };
})();
SYNC.init();
