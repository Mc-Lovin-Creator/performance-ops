/* ---------- Wearables and effort: import Oura, Apple Health (Health Auto Export) or Polar CSV; show HRV, resting heart rate and sleep
   against his own baseline; show session-RPE load beside time-only load. Monitoring aids only. The file is read on this device. ---------- */
SRC.plews = { cite: 'Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med 2013;43(9):773-781', url: PM('Plews 2013 training adaptation heart rate variability monitoring') };
SRC.foster = { cite: 'Foster C et al. A new approach to monitoring exercise training. J Strength Cond Res 2001;15(1):109-115 (session-RPE)', url: PM('Foster 2001 new approach to monitoring exercise training session RPE') };
let WEAR = store.get('wear', {});
const wNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
function wearParse(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) throw new Error('empty file');
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
  const head = split(lines[0]).map(h => h.toLowerCase());
  const find = re => head.findIndex(h => re.test(h));
  const iD = find(/^(date|day|summary_date|start)/), iS = find(/sleep.*(dur|asleep|total)|total sleep|sleep analysis|^sleep/), iH = find(/hrv|heart rate variability|rmssd/), iR = find(/resting heart|lowest.*heart|^rhr|resting hr/), iQ = find(/readiness|recovery score|recharge/);
  if (iD < 0 || (iS < 0 && iH < 0 && iR < 0)) throw new Error('could not find date and sleep, HRV or resting heart rate columns');
  const src = /oura/i.test(text.slice(0, 400)) || head.some(h => /readiness/.test(h)) ? 'Oura' : head.some(h => /recharge/.test(h)) ? 'Polar' : head.some(h => /\(ms\)|count\/min/.test(h)) ? 'Apple Health' : 'CSV';
  let n = 0; const out = {};
  for (const l of lines.slice(1)) {
    const c = split(l), d = new Date(c[iD]); if (isNaN(d)) continue; const iso = ISO(d);
    let sl = iS >= 0 ? wNum(c[iS]) : null; if (sl != null) sl = sl > 1000 ? sl / 3600 : sl > 24 ? sl / 60 : sl;
    out[iso] = { sleep: sl != null ? Math.round(sl * 10) / 10 : null, hrv: iH >= 0 ? wNum(c[iH]) : null, rhr: iR >= 0 ? wNum(c[iR]) : null, score: iQ >= 0 ? wNum(c[iQ]) : null, src }; n++;
  }
  return { days: out, n, src };
}
function wearStats(field, uptoIso) {
  const ds = Object.keys(WEAR).filter(d => d < uptoIso).sort().slice(-28).map(d => WEAR[d][field]).filter(v => v != null);
  if (ds.length < 7) return null; const m = ds.reduce((a, b) => a + b, 0) / ds.length, sd = Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / (ds.length - 1));
  return { m, sd, n: ds.length };
}
function wearPanel() {
  if (!perm().clinical) return '';
  const days = []; for (let k = 13; k >= 0; k--) { const t = new Date(TODAY); t.setDate(t.getDate() - k); days.push(ISO(t)); }
  const last = Object.keys(WEAR).sort().pop(), any = !!last;
  const series = (f, col, label, unit, worseUp) => {
    const st = last ? wearStats(f, last) : null, vals = days.map(d => WEAR[d] ? WEAR[d][f] : null), have = vals.filter(v => v != null);
    if (!have.length) return `<div class="wr-s"><span>${label}</span><em class="muted">no data</em></div>`;
    const mn = Math.min(...have, st ? st.m - st.sd : Infinity), mx = Math.max(...have, st ? st.m + st.sd : -Infinity), y = v => 46 - (v - mn) / ((mx - mn) || 1) * 40;
    const pts = vals.map((v, i) => v == null ? null : `${(i * 13 + 4).toFixed(0)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
    const v = WEAR[last] ? WEAR[last][f] : null, flag = st && v != null && (worseUp ? v > st.m + st.sd : v < st.m - st.sd);
    return `<div class="wr-s${flag ? ' flag' : ''}"><span>${label}</span><svg viewBox="0 0 180 50" preserveAspectRatio="none">${st ? `<rect x="0" y="${y(st.m + st.sd)}" width="180" height="${Math.max(1, y(st.m - st.sd) - y(st.m + st.sd))}" fill="${col}" opacity=".12"/>` : ''}<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2"/></svg>
      <b>${v != null ? v + unit : '–'}</b><em>${st ? `usual ${st.m.toFixed(0)} ± ${st.sd.toFixed(0)}${unit}` : 'baseline needs 7 days'}${flag ? ' · outside his usual range' : ''}</em></div>`;
  };
  const srpe = days.map(d => DAILY[d] && DAILY[d].court && DAILY[d].court.rpe ? (DAILY[d].court.min || 0) * DAILY[d].court.rpe : 0), wk = srpe.slice(-7).reduce((a, b) => a + b, 0), wkPrev = srpe.slice(0, 7).reduce((a, b) => a + b, 0);
  return `<section class="panel wear"><div class="sec-head"><div><span class="eyebrow">Wearables and effort · monitoring aids, compared with his own baseline</span><h2>Recovery signals</h2></div>
      <label class="btn sm" style="cursor:pointer">Import CSV<input type="file" accept=".csv,.txt" data-wear="file" hidden></label></div>
    ${wearDevices()}
    ${any ? `<div class="wr-g">${series('hrv', '#a78bfa', 'HRV', ' ms', false)}${series('rhr', '#fb7185', 'Resting heart rate', ' bpm', true)}${series('sleep', '#38bdf8', 'Sleep', ' h', false)}</div><p class="muted" style="font-size:12px;margin:0">${Object.keys(WEAR).length} day${Object.keys(WEAR).length === 1 ? '' : 's'} on record · last ${esc(last)} · ${esc(WEAR[last].src)}. A value outside the shaded band (his usual ± 1 SD over 28 days) is worth a conversation, not a decision on its own.</p>`
      : `<p class="muted" style="margin:0">No wearable data yet. Export from Oura (Trends → export CSV), Apple Health (Health Auto Export app, daily CSV) or Polar Flow, then import. The file is read on this device.</p>`}
    <div class="wr-rpe"><div><span>Session-RPE load, last 7 days</span><b>${wk}</b><em>minutes × effort (0 to 10) · previous week ${wkPrev}</em></div><p class="muted" style="margin:0;font-size:12px">Shown beside time-only load. The guard and plan still use minutes only, as the team decided.</p></div>
    <p class="lab-src">${srcLink('plews')} · ${srcLink('foster')} · ${srcLink('halson')}</p></section>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || t.dataset.wear !== 'file' || !t.files[0]) return; const f = t.files[0];
  f.text().then(x => { try { const r = wearParse(x); Object.assign(WEAR, r.days); store.set('wear', WEAR); audit('Imported wearable data', r.src + ' · ' + r.n + ' days'); toast(r.n + ' days imported from ' + r.src); keepRender(); } catch (err) { toast('Could not read that file: ' + err.message); } });
});

