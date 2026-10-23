/* ---------- Wearables and effort: import Oura, Apple Health (Health Auto Export) or Polar CSV; show HRV, resting heart rate and sleep
   against his own baseline; show session-RPE load beside time-only load. Monitoring aids only. The file is read on this device. ---------- */
SRC.plews = { cite: 'Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med 2013;43(9):773-781', url: PM('Plews 2013 training adaptation heart rate variability monitoring') };
SRC.foster = { cite: 'Foster C et al. A new approach to monitoring exercise training. J Strength Cond Res 2001;15(1):109-115 (session-RPE)', url: PM('Foster 2001 new approach to monitoring exercise training session RPE') };
let WEAR = store.get('wear', {});
const wNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
function wearParse(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()); if (lines.length < 2) throw new Error('empty file');
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
  const head = split(lines[0]).map(h => h.toLowerCase());
  const find = re => head.findIndex(h => re.test(h));
  const iD = find(/^(date|day|summary_date|start)/), iS = find(/sleep.*(dur|asleep|total)|total sleep|sleep analysis|^sleep/), iH = find(/hrv|heart rate variability|rmssd/), iR = find(/resting heart|lowest.*heart|^rhr|resting hr/), iQ = find(/readiness|recovery score|recharge/);
  if (iD < 0 || (iS < 0 && iH < 0 && iR < 0)) throw new Error('could not find date and sleep, HRV or resting heart rate columns');
  const src = /oura/i.test(text.slice(0, 400)) || head.some(h => /readiness/.test(h)) ? 'Oura' : head.some(h => /recharge/.test(h)) ? 'Polar' : head.some(h => /\(ms\)|count\/min/.test(h)) ? 'Apple Health' : 'CSV';
  let n = 0; const out = {};
  for (const l of lines.slice(1)) {
    const c = split(l), d = new Date(c[iD]); if (isNaN(d)) continue; const iso = ISO(d);
    let sl = iS >= 0 ? wNum(c[iS]) : null; if (sl != null) sl = sl > 1000 ? sl / 3600 : sl > 24 ? sl / 60 : sl;
    out[iso] = { sleep: sl != null ? Math.round(sl * 10) / 10 : null, hrv: iH >= 0 ? wNum(c[iH]) : null, rhr: iR >= 0 ? wNum(c[iR]) : null, score: iQ >= 0 ? wNum(c[iQ]) : null, src }; n++;
  }
  return { days: out, n, src };
}
function wearStats(field, uptoIso) {
  const ds = Object.keys(WEAR).filter(d => d < uptoIso).sort().slice(-28).map(d => WEAR[d][field]).filter(v => v != null);
  if (ds.length < 7) return null; const m = ds.reduce((a, b) => a + b, 0) / ds.length, sd = Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / (ds.length - 1));
  return { m, sd, n: ds.length };
}
function wearPanel() {
  if (!perm().clinical) return '';
  const days = []; for (let k = 13; k >= 0; k--) { const t = new Date(TODAY); t.setDate(t.getDate() - k); days.push(ISO(t)); }
  const last = Object.keys(WEAR).sort().pop(), any = !!last;
  const series = (f, col, label, unit, worseUp) => {
    const st = last ? wearStats(f, last) : null, vals = days.map(d => WEAR[d] ? WEAR[d][f] : null), have = vals.filter(v => v != null);
    if (!have.length) return `<div class="wr-s"><span>${label}</span><em class="muted">no data</em></div>`;
    const mn = Math.min(...have, st ? st.m - st.sd : Infinity), mx = Math.max(...have, st ? st.m + st.sd : -Infinity), y = v => 46 - (v - mn) / ((mx - mn) || 1) * 40;
    const pts = vals.map((v, i) => v == null ? null : `${(i * 13 + 4).toFixed(0)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
    const v = WEAR[last] ? WEAR[last][f] : null, flag = st && v != null && (worseUp ? v > st.m + st.sd : v < st.m - st.sd);
    return `<div class="wr-s${flag ? ' flag' : ''}"><span>${label}</span><svg viewBox="0 0 180 50" preserveAspectRatio="none">${st ? `<rect x="0" y="${y(st.m + st.sd)}" width="180" height="${Math.max(1, y(st.m - st.sd) - y(st.m + st.sd))}" fill="${col}" opacity=".12"/>` : ''}<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2"/></svg>
      <b>${v != null ? v + unit : '–'}</b><em>${st ? `usual ${st.m.toFixed(0)} ± ${st.sd.toFixed(0)}${unit}` : 'baseline needs 7 days'}${flag ? ' · outside his usual range' : ''}</em></div>`;
  };
  const srpe = days.map(d => DAILY[d] && DAILY[d].court && DAILY[d].court.rpe ? (DAILY[d].court.min || 0) * DAILY[d].court.rpe : 0), wk = srpe.slice(-7).reduce((a, b) => a + b, 0), wkPrev = srpe.slice(0, 7).reduce((a, b) => a + b, 0);
  return `<section class="panel wear"><div class="sec-head"><div><span class="eyebrow">Wearables and effort · monitoring aids, compared with his own baseline</span><h2>Recovery signals</h2></div>
      <label class="btn sm" style="cursor:pointer">Import CSV<input type="file" accept=".csv,.txt" data-wear="file" hidden></label></div>
    ${any ? `<div class="wr-g">${series('hrv', '#a78bfa', 'HRV', ' ms', false)}${series('rhr', '#fb7185', 'Resting heart rate', ' bpm', true)}${series('sleep', '#38bdf8', 'Sleep', ' h', false)}</div><p class="muted" style="font-size:12px;margin:0">${Object.keys(WEAR).length} days imported · last ${esc(last)} · ${esc(WEAR[last].src)}. A value outside the shaded band (his usual ± 1 SD over 28 days) is worth a conversation, not a decision on its own.</p>`
      : `<p class="muted" style="margin:0">No wearable data yet. Export from Oura (Trends → export CSV), Apple Health (Health Auto Export app, daily CSV) or Polar Flow, then import. The file is read on this device.</p>`}
    <div class="wr-rpe"><div><span>Session-RPE load, last 7 days</span><b>${wk}</b><em>minutes × effort (0 to 10) · previous week ${wkPrev}</em></div><p class="muted" style="margin:0;font-size:12px">Shown beside time-only load. The guard and plan still use minutes only, as the team decided.</p></div>
    <p class="lab-src">${srcLink('plews')} · ${srcLink('foster')} · ${srcLink('halson')}</p></section>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || t.dataset.wear !== 'file' || !t.files[0]) return; const f = t.files[0];
  f.text().then(x => { try { const r = wearParse(x); Object.assign(WEAR, r.days); store.set('wear', WEAR); audit('Imported wearable data', r.src + ' · ' + r.n + ' days'); toast(r.n + ' days imported from ' + r.src); keepRender(); } catch (err) { toast('Could not read that file: ' + err.message); } });
});
