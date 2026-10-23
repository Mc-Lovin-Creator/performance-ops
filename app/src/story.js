/* ---------- v44 Story mode: any search answer becomes a storyboard and a two-voice mini podcast (10 minutes or less), written only from the papers pulled ---------- */
const STORY_ = { busy: false, ep: null, ch: 0, ln: 0, playing: false, rate: 1, el: null, err: '' };
const SPK = { A: { name: 'Maya', role: 'host', pitch: 1.12, col: '#5eead4' }, B: { name: 'Dr Reid', role: 'scientist', pitch: 0.86, col: '#a78bfa' } };
const storyWords = ep => ep.chapters.reduce((n, c) => n + c.lines.reduce((m, l) => m + l.t.split(/\s+/).length, 0), 0);
const storyMins = ep => Math.max(1, Math.round(storyWords(ep) / 150 / STORY_.rate));
/* offline fallback: a short episode assembled from the answer itself, so story mode always works */
function storyFallback(R) {
  const P = AG.lit.papers || [], cites = (R.points || []).slice(0, 4);
  return { title: R.headline || AG.ask.q, chapters: [
    { title: 'The question', lines: [{ s: 'A', t: `Today's question: ${AG.ask.q}` }, { s: 'B', t: 'Good one, and the evidence has a clear answer for most people, with a few exceptions.' }] },
    { title: 'What the science says', lines: [{ s: 'B', t: R.answer.replace(/\[(\d+)\]/g, '') }].concat(cites.map(c => ({ s: 'A', t: `And paper ${c.n}?`, cite: [c.n] })).flatMap((q, i) => [q, { s: 'B', t: cites[i].point, cite: [cites[i].n] }])) },
    { title: 'Do it on Monday', lines: [{ s: 'A', t: R.dose ? `So the dose: ${R.dose}` : 'So what do we actually do?' }, { s: 'B', t: R.caution ? `One caution: ${R.caution}` : 'Start small, track how you respond, and progress one thing at a time.' }] },
    { title: 'Last word', lines: [{ s: 'A', t: 'That\'s the story. The sources are on screen.' }, { s: 'B', t: P.length ? `Read the full papers before you change practice. Abstracts only tell part of it.` : 'Sources were not retrieved this time, so check PubMed before acting on it.' }] }
  ] };
}
async function storyMake() {
  const R = AG.ask.res; if (!R) return; STORY_.err = '';
  if (AG_BLOCK().test(AG.ask.q)) { STORY_.err = 'This question mentions a person or patient details, so it was not sent.'; keepRender(); return; }
  STORY_.busy = true; keepRender();
  const P = AG.lit.papers || [], popTxt = POPF === 'all' ? 'a mixed audience from sedentary to elite' : 'a ' + popOf(POPF)[1].toLowerCase() + ' audience';
  const prompt = `Write a short two-voice science podcast episode for ${popTxt} inside a sports performance clinic's app.
Voices: "A" is Maya, a curious host; "B" is Dr Reid, an exercise scientist. Conversational, warm, never hype. Accurate: use only what the papers below support and say when evidence is mixed. No invented studies, names of real people, numbers or URLs.
Length: 600 to 1300 words in total (under 10 minutes spoken). 4 to 6 chapters, each with a short cinematic title (2 to 4 words), e.g. "The Myth", "Inside the Tendon", "Monday Morning".
Structure: a hook; the mechanism in plain words; what the papers found (cite paper numbers in "cite"); the dose by population (sedentary, trained, competitive, elite) where it differs; safety and who should not; one takeaway.
Return JSON only: {"title": episode title, "chapters": [{"title": text, "visual": one sentence describing a storyboard frame for this chapter, "anatomy": optional key from this list or "", "lines": [{"s": "A" or "B", "t": spoken text, "cite": [paper numbers]}]}]}.
Anatomy keys: ${Object.keys(DB).join(', ')}
Question: ${AG.ask.q}
Answer already given: ${R.answer}
${P.length ? 'Papers:\n' + P.map(p => `[${p.n}] ${p.title} (${p.journal}, ${p.year}). Abstract: ${p.abstract || 'not available'}`).join('\n') : 'No papers were retrieved: say so in the episode and keep to established guidance.'}`;
  let ep = null;
  if (AG.cap.sample) { try { ep = await AG.cap.sample.json(prompt, { modelTier: 'default' }); audit('Made a story episode', 'General question'); } catch (e) { STORY_.err = e && e.code === 'rate_limited' ? 'Too many requests just now; here is the short version.' : ''; } }
  if (!ep || !Array.isArray(ep.chapters) || !ep.chapters.length) ep = storyFallback(R);
  ep.chapters = ep.chapters.slice(0, 6).map(c => Object.assign(c, { lines: (c.lines || []).filter(l => l && l.t).map(l => ({ s: l.s === 'B' ? 'B' : 'A', t: String(l.t), cite: (l.cite || []).filter(n => P.find(p => p.n === n)) })) }));
  /* hard cap at 10 minutes */
  while (storyWords(ep) > 1450 && ep.chapters.length > 2) ep.chapters.splice(ep.chapters.length - 2, 1);
  STORY_.ep = ep; STORY_.ch = 0; STORY_.ln = 0; STORY_.busy = false; keepRender(); storyOpen();
}
function storyPanel() {
  const ep = STORY_.ep;
  return `<section class="panel story-p"><div class="sec-head"><div><span class="eyebrow">Story mode · storyboard and a two-voice mini podcast · 10 minutes or less</span><h2>${ep ? esc(ep.title) : 'Turn this answer into a story'}</h2></div>
    <div class="pills">${ep ? `<button class="btn primary sm" data-st="open">▶ Play episode · ${storyMins(ep)} min</button>` : ''}<button class="btn sm${ep ? '' : ' primary'}" data-st="make" ${STORY_.busy ? 'disabled' : ''}>${STORY_.busy ? 'Writing the episode…' : ep ? 'Rewrite' : 'Make the story'}</button></div></div>
    ${STORY_.err ? `<p class="muted" style="margin:0">${esc(STORY_.err)}</p>` : ''}
    ${ep ? `<div class="sb-strip">${ep.chapters.map((c, i) => `<button class="sb-card" data-st="jump" data-arg="${i}" style="--i:${i}"><span class="sb-n">Chapter ${i + 1}</span><b>${esc(c.title)}</b><span class="sb-v">${esc(c.visual || c.lines[0] && c.lines[0].t.slice(0, 90) + '…' || '')}</span>${(c.lines.flatMap(l => l.cite || [])).length ? `<span class="sb-c">${[...new Set(c.lines.flatMap(l => l.cite))].map(n => `<i>${n}</i>`).join('')}</span>` : ''}</button>`).join('')}</div>` : '<p class="muted" style="margin:0">Pulls the papers above into a storyboard, then two voices talk it through: the question, the mechanism, what the papers found, the dose by population, and the safety line.</p>'}</section>`;
}
/* player: full-screen, chapter slates between chapters, live transcript, two voices */
function storyVoices() { const v = (window.speechSynthesis && speechSynthesis.getVoices()) || [], en = v.filter(x => /^en/i.test(x.lang)); return [en.find(x => /female|samantha|serena|libby|sonia|karen|moira|google uk english female/i.test(x.name)) || en[0] || null, en.find(x => /male|daniel|arthur|ryan|george|oliver|google uk english male/i.test(x.name) && !/female/i.test(x.name)) || en[1] || en[0] || null]; }
function storyOpen() {
  if (!STORY_.ep) return;
  if (!STORY_.el) { STORY_.el = document.createElement('div'); STORY_.el.className = 'stp'; STORY_.el.setAttribute('role', 'dialog'); STORY_.el.setAttribute('aria-modal', 'true'); STORY_.el.setAttribute('aria-label', 'Story mode'); document.body.appendChild(STORY_.el); }
  STORY_.el.hidden = false; document.body.style.overflow = 'hidden'; storyDraw(true); requestAnimationFrame(() => STORY_.el.classList.add('on'));
}
function storyClose() { storyStop(); if (!STORY_.el) return; STORY_.el.classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { if (STORY_.el && !STORY_.el.classList.contains('on')) STORY_.el.hidden = true; }, 350); }
function storyDraw(slate) {
  const ep = STORY_.ep, c = ep.chapters[STORY_.ch], P = AG.lit.papers || [], total = ep.chapters.reduce((n, x) => n + x.lines.length, 0), done = ep.chapters.slice(0, STORY_.ch).reduce((n, x) => n + x.lines.length, 0) + STORY_.ln, l = c.lines[STORY_.ln] || c.lines[0];
  STORY_.el.innerHTML = `<div class="stp-bars">${ep.chapters.map((x, i) => `<span><i style="width:${i < STORY_.ch ? 100 : i === STORY_.ch ? Math.round(STORY_.ln / Math.max(1, x.lines.length) * 100) : 0}%"></i></span>`).join('')}</div>
    <div class="stp-top"><span class="eyebrow">${esc(ep.title)} · ${storyMins(ep)} min</span><button class="rp-x" data-st="close" aria-label="Close">✕</button></div>
    ${slate ? `<div class="stp-slate"><span>Chapter ${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][STORY_.ch]}</span><b>${esc(c.title)}</b><i></i></div>` : ''}
    <div class="stp-stage">
      <div class="stp-voices">${['A', 'B'].map(s => `<div class="stp-v${l && l.s === s && STORY_.playing ? ' talk' : ''}" style="--c:${SPK[s].col}"><span class="stp-orb"><i></i><i></i><i></i></span><b>${SPK[s].name}</b><em>${SPK[s].role}</em></div>`).join('')}</div>
      <div class="stp-tx" id="stp-tx">${c.lines.map((x, i) => `<p class="${i === STORY_.ln ? 'now' : i < STORY_.ln ? 'past' : ''}" style="--c:${SPK[x.s].col}"><b>${SPK[x.s].name}</b> ${esc(x.t)}${(x.cite || []).length ? ` <sup>${x.cite.map(n => `[${n}]`).join('')}</sup>` : ''}</p>`).join('')}</div>
      <div class="stp-side">${c.visual ? `<div class="stp-frame"><span class="eyebrow">Storyboard</span><p>${esc(c.visual)}</p>${c.anatomy && DB[c.anatomy] ? `<button class="btn sm" data-st="anat" data-arg="${c.anatomy}">Show ${esc(DB[c.anatomy].name.toLowerCase())} in 3D</button>` : ''}</div>` : ''}
        ${P.length ? `<div class="stp-src"><span class="eyebrow">Sources</span>${P.map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="${(l.cite || []).includes(p.n) ? 'hot' : ''}"><i>${p.n}</i>${esc(p.title.slice(0, 80))}${p.title.length > 80 ? '…' : ''} <span>${esc(p.journal || '')} ${esc(p.year || '')}</span></a>`).join('')}</div>` : ''}</div></div>
    <div class="stp-ctl"><button class="btn" data-st="prev" ${STORY_.ch ? '' : 'disabled'}>⏮ Chapter</button><button class="btn primary stp-play" data-st="play">${STORY_.playing ? '❚❚ Pause' : '▶ Play'}</button><button class="btn" data-st="next">Chapter ⏭</button>
      <div class="seg">${[0.9, 1, 1.2, 1.4].map(r => `<button data-st="rate" data-arg="${r}" aria-pressed="${STORY_.rate === r}">${r}×</button>`).join('')}</div><span class="muted">${done} of ${total} lines · voices are your device's</span></div>`;
  const now = STORY_.el.querySelector('.stp-tx .now'); if (now) now.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (slate) setTimeout(() => { const s = STORY_.el && STORY_.el.querySelector('.stp-slate'); if (s) s.classList.add('out'); }, 1300);
}
function storyStop() { STORY_.playing = false; try { speechSynthesis.cancel(); } catch (e) { } }
function storySpeak() {
  const ep = STORY_.ep; if (!ep || !STORY_.playing) return;
  const c = ep.chapters[STORY_.ch]; if (!c) { storyStop(); storyDraw(false); toast('Episode finished'); return; }
  const l = c.lines[STORY_.ln]; if (!l) { if (STORY_.ch < ep.chapters.length - 1) { STORY_.ch++; STORY_.ln = 0; storyDraw(true); setTimeout(storySpeak, 1500); } else { storyStop(); storyDraw(false); celebrate && celebrate(null, null, 1); toast('Episode finished'); } return; }
  storyDraw(false);
  if (!window.speechSynthesis) { setTimeout(() => { STORY_.ln++; storySpeak(); }, Math.max(1600, l.t.split(/\s+/).length * 400 / STORY_.rate)); return; }
  const [va, vb] = storyVoices(), u = new SpeechSynthesisUtterance(l.t); u.voice = l.s === 'A' ? va : vb; u.pitch = SPK[l.s].pitch; u.rate = STORY_.rate; u.lang = 'en-GB';
  u.onend = () => { if (!STORY_.playing) return; STORY_.ln++; setTimeout(storySpeak, 260); }; u.onerror = u.onend; speechSynthesis.speak(u);
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-st]'); if (!t) return; const k = t.dataset.st, a = t.dataset.arg;
  if (k === 'make') storyMake(); else if (k === 'open') storyOpen(); else if (k === 'close') storyClose();
  else if (k === 'jump') { STORY_.ch = +a; STORY_.ln = 0; storyOpen(); }
  else if (k === 'play') { if (STORY_.playing) { storyStop(); storyDraw(false); } else { STORY_.playing = true; storySpeak(); } }
  else if (k === 'next' || k === 'prev') { const was = STORY_.playing; storyStop(); STORY_.ch = Math.max(0, Math.min(STORY_.ep.chapters.length - 1, STORY_.ch + (k === 'next' ? 1 : -1))); STORY_.ln = 0; storyDraw(true); if (was) { STORY_.playing = true; setTimeout(storySpeak, 1500); } }
  else if (k === 'rate') { STORY_.rate = +a; storyDraw(false); }
  else if (k === 'anat') { storyClose(); go('anatomy'); setTimeout(() => window.AnatomyLab && AnatomyLab.focusOn && (AnatomyLab.select(a + '_R'), AnatomyLab.focusOn(a + '_R')), 900); }
});
document.addEventListener('keydown', e => { if (!STORY_.el || STORY_.el.hidden) return; if (e.key === 'Escape') storyClose(); else if (e.key === ' ') { e.preventDefault(); STORY_.el.querySelector('[data-st="play"]').click(); } });
