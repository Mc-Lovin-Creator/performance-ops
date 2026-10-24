/* ---------- Consent per athlete: what they agreed to, who recorded it and when. Clinicians only. ---------- */
const CONSENT_ITEMS = [['care', 'Health data for care', 'Recording assessments, treatment, load and tests to plan care'], ['physician', 'Sharing with the team physician', 'Daily clinical updates go to the physician'],
  ['coach', 'Load summary to coaches', 'Coaches see load and availability, never clinical notes'], ['video', 'Video for movement analysis', 'Phone video turned into joint angles (OpenCap); clips deleted after processing'],
  ['teach', 'Anonymised teaching use', 'Cases used in team education with no name or identifying detail'],
  ['wear', 'Wearable data sync', 'Daily sleep, HRV and resting heart rate pulled from his own Oura, WHOOP, Polar, Garmin or Apple Health account; disconnect any time']];
let CONSENT = store.get('consent', {});
function consentCard(a) {
  if (!a || !perm().clinical) return '';
  const c = CONSENT[a.id] || {}, n = CONSENT_ITEMS.filter(([k]) => c[k]).length;
  return `<section class="panel consent"><div class="sec-head"><div><span class="eyebrow">Consent · recorded by a clinician · AI tools never receive clinical data</span><h2>What ${esc(a.id === 'p1' ? 'Player 1' : a.name)} agreed to</h2></div><span class="chip ${n === CONSENT_ITEMS.length ? 'c-ok' : n ? 'c-load' : 'c-warn'}">${n} of ${CONSENT_ITEMS.length}</span></div>
    <div class="consent-g">${CONSENT_ITEMS.map(([k, l, d]) => `<label class="consent-i${c[k] ? ' on' : ''}"><input type="checkbox" data-consent="${a.id}|${k}" ${c[k] ? 'checked' : ''}><span><b>${esc(l)}</b><em>${esc(d)}</em>${c[k] ? `<small>Recorded by ${esc((PEOPLE.find(p => p.id === c[k].by) || {}).name || c[k].by)} · ${esc(c[k].at)}</small>` : ''}</span></label>`).join('')}</div>
    <p class="muted" style="font-size:12px;margin:0">Keep the signed form in the clinic record. Withdrawing consent stops new collection at once; ask the lead before deleting history.</p></section>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.consent) return; const [id, k] = t.dataset.consent.split('|');
  CONSENT[id] = CONSENT[id] || {}; if (t.checked) CONSENT[id][k] = { by: S.me, at: TODAY_ISO }; else delete CONSENT[id][k];
  store.set('consent', CONSENT); audit(t.checked ? 'Consent recorded' : 'Consent withdrawn', id + ' · ' + k); keepRender();
});
