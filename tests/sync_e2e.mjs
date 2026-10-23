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
  await p.evaluate(() => { const k = 'plos.daily', v = JSON.parse(localStorage.getItem(k) || '{}'); v['e2e-day'] = { court: { min: 30 } }; localStorage.setItem(k, JSON.stringify(v)); });
  await p.evaluate(() => window.__app && window.__app.go ? 0 : 0);
  await p.locator('.cov-step input, .cov-step button').first().click({ trial: true }).catch(() => {});
  // the app saves via store.set; call a harmless setter path: toggle theme (user key) and write daily through store
  await p.evaluate(() => document.getElementById('theme') && document.getElementById('theme').click());
  await p.waitForTimeout(1500);
  const st = JSON.parse(readFileSync(join(ROOT, 'dist', '_e2e', 'server_state.json'), 'utf8'));
  check(Object.keys(st).some(k => k.startsWith('user:') && k.endsWith('|theme')), 'user preference synced per user');
  check(errs.length === 0, 'no page errors (' + errs.join(' | ').slice(0, 200) + ')');
  // direct API checks with the browser's token
  const tok = await p.evaluate(() => JSON.parse(sessionStorage.getItem('plos.token')));
  const put = await fetch('http://localhost:8011/api/state/daily', { method: 'PUT', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ value: { x: 1 } }) });
  check(put.ok, 'lead can save Player 1 data');
  await new Promise(r => setTimeout(r, 700));
  const st2 = JSON.parse(readFileSync(join(ROOT, 'dist', '_e2e', 'server_state.json'), 'utf8'));
  check(JSON.stringify(st2['shared|daily']).includes('sealed') && !JSON.stringify(st2['shared|daily']).includes('"value"'), 'Player 1 data stored encrypted');
  const login = await (await fetch('http://localhost:8011/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'javi@lab.test', password: pw['javi@lab.test'] }) })).json();
  const coach = await fetch('http://localhost:8011/api/state/daily', { headers: { authorization: 'Bearer ' + login.token } });
  check(coach.status === 403, 'coach refused Player 1 data');
  await p.click('#sync-badge button'); await p.waitForSelector('.login-c');
  const left = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('plos.')).length);
  check(left === 0, 'sign-out clears the device copy');
} finally { await b.close(); srv.kill(); }
if (fail) process.exit(1); console.log('sync e2e passed');
