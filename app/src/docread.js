/* ---------- Safe PDF reader: a clinical PDF is read on this device only, summarised without AI, and only the
   clinician-checked summary is saved, encrypted in the records vault. The file itself is never uploaded or stored:
   its bytes live in memory while it is read and are overwritten as soon as the summary is made.
   Parser: Mozilla pdf.js with script evaluation switched off (isEvalSupported: false). ---------- */
const DOCREAD = { busy: false, draft: null, err: '', lib: null };
const PDFJS_V = '3.11.174', PDFJS_MAX = 25 * 1024 * 1024;
const PDFJS_SRI = { lib: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e', worker: 'sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2' };
function docLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (DOCREAD.lib) return DOCREAD.lib;
  /* both files are pinned by hash: the browser refuses the script if it changes, and the worker is checked before it runs */
  DOCREAD.lib = new Promise((ok, no) => { const s = document.createElement('script'); s.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_V}/pdf.min.js`; s.integrity = PDFJS_SRI.lib; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = async () => { try {
      const w = await (await fetch(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_V}/pdf.worker.min.js`, { referrerPolicy: 'no-referrer', integrity: PDFJS_SRI.worker })).blob();
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([w], { type: 'text/javascript' })); ok(window.pdfjsLib); } catch (e) { DOCREAD.lib = null; no(new Error('The PDF reader failed its safety check and was not loaded.')); } };
    s.onerror = () => { DOCREAD.lib = null; no(new Error('The PDF reader could not load. Check the connection and try again.')); }; document.head.appendChild(s); });
  return DOCREAD.lib;
}
/* text lines per page, rebuilt from positioned text runs */
async function docText(bytes) {
  const lib = await docLib();
  const doc = await lib.getDocument({ data: bytes, isEvalSupported: false, disableAutoFetch: true, disableStream: true, enableXfa: false, stopAtErrors: false }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
      const tc = await (await doc.getPage(i)).getTextContent(); const rows = new Map();
      for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = Math.round(it.transform[5] / 3) * 3; if (!rows.has(y)) rows.set(y, []); rows.get(y).push([it.transform[4], it.str]); }
      pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean));
    }
    return { pages, numPages: doc.numPages };
  } finally { try { await doc.destroy(); } catch (e) { } }
}
/* the on-device summary: document type, dates, the report's own conclusion sections, out-of-range results and the key sentences */
const DOC_TYPES = [['Imaging report', /\b(mri|magnetic resonance|ultrasound|x-ray|radiograph|ct scan|computed tomography|dexa|bone scan)\b/i], ['Lab results', /\b(haemoglobin|hemoglobin|ferritin|creatinine|vitamin d|25-oh|cholesterol|reference (range|interval)|ck\b|creatine kinase|hba1c)\b/i],
  ['Surgical or operation note', /\b(operation note|procedure performed|arthroscop|anaesthesia|anesthesia|post-?operative)\b/i], ['Discharge or clinic letter', /\b(dear dr|discharge|clinic letter|thank you for referring|yours sincerely)\b/i], ['Referral', /\b(referral|referred for|reason for referral)\b/i]];
