/* ---------- Agents: the bot ecosystem. External agents search the web on a schedule and write to the shared store; internal agents run in the app on its own data, which never leaves it ---------- */
const AG = { open: null, cap: { db: null, user: null, sample: null }, scout: [], evidence: [], runs: [], askq: [], me: null, ask: { q: '', busy: false, res: null, err: '' }, push: {} };
const AGENTS = [
  { id: 'scout', kind: 'External', name: 'Innovation scout', when: 'Every day, 06:00 Abu Dhabi', color: '#3B4BD8',
    task: 'Searches six lanes for the last 7 days: performance science, wearables and hardware, software and AI, apparel and footwear, nutrition and supplements, padel. Keeps the two strongest items per lane, writes a two-line summary and why it matters to us, with the source.',
    reads: 'The open web', writes: 'Innovation inbox', who: 'JP, Olivia and the physician decide who each item goes to' },
  { id: 'evidence', kind: 'External', name: 'Evidence watch', when: 'Every Monday, 06:15', color: '#0F8A6A',
    task: 'Finds new peer-reviewed work on padel injuries, foot and spring ligament, tendon loading, load monitoring, return to sport and recovery modalities. Grades each paper (review, trial, cohort, case) and states the finding in one sentence.',
    reads: 'Journals and PubMed via web search', writes: 'Education hub, new evidence', who: 'Clinical team, then shared to athletes when relevant' },
  { id: 'askdesk', kind: 'External', name: 'Ask desk', when: 'Every hour', color: '#B5651D',
    task: 'Takes questions people send for a deep answer, researches them on the web, and writes back an answer pitched to that person (athlete, coach or clinician) with sources.',
    reads: 'Queued questions, the open web', writes: 'The person\'s Researched for you list', who: 'The person who asked' },
  { id: 'ask', kind: 'Live', name: 'Ask', when: 'Instantly, when someone asks', color: '#7A3FB8',
    task: 'Answers a question in seconds, pitched to the person, links it to the Education hub and the Anatomy lab, and reads it aloud. Names and patient details are blocked before anything is sent.',
    reads: 'The question, PubMed and Europe PMC abstracts, our Education hub', writes: 'Nothing is stored', who: 'Everyone' },
  { id: 'brief', kind: 'Internal', name: 'Morning brief', when: 'When the app opens', color: '#1C1B1F',
    task: 'Builds the day for the clinical team: Player 1\'s status, who is on duty, open flags and what changed since yesterday.', reads: 'Player 1 record, duty calendar', writes: 'Dashboard', who: 'JP, Olivia, physician' },
  { id: 'loadwatch', kind: 'Internal', name: 'Load watch', when: 'Every time load is logged', color: '#C2410C',
    task: 'Watches the acute to chronic ratio, monotony and wellness for every athlete and flags a large rise or a wellness drop. Coach workload from PadelOps joins here later.', reads: 'Session load, wellness', writes: 'Flags on the dashboard and squad', who: 'Clinical team' },
  { id: 'curator', kind: 'Internal', name: 'Education curator', when: 'Daily', color: '#0E7490',
    task: 'Matches Education hub content to each person: population tier, sport, current injury and phase. Player 1 gets his routines, healing and pain guide; others get their tier\'s prescription.', reads: 'Classification tier, injury list', writes: 'Each person\'s Education page', who: 'Each athlete' },
  { id: 'drafter', kind: 'Internal', name: 'Update drafter', when: 'After the daily cover', color: '#4D7C0F',
    task: 'Drafts our daily clinical update from the daily cover: court load, protocol, observation and soft tissue. JP or Olivia reads it and sends it to the team physician.', reads: 'Player 1 daily cover', writes: 'Draft in the clinical thread', who: 'Team physician only' },
  { id: 'privacy', kind: 'Internal', name: 'Privacy guard', when: 'Continuously', color: '#9F1239',
    task: 'Reads the audit log for access changes, views of private records and exports, and raises anything unusual to the lead.', reads: 'Audit log', writes: 'Trust and access alerts', who: 'JP' }
];
const AG_GROUPS = [['p1team', 'Player 1 team (JP, Olivia, physician)'], ['clinical', 'Clinical staff'], ['coaches', 'Padel coaches'], ['squad', 'All athletes'], ['player1', 'Player 1']];
async function agInit() {
  if (AG.started || !window.claude || !claude.use) return; AG.started = true;
  const [db, user, sample] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('sample')]);
  AG.cap = { db, user, sample };
  if (user && user.id) { try { AG.me = await user.id(); } catch (e) { } }
  if (db) {
    const sub = (col, key, n) => { try { db.collection(col).orderBy('at', 'desc').limit(n).onSnapshot(s => { AG[key] = s.docs.map(d => Object.assign({ id: d.id }, d.data())); agLive(); }, () => { }); } catch (e) { } };
    sub('scout', 'scout', 60); sub('evidence', 'evidence', 40); sub('runs', 'runs', 30); sub('askq', 'askq', 40);
  }
  agLive();
}
function agLive() { if (['agents', 'innovation', 'ask'].includes(S.route)) { const y = scrollY; render(); scrollTo(0, y); } }
/* internal agents: computed here, from the app's own data */
function agInternal(id) {
  const a = P1(), w = p1Wellness(), rb = RT.band(a.acwr);
  if (id === 'brief') { const T = rtSync(); return [`Player 1: ${T.s ? RT_STW[T.s.st][0] : ''}${T.p ? ', ' + T.mins + ' min on court' : ''}`, `On duty: ${STAFF2.map(s => s.name + ' ' + statusOn(TODAY_ISO, s.id).s).join(', ')}`, `${w.n} wellness flag${w.n === 1 ? '' : 's'}, ratio ${a.acwr.toFixed(2)}`]; }
  if (id === 'loadwatch') return ATH.filter(x => x.acwr > 1.25 || x.acwr < 0.8).slice(0, 6).map(x => `${x.private && !seesAthlete(x) ? 'Private athlete' : x.name}: ratio ${x.acwr.toFixed(2)} ${x.acwr > 1.25 ? 'large rise' : 'under-loading'}`).concat(w.n ? [`Player 1 wellness: ${w.rules.filter(r => r[1]).map(r => r[0].toLowerCase()).join(', ')}`] : []);
  if (id === 'curator') return [`Player 1: fascia routines, tissue healing, If it hurts, spring ligament in 3D`, `Squad: prescription by tier (${Object.values(RX).map(c => c.label.toLowerCase()).join(', ')})`];
  if (id === 'drafter') return [(typeof agentDraft === 'function' ? String(agentDraft()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) + '…' : 'Draft appears after the daily cover is filled')];
  if (id === 'privacy') { const L = (typeof AUDIT !== 'undefined' ? AUDIT : []).slice(-40); const acc = L.filter(x => /access|private|export/i.test(x.action || x[1] || '')).length; return [`${L.length} recent actions read, ${acc} touching access or private records`, 'No unusual pattern found']; }
  return [];
}
function agStatus(id) {
  const ext = { scout: agScoutItems(), evidence: agEvidence(), askdesk: AG.askq.filter(q => q.status === 'done') }[id];
  const run = AG.runs.find(r => r.agent === id);
  if (id === 'scout' && agSrv()) { const dg = store.get('scoutdigest', null); return dg ? ['ok', 'Last scan ' + dg.date] : ['wait', 'Waiting for its first scan']; }
  if (ext) return run ? ['ok', 'Last run ' + new Date(run.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })] : AG.cap.db ? ['wait', 'Waiting for its first run'] : ['off', 'Needs the shared store'];
  if (id === 'ask') return AG.cap.sample ? ['ok', 'Ready'] : ['off', 'Not available in this view'];
  return ['ok', 'Running in the app'];
}
/* Where every bot lives: one map of the places, what runs there and what each can touch. */
const AG_PLACES = [
  ['cloud', 'Claude cloud · scheduled', 'Runs on Anthropic\'s servers on a schedule. Reads only public web sources and the questions queued for it.', [['Innovation scout', 'Daily 05:44', 'Public web', 'scout'], ['Evidence watch', 'Mondays 06:15', 'Journals, PubMed', 'evidence'], ['Ask desk', 'Hourly 07:00 to 21:00', 'Queued questions', 'askdesk']]],
  ['server', 'Performance Ops server', 'Runs next to your data. The only bots that touch Player 1 data live here, under his consent and the Player 1 access rules.', [['Grok scout', 'Daily, once keyed', 'Web and X (public only)', 'grok'], ['Wearable sync', 'Daily, once set up', 'Player 1\'s WHOOP, with consent', 'wear']]],
  ['app', 'Inside the app', 'Run in each person\'s browser on data they can already see. Nothing leaves the device.', [['Morning brief', 'When the app opens', 'Player 1 status, duty'], ['Load watch', 'Every load entry', 'Minutes, wellness'], ['Education curator', 'Daily', 'Tiers, injuries'], ['Update drafter', 'After the daily cover', 'Player 1 cover'], ['Privacy guard', 'Continuously', 'Audit log']]],
  ['build', 'Builders', 'Change the app itself, never the data.', [['Emergent agent', 'When asked', 'GitHub main, staging server'], ['Claude', 'When asked', 'The repository and tests']]]];
