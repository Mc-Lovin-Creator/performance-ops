// Signed in to the team server with an empty database: every page must render, show no demo content and keep nothing in localStorage.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8051, API = `http://localhost:${PORT}`;
const page = readFileSync(join(ROOT, 'frontend', 'public', 'index.html'), 'utf8').replaceAll('%REACT_APP_BACKEND_URL%', API);
const srv = createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/' || u === '/index.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(page); }
  if (u.startsWith('/api/')) {
    r.writeHead(200, { 'content-type': 'application/json' });
    if (u === '/api/state') return r.end(JSON.stringify({ state: {} }));
    if (u.startsWith('/api/scout/status')) return r.end(JSON.stringify({ grok: false, model: 'grok-4.7', feeds: 0, lanes: [], scheduled: false }));
    if (u.startsWith('/api/wear')) return r.end(JSON.stringify({ providers: [], links: {} }));
    return r.end(JSON.stringify({ ok: true, version: 1, rv: {}, conflicts: {}, value: {} }));
  }
  r.writeHead(404); r.end();
}).listen(PORT);
const ROUTES = ['player1', 'calendar', 'return', 'loadlab', 'p1tx', 'p1rec', 'p1inj', 'p1test', 'p1rx', 'p1edu', 'p1kit', 'p1chat', 'command', 'athletes',
  'treatment', 'records', 'classify', 'learn', 'messages', 'recovery', 'agents', 'innovation', 'trust', 'audit', 'members', 'book', 'pilot'];
// strings that only exist in the demo content
const DEMO = ['Lina S.', 'Omar K.', 'Karim M.', 'Noor A.', 'HRV 18%', 'Court 2 booked', 'tested 2026-10-16', 'Scan: mild spring ligament sprain', 'Force plate testing as a paid service', 'Summer vacation', 'higher-mild'];
let fail = 0; const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fail++; };
const b = await chromium.launch();
try {
  const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  let cur = ''; p.on('pageerror', e => errs.push(cur + ': ' + e.message));
  await p.route(/^https:\/\/(fonts|cdn)/, x => x.abort());
  await p.addInitScript(() => { sessionStorage.setItem('plos.token', JSON.stringify('test-token')); sessionStorage.setItem('plos.user', JSON.stringify({ id: 'u1', email: 'jp@lab.test', role: 'lead', person: 'jp', p1: true, totp: true })); });
  const seen = {};
  for (const r of ROUTES) {
    cur = r; await p.goto(`${API}/#${r}`); await p.waitForTimeout(500);
    const txt = await p.evaluate(() => document.body.innerText);
    const hits = DEMO.filter(d => txt.includes(d)); if (hits.length) seen[r] = hits;
  }
  check(Object.keys(seen).length === 0, 'no demo content on any page (' + JSON.stringify(seen).slice(0, 400) + ')');
  check(errs.length === 0, 'no page errors (' + [...new Set(errs)].join(' | ').slice(0, 600) + ')');
  const local = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('plos')));
  check(local.length === 0, 'nothing kept in localStorage (' + local.join(', ') + ')');
  await p.goto(`${API}/#player1`); await p.waitForTimeout(600);
  const t = await p.evaluate(() => document.body.innerText);
  check(/No wellness data or check-in today/i.test(t) || /Modify/i.test(t), 'no data reads as Modify, never as Ready');
} finally { await b.close(); srv.close(); }
if (fail) process.exit(1); console.log('live e2e passed');
