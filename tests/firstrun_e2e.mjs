// First run: empty server with a set-up key. The sign-in screen offers "create the first lead account", which works once.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['backend/tests/serve_for_e2e.py'], { cwd: ROOT, env: { ...process.env, PLOS_E2E_EMPTY: '1' } });
const keys = await new Promise((res, rej) => { srv.stdout.on('data', d => { try { res(JSON.parse(String(d).split('\n')[0])); } catch (e) { } }); srv.stderr.on('data', d => process.stderr.write(d)); setTimeout(() => rej(new Error('server did not start')), 20000); });
let fail = 0; const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fail++; };
const b = await chromium.launch();
try {
  const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\/(fonts|cdn)\./, x => x.abort());
  await p.goto('http://localhost:8022/'); await p.waitForSelector('.first-lead', { timeout: 10000 });
  check((await p.textContent('.first-lead')).includes('We keep punching above our weight.'), 'first-run screen with the slogan');
  check(!(await p.isVisible('.login-c:not(.first-lead)')), 'plain sign-in form hidden while set-up is open');
  const pw = 'first-lead-' + Date.now();
  await p.fill('.first-lead input[name=setup_token]', 'wrong-key-wrong-key-wrong-key-wrong-key');
  await p.fill('.first-lead input[name=email]', 'jp@lab.test'); await p.fill('.first-lead input[name=password]', pw); await p.fill('.first-lead input[name=again]', pw);
  await p.click('.first-lead button[type=submit]'); await p.waitForSelector('.first-lead .login-err:not([hidden])');
  check((await p.textContent('.first-lead .login-err')).includes('Wrong set-up key'), 'wrong set-up key refused');
  await p.fill('.first-lead input[name=setup_token]', keys.setup_token); await p.click('.first-lead button[type=submit]');
  await p.waitForSelector('.login-ok'); check(true, 'lead account created from the sign-in screen');
  check(!(await p.isVisible('.login-c input[name=code]')), '6-digit code box hidden until two-step sign-in is on');
  await p.fill('.login-c input[name=password]', pw); await p.click('.login-c button[type=submit]');
  await p.waitForSelector('#sync-badge', { timeout: 15000 }); check(true, 'signs in with the new account');
  const st = await (await fetch('http://localhost:8021/api/setup/status')).json(); check(st.open === false, 'set-up closes after the first account');
  check(errs.length === 0, 'no page errors (' + errs.join(' | ').slice(0, 200) + ')');
} finally { await b.close(); srv.kill(); }
if (fail) process.exit(1); console.log('first-run e2e passed');