const DOC_HEADS = /^(impression|conclusion|conclusions|diagnosis|diagnoses|findings|summary|assessment|recommendation|recommendations|plan|management|opinion|clinical (details|history|indication))\s*[:\-]?\s*(.*)$/i;
function docSummarise(pages) {
  const lines = pages.flat(), text = lines.join('\n');
  const type = (DOC_TYPES.find(([, re]) => re.test(text)) || ['Clinical document'])[0];
  const dates = [...new Set((text.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-](19|20)\d{2}|(19|20)\d{2}-\d{2}-\d{2}|\d{1,2} (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (19|20)\d{2})\b/gi) || []))].slice(0, 6);
  const sections = {}; let cur = null;
  for (const l of lines) { const m = l.match(DOC_HEADS); if (m && l.length < 160) { cur = m[1].toLowerCase().replace(/s$/, '').replace(/^clinical .*/, 'clinical details'); sections[cur] = sections[cur] || []; if (m[2]) sections[cur].push(m[2]); continue; }
    if (cur && sections[cur].join(' ').length < 900) { if (/^[A-Z][A-Z \/&]{3,40}:?$/.test(l)) { cur = null; continue; } sections[cur].push(l); } }
  for (const k of Object.keys(sections)) { sections[k] = sections[k].join(' ').replace(/\s+/g, ' ').trim().slice(0, 900); if (!sections[k]) delete sections[k]; }
  /* results flagged by the lab (H, L, *, high, low) or outside a printed range */
  const flags = [];
  for (const l of lines) {
    const m = l.match(/^([A-Za-z][A-Za-z0-9 ,()\-\/%.]{1,48}?)\s+(<|>)?(\d+(?:\.\d+)?)\s*([a-zA-Zµμ\/%0-9.^]*)\s*(?:\(?\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\)?)?\s*(H|L|HH|LL|\*|high|low)?\s*$/i);
    if (!m) continue; const v = +m[3], lo = m[5] != null ? +m[5] : null, hi = m[6] != null ? +m[6] : null, f = (m[7] || '').toUpperCase();
    const out = f ? (/^L|LOW/.test(f) ? 'low' : 'high') : (lo != null && hi != null && hi > lo ? (v < lo ? 'low' : v > hi ? 'high' : '') : '');
    if (out) flags.push({ test: m[1].trim(), value: (m[2] || '') + m[3] + (m[4] ? ' ' + m[4] : ''), range: lo != null ? lo + '–' + hi : '', dir: out });
    if (flags.length >= 20) break;
  }
  /* key sentences: scored by clinical terms and by words the document repeats */
  const sents = text.replace(/\n/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 320);
  const words = {}; for (const w of text.toLowerCase().match(/[a-z]{5,}/g) || []) words[w] = (words[w] || 0) + 1;
  const CLIN = /\b(tear|rupture|strain|sprain|fracture|oedema|edema|effusion|tendinopath|degenerat|grade|partial|full[- ]thickness|normal|no evidence|unremarkable|recommend|follow[- ]up|review|refer|surgery|conservative|rehab|deficien|elevated|reduced|abnormal|consistent with|suggest)/i;
  const scored = sents.map((s, i) => { const ws = s.toLowerCase().match(/[a-z]{5,}/g) || []; const tf = ws.reduce((a, w) => a + Math.min(4, words[w] || 0), 0) / Math.max(4, ws.length); return { s, i, sc: tf + (CLIN.test(s) ? 2 : 0) }; });
  const key = scored.sort((a, b) => b.sc - a.sc).slice(0, 5).sort((a, b) => a.i - b.i).map(x => x.s);
  return { type, dates, sections, flags, key, chars: text.length };
}
/* plain-text summary the clinician checks and edits before it is encrypted */
function docSummaryText(sum) {
  const order = ['impression', 'conclusion', 'diagnosi', 'diagnose', 'finding', 'assessment', 'recommendation', 'opinion', 'plan', 'management', 'summary', 'clinical details'];
  const out = [];
  for (const k of order) if (sum.sections[k]) out.push(k[0].toUpperCase() + k.slice(1).replace(/diagnosi$/, 'diagnosis') + ': ' + sum.sections[k]);
  if (sum.flags.length) out.push('Results outside the reference range: ' + sum.flags.map(f => `${f.test} ${f.value}${f.range ? ' (range ' + f.range + ')' : ''} ${f.dir}`).join('; '));
  if (!out.length && sum.key.length) out.push('Key points: ' + sum.key.join(' '));
  return out.join('\n\n');
}
async function docSha(bytes) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); return Array.from(h.slice(0, 8), b => b.toString(16).padStart(2, '0')).join(''); }
/* read one file: bytes stay in memory, are overwritten after reading, and nothing but the draft summary leaves this function */
async function docRead(file) {
  if (!file) throw new Error('Choose a PDF first.');
  if (file.size > PDFJS_MAX) throw new Error('That PDF is over 25 MB. Ask for a smaller copy.');
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) { buf.fill(0); throw new Error('That file is not a PDF.'); }
  let fp = '', res;
  try { fp = await docSha(buf); res = await docText(buf.slice()); }
  finally { buf.fill(0); }
  const sum = docSummarise(res.pages);
  if (sum.chars < 40) return { scan: true, pages: res.numPages, fp };
  return { pages: res.numPages, fp, type: sum.type, dates: sum.dates, flags: sum.flags, key: sum.key, text: docSummaryText(sum) };
}
function docPanel() {
  const d = DOCREAD.draft;
  return `<section class="panel vform2 docread"><h3>Read a PDF</h3>
    <p class="muted" style="margin:0;font-size:13px">The PDF is read on this device only. Nothing is sent anywhere and no AI is used. You check the summary, then only the summary is saved, encrypted. The file is not kept.</p>
    ${d ? (d.scan ? `<p class="verr">This PDF is a scan with no text layer (${d.pages} page${d.pages > 1 ? 's' : ''}). It can't be read on this device. Type the key points instead.</p>
      <form class="stack" data-v="savedoc" style="gap:10px"><label class="field">Title<input name="title" required placeholder="e.g. MRI right foot, Jan 2026"></label><label class="field">Summary<textarea name="summary" rows="6" required></textarea></label><input type="hidden" name="fp" value="${esc(d.fp)}"><input type="hidden" name="pages" value="${d.pages}"><input type="hidden" name="type" value="Scanned document"><div class="pills"><button class="btn primary" type="submit">Save summary, encrypted</button><button class="btn" type="button" data-v="docclear">Discard</button></div></form>`
      : `<div class="facts"><div><span>Looks like</span><span>${esc(d.type)} · ${d.pages} page${d.pages > 1 ? 's' : ''}</span></div>${d.dates.length ? `<div><span>Dates found</span><span>${d.dates.map(esc).join(', ')}</span></div>` : ''}${d.flags.length ? `<div><span>Outside range</span><span>${d.flags.map(f => `<span class="chip ${f.dir === 'high' ? 'c-risk' : 'c-warn'}">${esc(f.test)} ${esc(f.value)} ${f.dir}</span>`).join(' ')}</span></div>` : ''}</div>
      <form class="stack" data-v="savedoc" style="gap:10px"><label class="field">Title<input name="title" required value="${esc(d.type + (d.dates[0] ? ', ' + d.dates[0] : ''))}"></label><label class="field">Summary (check and edit before saving)<textarea name="summary" rows="9" required>${esc(d.text || d.key.join(' '))}</textarea></label>
      <details><summary class="muted" style="font-size:13px">Key sentences the reader picked</summary><ul style="font-size:13px">${d.key.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>
      <input type="hidden" name="fp" value="${esc(d.fp)}"><input type="hidden" name="pages" value="${d.pages}"><input type="hidden" name="type" value="${esc(d.type)}"><div class="pills"><button class="btn primary" type="submit">Save summary, encrypted</button><button class="btn" type="button" data-v="docclear">Discard</button></div></form>`)
    : `<label class="field">PDF file<input type="file" id="doc-file" accept="application/pdf,.pdf"></label><div class="pills"><button class="btn primary" data-v="docread" ${DOCREAD.busy ? 'disabled' : ''}>${DOCREAD.busy ? 'Reading on this device…' : 'Read and summarise'}</button></div>`}
    ${DOCREAD.err ? `<p class="verr">${esc(DOCREAD.err)}</p>` : ''}</section>`;
}
window.__doc = { docSummarise, docSummaryText };
