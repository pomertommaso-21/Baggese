// Collaudo con il motore di Safari (WebKit), come su iPhone: lo scorrimento delle giornate
// deve animarsi davvero, senza ridisegnare la pagina e senza schede sovrapposte.
const { webkit, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
(async () => {
  const problemi = [];
  const b = await webkit.launch();
  const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.addInitScript(() => { try { localStorage.setItem('baggese-myteam', 't_baggese'); localStorage.setItem('baggese-mygirone', 'O'); } catch (e) {} });
  const p = await c.newPage();
  p.on('pageerror', e => { if (!/view transition/i.test(e.message)) problemi.push('errore JavaScript: ' + e.message); });
  await p.goto(BASE + '?t=' + Date.now()); await p.waitForTimeout(3000);
  await p.click('nav.tabs [data-tab="partite"]'); await p.waitForTimeout(900);
  await p.click('[data-pv="round"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { const ch = document.querySelector('#app > *'); if (ch) ch.__mk = 1; });
  const swipe = (dir) => p.evaluate((dir) => new Promise(res => {
    const el = document.getElementById('roundCard'); const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2, y = r.top + 160; const log = [];
    const mk = (type, x) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: x == null ? [] : [{ clientX: x, clientY: y }] }); Object.defineProperty(e, 'changedTouches', { value: [{ clientX: x == null ? x0 - dir * 150 : x, clientY: y }] }); return e; };
    const n = () => document.querySelectorAll('#rcVp .rc-slot').length;
    const from = document.getElementById('roundCard').dataset.r;
    el.dispatchEvent(mk('touchstart', x0)); let i = 0;
    const step = () => { i++; el.dispatchEvent(mk('touchmove', x0 - dir * 150 * i / 8)); if (i < 8) requestAnimationFrame(step); else { document.dispatchEvent(mk('touchend', null)); el.click(); let k = 0, mid = [];
      const after = () => { mid.push(n()); if (++k < 50) requestAnimationFrame(after); else res({ from, to: document.getElementById('roundCard').dataset.r, slots: mid }); }; requestAnimationFrame(after); } };
    requestAnimationFrame(step); }), dir);
  for (const dir of [1, -1, 1]) {
    const r = await swipe(dir); await p.waitForTimeout(400);
    if (r.slots.some(x => x < 2)) problemi.push(`scorrimento ${dir > 0 ? 'avanti' : 'indietro'}: le schede accanto spariscono durante l'animazione`);
    if (+r.to !== +r.from + dir) problemi.push(`scorrimento ${dir > 0 ? 'avanti' : 'indietro'}: dalla ${r.from}ª si è arrivati alla ${r.to}ª`);
  }
  if (!(await p.evaluate(() => { const ch = document.querySelector('#app > *'); return !!(ch && ch.__mk); }))) problemi.push('durante lo scorrimento la pagina viene ridisegnata');
  const sopra = await p.evaluate(() => { const vp = document.getElementById('rcVp').getBoundingClientRect(); return [...document.querySelectorAll('#rcVp .rc-side')].some(s => { const q = s.getBoundingClientRect(); return q.left < vp.right - 1 && q.right > vp.left + 1; }); });
  if (sopra) problemi.push('a fine scorrimento una giornata accanto resta sopra quella attuale');
  await b.close();
  if (problemi.length) { console.log('COLLAUDO SAFARI NON SUPERATO:\n- ' + problemi.join('\n- ')); process.exit(1); }
  console.log('Collaudo Safari superato: scorrimento delle giornate regolare.');
})();
