/* ---------- Weekly story briefing (built on this device from his data; nothing is sent to an AI) and pilot metrics ---------- */
function weekDays(back) { const out = []; for (let k = back + 6; k >= back; k--) { const t = new Date(TODAY); t.setDate(t.getDate() - k); out.push(ISO(t)); } return out; }
function weekSummary() {
  const d = weekDays(0), recs = d.map(x => DAILY[x]).filter(Boolean);
  const played = recs.reduce((a, r) => a + ((r.court && r.court.min) || 0), 0), allowed = recs.reduce((a, r) => a + ((r.court && r.court.allowed) || 0), 0);
  const over = recs.filter(r => r.court && r.court.allowed && r.court.min > r.court.allowed * 1.1).length;
  const proto = recs.filter(r => r.proto && r.proto.done).length, warm = recs.filter(r => r.court && r.court.warm).length;
  const flags = [...new Set(recs.flatMap(r => (r.obs && r.obs.flags) || []))], soft = recs.filter(r => r.soft && r.soft.regions && r.soft.regions.length), better = soft.filter(r => r.soft.response === 'Better').length;
  const w = typeof WEAR !== 'undefined' ? d.map(x => WEAR[x]).filter(Boolean) : [], hrv = w.map(x => x.hrv).filter(v => v != null), sl = w.map(x => x.sleep).filter(v => v != null);
  const T = typeof rtSync === 'function' ? rtSync() : null;
  return { logged: recs.length, played, allowed, over, proto, warm, flags, soft: soft.length, better, hrv: hrv.length ? Math.round(hrv.reduce((a, b) => a + b, 0) / hrv.length) : null, sleep: sl.length ? (sl.reduce((a, b) => a + b, 0) / sl.length).toFixed(1) : null, week: T && T.p ? T.p.week : null, weeks: typeof RT !== 'undefined' ? RT.WEEKS : null };
}
function p1Brief() {
  if (!perm().clinical) return '';
  const s = weekSummary();
  return `<section class="p1brief"><div><span class="eyebrow">Weekly story · built on this device from his records · no AI, no data leaves the app</span><h2>His week in two minutes</h2>
    <p class="muted" style="margin:0">${s.logged} of 7 days logged · ${s.played} min on court${s.allowed ? ` of ${s.allowed} guided` : ''} · ${s.proto} protocol days${s.week ? ` · week ${s.week} of ${s.weeks}` : ''}</p></div>
    <button class="btn primary" data-brief="play">▶ Play the briefing</button></section>`;
}
function briefEpisode() {
  const s = weekSummary(), A = t => ({ s: 'A', t }), B = t => ({ s: 'B', t });
  return { title: 'Player 1 · the week', chapters: [
    { title: 'The week', visual: 'Seven days of the return plan.', lines: [A(`Here's Player 1's week.${s.week ? ` He is in week ${s.week} of ${s.weeks} of the return.` : ''}`), B(`${s.logged} of 7 days were logged. ${s.logged < 5 ? 'That is light; the picture is incomplete.' : 'Enough to read the trend.'}`)] },
    { title: 'The load', visual: 'Minutes on court against the guidance.', lines: [A(`How much did he play?`), B(`${s.played} minutes on court${s.allowed ? `, against ${s.allowed} guided` : ''}. ${s.over ? `On ${s.over} day${s.over > 1 ? 's' : ''} he played more than ten percent over the guidance, and the plan adjusted the next day.` : 'He stayed within the guidance.'}`)] },
    { title: 'The work', visual: 'Warm-ups, the 7-minute protocol and soft tissue.', lines: [A(`And the work around the court?`), B(`Warm-up on ${s.warm} days, the 7-minute protocol on ${s.proto}. Soft tissue on ${s.soft} days${s.soft ? `, with ${s.better} reported as better afterwards` : ''}.`)] },
    { title: 'What we saw', visual: 'Court observations and recovery signals.', lines: [A(`Anything the coaches or clinicians noticed?`), B(s.flags.length ? `Flags this week: ${s.flags.slice(0, 3).join('; ')}.` : 'No movement flags were logged.'), ...(s.hrv || s.sleep ? [B(`From his wearable: ${s.hrv ? `average HRV ${s.hrv} milliseconds` : ''}${s.hrv && s.sleep ? ', ' : ''}${s.sleep ? `sleep ${s.sleep} hours a night` : ''}. Treat it as context, not a verdict.`)] : [])] },
    { title: 'Next week', visual: 'The plan, one variable at a time.', lines: [A(`So what changes next week?`), B(`Follow the plan's next step: one variable at a time, minutes or intensity, never both. Decisions stay with JP, Olivia and the physician.`)] }
  ] };
}
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-brief]'); if (!t) return; STORY_.ep = briefEpisode(); AG.lit.papers = []; STORY_.ch = 0; STORY_.ln = 0; audit('Played weekly briefing', 'Player 1'); storyOpen(); });

