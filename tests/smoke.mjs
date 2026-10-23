// Browser smoke test: open every route of the built app and fail on any page error.
// Needs Playwright: npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'dist', 'performance-lab.html');
const ROUTES = ['player1', 'calendar', 'return', 'loadlab', 'p1tx', 'p1rec', 'p1inj', 'p1test', 'p1rx', 'p1edu', 'p1kit', 'p1chat', 'command', 'athletes', 'athlete-km~load',
  'athlete-sr~tests', 'treatment', 'records', 'classify', 'learn', 'ask', 'messages', 'recovery', 'agents', 'innovation', 'trust', 'build', 'audit', 'members', 'book', 'anatomy', 'pilot'];

const browser = await chromium.launch();
let fail = 0;
for (const r of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__noSlate = 1; });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\/(fonts|cdn)\./, x => x.abort());
  await p.goto('file://' + PAGE + '#' + r); await p.waitForTimeout(900);
  const len = await p.$eval('#page', n => n.textContent.length).catch(() => -1);
  if (errs.length || len < 100) { fail++; console.error('FAIL', r, len, errs.join(' | ').slice(0, 300)); } else console.log('ok  ', r.padEnd(18), len);
  await ctx.close();
}
// education hub: every domain and section renders
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(() => { window.__noSlate = 1; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https:\/\/(fonts|cdn)\./, x => x.abort());
  await p.goto('file://' + PAGE + '#learn'); await p.waitForTimeout(600);
  const doms = await p.$$eval('[data-edu="dom"]', b => b.map(x => x.dataset.arg));
  for (const d of doms) {
    await p.evaluate(d => document.querySelector(`[data-edu="dom"][data-arg="${d}"]`).click(), d); await p.waitForTimeout(250);
    const secs = await p.$$eval('[data-edu="sec"]', b => b.map(x => x.dataset.arg));
    for (const s of secs) { await p.evaluate(s => document.querySelector(`[data-edu="sec"][data-arg="${s}"]`).click(), s); await p.waitForTimeout(150); }
  }
  if (errs.length) { fail++; console.error('FAIL education hub', errs.join(' | ').slice(0, 300)); } else console.log('ok   education hub:', doms.length, 'domains');
  await ctx.close();
}
await browser.close();
if (fail) { console.error(fail, 'route(s) failed'); process.exit(1); }
console.log('smoke test passed');
