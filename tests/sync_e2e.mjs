// End-to-end: sign in through the real UI, save Player 1 data, confirm the server holds it encrypted,
// then confirm a coach cannot read it. Starts backend/tests/serve_for_e2e.py itself.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['backend/tests/serve_for_e2e.py'], { cwd: ROOT, env: process.env });
const pw = await new Promise((res, rej) => { srv.stdout.on('data', d => { try { res(JSON.parse(String(d).split('\n')[0])); } catch (e) { } }); srv.stderr.on('data', d => process.stderr.write(d)); setTimeout(() => rej(new Error('server did not start')), 20000); });
let fail = 0; const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fail++; };
const b = await chromium.launch();
try {
  const ctx = await b.newContext(); await ctx.addInitScript(() => { window.__noSlate = 1; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\/(fonts|cdn)\./, x => x.abort());
  await p.goto('http://localhost:8012/'); await p.waitForSelector('.login-c');
  check(true, 'sign-in screen shown before any data');
  await p.fill('.login-c input[name=email]', 'jp@lab.test'); await p.fill('.login-c input[name=password]', 'wrong-password-123');
  await p.click('.login-c button'); await p.waitForSelector('.login-err'); check(true, 'wrong password refused');
  await p.fill('.login-c input[name=email]', 'jp@lab.test'); await p.fill('.login-c input[name=password]', pw['jp@lab.test']);
  await p.click('.login-c button'); await p.waitForSelector('#sync-badge', { timeout: 15000 });
  check(true, 'signed in as lead');
  await p.evaluate(() => { location.hash = 'player1'; }); await p.waitForTimeout(800);
  // trigger a Player 1 save through the app's own store
  await p.evaluate(() => { const k = 'plos.daily', v = JSON.parse(sessionStorage.getItem(k) || '{}'); v['e2e-day'] = { court: { min: 30 } }; sessionStorage.setItem(k, JSON.stringify(v)); });
  await p.evaluate(() => window.__app && window.__app.go ? 0 : 0);
  await p.locator('.cov-step input, .cov-step button').first().click({ trial: true }).catch(() => {});
  // the app saves via store.set; call a harmless setter path: toggle theme (user key) and write daily through store
  await p.evaluate(() => document.getElementById('theme') && document.getElementById('theme').click());
  let synced = false; for (let i = 0; i < 40 && !synced; i++) { await p.waitForTimeout(500); const st = JSON.parse(readFileSync(join(ROOT, 'dist', '_e2e', 'server_state.json'), 'utf8')); synced = Object.keys(st).some(k => k.startsWith('user:') && k.endsWith('|theme')); }
  check(synced, 'user preference synced per user');
  check(errs.length === 0, 'no page errors (' + errs.join(' | ').slice(0, 200) + ')');
  // direct API checks with the browser's token
  const tok = await p.evaluate(() => JSON.parse(sessionStorage.getItem('plos.token')));
  const put = await fetch('http://localhost:8011/api/state/daily', { method: 'PUT', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ value: { x: 1 } }) });
  check(put.ok, 'lead can save Player 1 data');
  const rec = await fetch('http://localhost:8011/api/state/daily/records', { method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'map', changes: { y: 2 }, base: {} }) });
  const rj = await rec.json(); check(rec.ok && rj.value.x === 1 && rj.value.y === 2, 'record-level save merges with existing entries');
  await new Promise(r => setTimeout(r, 700));
  const st2 = JSON.parse(readFileSync(join(ROOT, 'dist', '_e2e', 'server_state.json'), 'utf8'));
  check(JSON.stringify(st2['shared|daily']).includes('sealed') && !JSON.stringify(st2['shared|daily']).includes('"value"'), 'Player 1 data stored encrypted');
  const login = await (await fetch('http://localhost:8011/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'javi@lab.test', password: pw['javi@lab.test'] }) })).json();
  const coach = await fetch('http://localhost:8011/api/state/daily', { headers: { authorization: 'Bearer ' + login.token } });
  check(coach.status === 403, 'coach refused Player 1 data');
  // wearables: consent, connect Oura through the UI (provider faked on the server), callback, status, sync
  const H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
  const cv = await (await fetch('http://localhost:8011/api/state/consent', { headers: H })).json();
  await fetch('http://localhost:8011/api/state/consent', { method: 'PUT', headers: H, body: JSON.stringify({ value: { p1: { wear: { by: 'jp', at: 'e2e' } } }, version: cv.version || 0 }) });
  await p.evaluate(() => { location.hash = 'loadlab'; }); await p.waitForSelector('[data-wdev="connect"][data-arg="oura"]', { timeout: 10000 });
  check(await p.locator('.wr-chip.off', { hasText: 'WHOOP' }).count() === 1, 'unconfigured providers shown as not set up');
  await p.click('[data-wdev="connect"][data-arg="oura"]'); await p.waitForSelector('.wr-sheet a.btn.primary');
  const authUrl = new URL(await p.getAttribute('.wr-sheet a.btn.primary', 'href'));
  check(authUrl.origin === 'https://cloud.ouraring.com' && authUrl.searchParams.get('client_id') === 'e2e-oura', 'connect link goes to Oura with our client id');
  const cb = await (await fetch(authUrl.searchParams.get('redirect_uri') + '?code=e2e&state=' + encodeURIComponent(authUrl.searchParams.get('state')))).text();
  check(cb.includes('Connected') && cb.includes('days loaded'), 'callback stores the connection and runs the first sync');
  await p.click('.wr-sheet [data-close]'); await p.waitForSelector('.wr-chip.on', { timeout: 10000 });
  check((await p.textContent('.wr-chip.on')).includes('synced'), 'Oura shows as connected and synced');
  await p.click('[data-wdev="sync"][data-arg="oura"]'); await p.waitForTimeout(1500);
  const wv = await (await fetch('http://localhost:8011/api/state/wear', { headers: H })).json();
  check(Object.values(wv.value || {}).some(d => d.src === 'Oura' && d.hrv === 61), 'synced days are in Player 1\'s encrypted wear record');
  let pulled = false; for (let i = 0; i < 20 && !pulled; i++) { pulled = await p.evaluate(() => Object.values(JSON.parse(sessionStorage.getItem('plos.wear') || '{}')).some(d => d.src === 'Oura')); if (!pulled) await p.waitForTimeout(500); }
  check(pulled, 'app pulled the synced days');
  check(!JSON.stringify(await (await fetch('http://localhost:8011/api/state', { headers: H })).json()).includes('oura-at'), 'provider tokens never reach the browser');
  if (process.env.E2E_SHOT) { await p.evaluate(() => document.querySelector('.wear').scrollIntoView()); await p.screenshot({ path: process.env.E2E_SHOT }); }
  check(errs.length === 0, 'no page errors after wearables (' + errs.join(' | ').slice(0, 200) + ')');
  // accounts screen: the lead adds a person and sees two-step status
  await p.click('#sync-badge [data-acct]'); await p.waitForSelector('.acct [data-list] .acct-r');
  await p.fill('.acct [data-add] input[name=email]', 'newphysio@lab.test'); await p.selectOption('.acct [data-add] select[name=role]', 'physio');
  await p.check('.acct [data-add] input[name=p1]'); await p.fill('.acct [data-add] input[name=password]', 'temporary-pass-' + Date.now());
  await p.click('.acct [data-add] button[type=submit]'); await p.waitForSelector('.acct-r:has-text("newphysio@lab.test")', { timeout: 8000 });
  check((await p.textContent('.acct-r:has-text("newphysio@lab.test")')).includes('two-step OFF'), 'lead adds a person; Player 1 access shows two-step status');
  await p.click('.acct [data-close]');
  check(errs.length === 0, 'no page errors in accounts (' + errs.join(' | ').slice(0, 200) + ')');
  await p.click('#sync-badge [data-out]'); await p.waitForSelector('.login-c');
  const left = await p.evaluate(() => [localStorage, sessionStorage].reduce((n, box) => n + Object.keys(box).filter(k => k.startsWith('plos')).length, 0));
  check(left === 0, 'sign-out clears the device copy');
  check(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('plos')).length) === 0, 'nothing was ever kept in localStorage');
} finally { await b.close(); srv.kill(); }
if (fail) process.exit(1); console.log('sync e2e passed');
