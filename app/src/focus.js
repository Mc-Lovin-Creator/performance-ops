/* ---------- Focus and calm: Labs section folds away; one switch sets how much motion the app uses ---------- */
const FX_MODES = [['calm', 'Calm', 'No title cards or confetti; still visuals'], ['balanced', 'Balanced', 'Title cards once, celebrations only for big wins'], ['cinematic', 'Cinematic', 'Every effect, every session']];
window.FXMODE = () => store.get('fx', 'balanced');
const fxApply = () => { document.documentElement.dataset.fx = FXMODE(); const b = document.getElementById('fxmode'); if (b) { const m = FX_MODES.find(x => x[0] === FXMODE()); b.textContent = m[1]; b.title = 'Motion: ' + m[1] + '. ' + m[2] + '. Click to change.'; } };
(function fxButton() { const t = document.getElementById('theme'); if (!t || document.getElementById('fxmode')) return; const b = document.createElement('button'); b.id = 'fxmode'; b.className = 'fx-mode'; t.parentNode.insertBefore(b, t); fxApply(); })();
document.addEventListener('click', e => {
  const l = e.target.closest && e.target.closest('[data-labs]'); if (l) { store.set('labsOpen', !store.get('labsOpen', false)); renderNav(); return; }
  if (e.target.id === 'fxmode') { const i = FX_MODES.findIndex(x => x[0] === FXMODE()); store.set('fx', FX_MODES[(i + 1) % 3][0]); fxApply(); toast('Motion: ' + FX_MODES[(i + 1) % 3][1] + '. ' + FX_MODES[(i + 1) % 3][2]); }
});
fxApply();
