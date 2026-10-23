/* ---------- Backend sync (production): sign-in, pull on start, push every save, poll for colleagues' changes.
   Active only when the page is served with a backend URL (window.PLOS_API). The published demo has none and stays local. ---------- */
const SYNC = (() => {
  const raw = window.PLOS_API || '', API = raw && raw.indexOf('%') !== 0 ? raw.replace(/\/$/, '') : '';
  const ss = { get: k => { try { return JSON.parse(sessionStorage.getItem('plos.' + k)); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem('plos.' + k, JSON.stringify(v)); } catch (e) { } } };
  const S2 = { on: !!API, token: ss.get('token'), user: ss.get('user'), ver: ss.get('ver') || {}, timers: {}, pending: {} };
  const req = async (method, path, body) => {
    const r = await fetch(API + '/api' + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, S2.token ? { authorization: 'Bearer ' + S2.token } : {}), body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && path !== '/auth/login') { signOut(true); throw new Error('signed out'); }
    const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, body: j };
  };
  const clearLocal = () => { try { Object.keys(localStorage).filter(k => k.indexOf('plos.') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) { } };
  function signOut(expired) { try { ['token', 'user', 'ver'].forEach(k => sessionStorage.removeItem('plos.' + k)); } catch (e) { } clearLocal(); location.reload(); }
  async function pull(apply) {
    const r = await req('GET', '/state'); if (!r.ok) return [];
    const changed = [];
    for (const [k, d] of Object.entries(r.body.state || {})) {
      if ((S2.ver[k] || 0) < d.version) { changed.push(k); if (apply) { try { localStorage.setItem('plos.' + k, JSON.stringify(d.value)); } catch (e) { } S2.ver[k] = d.version; } }
    }
    if (apply) ss.set('ver', S2.ver); return changed;
  }
  function push(k) {
    clearTimeout(S2.timers[k]);
    S2.timers[k] = setTimeout(async () => {
      let value; try { value = JSON.parse(localStorage.getItem('plos.' + k)); } catch (e) { return; }
      try {
        const r = await req('PUT', '/state/' + k, { value, version: S2.ver[k] || 0 });
        if (r.ok) { S2.ver[k] = r.body.version; ss.set('ver', S2.ver); syncBadge('Saved'); }
        else if (r.status === 409 && r.body.reason === 'version') { const cur = r.body.current; if (cur) { localStorage.setItem('plos.' + k, JSON.stringify(cur.value)); S2.ver[k] = cur.version; ss.set('ver', S2.ver); } toast('A colleague changed this a moment ago. Loading their version.'); setTimeout(() => location.reload(), 1400); }
        else if (r.status === 409) toast(r.body.error || 'That clashes with another booking');
        else if (r.status === 403) syncBadge('Not shared: you do not have access to save ' + k);
        else if (r.status !== 404) syncBadge('Not saved, will retry');
      } catch (e) { syncBadge('Offline: saved on this device'); }
    }, 600);
  }
  function syncBadge(t) { const b = document.getElementById('sync-badge'); if (b) { b.querySelector('em').textContent = t; b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 900); } }
  function loginOverlay(msg) {
    const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<form class="login-c" autocomplete="on"><span class="eyebrow">Performance Lab OS</span><h1>Sign in</h1><p class="muted">Private clinical system. Your access is set by your role.</p>
      <label class="field">Email<input name="email" type="email" required autocomplete="username"></label><label class="field">Password<input name="password" type="password" required autocomplete="current-password"></label>
      ${msg ? `<p class="login-err">${esc(msg)}</p>` : ''}<button class="btn primary" type="submit">Sign in</button></form>`;
    document.body.appendChild(o);
    o.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const r = await req('POST', '/auth/login', { email: f.get('email'), password: f.get('password') });
        if (!r.ok) { o.remove(); return loginOverlay(r.body.error || 'Could not sign in'); }
        clearLocal(); S2.token = r.body.token; S2.user = r.body.user; S2.ver = {}; ss.set('token', S2.token); ss.set('user', S2.user);
        await pull(true); store.set('me', S2.user.person); location.reload();
      } catch (err) { o.remove(); loginOverlay('Cannot reach the server'); }
    });
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
    }, 0);
    setInterval(async () => { try { const ch = await pull(false); if (ch.length) { syncBadge(ch.length + ' update' + (ch.length > 1 ? 's' : '') + ' from the team'); const bb = document.getElementById('sync-badge'); if (bb && !bb.querySelector('.reload')) { const r = document.createElement('button'); r.className = 'reload'; r.textContent = 'Load'; r.onclick = async () => { await pull(true); location.reload(); }; bb.appendChild(r); } } } catch (e) { } }, 60000);
  }
  return { init, on: S2.on, user: () => S2.user };
})();
SYNC.init();