/* ---------- Live device sync (production backend): connect Player 1's own Oura, WHOOP, Polar or Garmin account by OAuth, or let the
   Health Auto Export iPhone app post Apple Health summaries. Tokens stay on the server, encrypted; the app only sees status and the daily rows. ---------- */
const WDEV = { st: null, busy: '', loading: false };
const wApi = () => { try { return SYNC && SYNC.on ? SYNC : null; } catch (e) { return null; } };
const WDEV_LIST = [['oura', 'Oura'], ['whoop', 'WHOOP'], ['polar', 'Polar'], ['garmin', 'Garmin'], ['apple', 'Apple Health']];
const wAgo = t => { if (!t) return 'never'; const m = Math.round((Date.now() / 1000 - t) / 60); return m < 2 ? 'just now' : m < 90 ? m + ' min ago' : m < 60 * 36 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
async function wdevLoad() {
  const A = wApi(); if (!A || WDEV.loading) return; WDEV.loading = true;
  try { const r = await A.api('GET', '/wear'); WDEV.st = r.ok ? r.body : { error: r.body.error || 'Not available' }; } catch (e) { WDEV.st = { error: 'Server not reachable' }; }
  WDEV.loading = false; keepRender();
}
function wearDevices() {
  const A = wApi();
  if (!A) return `<div class="wr-dev demo"><span class="eyebrow">Live sync · on the lab server</span><div class="wr-chips">${WDEV_LIST.map(([, n]) => `<span class="wr-chip off"><i></i>${n}</span>`).join('')}</div>
    <p class="muted">When the app runs on the lab server, his Oura, WHOOP, Polar or Garmin account connects once and syncs daily; Apple Health arrives from the Health Auto Export app. This demo reads CSV files only.</p></div>`;
  if (!WDEV.st) { setTimeout(wdevLoad, 0); return `<div class="wr-dev"><span class="eyebrow">Live sync</span><p class="muted">Checking connected devices…</p></div>`; }
  if (WDEV.st.error) return `<div class="wr-dev"><span class="eyebrow">Live sync</span><p class="muted">${esc(WDEV.st.error)}</p></div>`;
  const chip = p => {
    const cls = p.connected ? (p.last_error ? 'warn' : 'on') : p.configured ? '' : 'off', busy = WDEV.busy === p.id;
    const line = p.connected ? (p.last_error ? esc(p.last_error) : `synced ${wAgo(p.last_sync)}${p.last_days != null ? ' · ' + p.last_days + (p.last_days === 1 ? ' day' : ' days') : ''}`) : p.configured ? 'not connected' : 'not set up on the server';
    const acts = !WDEV.st.consent ? '' : p.connected
      ? `${p.push ? '' : `<button class="btn sm" data-wdev="sync" data-arg="${p.id}" ${busy ? 'disabled' : ''}>${busy ? 'Syncing…' : 'Sync now'}</button>`}${p.id === 'apple' ? `<button class="btn sm" data-wdev="apple" data-arg="apple">New link</button>` : ''}<button class="btn sm ghost" data-wdev="off" data-arg="${p.id}">Disconnect</button>`
      : p.configured ? `<button class="btn sm primary" data-wdev="${p.id === 'apple' ? 'apple' : 'connect'}" data-arg="${p.id}" ${busy ? 'disabled' : ''}>${p.id === 'apple' ? 'Create ingest link' : 'Connect'}</button>` : '';
    return `<div class="wr-chip ${cls}"><i></i><span><b>${esc(p.name)}</b><em>${line}</em></span><span class="wr-act">${acts}</span></div>`;
  };
  return `<div class="wr-dev"><span class="eyebrow">Live sync · tokens stay on the server, encrypted · daily summaries only</span>
    ${WDEV.st.consent ? '' : `<p class="wr-need">Record Player 1's consent for <b>wearable data sync</b> before connecting a device. <a href="#p1rec">Open his record</a></p>`}
    <div class="wr-chips">${WDEV.st.providers.map(chip).join('')}</div></div>`;
}
function wdevSheet(title, body) {
  const o = document.createElement('div'); o.className = 'login-o'; o.innerHTML = `<div class="login-c wr-sheet"><span class="eyebrow">Wearable sync</span><h1>${esc(title)}</h1>${body}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-close>Done</button></div></div>`;
  document.body.appendChild(o); o.querySelector('[data-close]').onclick = () => { o.remove(); WDEV.st = null; keepRender(); };
  o.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast('Copied'); } catch (e) { } });
  return o;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-wdev]'); if (!b) return; const A = wApi(); if (!A) return;
  const act = b.dataset.wdev, pid = b.dataset.arg, name = (WDEV_LIST.find(x => x[0] === pid) || [, pid])[1];
  if (act === 'connect') {
    WDEV.busy = pid; keepRender(); const r = await A.api('POST', '/wear/' + pid + '/connect'); WDEV.busy = ''; keepRender();
    if (!r.ok) return toast(r.body.error || 'Could not start');
    wdevSheet('Connect ' + name, `<p class="muted">Player 1 signs in to his own ${esc(name)} account and approves read access. Open the link on this device with him, or copy it to his phone. It works once and expires in 24 hours. Nothing is sent to him by the app.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="${esc(r.body.url)}" target="_blank" rel="noopener">Open sign-in</a><button class="btn" data-copy="${esc(r.body.url)}">Copy link</button></div>`);
  } else if (act === 'sync') {
    WDEV.busy = pid; keepRender(); const r = await A.api('POST', '/wear/' + pid + '/sync'); WDEV.busy = '';
    if (r.ok) { await A.pull(); WEAR = store.get('wear', {}); toast(r.body.pending ? 'Garmin will send his data shortly' : `${name}: ${r.body.days} days checked, ${r.body.changed} updated`); audit('Synced wearable', name); }
    else toast(r.body.reason === 'reconnect' ? name + ' needs to be connected again' : (r.body.error || 'Sync failed'));
    WDEV.st = null; keepRender();
  } else if (act === 'off') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Disconnect'; }, 3000); return; }
    const r = await A.api('DELETE', '/wear/' + pid); toast(r.ok ? name + ' disconnected. Days already synced stay in his record.' : (r.body.error || 'Could not disconnect')); WDEV.st = null; keepRender();
  } else if (act === 'apple') {
    const r = await A.api('POST', '/wear/apple/token'); if (!r.ok) return toast(r.body.error || 'Could not create the link');
    wdevSheet('Apple Health via Health Auto Export', `<ol class="muted wr-steps"><li>On his iPhone, open Health Auto Export → Automations → new <b>REST API</b> automation.</li><li>Data: Health Metrics: <b>Heart Rate Variability, Resting Heart Rate, Sleep Analysis</b>. Format JSON, aggregate by day, sync daily.</li><li>URL and header below. The key is shown once; creating a new link replaces it.</li></ol>
      <label class="field">URL<code class="totp-key">${esc(r.body.url)}</code></label><button class="btn sm" data-copy="${esc(r.body.url)}">Copy URL</button>
      <label class="field">Header: ${esc(r.body.header)}<code class="totp-key" style="word-break:break-all">${esc(r.body.value)}</code></label><button class="btn sm" data-copy="${esc(r.body.value)}">Copy header value</button>`);
  }
});
if (typeof location !== 'undefined' && /[?&]wear=/.test(location.search)) setTimeout(() => { WDEV.st = null; try { SYNC.pull().then(() => { WEAR = store.get('wear', {}); keepRender(); }); } catch (e) { } }, 500);
