/* ---------- v44 Book a session: booker pattern and slot logic adapted from Cal.com (MIT, github.com/calcom/cal.com, packages/features/schedules/lib/slots.ts) ----------
   Slots: start on the interval boundary inside each availability range; a slot fits when start + length + buffer stays inside the range,
   is at least the minimum notice away, and does not overlap an existing booking (with its buffer) for that clinician. */
const EVT = [
  { id: 'assess', title: 'Performance assessment', mins: 60, buf: 15, who: ['jp', 'olivia'], col: '#38bdf8', desc: 'Screening, tests against population standards and a written prescription.', pops: ['sedentary', 'trained', 'competitive', 'elite'] },
  { id: 'tx', title: 'Treatment', mins: 45, buf: 10, who: ['jp', 'olivia', 'physio2'], col: '#a78bfa', desc: 'Hands-on treatment and the loading plan for the week.', pops: ['sedentary', 'trained', 'competitive', 'elite'] },
  { id: 'p7', title: '7-minute protocol', mins: 7, buf: 3, who: ['jp', 'olivia'], col: '#5eead4', desc: 'One stimulus done well: red light, NMES potentiation, or a loading technique.', pops: ['trained', 'competitive', 'elite'] },
  { id: 'recov', title: 'Recovery station', mins: 20, buf: 5, who: ['jp', 'olivia', 'physio2'], col: '#34d399', desc: 'Phase A, five stretch stations and the sensory track.', pops: ['sedentary', 'trained', 'competitive', 'elite'] },
  { id: 'test', title: 'Testing battery', mins: 90, buf: 15, who: ['jp', 'olivia'], col: '#f59e0b', desc: 'Strength, jump, aerobic and padel-specific tests, retested every block.', pops: ['trained', 'competitive', 'elite'] },
  { id: 'doc', title: 'Physician review', mins: 30, buf: 10, who: ['dr'], col: '#fb7185', desc: 'Medical review and clearance decisions.', pops: ['sedentary', 'trained', 'competitive', 'elite'] }
];
/* weekly availability, minutes from midnight, UAE working week (Mon to Fri, Saturday morning) */
const AVAIL = { 1: [[420, 720], [780, 1140]], 2: [[420, 720], [780, 1140]], 3: [[420, 720], [780, 1140]], 4: [[420, 720], [780, 1140]], 5: [[420, 720], [780, 1080]], 6: [[480, 720]] };
const BK_NOTICE = 120, BK_STEP = 15;
let BOOK = store.get('bookings') || null;
if (!BOOK) { const d = new Date(TODAY); d.setDate(d.getDate() + 1); while (!AVAIL[d.getDay()]) d.setDate(d.getDate() + 1); BOOK = [{ id: 'b1', evt: 'tx', who: 'jp', ath: 'p1', day: ISO(d), start: 540, by: 'jp' }, { id: 'b2', evt: 'assess', who: 'olivia', ath: ATH[1] ? ATH[1].id : 'p1', day: ISO(d), start: 600, by: 'olivia' }]; store.set('bookings', BOOK); }
const BK = { evt: 'assess', who: null, month: null, day: null, slot: null, ath: null };
const bkHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function bkSlots(dayIso, evt, who) {
  const d = new Date(dayIso + 'T00:00'), ranges = AVAIL[d.getDay()] || [], now = new Date(), out = [];
  const busy = BOOK.filter(b => b.day === dayIso && b.who === who).map(b => { const e = EVT.find(x => x.id === b.evt); return [b.start, b.start + e.mins + e.buf]; });
  for (const [a, z] of ranges) for (let s = Math.ceil(a / BK_STEP) * BK_STEP; s + evt.mins + evt.buf <= z; s += BK_STEP) {
    const at = new Date(d); at.setMinutes(s); if ((at - now) / 60000 < BK_NOTICE) continue;
    if (busy.some(([b0, b1]) => s < b1 && s + evt.mins + evt.buf > b0)) continue; out.push(s);
  }
  return out;
}
const canSeeBooking = b => { const a = ATH.find(x => x.id === b.ath); return !a || seesAthlete(a); };
function pageBook() {
  const evt = EVT.find(e => e.id === BK.evt) || EVT[0], who = BK.who && evt.who.includes(BK.who) ? BK.who : evt.who[0]; BK.who = who;
  const m0 = BK.month ? new Date(BK.month + '-01T00:00') : new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), first = new Date(m0), lead = (first.getDay() + 6) % 7, dim = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
  const cells = []; for (let i = 0; i < lead; i++) cells.push(''); for (let d = 1; d <= dim; d++) { const dt = new Date(m0.getFullYear(), m0.getMonth(), d), iso = ISO(dt), past = dt < TODAY, n = past ? 0 : bkSlots(iso, evt, who).length; cells.push(`<button class="bk-d${iso === BK.day ? ' on' : ''}${iso === TODAY_ISO ? ' today' : ''}" data-bk="day" data-arg="${iso}" ${n ? '' : 'disabled'} aria-label="${iso}, ${n} times free"><b>${d}</b>${n ? `<i style="--c:${evt.col}"></i>` : ''}</button>`); }
  const slots = BK.day ? bkSlots(BK.day, evt, who) : [], athList = me().role === 'athlete' ? ATH.filter(a => a.id === (me().athlete || '')) : ATH.filter(seesAthlete);
  const mine = BOOK.filter(canSeeBooking).filter(b => b.day >= TODAY_ISO).sort((a, b) => (a.day + bkHM(a.start)).localeCompare(b.day + bkHM(b.start)));
  const mLabel = m0.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), nav = k => { const x = new Date(m0); x.setMonth(x.getMonth() + k); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  return `<div class="sec-head"><div><span class="eyebrow">Book a session · ${EVT.length} session types · clash-checked, buffered, 2-hour notice</span><h1 style="font-size:34px;letter-spacing:-.6px">Book a session</h1></div></div>
  <div class="bk-types">${EVT.filter(e => popMatch(e.pops)).map(e => `<button class="bk-t" data-bk="evt" data-arg="${e.id}" aria-pressed="${e.id === evt.id}" style="--c:${e.col}"><b>${esc(e.title)}</b><span>${e.mins} min</span>${popTags(e.pops)}</button>`).join('')}</div>
  <section class="booker holo-edge" style="--c:${evt.col}">
    <div class="bk-info"><span class="eyebrow">Session</span><h2>${esc(evt.title)}</h2><p class="muted">${esc(evt.desc)}</p>
      <div class="bk-meta"><span>⏱ ${evt.mins} min</span><span>↔ ${evt.buf} min buffer</span><span>📍 Performance Lab</span></div>
      <span class="eyebrow" style="margin-top:14px">With</span><div class="pills">${evt.who.map(w => `<button class="pill" data-bk="who" data-arg="${w}" aria-pressed="${w === who}">${esc(PEOPLE.find(p => p.id === w).name)}</button>`).join('')}</div></div>
    <div class="bk-cal"><div class="bk-mh"><button class="btn sm" data-bk="month" data-arg="${nav(-1)}" aria-label="Previous month">‹</button><b>${mLabel}</b><button class="btn sm" data-bk="month" data-arg="${nav(1)}" aria-label="Next month">›</button></div>
      <div class="bk-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="bk-wd">${d}</span>`).join('')}${cells.map(c => c || '<span></span>').join('')}</div></div>
    <div class="bk-slots">${BK.day ? `<b class="bk-sd">${new Date(BK.day + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</b>${slots.length ? slots.map((s, i) => `<div class="bk-s${BK.slot === s ? ' on' : ''}" style="animation-delay:${i * 18}ms">${BK.slot === s ? `<span>${bkHM(s)}</span><button class="btn primary sm" data-bk="confirm">Confirm</button>` : `<button data-bk="slot" data-arg="${s}">${bkHM(s)}</button>`}</div>`).join('') : '<p class="muted">No free times this day.</p>'}
      ${BK.slot != null ? `<label class="field" style="margin-top:10px">For<select id="bk-ath">${athList.map(a => `<option value="${a.id}" ${a.id === BK.ath ? 'selected' : ''}>${esc(aName(a))}</option>`).join('')}</select></label><p class="muted" style="font-size:12px;margin:6px 0 0">No clinical notes here: details stay in the record.</p>` : ''}` : '<p class="muted">Pick a day to see free times.</p>'}</div>
  </section>
  <section class="panel"><div class="sec-head"><h2>Upcoming</h2><span class="muted">${mine.length} booked</span></div><div class="rows">${mine.map(b => { const e = EVT.find(x => x.id === b.evt), a = ATH.find(x => x.id === b.ath); return `<div class="row"><span class="bk-dot" style="--c:${e.col}"></span><span class="grow"><b>${esc(e.title)}</b> · ${esc(a ? aName(a) : '')}<br><span class="muted">${new Date(b.day + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${bkHM(b.start)} to ${bkHM(b.start + e.mins)} · ${esc(PEOPLE.find(p => p.id === b.who).name)}</span></span><button class="btn sm" data-bk="cancel" data-arg="${b.id}">Cancel</button></div>`; }).join('') || '<p class="muted">Nothing booked yet.</p>'}</div></section>
  <p class="muted" style="font-size:12px">Booking flow and slot rules adapted from <a href="https://github.com/calcom/cal.com" target="_blank" rel="noopener">Cal.com</a> (MIT licence). Calendar sync and reminders need hosting; until then bookings stay on this device.</p>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-bk]'); if (!b) return; const k = b.dataset.bk, a = b.dataset.arg;
  if (k === 'evt') { BK.evt = a; BK.slot = null; } else if (k === 'who') { BK.who = a; BK.slot = null; } else if (k === 'month') { BK.month = a; } else if (k === 'day') { BK.day = a; BK.slot = null; } else if (k === 'slot') { BK.slot = +a; }
  else if (k === 'confirm') { const sel = document.getElementById('bk-ath'), ath = sel ? sel.value : null; if (!ath) return toast('Pick who the session is for'); BOOK.push({ id: 'b' + Date.now(), evt: BK.evt, who: BK.who, ath, day: BK.day, start: BK.slot, by: S.me }); store.set('bookings', BOOK); audit('Session booked', BK.evt + ' ' + BK.day + ' ' + bkHM(BK.slot)); const r = b.getBoundingClientRect(); window.celebrate && celebrate(r.left + r.width / 2, r.top, 1.2); toast('Booked: ' + EVT.find(x => x.id === BK.evt).title + ' at ' + bkHM(BK.slot)); BK.slot = null; }
  else if (k === 'cancel') { BOOK = BOOK.filter(x => x.id !== a); store.set('bookings', BOOK); audit('Session cancelled', a); toast('Booking cancelled'); }
  keepRender();
});
document.addEventListener('change', e => { if (e.target.id === 'bk-ath') BK.ath = e.target.value; });