function agMap() {
  const srv = typeof SYNC !== 'undefined' && SYNC.on, st = AG.srvStatus;
  if (srv && !st && !AG.srvAsked) { AG.srvAsked = true; SYNC.api('GET', '/scout/status').then(r => { if (r.ok) { AG.srvStatus = r.body; keepRender(); } }).catch(() => { }); }
  const dot = id => id === 'grok' ? (srv && st ? (st.grok ? (st.scheduled ? 'ok' : 'wait') : 'off') : 'off') : id === 'wear' ? 'off' : ['scout', 'evidence', 'askdesk'].includes(id) ? agStatus(id)[0] : 'ok';
  return `<section class="panel ag-map"><div class="sec-head"><div><span class="eyebrow">Where every bot is</span><h2>${AG_PLACES.reduce((n, p) => n + p[3].length, 0)} bots in 4 places</h2></div><span class="muted" style="font-size:13px">Your personal agents are on your own Swarm page, not here</span></div>
    <div class="ag-places">${AG_PLACES.map(([id, name, why, bots]) => `<div class="ag-place ag-${id}"><b>${name}</b><p>${why}</p><ul>${bots.map(b => { const d = dot(b[3]); return `<li><span class="dot-st st-${d}"></span><span class="grow"><b>${esc(b[0])}</b><em>${esc(b[1])} · ${esc(b[2])}</em></span></li>`; }).join('')}</ul></div>`).join('')}</div>
    <p class="muted" style="margin:0;font-size:12.5px">Green: running. Amber: waiting for its first run. Grey: switched off until its keys or consent are in place.</p></section>`;
}
function pageAgents() {
  const kinds = [['External', 'Search the web on a schedule'], ['Live', 'Answers on demand'], ['Internal', 'Run on the app\'s own data, nothing leaves it']];
  const card = g => { const st = agStatus(g.id), open = AG.open === g.id;
    const out = g.kind === 'Internal' ? agInternal(g.id) : g.id === 'scout' ? agScoutItems().slice(0, 4).map(x => x.title) : g.id === 'evidence' ? agEvidence().slice(0, 4).map(x => x.title) : g.id === 'askdesk' ? AG.askq.slice(0, 4).map(x => (x.status === 'done' ? 'Answered: ' : 'Queued: ') + x.q) : ['Ask anything on the Ask page'];
    return `<article class="ag-card${open ? ' open' : ''}" style="--ag:${g.color}"><button class="ag-head" data-ag="open" data-arg="${g.id}" aria-expanded="${open}"><span class="ag-orb" aria-hidden="true"><i></i></span><span class="grow"><b>${g.name}</b><span class="muted">${g.when}</span></span><span class="ag-st ag-${st[0]}">${st[1]}</span></button>
      <p class="ag-task">${esc(g.task)}</p>
      <div class="ag-flow"><span><em>Reads</em>${esc(g.reads)}</span><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M0 6h15M11 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span><em>Writes</em>${esc(g.writes)}</span><span><em>Goes to</em>${esc(g.who)}</span></div>
      ${open ? `<div class="ag-out"><span class="eyebrow">What it is doing</span>${out.length ? `<ul>${out.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing yet.</p>'}${g.id === 'scout' ? '<a class="btn sm" href="#innovation">Open the Innovation inbox</a>' : g.id === 'ask' || g.id === 'askdesk' ? '<a class="btn sm" href="#ask">Open Ask</a>' : ''}</div>` : ''}</article>`; };
  const feed = AG.runs.slice(0, 12);
  return `<div class="sec-head"><div><span class="eyebrow">${AGENTS.length} agents · external, live and internal</span><h1 style="font-size:34px;letter-spacing:-.6px">Agents</h1></div><a class="btn" href="#ask">Ask</a></div>
  <section class="ag-hero"><div><span class="eyebrow">How they work together</span><p>External agents bring the outside world in on a schedule. Internal agents work only on our own data and never send it out. Nothing reaches an athlete until a clinician pushes it.</p></div>
    <div class="ag-net" aria-hidden="true">${AGENTS.map((g, i) => { const a = i / AGENTS.length * Math.PI * 2 - Math.PI / 2; return `<span style="--x:${50 + Math.cos(a) * 40}%;--y:${50 + Math.sin(a) * 40}%;--ag:${g.color};--d:${i * 0.35}s" title="${g.name}"></span>`; }).join('')}<b>Lab</b></div></section>
  ${agMap()}
  ${kinds.map(([k, d]) => `<section class="stack" style="gap:12px"><div><span class="eyebrow">${k}</span><h2 style="font-size:20px">${d}</h2></div><div class="ag-grid">${AGENTS.filter(g => g.kind === k).map(card).join('')}</div></section>`).join('')}
  <section class="panel"><div class="sec-head"><h2>Run log</h2><span class="muted" style="font-size:13px">Written by the agents themselves</span></div>${feed.length ? `<div class="rows">${feed.map(r => `<div class="row" style="font-size:13.5px"><span class="dot" style="background:${(AGENTS.find(g => g.id === r.agent) || {}).color || '#888'}"></span><span class="grow"><b>${esc((AGENTS.find(g => g.id === r.agent) || {}).name || r.agent)}</b> · ${esc(r.summary || '')}</span><span class="muted num">${new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div>` : `<p class="muted" style="margin:0">${AG.cap.db ? 'No runs yet. The first scheduled run fills this.' : 'The run log needs the shared store, which this view does not have.'}</p>`}</section>`;
}
/* Innovation inbox: what the scout found, waiting for a clinician to push it */
/* On the team server the scout runs there (Grok on the web and X, plus chosen feeds) and writes the team `scout` record */
const agSrv = () => { try { return typeof SYNC !== 'undefined' && SYNC.on; } catch (e) { return false; } };
const AG_LANES = ['Launches and drops', 'Wearables and hardware', 'Performance science', 'Recovery and rehab', 'Longevity', 'Padel', 'Nutrition and supplements', 'Apparel and footwear', 'Software and AI'];
function agScoutItems() { return agSrv() ? Object.values(store.get('scout', {}) || {}).sort((a, b) => (b.at || '').localeCompare(a.at || '')) : AG.scout; }
function agEvidence() { return agSrv() ? agScoutItems().filter(x => x.kind === 'research').map(x => ({ title: x.title, url: x.url, finding: x.summary, grade: 'Research, check the paper', topic: x.lane, journal: x.source, date: x.date, at: x.at })) : AG.evidence; }
function agScoutHead() {
  if (!agSrv()) return '';
  const st = AG.srvStatus, dg = store.get('scoutdigest', null), lead = me().role === 'lead';
  if (!st && !AG.srvAsked) { AG.srvAsked = true; SYNC.api('GET', '/scout/status').then(r => { if (r.ok) { AG.srvStatus = r.body; keepRender(); } }).catch(() => { }); }
  const lanes = dg && dg.lanes ? Object.entries(dg.lanes) : [];
  return `<section class="panel"><div class="sec-head"><div><span class="eyebrow">This week by domain${dg ? ' · ' + esc(dg.date) : ''}</span><h2>Domain summaries</h2></div>${lead ? `<button class="btn sm" data-ag="scan" ${AG.scanning ? 'disabled' : ''}>${AG.scanning ? 'Scanning… (a few minutes)' : 'Run the scan now'}</button>` : ''}</div>
    <p class="muted" style="margin:0;font-size:12.5px">${st ? (st.grok ? `Grok (${esc(st.model)}) searches the web and X` : 'Grok is off until XAI_API_KEY is added in the server settings') + ` · ${st.feeds} feed${st.feeds === 1 ? '' : 's'}` + (st.scheduled ? ' · runs daily' : ' · not scheduled yet') : 'Checking the scout…'}. Public sources only; no team or patient data is sent. Links are kept only if Grok actually cited them.</p>
    ${lanes.length ? `<div class="facts">${AG_LANES.filter(l => dg.lanes[l]).map(l => `<div><span>${esc(l)}</span><span>${esc(dg.lanes[l].summary)}</span></div>`).join('')}</div>` : '<p class="muted" style="margin:0;font-size:13px">No summaries yet. They appear after the first scan.</p>'}
    ${dg && dg.errors && dg.errors.length ? `<p class="muted" style="font-size:12px;margin:0">Last scan had ${dg.errors.length} problem${dg.errors.length > 1 ? 's' : ''}: ${esc(dg.errors.slice(0, 2).join('; '))}</p>` : ''}</section>`;
}
function innovationInbox() {
  const lanes = AG_LANES;
  const items = agScoutItems().map(x => Object.assign({ pops: x.pops || inferPops([x.title, x.summary, x.why, x.lane].join(' ')) }, x)).filter(x => popMatch(x.pops)); const canPush = perm().clinical || me().role === 'lead';
  const byLane = l => items.filter(x => x.lane === l);
  return agScoutHead() + `<section class="stack" style="gap:14px"><div class="sec-head"><div><span class="eyebrow">Innovation scout · daily</span><h2>Today's scan</h2></div><span class="muted" style="font-size:13px">${items.length ? items.filter(x => x.status === 'new').length + ' waiting for a decision' : ''}</span></div>${popFilterBar('Scout results for')}
    ${items.length ? `<div class="ag-lanes">${lanes.map(l => `<section class="panel ag-lane"><h3>${l}</h3>${byLane(l).length ? byLane(l).slice(0, 4).map(x => `<article class="ag-item ${x.status || 'new'}"><a href="${esc(x.url || '#')}" target="_blank" rel="noopener"><b>${esc(x.title)}</b></a>${popTags(x.pops)}<p>${esc(x.summary || '')}</p>${x.why ? `<p class="muted"><b>Why it matters:</b> ${esc(x.why)}</p>` : ''}<span class="muted" style="font-size:11.5px">${x.kind && x.kind !== 'news' ? `<b>${esc(x.kind[0].toUpperCase() + x.kind.slice(1))}</b> · ` : ''}${esc(x.source || '')}${x.date ? ' · ' + esc(x.date) : ''}${x.via === 'grok' ? ' · found by Grok' : x.via === 'feed' ? ' · from a feed' : ''}</span>
      ${x.status === 'pushed' ? `<span class="chip c-ok">Sent to ${esc((x.pushedTo || []).map(g => (AG_GROUPS.find(a => a[0] === g) || [0, g])[1]).join(', '))}</span>` : x.status === 'dismissed' ? '<span class="chip c-muted">Dismissed</span>' : canPush ? `<div class="ag-push"><select data-ag-to="${x.id}">${AG_GROUPS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><button class="btn sm primary" data-ag="push" data-arg="${x.id}">Push</button><button class="btn sm" data-ag="dismiss" data-arg="${x.id}">Dismiss</button></div>` : ''}</article>`).join('') : '<p class="muted" style="margin:0;font-size:13px">Nothing new in this lane.</p>'}</section>`).join('')}</div>`
      : `<section class="panel"><p class="muted" style="margin:0">${agSrv() ? 'Nothing scanned yet.' : AG.cap.db ? 'The scout has not run yet. Its first scan lands here at 06:00 Abu Dhabi time.' : 'The inbox needs the shared store, which this view does not have.'}</p></section>`}</section>`;
}
/* Ask: live answers pitched to the person; deep research goes to the Ask desk */
const AG_BLOCK = () => new RegExp('\\b(' + ATH.map(a => a.name).concat(['player 1', 'patient', 'diagnos', 'mrn', 'emirates id', 'date of birth', 'dob']).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'i');
function agVoice() { const r = me().role; return r === 'athlete' ? 'athlete' : r === 'coach' ? 'coach' : 'clinician'; }
function pageAsk() {
  const R = AG.ask.res, mine = AG.askq.filter(q => !AG.me || q.by === AG.me);
  const hubIdx = EDU_DOMAINS.flatMap(d => d.sections.map(s => [d.id, s.id, s.title]));
  return `<div class="sec-head"><div><span class="eyebrow">Search engine · pulls papers from PubMed and Europe PMC · pitched to you as ${agVoice()}</span><h1 style="font-size:34px;letter-spacing:-.6px">Ask</h1></div></div>
  <section class="ask-box"><label class="ask-in"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="ask-q" placeholder="How long should I hold a stretch?" value="${esc(AG.ask.q)}" autocomplete="off"></label>
    <div class="ask-act"><button class="btn primary" data-ag="ask" ${AG.ask.busy ? 'disabled' : ''}>${AG.ask.busy ? 'Thinking…' : 'Answer now'}</button><button class="btn" data-ag="deep" title="The Ask desk researches it on the web and writes back within the hour">Research it on the web</button></div>
    ${popFilterBar('Answer for')}<div class="seg lit-f" role="group" aria-label="Where to search">${LIT_FILTERS.map(([k, l]) => `<button data-ag="litf" data-arg="${k}" aria-pressed="${AG.lit.filter === k}">${l}</button>`).join('')}</div>
    <div class="pills">${['How long should I hold a stretch?', 'What does a spring ligament sprain need to heal?', 'Is ice or heat better after padel?', 'How much protein after training?'].map(x => `<button class="pill" data-ag="try" data-arg="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <span class="muted" style="font-size:12.5px">Do not type names or patient details. Questions that contain them are stopped before anything is sent.</span></section>
  ${AG.ask.err ? `<p style="color:var(--risk);margin:0">${esc(AG.ask.err)}</p>` : ''}
  ${R ? `<section class="panel ask-ans"><div class="sec-head"><div><span class="eyebrow">Answer · ${esc(R.voice)}</span><h2>${esc(R.headline || AG.ask.q)}</h2></div><div class="pills"><button class="btn sm" data-ag="listen">${AG.speaking ? 'Stop' : 'Listen'}</button>${(R.anatomy || []).filter(k => DB[k]).slice(0, 2).map(k => `<button class="btn sm" data-act="focus" data-arg="${k}_R">Show ${esc(DB[k].name.toLowerCase())} in 3D</button>`).join('')}</div></div>
    <p class="ask-text">${esc(R.answer)}</p>${R.dose ? `<div class="facts"><div><span>Dose</span><span>${esc(R.dose)}</span></div>${R.caution ? `<div><span>Caution</span><span>${esc(R.caution)}</span></div>` : ''}</div>` : ''}
    ${(R.hub || []).length ? `<div class="pills">${R.hub.map(h => { const m = hubIdx.find(x => x[1] === h); return m ? `<button class="pill" data-ag="hub" data-d="${m[0]}" data-arg="${m[1]}">Read: ${esc(m[2])}</button>` : ''; }).join('')}</div>` : ''}
    ${AG.lit.papers.length ? `<div class="lit"><span class="eyebrow">Pulled from PubMed and Europe PMC · ${esc((LIT_FILTERS.find(x => x[0] === AG.lit.filter) || [])[1] || '')}</span>${AG.lit.papers.map(p => { const pt = (R.points || []).find(x => x.n === p.n); const used = (R.cited || []).includes(p.n); return `<a class="lit-p${used ? ' used' : ''}" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="lit-n">${p.n}</span><span class="grow"><b>${esc(p.title)}</b><span class="muted">${esc(p.authors)} · ${esc(p.journal || '')} ${esc(p.year || '')}${p.type ? ' · ' + esc(p.type) : ''}</span>${pt ? `<span class="lit-pt">${esc(pt.point)}</span>` : ''}</span>${p.oa ? '<span class="chip c-ok">Open access</span>' : ''}</a>`; }).join('')}</div>` : AG.lit.ok === false ? '<p class="muted" style="margin:0;font-size:12.5px">The literature databases could not be reached from this view, so this answer is from Claude\'s knowledge.</p>' : ''}
    <span class="muted" style="font-size:12.5px">${AG.lit.papers.length ? 'Written from the abstracts above. Read the full papers before changing practice.' : "Answered from Claude's knowledge, not a live search."} Check the evidence: ${(R.search || []).slice(0, 2).map(s => `${esc(s)} in <a href="https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(s)}" target="_blank" rel="noopener">PubMed</a>, <a href="https://europepmc.org/search?query=${encodeURIComponent(s)}" target="_blank" rel="noopener">Europe PMC</a>, <a href="https://bjsm.bmj.com/search/${encodeURIComponent(s)}" target="_blank" rel="noopener">BJSM</a>`).join(' · ')}; or press Research it on the web.</span></section>${storyPanel()}` : ''}
  <section class="panel"><div class="sec-head"><h2>Researched for you</h2><span class="muted" style="font-size:13px">The Ask desk answers these from the web, with sources</span></div>
    ${mine.length ? `<div class="rows">${mine.map(q => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${esc(q.q)}</b>${q.status === 'done' ? `<br>${esc(q.answer || '')}${(q.sources || []).length ? `<br>${q.sources.slice(0, 4).map(s => `<a class="muted" style="font-size:12px" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ')}` : ''}` : '<br><span class="muted">Queued for the Ask desk</span>'}</span><span class="chip ${q.status === 'done' ? 'c-ok' : 'c-muted'}">${q.status === 'done' ? 'Answered' : 'Queued'}</span></div>`).join('')}</div>` : `<p class="muted" style="margin:0">${AG.cap.db ? 'Nothing yet. Press Research it on the web to send a question to the Ask desk.' : 'Deep research needs the shared store, which this view does not have.'}</p>`}</section>`;
}

/* ---------- Literature pull: Europe PMC (indexes all of PubMed, PubMed Central and preprints) queried from the page, then the answer is written only from those abstracts ---------- */
const LIT_FILTERS = [['all', 'All of PubMed and Europe PMC', ''], ['oa', 'Open access only', ' AND OPEN_ACCESS:y'], ['reviews', 'Reviews and guidelines', ' AND (PUB_TYPE:"review" OR PUB_TYPE:"systematic-review" OR PUB_TYPE:"guideline" OR PUB_TYPE:"practice-guideline")'], ['bjsm', 'BJSM only', ' AND JOURNAL:"Br J Sports Med"'], ['sportmed', 'Sports medicine journals', ' AND (JOURNAL:"Br J Sports Med" OR JOURNAL:"Sports Med" OR JOURNAL:"Am J Sports Med" OR JOURNAL:"J Orthop Sports Phys Ther" OR JOURNAL:"Int J Sports Physiol Perform" OR JOURNAL:"Med Sci Sports Exerc" OR JOURNAL:"J Sci Med Sport" OR JOURNAL:"Scand J Med Sci Sports")'], ['preprints', 'Preprints (incl. SportRxiv)', ' AND SRC:PPR']];
AG.lit = { filter: 'reviews', papers: [], ok: null };
async function litSearch(q) {
  const f = (LIT_FILTERS.find(x => x[0] === AG.lit.filter) || LIT_FILTERS[0])[2];
  const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=6&query=' + encodeURIComponent('(' + q + ')' + f);
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('status ' + r.status);
  const j = await r.json();
  return ((j.resultList || {}).result || []).map((p, i) => ({ n: i + 1, title: (p.title || '').replace(/<[^>]+>/g, ''), journal: (p.journalInfo && p.journalInfo.journal && (p.journalInfo.journal.isoabbreviation || p.journalInfo.journal.title)) || p.bookOrReportDetails && p.bookOrReportDetails.publisher || p.source, year: p.pubYear, authors: (p.authorString || '').split(',').slice(0, 3).join(',') + ((p.authorString || '').split(',').length > 3 ? ' et al.' : ''), pmid: p.pmid, doi: p.doi, oa: p.isOpenAccess === 'Y', type: ((p.pubTypeList || {}).pubType || []).slice(0, 2).join(', '), abstract: (p.abstractText || '').replace(/<[^>]+>/g, '').slice(0, 1600), url: p.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + p.pmid + '/' : p.doi ? 'https://doi.org/' + p.doi : 'https://europepmc.org/article/' + p.source + '/' + p.id }));
}

async function agAsk(deep) {
  const q = (document.getElementById('ask-q') || {}).value || AG.ask.q; AG.ask.q = q.trim(); AG.ask.err = '';
  if (!AG.ask.q) return;
  if (AG_BLOCK().test(AG.ask.q)) { AG.ask.err = 'This question mentions a person or patient details, so it was not sent. Ask it in general terms.'; keepRender(); return; }
  if (deep) {
    if (!AG.cap.db) { AG.ask.err = 'Deep research needs the shared store, which this view does not have.'; keepRender(); return; }
    try { await AG.cap.db.collection('askq').add({ q: AG.ask.q, voice: agVoice(), by: AG.me || 'anon', at: new Date().toISOString(), status: 'queued' }); toast('Sent to the Ask desk. The answer appears below, usually within the hour.'); } catch (e) { AG.ask.err = 'Could not queue it: ' + (e.message || e.code); }
    keepRender(); return;
  }
  if (!AG.cap.sample) { AG.ask.err = 'Live answers are not available in this view.'; keepRender(); return; }
  AG.ask.busy = true; AG.ask.res = null; AG.lit.papers = []; AG.lit.ok = null; keepRender();
  try { AG.lit.papers = await litSearch(AG.ask.q); AG.lit.ok = true; } catch (e) { AG.lit.ok = false; }
  keepRender();
  const voice = agVoice(), hub = EDU_DOMAINS.flatMap(d => d.sections.map(s => s.id + ': ' + s.title)).join('; '), keys = Object.keys(DB).join(', ');
  const popTxt = POPF === 'all' ? '' : ` Pitch the dose for a ${popOf(POPF)[1].toLowerCase()} person (McKay ${popOf(POPF)[3]}) and say how it differs for other levels in one line.`;
  const style = { athlete: 'Speak to an athlete: plain words, practical, under 120 words.', coach: 'Speak to a padel coach: court-focused and practical, under 150 words.', clinician: 'Speak to a clinician: evidence-based, give dose, population differences and contraindications, under 200 words.' }[voice];
  const prompt = `You answer sports science and rehab questions inside a performance clinic's app. ${style}${popTxt} Be accurate and say when evidence is mixed. Do not invent studies or URLs.
Return JSON only: {"headline": short title, "answer": the answer, "dose": the practical dose or "" , "caution": when not to or "", "hub": up to 3 ids from this Education hub list that fit, "anatomy": up to 2 keys from this anatomy list that fit, "search": 2 or 3 short PubMed search phrases}.
Education hub ids: ${hub}
Anatomy keys: ${keys}
Question: ${AG.ask.q}
${AG.lit.papers.length ? `Base the answer on these papers pulled from PubMed and Europe PMC. Use only what their abstracts support, cite them inline as [1], [2] by number, and add "cited": the numbers you used, and "points": for each cited paper one short key finding as {"n": number, "point": text}. If they do not answer the question, say so.
` + AG.lit.papers.map(p => `[${p.n}] ${p.title} (${p.journal}, ${p.year}; ${p.type}). Abstract: ${p.abstract || 'not available'}`).join('\n') : 'No papers could be pulled, so answer from established guidance and say that sources were not retrieved.'}`;
  try { const r = await AG.cap.sample.json(prompt, { modelTier: 'default' }); AG.ask.res = Object.assign({ voice }, r); audit('Asked the AI', 'General question'); }
  catch (e) { AG.ask.err = e && e.code === 'not_granted' ? 'Live answers were not allowed in this view.' : e && e.code === 'rate_limited' ? 'Too many questions just now. Try again in a minute.' : 'No answer this time.'; }
  AG.ask.busy = false; keepRender();
}
function agSpeak() {
  const R = AG.ask.res; if (!R || !window.speechSynthesis) { toast('Audio is not available on this device'); return; }
  if (AG.speaking) { speechSynthesis.cancel(); AG.speaking = false; keepRender(); return; }
  const u = new SpeechSynthesisUtterance([R.headline, R.answer, R.dose ? 'Dose. ' + R.dose : '', R.caution ? 'Caution. ' + R.caution : ''].filter(Boolean).join('. '));
  u.rate = 1.02; u.lang = 'en-GB'; u.onend = () => { AG.speaking = false; keepRender(); }; AG.speaking = true; speechSynthesis.speak(u); keepRender();
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-ag]'); if (!t) return; const k = t.dataset.ag, a = t.dataset.arg;
  if (k === 'open') { AG.open = AG.open === a ? null : a; keepRender(); }
  else if (k === 'litf') { AG.lit.filter = a; keepRender(); }
  else if (k === 'try') { AG.ask.q = a; agAsk(false); }
  else if (k === 'ask') agAsk(false);
  else if (k === 'deep') agAsk(true);
  else if (k === 'listen') agSpeak();
  else if (k === 'hub') { EDU.dom = t.dataset.d; EDU.sec = a; go(me().role === 'athlete' ? 'learn' : 'learn'); }
  else if (k === 'scan' && agSrv()) { AG.scanning = true; keepRender(); try { const r = await SYNC.api('POST', '/scout/run'); await SYNC.pull(); toast(r.ok ? `${r.body.added} new item${r.body.added === 1 ? '' : 's'} from ${r.body.lanes} domains` : (r.body.error || 'The scan failed')); } catch (err) { toast('The scan failed'); } AG.scanning = false; keepRender(); }
  else if ((k === 'push' || k === 'dismiss') && agSrv()) {
    const to = (document.querySelector(`[data-ag-to="${a}"]`) || {}).value, m = Object.assign({}, store.get('scout', {})); if (!m[a]) return;
    m[a] = Object.assign({}, m[a], k === 'push' ? { status: 'pushed', pushedTo: [to], pushedAt: new Date().toISOString(), pushedBy: me().name } : { status: 'dismissed' });
    store.set('scout', m); audit(k === 'push' ? 'Pushed an innovation item' : 'Dismissed an innovation item', k === 'push' ? (AG_GROUPS.find(g => g[0] === to) || [0, to])[1] : ''); toast(k === 'push' ? 'Sent' : 'Dismissed'); keepRender();
  }
  else if ((k === 'push' || k === 'dismiss') && AG.cap.db) {
    const to = (document.querySelector(`[data-ag-to="${a}"]`) || {}).value;
    try { await AG.cap.db.doc('scout/' + a).update(k === 'push' ? { status: 'pushed', pushedTo: [to], pushedAt: new Date().toISOString() } : { status: 'dismissed' }); audit(k === 'push' ? 'Pushed an innovation item' : 'Dismissed an innovation item', k === 'push' ? (AG_GROUPS.find(g => g[0] === to) || [0, to])[1] : ''); toast(k === 'push' ? 'Sent' : 'Dismissed'); }
    catch (err) { toast(err && err.code === 'not_granted' ? 'You cannot change the inbox in this view' : 'Could not save that'); }
  }
});
document.addEventListener('keydown', e => { if (e.target && e.target.id === 'ask-q' && e.key === 'Enter') { e.preventDefault(); agAsk(false); } });
setTimeout(agInit, 0);
window.__AG = AG; window.__render = () => render();
