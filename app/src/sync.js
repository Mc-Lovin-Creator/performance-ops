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
    const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<form class="login-c" autocomplete="on"><span class="eyebrow">Performance Lab OS</span><h1>Sign in</h1><p class="muted">Private clinical system. Your access is set by your role.</p>
      <label class="field">Email<input name="email" type="email" required autocomplete="username"></label><label class="field">Password<input name="password" type="password" required autocomplete="current-password"></label>
      <label class="field login-code" ${S2.needCode ? '' : 'hidden'}>6-digit code from your authenticator app<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8"></label>
      ${msg ? `<p class="login-err">${esc(msg)}</p>` : ''}<button class="btn primary" type="submit">Sign in</button></form>`;
    document.body.appendChild(o);
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
  function init() {
    if (!S2.on) return;
    if (!S2.token) { store.set = () => { }; clearLocal(); setTimeout(clearLocal, 0); document.documentElement.classList.add('locked'); return loginOverlay(); }
    const orig = store.set; store.set = (k, v) => { orig(k, v); if (k !== 'me') push(k); };
    if (S2.user && store.get('me') !== S2.user.person) orig('me', S2.user.person);
    setTimeout(() => {
      const w = document.getElementById('who'); if (w) { w.disabled = true; w.title = 'Signed in as ' + (S2.user ? S2.user.email : ''); }
      const b = document.createElement('div'); b.id = 'sync-badge'; b.innerHTML = `<i></i><span>${esc(S2.user ? S2.user.email : '')}</span><em>Synced</em><button type="button">Sign out</button>`; document.body.appendChild(b);
      b.querySelector('button').addEventListener('click', () => signOut());
      if (S2.user && S2.user.needs_2fa) twoStep();
    }, 0);
    setInterval(async () => { try { const ch = await pull(false); if (ch.length) { syncBadge(ch.length + ' update' + (ch.length > 1 ? 's' : '') + ' from the team'); const bb = document.getElementById('sync-badge'); if (bb && !bb.querySelector('.reload')) { const r = document.createElement('button'); r.className = 'reload'; r.textContent = 'Load'; r.onclick = async () => { await pull(true); location.reload(); }; bb.appendChild(r); } } } catch (e) { } }, 60000);
  }
  return { init, on: S2.on, user: () => S2.user };
})();
SYNC.init();
