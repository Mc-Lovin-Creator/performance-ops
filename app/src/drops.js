/* ---------- Tech drops: new health, wellness and performance tech, by domain, with a daily brief and a weekly roundup.
   Found on the team server by Grok across X and public posts on Instagram, TikTok, YouTube, LinkedIn, Reddit and Threads, plus brand
   newsrooms, press, Product Hunt and Kickstarter. Every item links to the post or page it came from. What a product claims is the
   brand's claim, not evidence. Staff only. ---------- */
const DROP_DOMAINS = ['Wearables and sensors', 'Recovery tech', 'Sleep tech', 'Training and gym tech', 'Footwear and apparel tech', 'Rehab and physio devices', 'Nutrition and metabolic tech', 'Mind and neurotech', 'Diagnostics and longevity', 'Racket and padel tech'];
const DROP_CH = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', reddit: 'Reddit', threads: 'Threads', producthunt: 'Product Hunt', kickstarter: 'Kickstarter', press: 'Press', web: 'Web' };
const DR = { mode: 'daily', dom: '', ch: '', busy: false };
const drSrv = () => { try { return typeof SYNC !== 'undefined' && SYNC.on; } catch (e) { return false; } };
const drItems = () => Object.values(store.get('drops', {}) || {}).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || '').localeCompare(a.at || ''));
function pageDrops() {
  const brief = (store.get('dropsbrief', {}) || {})[DR.mode], lead = me().role === 'lead', days = DR.mode === 'weekly' ? 7 : 2;
  const since = new Date(TODAY); since.setDate(since.getDate() - days); const sinceIso = ISO(since);
  const all = drItems(), win = all.filter(x => (x.date || '') >= sinceIso), list = win.filter(x => (!DR.dom || x.domain === DR.dom) && (!DR.ch || x.channel === DR.ch));
  const byDom = d => win.filter(x => x.domain === d), chans = [...new Set(win.map(x => x.channel).filter(Boolean))];
  const head = `<div class="sec-head"><div><span class="eyebrow">Health, wellness and performance tech · web, X, Instagram, TikTok, YouTube, LinkedIn, Reddit, Threads</span><h1 style="font-size:34px;letter-spacing:-.6px">Tech drops</h1></div>
    <div class="pills"><div class="seg" role="group" aria-label="Brief"><button data-dr="mode" data-arg="daily" aria-pressed="${DR.mode === 'daily'}">Daily brief</button><button data-dr="mode" data-arg="weekly" aria-pressed="${DR.mode === 'weekly'}">Weekly roundup</button></div>${lead && drSrv() ? `<button class="btn" data-dr="run" ${DR.busy ? 'disabled' : ''}>${DR.busy ? 'Scanning… (a few minutes)' : 'Run ' + (DR.mode === 'weekly' ? 'weekly roundup' : 'daily scan') + ' now'}</button>` : ''}</div></div>`;
  const top = brief ? `<section class="dr-brief"><div><span class="eyebrow">${DR.mode === 'weekly' ? 'Week to ' : ''}${esc(brief.date)} · last ${brief.days} days · ${brief.count} drops</span><h2>${DR.mode === 'weekly' ? 'This week in health tech' : "Today's drops"}</h2></div>
      <div class="dr-doms">${DROP_DOMAINS.filter(d => brief.domains && brief.domains[d]).map(d => `<button class="dr-dom" data-dr="dom" data-arg="${esc(d)}" aria-pressed="${DR.dom === d}"><b>${esc(d)}</b><span>${esc(brief.domains[d].summary)}</span><em>${byDom(d).length} item${byDom(d).length === 1 ? '' : 's'}</em></button>`).join('') || '<p class="muted" style="margin:0">Nothing new in this period.</p>'}</div>
      ${brief.errors && brief.errors.length ? `<p class="muted" style="font-size:12px;margin:0">${brief.errors.length} domain${brief.errors.length > 1 ? 's' : ''} could not be scanned last time.</p>` : ''}</section>`
    : `<section class="panel"><span class="eyebrow">Not scanned yet</span><h2>${drSrv() ? 'The first ' + (DR.mode === 'weekly' ? 'weekly roundup' : 'daily brief') + ' appears after its first run' : 'Tech drops run on the team server'}</h2><p class="muted" style="margin:0">It needs XAI_API_KEY and SCOUT_CRON_KEY in the server settings (deploy/stages/4b-scout.md). Daily at 06:00 Abu Dhabi, weekly on Sundays.</p></section>`;
  const filt = `<div class="pills">${[['', 'All domains']].concat(DROP_DOMAINS.map(d => [d, d])).map(([k, l]) => `<button class="pill" data-dr="dom" data-arg="${esc(k)}" aria-pressed="${DR.dom === k}">${esc(l)}${k ? ` <span class="num muted">${byDom(k).length}</span>` : ''}</button>`).join('')}</div>
    ${chans.length > 1 ? `<div class="pills">${[['', 'Every channel']].concat(chans.map(c => [c, DROP_CH[c] || c])).map(([k, l]) => `<button class="pill" data-dr="ch" data-arg="${esc(k)}" aria-pressed="${DR.ch === k}">${esc(l)}</button>`).join('')}</div>` : ''}`;
  const cards = list.length ? `<div class="dr-grid">${list.map(x => `<article class="dr-card"><div class="dr-top"><span class="chip plain">${esc(x.kind)}</span><span class="dr-ch">${esc(DROP_CH[x.channel] || 'Web')}</span><span class="muted num" style="margin-left:auto">${esc(x.date)}</span></div>
      <h3>${esc(x.product)}</h3><span class="muted" style="font-size:13px">${esc(x.brand)}${x.price ? ' · ' + esc(x.price) : ''}${x.availability ? ' · ' + esc(x.availability) : ''}</span>
      <p>${esc(x.what)}</p>${x.claims ? `<p class="dr-claim"><b>Brand claim:</b> ${esc(x.claims)}</p>` : ''}${x.why ? `<p class="muted"><b>For us:</b> ${esc(x.why)}</p>` : ''}
      <div class="dr-foot"><span class="chip plain c-muted">${esc(x.domain)}</span><a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Open source · ${esc(x.source || DROP_CH[x.channel] || 'link')}</a></div></article>`).join('')}</div>`
    : `<p class="muted">No drops ${DR.dom ? 'in ' + esc(DR.dom) + ' ' : ''}for this period.</p>`;
  return head + top + filt + cards + `<p class="muted" style="font-size:12.5px">Links are kept only if the scanner actually opened the source. Product claims are the brand's; check the evidence before anything reaches an athlete. Instagram, TikTok and other platforms are read only through their public, indexed posts; no accounts are logged in or scraped.</p>`;
}
document.addEventListener('click', async e => {
  const t = e.target.closest && e.target.closest('[data-dr]'); if (!t) return; const k = t.dataset.dr, a = t.dataset.arg;
  if (k === 'mode') { DR.mode = a; DR.dom = ''; DR.ch = ''; }
  else if (k === 'dom') DR.dom = DR.dom === a ? '' : a;
  else if (k === 'ch') DR.ch = a;
  else if (k === 'run' && drSrv()) { DR.busy = true; keepRender(); try { const r = await SYNC.api('POST', '/drops/run?mode=' + DR.mode); await SYNC.pull(); toast(r.ok ? `${r.body.added} new drop${r.body.added === 1 ? '' : 's'} across ${r.body.domains} domains` : (r.body.error || 'The scan failed')); audit('Ran tech drops ' + DR.mode, ''); } catch (err) { toast('The scan failed'); } DR.busy = false; }
  keepRender();
});
