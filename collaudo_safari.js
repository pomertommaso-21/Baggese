// Collaudo con il motore di Safari (WebKit), come su iPhone.
// Controlla lo scorrimento delle giornate in più gironi: deve animarsi davvero (posizioni intermedie),
// senza ridisegnare la pagina, senza schede che spariscono o restano sovrapposte; due scorrimenti
// veloci devono contare entrambi; freccia e numeri delle giornate devono funzionare;
// "La giornata in breve" deve aprirsi senza far cambiare altezza a poco a poco alla scheda.
const { webkit, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
(async () => {
  const problemi = [];
  const b = await webkit.launch();
  for (const [g, team] of [['O', 't_baggese'], ['PB', null], ['TC', null]]) {
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.addInitScript(([g, team]) => { try { localStorage.setItem('baggese-mygirone', g); if (team) localStorage.setItem('baggese-myteam', team); localStorage.removeItem('baggese-fold-gb'); } catch (e) {} }, [g, team]);
    const p = await c.newPage(); const tag = 'Safari ' + g;
    p.on('pageerror', e => { if (!/view transition/i.test(e.message)) problemi.push(`${tag}: errore JavaScript: ${e.message}`); });
    await p.goto(BASE + '?t=' + Date.now()); await p.waitForTimeout(3000);
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); }); await p.waitForTimeout(300);
    await p.click('nav.tabs [data-tab="partite"]'); await p.waitForTimeout(900);
    await p.click('[data-pv="round"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { const a = [...document.querySelectorAll('.rchip:not(.future)')]; (a[a.length - 1] || document.querySelector('.rchip')).click(); }); await p.waitForTimeout(1500);
    await p.evaluate(() => { const ch = document.querySelector('#app > *'); if (ch) ch.__mk = 1; });
    const cur = () => p.evaluate(() => +document.getElementById('roundCard').dataset.r);
    // gesto come su iPhone: tocco, trascinamento, rilascio e poi il "tap" che Safari genera
    const swipe = (dir, wait) => p.evaluate(([dir, wait]) => new Promise(res => {
      const el = document.getElementById('roundCard'); const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2, y = r.top + 160;
      const mk = (type, x) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: x == null ? [] : [{ clientX: x, clientY: y }] }); Object.defineProperty(e, 'changedTouches', { value: [{ clientX: x == null ? x0 - dir * 150 : x, clientY: y }] }); return e; };
      const slots = () => document.querySelectorAll('#rcVp .rc-slot').length;
      const xs = []; el.dispatchEvent(mk('touchstart', x0)); let i = 0;
      const step = () => { i++; el.dispatchEvent(mk('touchmove', x0 - dir * 150 * i / 8)); if (i < 8) requestAnimationFrame(step); else { document.dispatchEvent(mk('touchend', null)); el.click(); let k = 0, mn = 9;
        const after = () => { mn = Math.min(mn, slots()); const inc = document.querySelector('#rcVp .rc-slot.' + (dir > 0 ? 'n' : 'p')) || document.querySelector('#rcVp .rc-slot.cur'); xs.push(Math.round(inc.getBoundingClientRect().left)); if (++k < wait) requestAnimationFrame(after); else res({ mn, xs }); }; requestAnimationFrame(after); } };
      requestAnimationFrame(step); }), [dir, wait]);
    const rs = await p.evaluate(() => [...document.querySelectorAll('.rchip')].map(x => +x.dataset.round));
    const first = rs[0], last = rs[rs.length - 1];
    for (const dir of [-1, 1, -1]) {
      const r0 = await cur(); if ((dir < 0 && r0 === first) || (dir > 0 && r0 === last)) continue;
      const r = await swipe(dir, 45); await p.waitForTimeout(300); const r1 = await cur();
      if (r.mn < 2) problemi.push(`${tag}: scorrendo, le schede accanto spariscono`);
      if (r1 !== r0 + dir) problemi.push(`${tag}: scorrendo dalla ${r0}ª si arriva alla ${r1}ª invece che alla ${r0 + dir}ª`);
      const mid = r.xs.filter(x => Math.abs(x - 16) > 20 && Math.abs(x - 16) < 340).length;
      if (mid < 3) problemi.push(`${tag}: la giornata non scorre, salta direttamente (posizioni intermedie: ${mid})`);
    }
    // due scorrimenti veloci: il secondo parte mentre il primo si sta ancora muovendo
    { const r0 = await cur(); const dir = r0 - first >= 2 ? -1 : 1;
      if ((dir < 0 ? r0 - first : last - r0) >= 2) { await swipe(dir, 4); await swipe(dir, 45); await p.waitForTimeout(400); const r1 = await cur();
        if (r1 !== r0 + 2 * dir) problemi.push(`${tag}: due scorrimenti veloci: dalla ${r0}ª alla ${r1}ª invece che alla ${r0 + 2 * dir}ª`); } }
    // freccia e numero della giornata
    { const r0 = await cur(); const dir = r0 > first ? -1 : 1; await p.evaluate((d) => document.querySelector(`#roundCard [data-rstep="${d}"]`).click(), dir); await p.waitForTimeout(1200);
      if ((await cur()) !== r0 + dir) problemi.push(`${tag}: la freccia non cambia giornata`);
      const tgt = rs[Math.floor(rs.length / 2)]; await p.click(`.rchip[data-round="${tgt}"]`); await p.waitForTimeout(1500);
      if ((await cur()) !== tgt) problemi.push(`${tag}: il numero della giornata non porta alla ${tgt}ª`); }
    // a fine scorrimento nessuna giornata accanto sopra a quella attuale
    { await p.waitForTimeout(800); const sopra = await p.evaluate(() => { const vp = document.getElementById('rcVp').getBoundingClientRect(); return [...document.querySelectorAll('#rcVp .rc-side')].some(s => { const q = s.getBoundingClientRect(); return q.left < vp.right - 1 && q.right > vp.left + 1; }); });
      if (sopra) problemi.push(`${tag}: una giornata accanto resta sopra quella attuale`); }
    if (!(await p.evaluate(() => { const ch = document.querySelector('#app > *'); return !!(ch && ch.__mk); }))) problemi.push(`${tag}: durante gli scorrimenti la pagina viene ridisegnata`);
    // La giornata in breve: altezza della scheda in un colpo solo (a poco a poco su iPhone trema)
    { await p.evaluate(() => { const a = [...document.querySelectorAll('.rchip:not(.future)')]; if (a.length) a[a.length - 1].click(); }); await p.waitForTimeout(1500);
      const gb = p.locator('#roundCard [data-fold="gb"]');
      if (await gb.count()) { await gb.scrollIntoViewIfNeeded(); await gb.click(); await p.waitForTimeout(60);
        const h1 = await p.evaluate(() => document.getElementById('roundCard').getBoundingClientRect().height); await p.waitForTimeout(600);
        const h2 = await p.evaluate(() => document.getElementById('roundCard').getBoundingClientRect().height);
        if (Math.abs(h1 - h2) > 1) problemi.push(`${tag}: La giornata in breve fa cambiare altezza alla scheda a poco a poco (su iPhone trema)`); } }
    await c.close();
  }
  await b.close();
  if (problemi.length) { console.log('COLLAUDO SAFARI NON SUPERATO:\n- ' + problemi.join('\n- ')); process.exit(1); }
  console.log('Collaudo Safari superato: giornate che scorrono bene in 3 gironi.');
})();
