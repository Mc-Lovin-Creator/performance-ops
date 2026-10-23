/* ---------- v44 Chapters: the app told as a film in chapters. A one-second title card the first time each chapter opens in a session ---------- */
const CHAPTERS = {
  player1: ['One', 'The Comeback'], return: ['Two', 'The Road Back'], loadlab: ['Three', 'The Threshold'], p1tx: ['Four', 'Hands On'], p1test: ['Five', 'The Numbers'],
  p1rx: ['Six', 'The Prescription'], p1anat: ['Seven', 'Beneath the Skin'], anatomy: ['Seven', 'Beneath the Skin'], p1edu: ['Eight', 'The Library'], learn: ['Eight', 'The Library'],
  members: ['Nine', 'The Ensemble'], book: ['Ten', 'The Appointment'], audit: ['Eleven', 'The Evidence'], innovation: ['Twelve', 'The Scout'], ask: ['Thirteen', 'The Question'], command: ['Prologue', 'The Squad']
};
function chapterSlate(r) {
  const c = CHAPTERS[r]; if (!c || window.__noSlate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const k = 'plos.ch.' + r; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, 1); } catch (x) { }
  const el = document.createElement('div'); el.className = 'slate'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="slate-in"><span class="slate-n">${c[0] === 'Prologue' ? 'Prologue' : 'Chapter ' + c[0]}</span><b class="slate-t">${c[1]}</b><span class="slate-r"></span></div>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 520); };
  setTimeout(kill, 1150); el.addEventListener('click', kill);
}
