// Safe PDF reader: the file is read in the browser, only an encrypted, clinician-checked summary is saved, and nothing is sent anywhere.
// pdf.js itself is replaced by a stub here (the test machine has no internet); the stub returns positioned text the way pdf.js does.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(ROOT, 'dist', 'performance-lab.html'));
const srv = createServer((q, r) => { if (q.url.split('?')[0] === '/') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(page); } r.writeHead(404); r.end(); }).listen(8031);
let fail = 0; const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fail++; };
const LINES = ['MRI RIGHT FOOT', 'Date: 12/01/2026', 'Findings:', 'There is a partial thickness tear of the spring ligament with surrounding oedema.', 'Impression:', 'Grade 2 sprain of the spring ligament. Recommend conservative management and review in 6 weeks.'];
const stub = `window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument(o) { window.__pdfOpts = o; window.__pdfBytes = o.data; const L = ${JSON.stringify(LINES)};
  return { promise: Promise.resolve({ numPages: 1, destroy() { window.__pdfDestroyed = true; return Promise.resolve(); }, getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: L.map((s, i) => ({ str: s, transform: [1, 0, 0, 1, 50, 800 - i * 20] })) }) }) }) }; } };`;
const b = await chromium.launch();
try {
  const p = await (await b.newContext()).newPage(); const errs = [], outside = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('request', q => { const u = q.url(); if (!/^http:\/\/localhost:8031\//.test(u) && !/^data:|^blob:/.test(u)) outside.push(u); });
  await p.route(/^https:\/\/(fonts|cdn)\./, x => x.abort());
  await p.addInitScript(stub);
  await p.goto('http://localhost:8031/#records'); await p.waitForSelector('form[data-v="create"]', { timeout: 15000 });
  const pass = 'test-pass-' + Date.now() + '-vault';
  await p.fill('#v-p1', pass);  await p.fill('#v-p2', pass);  await p.click('form[data-v="create"] button[type=submit]');
  await p.waitForSelector('[data-v="newp"]', { timeout: 20000 }); await p.click('[data-v="newp"]');
  await p.fill('form[data-v="createp"] input[name=name]', 'Test Patient'); await p.click('form[data-v="createp"] button[type=submit]');
  await p.waitForSelector('[data-v="tab"][data-arg="docs"]'); await p.click('[data-v="tab"][data-arg="docs"]');
  outside.length = 0;
  await p.setInputFiles('#doc-file', { name: 'mri-report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test file\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF') });
  await p.click('[data-v="docread"]'); await p.waitForSelector('form[data-v="savedoc"] textarea', { timeout: 10000 });
  const draft = await p.inputValue('form[data-v="savedoc"] textarea');
  check(/Impression: Grade 2 sprain of the spring ligament/.test(draft) && /Finding: There is a partial thickness tear/.test(draft), 'summary drafted on the device from the report sections');
  check(await p.evaluate(() => window.__pdfOpts.isEvalSupported === false), 'pdf.js runs with script evaluation off');
  check(await p.evaluate(() => window.__pdfDestroyed === true), 'parsed document released after reading');
  check(await p.evaluate(() => document.getElementById('doc-file') === null || document.getElementById('doc-file').value === ''), 'file picker cleared');
  await p.fill('form[data-v="savedoc"] input[name=title]', 'MRI right foot, Jan 2026');
  await p.click('form[data-v="savedoc"] button[type=submit]'); await p.waitForSelector('details.vnote summary', { state: 'attached' });
  check((await p.textContent('details.vnote summary')).includes('MRI right foot, Jan 2026'), 'summary listed in the record');
  const stored = await p.evaluate(() => JSON.stringify(window.__V.mem));
  check(!/spring ligament|Grade 2|MRI right foot|Test Patient/.test(stored), 'store holds ciphertext only: no summary, title or name in clear');
  check(!/%PDF|mri-report/.test(stored), 'the PDF and its file name were not stored');
  check(/Saved a PDF summary \(file not kept\)/.test(stored), 'audit log records the summary by patient code');
  check(outside.length === 0, 'no requests left the page while reading and saving (' + outside.slice(0, 3).join(' ') + ')');
  check(errs.length === 0, 'no page errors (' + errs.join(' | ').slice(0, 200) + ')');
} finally { await b.close(); srv.close(); }
if (fail) process.exit(1); console.log('PDF reader e2e passed');