/* pilot metrics: what an investor and the clinic will ask in 90 days */
function pagePilot() {
  const days14 = [...weekDays(7), ...weekDays(0)], cover = days14.map(d => { const r = DAILY[d]; if (!r) return 0; return [!!(r.court && r.court.warm), r.court && r.court.min > 0, (r.obs && (r.obs.flags.length || r.obs.note)), !!(r.other && r.other.type), r.soft && r.soft.regions.length, r.proto && r.proto.done].filter(Boolean).length / 6; });
  const coverPct = Math.round(cover.reduce((a, b) => a + b, 0) / 14 * 100), daysLogged = cover.filter(x => x > 0).length;
  const T = typeof rtSync === 'function' ? rtSync() : null, wk = T && T.p ? T.p.week : 0;
  const inj = (typeof INJ !== 'undefined' ? INJ : []), reinj = inj.filter(i => i.date && i.date >= (RT.START_ISO || '0')).length;
  const consentN = ATH.filter(a => CONSENT[a.id] && Object.keys(CONSENT[a.id]).length >= 3).length, books = (typeof BOOK !== 'undefined' ? BOOK : []).length;
  const active = new Set((S.audit || []).map(x => x.who)).size;
  const tile = (l, v, sub, ok) => `<div class="kpi pil${ok === false ? ' warn' : ''}"><span class="eyebrow">${l}</span><b>${v}</b><em>${sub}</em></div>`;
  return `<div class="sec-head"><div><span class="eyebrow">Pilot metrics · 90-day evidence for the clinic and investors</span><h1 style="font-size:34px;letter-spacing:-.6px">Is it working?</h1></div></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    ${tile('Daily cover completion', coverPct + '%', `${daysLogged} of 14 days logged · target 80%`, coverPct >= 80)}
    ${tile('Return progress', wk ? `Week ${wk} of ${RT.WEEKS}` : '–', 'graded return plan', true)}
    ${tile('Re-injury since return began', reinj, 'target 0 at 6 months', reinj === 0)}
    ${tile('Consent recorded', `${consentN} of ${ATH.length}`, 'athletes with 3 or more items', consentN === ATH.length)}
    ${tile('Sessions booked', books, 'from Book a session', true)}
    ${tile('People active this session', active, 'from the audit log; the server counts weekly active clinicians', true)}
  </div>
  <section class="panel"><div class="sec-head"><h2>What still needs measuring</h2></div><div class="rows">
    ${[['Minutes saved per athlete', 'Time each daily cover takes, logged automatically from first to last field; compare with the old paper or WhatsApp process.'], ['Days to return', 'Date cleared to full play minus injury date, for every return in the pilot; compare with the clinic\'s previous cases.'], ['Re-injury at 6 months', 'Same site or a new lower-limb injury within 6 months of return.'], ['Weekly active clinicians', 'From the server audit log (sign-ins and writes per week).'], ['Athlete-reported confidence', 'A one-question weekly check (0 to 10) before and after the pilot.']].map(([a, b]) => `<div class="row" style="align-items:flex-start;font-size:13.5px"><span class="grow"><b>${a}</b><br><span class="muted">${b}</span></span></div>`).join('')}</div></section>
  <p class="muted" style="font-size:12.5px">Numbers on this page come from the records in the app. In the pilot, the server's audit log is the source of truth.</p>`;
}
