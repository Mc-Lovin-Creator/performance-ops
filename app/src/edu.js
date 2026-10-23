/* ---------- Education hub (Performance Library from fascia-body-flow) — one hub, used in Player 1's section and the squad section ---------- */
const EDU = { dom: 'routines', sec: 'morning', topic: {}, open: {}, pop: 'competitive', ctab: 'populations' };
const E = FBF;
const EDU_DOMAINS = [
  { id: 'routines', label: 'Fascia routines', p1: true, sections: ROUTINES.map(r => ({ id: r.id, label: r.label, title: r.label, description: r.summary + ' · ' + r.duration, render: () => eduRoutine(r) })) },
  { id: 'recovery', label: 'Recovery and rehab', sections: [
    { id: 'healing', label: 'Tissue healing', title: 'Tissue healing timelines', description: 'How long each tissue really takes to heal, by severity, on a shared 0 to 2 year scale.', render: eduHealing },
    { id: 'pain', label: 'If it hurts', title: 'Pain and rehab options', description: 'What to do for each kind of pain, and the rehab tools with their dose.', render: eduPain },
    { id: 'electro', label: 'Electrotherapy', title: 'Electrotherapy', description: 'TENS, ultrasound, shortwave, IFT, cryotherapy, heat and NMES: parameters, effects, indications and contraindications.', render: () => eduTopics('electro', E.electrotherapyData.ELECTROTHERAPY_MODALITIES) + eduElectroExtra() }
  ] },
  { id: 'biomech', label: 'Biomechanics', sections: [
    { id: 'core', label: 'Core biomechanics', title: 'Biomechanics', description: 'Core concepts, planes and axes, types of motion, Newton\'s laws, force and torque, levers, stability, muscle contractions and length-tension.', render: () => eduTopics('bio', E.biomechanicsTopicsData.BIOMECHANICS_TOPICS) },
    { id: 'load', label: 'Load science', title: 'How external force loads the body', description: 'Every movement creates internal stress. Understanding force types helps you train smarter and reduce injury risk.', render: eduLoad }
  ] },
  { id: 'physiology', label: 'Physiology', sections: [
    { id: 'phys', label: 'Exercise physiology', title: 'Exercise physiology and bioenergetics', description: 'ACSM core science: energy systems, VO2max, lactate thresholds, cardiovascular response, FITT-VP prescription and environmental physiology.', render: () => eduTopics('phys', E.physiologyTopicsData.PHYSIOLOGY_TOPICS) }
  ] },
  { id: 'coaching', label: 'Coaching science', sections: [
    { id: 'domains', label: 'Performance domains', title: 'Performance domains', description: 'The six pillars of athletic performance, each connected to the fascial system.', render: eduDomains },
    { id: 'elite', label: 'Elite S&C principles', title: 'Elite S&C principles', description: 'How high-performance coaching works at the elite level: value beyond the barbell, asymmetry, season planning, tech, travel and the human side.', render: eduElite },
    { id: 'framework', label: 'Framework', title: E.frameworkData.frameworkOverview.title, description: E.frameworkData.frameworkOverview.description, render: eduFramework }
  ] },
  { id: 'evidence', label: 'Evidence library', sections: [
    { id: 'sources', label: 'Sources', title: 'Evidence library', description: 'PubMed, BJSM, open-access journals, preprints and the organisations behind the guidelines, with one search box for all of them.', render: evidenceLibrary }
  ] },
  { id: 'body', label: 'Body regions', sections: [
    { id: 'regions', label: 'Regions and injuries', title: 'Body regions, tissues and injuries', description: 'For each region: the muscles, tendons, nerves, bones and fascia, the common injuries, and recent research.', render: eduBody }
  ] }
];
function eduHub(scope) {
  const doms = EDU_DOMAINS;
  if (!doms.find(d => d.id === EDU.dom)) EDU.dom = doms[0].id;
  const dom = doms.find(d => d.id === EDU.dom), sec = dom.sections.find(s => s.id === EDU.sec) || dom.sections[0];
  return `<div class="edu">
    <div class="edu-top"><div class="stack" style="gap:12px;min-width:0">${popFilterBar('Content for')}<nav class="seg edu-doms" aria-label="Domains">${doms.filter(d => d.id === dom.id || popMatch(EDU_POPS[d.id])).map(d => `<button data-edu="dom" data-arg="${d.id}" aria-pressed="${d.id === dom.id}">${d.label}${popTags(EDU_POPS[d.id])}</button>`).join('')}</nav></div>${typeof holoCard === 'function' ? holoCard() : ''}</div>
    ${dom.sections.length > 1 ? `<div class="pills edu-secs">${dom.sections.map(s => `<button class="pill" data-edu="sec" data-arg="${s.id}" aria-pressed="${s.id === sec.id}">${s.label}</button>`).join('')}</div>` : ''}
    <div class="edu-head"><span class="eyebrow">${dom.label}${scope === 'p1' ? ' · Player 1' : ''}</span><h2 style="font-size:26px;letter-spacing:-.3px">${esc(sec.title)}</h2><p class="muted" style="margin:0;max-width:72ch">${esc(sec.description)}</p></div>
    <div class="edu-body">${sec.render()}</div></div>`;
}
/* fascia routines with the videos made for Player 1 */
function eduRoutine(r) {
  return `<div class="edu-rt-bar"><button class="btn primary" data-rp="open" data-r="${r.id}" data-i="0"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>Play the routine</button><span class="muted">${r.steps.length} steps · ${esc(r.duration)} · on the 3D body or on film, plays straight through</span></div>
  <div class="edu-steps">${r.steps.map((s, i) => `<article class="panel edu-step"><button class="edu-vid" data-rp="open" data-r="${r.id}" data-i="${i}" aria-label="Play step ${i + 1}, ${esc(s.title)}"><video src="${s.videoUrl}#t=0.6" muted playsinline preload="metadata" onerror="this.parentNode.classList.add('off')"></video><span class="edu-play"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg></span><span class="edu-vid-n">${String(i + 1).padStart(2, '0')}</span></button>
    <div class="stack" style="gap:8px"><span class="eyebrow">Step ${i + 1} of ${r.steps.length}</span><h3 style="font-size:19px">${esc(s.title)}</h3><p style="margin:0">${esc(s.lead)}</p>
    <div class="pills">${s.actions.map(a => `<span class="chip plain c-muted">${esc(a)}</span>`).join('')}</div><p class="muted serif" style="margin:0;font-size:16px;font-style:italic">${esc(s.closing)}</p></div></article>`).join('')}</div>`;
}
/* full-screen routine player: story-style progress, auto-advance, timer fallback when a video cannot play */
const RP = { r: null, i: 0, el: null, raf: 0, t0: 0, fallback: false, STEP_S: 45, mode: store.get('rpmode') || '3d' };
function rpOpen(rid, i) {
  RP.r = ROUTINES.find(x => x.id === rid); RP.i = i || 0; if (!RP.r) return;
  if (!RP.el) { RP.el = document.createElement('div'); RP.el.className = 'rp'; RP.el.setAttribute('role', 'dialog'); RP.el.setAttribute('aria-modal', 'true'); document.body.appendChild(RP.el); }
  RP.el.hidden = false; document.body.style.overflow = 'hidden'; rpStep(); requestAnimationFrame(() => RP.el.classList.add('on'));
}
function rpClose() { if (!RP.el) return; if (RP.mode === '3d' && window.AnatomyLab) { AnatomyLab.set('move', 'idle'); if (!['anatomy', 'p1anat'].includes(S.route)) AnatomyLab.stop(); else setTimeout(() => render(), 400); } cancelAnimationFrame(RP.raf); const v = RP.el.querySelector('video'); if (v) v.pause(); RP.el.classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { if (RP.el && !RP.el.classList.contains('on')) RP.el.hidden = true; }, 380); }
function rpStep() {
  const r = RP.r, s = r.steps[RP.i]; RP.fallback = false; cancelAnimationFrame(RP.raf);
  if (RP.mode === '3d' && window.AnatomyLab && typeof FLOWS !== 'undefined' && FLOWS[r.id] && FLOWS[r.id][RP.i]) return rpStep3d();
  RP.el.innerHTML = `<div class="rp-bars">${r.steps.map((_, k) => `<span><i style="width:${k < RP.i ? 100 : 0}%"></i></span>`).join('')}</div>
    <div class="rp-top"><span class="eyebrow" style="color:rgba(255,255,255,.7)">${esc(r.label)} · step ${RP.i + 1} of ${r.steps.length}</span><div class="seg rp-mode"><button data-rp="mode" data-arg="3d" aria-pressed="false">3D anatomy</button><button data-rp="mode" data-arg="video" aria-pressed="true">Film</button></div><button class="rp-x" data-rp="close" aria-label="Close">✕</button></div>
    <div class="rp-stage"><div class="rp-vid"><video src="${s.videoUrl}" playsinline autoplay preload="auto"></video><div class="rp-ring" hidden><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="rp-arc" cx="60" cy="60" r="54" pathLength="100"/></svg><b class="num">45</b></div></div>
      <div class="rp-text"><h2>${esc(s.title)}</h2><p class="rp-lead">${esc(s.lead)}</p><ol class="rp-acts">${s.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ol><p class="rp-close serif">${esc(s.closing)}</p>
      <div class="rp-nav"><button class="btn" data-rp="prev" ${RP.i ? '' : 'disabled'}>Back</button><button class="btn primary" data-rp="next">${RP.i < r.steps.length - 1 ? 'Next step' : 'Finish'}</button></div></div></div>`;
  const v = RP.el.querySelector('video'), bar = RP.el.querySelectorAll('.rp-bars i')[RP.i];
  const startTimer = () => { RP.fallback = true; RP.el.querySelector('.rp-vid').classList.add('off'); RP.el.querySelector('.rp-ring').hidden = false; RP.t0 = performance.now(); tick(); };
  const tick = () => {
    if (RP.fallback) { const p = Math.min(1, (performance.now() - RP.t0) / (RP.STEP_S * 1000)); bar.style.width = p * 100 + '%'; const arc = RP.el.querySelector('.rp-arc'); if (arc) arc.style.strokeDashoffset = 100 - p * 100; const n = RP.el.querySelector('.rp-ring b'); if (n) n.textContent = Math.ceil(RP.STEP_S * (1 - p)); if (p >= 1) return rpNext(); }
    else if (v.duration) bar.style.width = (v.currentTime / v.duration * 100) + '%';
    RP.raf = requestAnimationFrame(tick);
  };
  v.addEventListener('error', startTimer, { once: true });
  v.addEventListener('ended', rpNext, { once: true });
  v.play().then(tick).catch(() => { v.muted = true; v.play().then(tick).catch(startTimer); });
}
function rpStep3d() {
  const r = RP.r, s = r.steps[RP.i], f = FLOWS[r.id][RP.i];
  RP.el.innerHTML = `<div class="rp-bars">${r.steps.map((_, k) => `<span><i style="width:${k < RP.i ? 100 : 0}%"></i></span>`).join('')}</div>
    <div class="rp-top"><span class="eyebrow" style="color:rgba(255,255,255,.7)">${esc(r.label)} · step ${RP.i + 1} of ${r.steps.length}</span><div class="seg rp-mode"><button data-rp="mode" data-arg="3d" aria-pressed="true">3D anatomy</button><button data-rp="mode" data-arg="video" aria-pressed="false">Film</button></div><button class="rp-x" data-rp="close" aria-label="Close">✕</button></div>
    <div class="rp-stage"><div class="rp-vid rp-3d"><div class="rp3d-host" id="rp3d"></div><div class="rp3d-tag"><i></i>${esc(f.line)}</div><div class="rp3d-heat"><span>Lengthening</span><b></b><span>Shortening</span></div><div class="rp3d-t num" id="rp3d-t">${RP.STEP_S}</div></div>
      <div class="rp-text"><span class="sb-n">Step ${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][RP.i]}</span><h2>${esc(s.title)}</h2><p class="rp-lead">${esc(s.lead)}</p><ol class="rp-acts">${s.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ol><p class="rp-close serif">${esc(s.closing)}</p>
      <div class="rp-story">${r.steps.map((x, k) => `<button class="${k === RP.i ? 'on' : k < RP.i ? 'done' : ''}" data-rp="goto" data-i="${k}" title="${esc(x.title)}"><b>${k + 1}</b><span>${esc(x.title)}</span></button>`).join('')}</div>
      <div class="rp-nav"><button class="btn" data-rp="prev" ${RP.i ? '' : 'disabled'}>Back</button><button class="btn primary" data-rp="next">${RP.i < r.steps.length - 1 ? 'Next step' : 'Finish'}</button></div></div></div>`;
  rp3dMount(document.getElementById('rp3d'), r.id, RP.i);
  const bar = RP.el.querySelectorAll('.rp-bars i')[RP.i], tEl = document.getElementById('rp3d-t'); RP.t0 = performance.now();
  const tick = () => { const p = Math.min(1, (performance.now() - RP.t0) / (RP.STEP_S * 1000)); bar.style.width = p * 100 + '%'; if (tEl) tEl.textContent = Math.ceil(RP.STEP_S * (1 - p)); if (p >= 1) return rpNext(); RP.raf = requestAnimationFrame(tick); };
  RP.raf = requestAnimationFrame(tick);
}
function rpNext() { if (RP.i < RP.r.steps.length - 1) { RP.i++; rpStep(); } else { audit('Completed fascia routine', RP.r.label); toast(RP.r.label + ' complete'); rpClose(); } }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-rp]'); if (!t) return; e.preventDefault(); const k = t.dataset.rp;
  if (k === 'open') rpOpen(t.dataset.r, +t.dataset.i); else if (k === 'close') rpClose(); else if (k === 'mode') { RP.mode = t.dataset.arg; store.set('rpmode', RP.mode); cancelAnimationFrame(RP.raf); const v = RP.el.querySelector('video'); if (v) v.pause(); if (RP.mode !== '3d' && window.AnatomyLab) AnatomyLab.stop(); rpStep(); } else if (k === 'goto') { cancelAnimationFrame(RP.raf); RP.i = +t.dataset.i; rpStep(); } else if (k === 'next') rpNext(); else if (k === 'prev' && RP.i) { RP.i--; rpStep(); }
});
document.addEventListener('keydown', e => { if (!RP.el || RP.el.hidden) return; if (e.key === 'Escape') rpClose(); else if (e.key === 'ArrowRight') rpNext(); else if (e.key === 'ArrowLeft' && RP.i) { RP.i--; rpStep(); } });
/* topic libraries: list on the left, the chosen topic's panels on the right */
function eduTopics(key, topics) {
  const cur = topics.find(t => t.id === EDU.topic[key]) || topics[0];
  const panel = p => p.kind === 'compare' ? `<div class="edu-cmp"><div><b>${esc(p.left.title)}</b><ul>${p.left.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b>${esc(p.right.title)}</b><ul>${p.right.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`
    : `<ul class="${p.tone ? 'edu-tone edu-' + p.tone : ''}">${(p.items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<div class="edu-lib"><nav class="edu-toc">${topics.map(t => `<button data-edu="topic" data-k="${key}" data-arg="${t.id}" aria-pressed="${t.id === cur.id}"><i style="background:${t.accent}"></i><span><b>${t.n}. ${esc(t.title)}</b><em>${esc(t.subtitle || '')}</em></span></button>`).join('')}</nav>
    <section class="panel edu-topic" style="--acc:${cur.accent}"><span class="eyebrow">${esc(cur.tagline || '')}</span><h3 style="font-size:22px">${esc(cur.title)}</h3>
      <div class="edu-panels">${cur.panels.map(p => `<div class="edu-panel"><h4>${esc(p.heading)}</h4>${panel(p)}</div>`).join('')}</div>
      ${cur.examTip ? `<div class="edu-tip"><b>Key point</b> ${esc(cur.examTip)}</div>` : ''}</section></div>`;
}
function eduElectroExtra() {
  const P = E.electrotherapyData.PARAMETERS_TABLE, C = E.electrotherapyData.CONTRAINDICATIONS, EV = E.electrotherapyEvidence;
  return `<section class="panel"><h3>Parameters at a glance</h3><div class="tbl-wrap"><table class="tbl"><thead><tr>${P.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${P.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="grid2"><ul>${P.reminders.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div><b>Decision flow</b><ol>${P.flow.map(x => `<li>${esc(x)}</li>`).join('')}</ol><span class="muted" style="font-size:12.5px">${esc(P.flowNote)}</span></div></div></section>
  <div class="grid2"><section class="panel"><h3>Contraindications</h3><div class="grid2"><div><b style="color:var(--risk)">Absolute</b><ul>${C.absolute.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><b style="color:var(--warn)">Relative</b><ul>${C.relative.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div class="rows">${C.modalitySpecific.map(m => `<div class="row" style="align-items:flex-start;font-size:13px"><b style="min-width:110px">${esc(m.modality)}</b><span class="grow">Avoid: ${esc(m.avoid)}<br><span class="muted">Caution: ${esc(m.caution)}</span></span></div>`).join('')}</div></section>
  <section class="panel"><h3>Evidence by modality</h3><div class="rows">${EV.EVIDENCE_MODALITIES.map(m => `<div class="row" style="align-items:flex-start;font-size:13px"><span class="grow"><b>${esc(m.name)}</b> · <span class="chip plain c-muted">${esc(m.strength)}</span><br><span class="muted">${esc(m.mechanism)}</span><span class="bar-track" style="display:block;margin-top:6px"><span class="bar-fill" style="display:block;width:${Math.round(m.records / EV.MAX_RECORDS * 100)}%;background:${m.accent}"></span></span></span><span class="num muted">${m.records.toLocaleString()} studies</span></div>`).join('')}</div></section></div>`;
}
function eduHealing() {
  const A = E.anatomyData, cols = A.timelineColumns, n = cols.length;
  const pos = w => { let i = cols.findIndex(c => w <= c.end); if (i < 0) return 1; const c = cols[i], span = Math.max(1, c.end - c.start + 1); return (i + Math.min(1, Math.max(0, (w - c.start) / span))) / n; };
  return `<section class="panel"><div class="edu-tl"><b></b><div class="edu-tl-head">${cols.map(c => `<span>${esc(c.label)}</span>`).join('')}</div></div>
    ${A.tissueHealingData.map(t => `<div class="edu-tl"><b>${esc(t.tissue)}</b><div class="edu-tl-track">${t.ranges.map((r, i) => { const x0 = pos(r.start), x1 = pos(r.end + 0.999); return `<span title="${esc(r.label)}: weeks ${r.start} to ${r.end}" style="left:${x0 * 100}%;width:${Math.max(1.5, (x1 - x0) * 100)}%;background:${t.color};opacity:${1 - i * 0.28}"><em>${esc(r.label)}</em></span>`; }).join('')}</div></div>`).join('')}
    <span class="muted" style="font-size:12.5px">Each bar is one grade of injury for that tissue; columns run from 1 week to 2 years.</span></section>
    <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${A.healingFactors.map(h => `<section class="panel"><h3>${esc(h.title)}</h3><p class="muted" style="margin:0;font-size:13.5px">${esc(h.text)}</p></section>`).join('')}</div>`;
}
function eduPain() {
  const R = E.recoveryGuideData;
  const card = o => `<section class="panel"><h3>${o.icon ? o.icon + ' ' : ''}${esc(o.n)}</h3><p style="margin:0;font-size:13.5px">${esc(o.short)}</p><p class="muted" style="margin:0;font-size:13px">${esc(o.detail)}</p>${o.dose ? `<div class="facts"><div><span>Dose</span><span>${esc(o.dose)}</span></div></div>` : ''}</section>`;
  return `<h3>When it hurts</h3><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${R.painOptions.map(card).join('')}</div>
    <h3>Rehab tools</h3><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${R.rehabOptions.map(card).join('')}</div>
    <section class="panel"><h3>Severity guide</h3><div class="rows">${R.severityLevels.map(s => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="chip plain" style="border-color:${s.accent};color:${s.accent}">${esc(s.tag)}</span><span class="grow"><b>${esc(s.title)}</b><br><span class="muted">${esc(s.text)}</span></span></div>`).join('')}</div></section>`;
}
function eduLoad() {
  const A = E.anatomyData;
  return `<div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${A.loadTypes.map(l => `<section class="panel" style="border-top:3px solid ${l.color}"><h3>${esc(l.name)}</h3><p style="margin:0;font-size:13.5px">${esc(l.action)}</p><div class="facts"><div><span>Tissues</span><span>${l.tissues.map(esc).join(', ')}</span></div><div><span>Movements</span><span>${l.movements.map(esc).join(', ')}</span></div></div></section>`).join('')}</div>
    <section class="panel"><h3>The dose: what makes a load</h3><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${A.doseComponents.map(d => `<div><b>${esc(d.name)}</b><p class="muted" style="margin:4px 0 0;font-size:13px">${esc(d.description)}</p></div>`).join('')}</div></section>`;
}
function eduDomains() {
  return `<div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${E.anatomyData.performanceDomains.map((d, i) => `<section class="panel edu-dom"><span class="serif num" style="font-size:40px;line-height:1;color:var(--accent)">${String(i + 1).padStart(2, '0')}</span><h3 style="font-size:20px">${esc(d.title)}</h3><p class="muted" style="margin:0;font-size:13.5px">${esc(d.description)}</p></section>`).join('')}</div>`;
}
function eduElite() {
  return `<div class="stack" style="gap:10px">${E.eliteSCData.elitePrinciples.map(p => { const open = !!EDU.open[p.id]; return `<section class="panel edu-acc${open ? ' open' : ''}"><button class="edu-acc-h" data-edu="acc" data-arg="${p.id}" aria-expanded="${open}"><span class="serif num" style="font-size:26px;color:var(--accent)">${p.num}</span><span class="grow"><b style="font-size:16px">${esc(p.title)}</b><br><span class="muted" style="font-size:13px">${esc(p.summary)}</span></span><span class="chip plain c-muted">${esc(p.tag)}</span></button>
    ${open ? `<div class="grid2">${p.sections.map(s => `<div><h4>${esc(s.heading)}</h4>${s.text ? `<p style="margin:0;font-size:13.5px">${esc(s.text)}</p>` : ''}${s.points ? `<ul>${s.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>` : ''}</section>`; }).join('')}</div>`;
}
function eduFramework() {
  return `<p class="serif" style="font-size:20px;margin:0">${esc(E.frameworkData.frameworkOverview.tagline)}</p><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${E.frameworkData.frameworkPillars.map(p => `<section class="panel" style="border-top:3px solid ${p.color}"><h3>${esc(p.title)}</h3><p style="margin:0;font-size:13.5px">${esc(p.summary)}</p><ul>${p.keyPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul><span class="muted" style="font-size:12px">${p.references.map(r => esc(r.authors + ' (' + r.year + '). ' + r.title + '. ' + r.journal + ' ' + r.vol)).join('<br>')}</span></section>`).join('')}</div>`;
}
function eduBody() {
  const A = E.anatomyData, R = E.anatomyResearch.anatomyResearch;
  const cur = A.bodyParts.find(b => b.id === EDU.topic.body) || A.bodyParts[0], res = R[cur.id] || [];
  return `<div class="edu-lib"><nav class="edu-toc">${A.bodyParts.map(b => `<button data-edu="topic" data-k="body" data-arg="${b.id}" aria-pressed="${b.id === cur.id}"><span><b>${esc(b.name)}</b><em>${esc(b.region)}</em></span></button>`).join('')}</nav>
    <section class="panel"><h3 style="font-size:22px">${esc(cur.name)}</h3><div class="facts">${Object.entries(cur.systems).map(([k, v]) => `<div><span>${k[0].toUpperCase() + k.slice(1)}</span><span>${esc(v)}</span></div>`).join('')}</div>
      <h4>Common injuries</h4><div class="rows">${cur.injuries.map(i => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${esc(i.name)}</b><br><span class="muted">${esc(i.description)}</span></span><span class="chip plain c-muted" style="max-width:200px;white-space:normal">${esc(i.recovery)}</span></div>`).join('')}</div>
      ${res.length ? `<h4>Research</h4><div class="rows">${res.map(r => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${esc(r.title)}</b><br><span class="muted">${esc(r.finding)}</span></span><span class="muted" style="font-size:12px">${esc(r.source)} ${esc(r.year)}</span></div>`).join('')}</div>` : ''}
      <a class="btn sm" href="#anatomy">Open the Anatomy lab</a></section></div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-edu]'); if (!t) return; e.preventDefault();
  const k = t.dataset.edu, a = t.dataset.arg;
  if (k === 'dom') { EDU.dom = a; EDU.sec = EDU_DOMAINS.find(d => d.id === a).sections[0].id; }
  else if (k === 'sec') EDU.sec = a;
  else if (k === 'topic') EDU.topic[t.dataset.k] = a;
  else if (k === 'acc') EDU.open[a] = !EDU.open[a];
  else if (k === 'pop') EDU.pop = a;
  else if (k === 'ctab') EDU.ctab = a;
  else if (k === 'nath') EDU.nath = a;
  keepRender();
});


/* ---------- Evidence library: where the team searches, with one query sent to the source of their choice ---------- */
const SOURCES = [
  { cat: 'Search the literature', items: [
    ['PubMed', 'US National Library of Medicine. The default for clinical and sport science papers.', 'https://pubmed.ncbi.nlm.nih.gov/', 'https://pubmed.ncbi.nlm.nih.gov/?term=', 'Free'],
    ['PubMed, free full text only', 'The same search, filtered to papers anyone can read in full.', 'https://pubmed.ncbi.nlm.nih.gov/', 'https://pubmed.ncbi.nlm.nih.gov/?filter=simsearch2.ffrft&term=', 'Open access'],
    ['Europe PMC', 'European mirror of PubMed Central with millions of full-text papers and preprints.', 'https://europepmc.org/', 'https://europepmc.org/search?query=', 'Open access'],
    ['Google Scholar', 'Broadest net, including theses and books. Check quality yourself.', 'https://scholar.google.com/', 'https://scholar.google.com/scholar?q=', 'Free'],
    ['Semantic Scholar', 'AI-ranked search with citation context.', 'https://www.semanticscholar.org/', 'https://www.semanticscholar.org/search?q=', 'Free'],
    ['PEDro', 'Physiotherapy Evidence Database: trials, reviews and guidelines rated for quality.', 'https://pedro.org.au/', '', 'Free'],
    ['Cochrane Library', 'Gold-standard systematic reviews.', 'https://www.cochranelibrary.com/', '', 'Abstracts free']] },
  { cat: 'Sport and exercise medicine journals', items: [
    ['British Journal of Sports Medicine', 'BJSM: consensus statements, IOC papers, infographics and podcasts.', 'https://bjsm.bmj.com/', 'https://bjsm.bmj.com/search/', 'Some open'],
    ['BMJ Open Sport & Exercise Medicine', 'BJSM\'s open-access sister journal.', 'https://bmjopensem.bmj.com/', 'https://bmjopensem.bmj.com/search/', 'Open access'],
    ['Aspetar Sports Medicine Journal', 'Free journal from Aspetar, the Qatar orthopaedic and sports medicine hospital. Regional and practical.', 'https://www.aspetar.com/en/professionals/aspetar-sports-medicine-journal', '', 'Free'],
    ['Sports Medicine – Open', 'Springer\'s open-access sports medicine journal.', 'https://sportsmedicine-open.springeropen.com/', '', 'Open access'],
    ['Frontiers in Sports and Active Living', 'Open-access journal covering performance, rehab and physical activity.', 'https://www.frontiersin.org/journals/sports-and-active-living', '', 'Open access'],
    ['JOSPT', 'Journal of Orthopaedic & Sports Physical Therapy, including clinical practice guidelines.', 'https://www.jospt.org/', '', 'Some open'],
    ['IJSPP', 'International Journal of Sports Physiology and Performance.', 'https://journals.humankinetics.com/view/journals/ijspp/ijspp-overview.xml', '', 'Subscription']] },
  { cat: 'Preprints and open forums', items: [
    ['SportRxiv', 'Free preprint server for sport and exercise science. New work before peer review: read critically.', 'https://sportrxiv.org/', 'https://sportrxiv.org/index.php/server/search/search?query=', 'Open access'],
    ['BJSM blog and podcast', 'Open commentary and interviews from the BJSM community.', 'https://blogs.bmj.com/bjsm/', '', 'Free'],
    ['Physiopedia', 'Open physiotherapy wiki with referenced pages and free courses.', 'https://www.physio-pedia.com/', 'https://www.physio-pedia.com/index.php?search=', 'Free']] },
  { cat: 'Organisations and guidelines', items: [
    ['ACSM', 'American College of Sports Medicine: exercise prescription guidelines and position stands.', 'https://www.acsm.org/', '', 'Some open'],
    ['NSCA', 'National Strength and Conditioning Association: strength and conditioning standards.', 'https://www.nsca.com/', '', 'Some open'],
    ['AIS clearinghouse', 'Australian Institute of Sport research and practice summaries.', 'https://www.ausport.gov.au/clearinghouse', '', 'Free']] }
];
function evidenceLibrary() {
  const q = EDU.srcq || '';
  const latest = (typeof AG !== 'undefined' ? AG.evidence : []);
  return `<section class="panel ev-search"><label class="ask-in"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="ev-q" placeholder="Search the evidence, e.g. spring ligament rehabilitation" value="${esc(q)}" autocomplete="off"></label>
    <div class="pills">${SOURCES.flatMap(c => c.items).filter(s => s[3]).map(s => `<a class="pill ev-go" data-ev="${esc(s[3])}" href="${esc(s[3] + encodeURIComponent(q || ''))}" target="_blank" rel="noopener">${esc(s[0])} ↗</a>`).join('')}</div>
    <span class="muted" style="font-size:12.5px">Type once, then open it in any source. Searches go straight to that site; nothing about a patient should ever be typed here.</span></section>
  ${latest.length ? `<section class="panel"><div class="sec-head"><h3>New this week · Evidence watch</h3><span class="muted" style="font-size:13px">Found and graded by the Evidence watch agent</span></div><div class="rows">${latest.slice(0, 8).map(x => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.title)}</b></a><br><span class="muted">${esc(x.finding || '')}</span></span><span class="chip plain c-muted">${esc(x.grade || '')}</span></div>`).join('')}</div></section>` : ''}
  ${SOURCES.map(c => `<section class="stack" style="gap:10px"><h3>${c.cat}</h3><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${c.items.map(s => `<a class="panel ev-card" href="${esc(s[2])}" target="_blank" rel="noopener"><span class="sec-head" style="align-items:flex-start"><b>${esc(s[0])}</b><span class="chip plain ${/Open|Free/.test(s[4]) ? 'c-ok' : 'c-muted'}">${esc(s[4])}</span></span><span class="muted" style="font-size:13px">${esc(s[1])}</span></a>`).join('')}</div></section>`).join('')}`;
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'ev-q') { EDU.srcq = e.target.value; document.querySelectorAll('.ev-go').forEach(a => { a.href = a.dataset.ev + encodeURIComponent(EDU.srcq); }); } });

/* ---------- Clinical testing components (from fascia-body-flow's assessment platform): ACSM-anchored populations, workflow, norms, scoring, risk ---------- */
function clinicalComponents() {
  const C = E.clinicalDomainData, pop = C.POPULATIONS.find(p => p.id === EDU.pop) || C.POPULATIONS[2];
  const tabs = [['populations', 'Populations and prescription'], ['workflow', 'Testing workflow'], ['norms', 'Norms by population'], ['scoring', 'Domains and scoring'], ['risk', 'Risk and safety'], ['equipment', 'Equipment'], ['refs', 'References']];
  const refs = (k) => (C.CLINICAL_REFERENCES[k] || []).map(r => `<a class="muted" style="font-size:12.5px" href="${r.url}" target="_blank" rel="noopener">${esc(r.title)} · ${esc(r.source)}</a>`).join('<br>');
  let body = '';
  if (EDU.ctab === 'populations') body = `<div class="pills">${C.POPULATIONS.map(p => `<button class="pill" data-edu="pop" data-arg="${p.id}" aria-pressed="${p.id === pop.id}"><i class="dot" style="background:${p.color}"></i>${esc(p.label)}</button>`).join('')}</div>
    <div class="grid2"><section class="panel" style="border-top:3px solid ${pop.color}"><span class="eyebrow">${esc((POP_FRAME.find(f => f.id === pop.id) || {}).tier || '')}</span><h3 style="font-size:22px">${esc(pop.label)}</h3><p style="margin:0">${esc(pop.description)}</p></section>
    <section class="panel"><h3>${esc((POP_FRAME.find(f => f.id === pop.id) || {}).tier || '')}</h3><p style="margin:0">${esc((POP_FRAME.find(f => f.id === pop.id) || {}).def || '')}</p><a class="muted" style="font-size:12.5px" href="${SRC.mckay.url}" target="_blank" rel="noopener">McKay et al. 2022, IJSPP</a></section></div>
    ${rxEvidence(pop.id)}
    <section class="panel"><h3>Periodisation models</h3><div class="rows">${C.PERIODIZATION_MODELS.map(m => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${esc(m.name)}</b> <span class="muted">for ${m.for.map(esc).join(', ')}</span><br>${esc(m.detail)}</span><span class="muted" style="font-size:12px">${esc(m.source)}</span></div>`).join('')}</div></section>`;
  if (EDU.ctab === 'workflow') body = `<section class="panel"><ol class="edu-flow">${C.WORKFLOW_STEPS.map(s => `<li><b>${esc(s.title)}</b><span>${esc(s.detail)}</span><em>Output: ${esc(s.output)} · ${esc(s.source)}</em></li>`).join('')}</ol>${refs('workflow')}</section>`;
  if (EDU.ctab === 'norms') { const sq = ATH.find(a => a.id === EDU.nath) || ATH[0]; const tp = sq.tier >= 4 ? 'elite' : sq.tier === 3 ? 'competitive' : sq.tier >= 1 ? 'trained' : 'sedentary';
    body = `${popFramework(tp)}<section class="panel"><div class="sec-head"><div><h2>Test an athlete</h2><span class="muted" style="font-size:13px">Same standards as Player 1, scoped to each athlete's sex and age</span></div></div><div class="pills">${ATH.filter(seesAthlete).map(a => `<button class="pill" data-edu="nath" data-arg="${a.id}" aria-pressed="${a.id === sq.id}">${esc(a.name)} <span class="muted">· ${esc(tierName(a.tier >= 4 ? 'elite' : a.tier === 3 ? 'competitive' : 'trained'))}</span></button>`).join('')}</div></section>${rxEvidence(tp)}${normsPanel(sq.id, tp)}`; }
  if (EDU.ctab === 'scoring') body = `<p class="nr-note" style="margin:0 0 12px">The 0 to 10 domain score and the weightings are our team's reporting convention, not a published standard. The numbers underneath them come from the referenced norms.</p><div class="grid2"><section class="panel"><h3>Domain weighting by goal</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Domain</th><th>Default</th><th>Rehab</th><th>Performance</th><th>Healthspan</th></tr></thead><tbody>${C.DOMAIN_WEIGHTS.map(w => `<tr><td><i class="dot" style="background:${w.color}"></i><b>${esc(w.domain)}</b></td>${['default', 'rehab', 'performance', 'healthspan'].map(k => `<td class="num">${w[k]}%</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><h3>Score bands</h3><div class="rows">${C.SCORE_BANDS.map(b => `<div class="row"><span class="chip plain" style="border-color:${b.color};color:${b.color}">${esc(b.band)}</span><span class="grow">${esc(b.label)}</span><span class="num">${esc(b.score)}</span></div>`).join('')}</div><div class="pills">${C.SCORE_LABELS.map(l => `<span class="chip plain" style="border-color:${l.color};color:${l.color}">${esc(l.range)} · ${esc(l.label)}</span>`).join('')}</div></section></div>
    <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${C.SCORING_NOTES.map(n => `<section class="panel"><h3>${esc(n.heading)}</h3><ul>${n.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}</div>${refs('scoring')}`;
  if (EDU.ctab === 'risk') body = `<section class="panel"><div class="sec-head"><div><h2>Pre-participation screening · ACSM 2015 algorithm</h2><span class="muted" style="font-size:13px">Replaces the old low, moderate, high risk-factor count, which ACSM retired in 2015. Clearance now depends on current activity, known disease and symptoms.</span></div><a class="muted" style="font-size:12.5px" href="${SRC.riebe.url}" target="_blank" rel="noopener">Riebe et al. 2015, MSSE</a></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Currently exercising?</th><th>Known cardiovascular, metabolic or renal disease</th><th>Signs or symptoms</th><th>Medical clearance</th><th>Start</th></tr></thead><tbody>${[['No', 'No', 'No', 'Not needed', 'Light to moderate, progress gradually'], ['No', 'Yes', 'No', 'Recommended', 'Light to moderate after clearance'], ['No', 'Any', 'Yes', 'Recommended', 'After clearance'], ['Yes', 'No', 'No', 'Not needed', 'Continue moderate or vigorous'], ['Yes', 'Yes', 'No', 'Not needed for moderate; recommended before vigorous', 'Continue moderate'], ['Yes', 'Any', 'Yes', 'Stop exercising and get clearance', 'After clearance']].map(r => `<tr>${r.map((c, i) => `<td${i === 3 ? ' style="font-weight:700"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <div class="grid2"><section class="panel"><h3>Risk factors <span class="muted" style="font-size:12px;font-weight:400">· for education and counselling; no longer used to decide clearance</span></h3><ul>${C.RISK_FACTORS.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h3>Signs and symptoms</h3><ul>${C.RISK_SYMPTOMS.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
    <section class="panel">${C.CONTRAINDICATIONS.map(c => `<h3 style="color:${c.color}">${esc(c.kind)}</h3><ul>${c.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}<h3>Stop the test if</h3><ul>${C.TERMINATION_CRITERIA.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section></div>${refs('risk')}`;
  if (EDU.ctab === 'equipment') body = `<section class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Domain</th><th>Device</th><th>Measures</th><th>Units</th><th>Validity</th></tr></thead><tbody>${C.EQUIPMENT.map(q => `<tr><td>${esc(q.domain)}</td><td><b>${esc(q.device)}</b></td><td>${esc(q.measures)}</td><td>${esc(q.units)}</td><td class="muted" style="font-size:12.5px">${esc(q.validity)}</td></tr>`).join('')}</tbody></table></div>${refs('equipment')}</section>`;
  if (EDU.ctab === 'refs') body = `<section class="panel">${Object.keys(C.CLINICAL_REFERENCES).map(k => `<h3 style="text-transform:capitalize">${k}</h3>${refs(k)}`).join('')}</section>`;
  return `<section class="stack" style="gap:16px"><div class="sec-head"><div><span class="eyebrow">Clinical testing components · sedentary, trained, competitive, elite</span><h2>Testing and prescription standards</h2></div></div>
    <nav class="seg edu-doms" aria-label="Clinical testing">${tabs.map(([k, l]) => `<button data-edu="ctab" data-arg="${k}" aria-pressed="${EDU.ctab === k}">${l}</button>`).join('')}</nav>${body}</section>`;
}

/* ---------- Prescription and testing standards for one person: population, FITT-VP, and every metric against the four population bands ---------- */
let NORMV = store.get('normv', {});
function normBand(m, v) {
  const P = ['sedentary', 'trained', 'competitive', 'elite'], lower = m.ranges.elite[0] < m.ranges.sedentary[0];
  let best = null; for (const k of P) { const [a, b] = m.ranges[k]; if (v >= Math.min(a, b) && v <= Math.max(a, b)) best = k; }
  if (!best) { const all = P.map(k => m.ranges[k]).flat(), lo = Math.min(...all), hi = Math.max(...all); best = (v < lo) !== lower ? 'below' : 'above'; }
  return best;
}
function normBar(m, who, v) {
  const C = E.clinicalDomainData, P = C.POPULATIONS, all = P.map(p => m.ranges[p.id]).flat(), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.06, a = lo - pad, b = hi + pad, x = t => ((t - a) / (b - a) * 100).toFixed(2);
  const band = v != null && v !== '' ? normBand(m, +v) : null, pop = P.find(p => p.id === band);
  return `<div class="nb"><div class="nb-h"><b>${esc(m.metric)}</b><span class="muted">${esc(m.unit)} · ${esc(m.domain)}</span>${pop ? `<span class="chip plain" style="border-color:${pop.color};color:${pop.color}">${esc(pop.label)} level</span>` : band ? `<span class="chip plain c-muted">${band === 'below' ? 'Below all bands' : 'Above elite'}</span>` : ''}</div>
    <div class="nb-track">${P.map((p, i) => { const [r0, r1] = m.ranges[p.id]; return `<span class="nb-b${p.id === who ? ' me' : ''}" style="left:${x(Math.min(r0, r1))}%;width:${(x(Math.max(r0, r1)) - x(Math.min(r0, r1))).toFixed(2)}%;--c:${p.color};top:${i * 9}px" title="${esc(p.label)} ${r0} to ${r1}"></span>`; }).join('')}${v != null && v !== '' ? `<i class="nb-v" style="left:${x(Math.max(a, Math.min(b, +v)))}%"><em>${esc(String(v))}</em></i>` : ''}</div>
    <div class="nb-f"><span class="muted">${C.POPULATIONS.find(p => p.id === who).label} target ${m.ranges[who].join(' to ')} ${esc(m.unit)}</span><label class="nb-in">Result<input type="number" step="any" value="${v != null ? esc(String(v)) : ''}" data-nv="${esc(m.metric)}" aria-label="${esc(m.metric)} result"></label><span class="muted" style="font-size:11px">${esc(m.source)}</span></div></div>`;
}
function pageP1Rx() {
  const g = p1Gate(); if (g) return g;
  const who = 'elite', pf = nprof('p1'), vals = (NORMV.v2 || {}).p1 || {}, graded = NORMS.filter(m => refsFor(m, pf).length);
  const tested = NORMS.filter(m => vals[m.id] && vals[m.id].now != null), elite = tested.filter(m => { const v = normVerdict(m, refsFor(m, pf), vals[m.id].now); return v && v.tier === 'elite'; });
  return p1Head('p1rx', 'Prescription', 'McKay 2022 tiers · ACSM FITT-VP · padel cohorts') + `
  <section class="cmd"><canvas class="cmd-warp" aria-hidden="true"></canvas><div class="cmd-veil" aria-hidden="true"></div>
    <div class="cmd-l"><span class="eyebrow">Player 1 · population · McKay Tier 4 to 5</span><span class="cmd-tag">Every number has a source you can open.</span><h1 class="cmd-word">Elite</h1><p class="cmd-why">Professional padel. Elite references come from peer-reviewed top-50 World Padel Tour cohorts; general-population norms come from large registries; anything without a valid norm is tracked against his own baseline.</p>
      <div class="cmd-chips"><span class="cmd-chip"><em>With published references</em>${graded.length} of ${NORMS.length}</span><span class="cmd-chip"><em>Tested</em>${tested.length}</span><span class="cmd-chip"><em>At pro padel level</em>${elite.length} of ${tested.length}</span></div></div>
    <div class="cmd-r"><div class="pop-stack">${POP_FRAME.map(p => `<span class="${p.id === who ? 'on' : ''}" style="--c:${tierColor(p.id)}"><b>${esc(p.label)}</b><em>${esc(p.tier)}</em></span>`).join('')}</div></div></section>
  ${rxEvidence(who)}
  ${normsPanel('p1', who)}
  ${popFramework(who)}`;
}
document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.nv !== undefined) { NORMV.p1 = NORMV.p1 || {}; if (t.value === '') delete NORMV.p1[t.dataset.nv]; else NORMV.p1[t.dataset.nv] = +t.value; store.set('normv', NORMV); audit('Entered a test result', t.dataset.nv); keepRender(); } });
