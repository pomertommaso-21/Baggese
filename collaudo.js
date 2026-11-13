/* Collaudo automatico dell'app: prova ogni girone e ogni scheda come farebbe una persona.
   Se trova errori esce con codice 1 e la nuova versione NON viene pubblicata.
   Uso: servire la cartella su http://localhost:8765 e poi  node collaudo.js */
const { chromium } = require('playwright'); const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const GIRONI = JSON.parse(html.match(/var GIRONI = (\[.*?\]);\n/)[1]);
const BASE = process.env.BASE || 'http://localhost:8765/';
const problemi = [];
const CONF = [];
GIRONI.forEach((g, i) => CONF.push({ g: g.id, team: g.teams[0][0], vw: 393, vh: 852, sch: i % 2 ? 'dark' : 'light' }));
CONF.push({ g: GIRONI[0].id, team: GIRONI[0].teams[2][0], vw: 375, vh: 667, sch: 'dark' });
CONF.push({ g: GIRONI[0].id, team: GIRONI[0].teams[2][0], vw: 1280, vh: 820, sch: 'light' });
(async () => {
  // file dei dati: devono esistere e avere squadre e partite
  for (const g of GIRONI) {
    try { const d = JSON.parse(fs.readFileSync(g.file, 'utf8')); if (!d.teams || d.teams.length < 2 || !d.matches || !d.matches.length) problemi.push(`${g.file}: senza squadre o partite`);
      const ids = new Set(d.teams.map(t => t.id)); d.matches.forEach(m => { if (!ids.has(m.homeId) || !ids.has(m.awayId)) problemi.push(`${g.file}: partita con squadra sconosciuta (${m.homeId}-${m.awayId})`); });
      g.teams.forEach(t => { if (!fs.existsSync(t[0] + '.png')) problemi.push(`stemma mancante: ${t[0]}.png`); });
    } catch (e) { problemi.push(`${g.file}: non leggibile (${e.message})`); }
  }
  const b = await chromium.launch();
  for (const C of CONF) {
    const mob = C.vw < 700; const tag = `${C.g} ${C.vw}px ${C.sch}`;
    const c = await b.newContext({ viewport: { width: C.vw, height: C.vh }, colorScheme: C.sch, hasTouch: mob, isMobile: mob, serviceWorkers: 'block' });
    await c.addInitScript(([t, g]) => { try { localStorage.setItem('baggese-myteam', t); localStorage.setItem('baggese-follow', JSON.stringify([t])); localStorage.setItem('baggese-mygirone', g); } catch (e) {} }, [C.team, C.g]);
    const p = await c.newPage();
    p.on('pageerror', e => problemi.push(`${tag}: errore JavaScript: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) problemi.push(`${tag}: errore in console: ${m.text().slice(0, 160)}`); });
    p.on('requestfailed', r => { if (r.url().startsWith(BASE)) problemi.push(`${tag}: file non caricato: ${r.url().replace(BASE, '')}`); });
    p.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) problemi.push(`${tag}: file mancante (${r.status()}): ${r.url().replace(BASE, '').split('?')[0]}`); });
    await p.goto(BASE + '?collaudo=' + Date.now()); await p.waitForTimeout(2600);
    async function check(name) {
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => { const W = innerWidth, out = []; if (document.documentElement.scrollWidth > W + 1) out.push('la pagina scorre di lato');
        if (!document.querySelector('#app h1')) out.push('manca il titolo');
        document.querySelectorAll('#app img').forEach(e => { if (e.complete && e.naturalWidth === 0 && getComputedStyle(e).display !== 'none') out.push('immagine rotta ' + e.getAttribute('src')); });
        document.querySelectorAll('#app *').forEach(e => { const s = getComputedStyle(e); if (s.display === 'none' || !e.getClientRects().length) return; const r = e.getBoundingClientRect(); if (!r.width) return;
          for (let a = e.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return; }
          if (r.right > W + 1 || r.left < -1) out.push('elemento fuori schermo ' + e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 20)); });
        return [...new Set(out)].slice(0, 5); });
      r.forEach(x => problemi.push(`${tag} · ${name}: ${x}`));
    }
    async function tap(sel) { const l = p.locator(sel).first(); if (!(await l.count())) return false; try { await l.scrollIntoViewIfNeeded({ timeout: 2000 }); await l.click({ timeout: 3000 }); return true; } catch (e) { problemi.push(`${tag}: non riesco a toccare ${sel}`); return false; } }
    async function closeDlg() { await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); }); await p.waitForTimeout(150); }
    await check('Home');
    if (await tap('[data-view]')) { await p.waitForTimeout(400); await closeDlg(); }
    for (const t of ['partite', 'classifica', 'rosa', 'gestione']) { await tap(`nav.tabs [data-tab="${t}"]`); await check(t); }
    await tap('nav.tabs [data-tab="classifica"]'); await p.waitForTimeout(400);
    if (await tap('[data-act="prog"]')) { await p.waitForTimeout(400); await closeDlg(); }
    /* Partite per giornata: dopo il cambio giornata le schede accanto devono restare fuori dallo schermo */
    await tap('nav.tabs [data-tab="partite"]'); await p.waitForTimeout(400);
    if (await tap('#app [data-pv="round"]')) { await p.waitForTimeout(700);
      for (const st of ['1', '-1']) { if (!(await tap(`#roundCard [data-rstep="${st}"]:not([disabled])`))) continue; await p.waitForTimeout(1400);
        const bad = await p.evaluate(() => { const W = innerWidth, c = document.getElementById('roundCard'); if (!c) return 'scheda della giornata sparita';
          const vp = document.getElementById('rcVp').getBoundingClientRect(), cl = c.getBoundingClientRect().left - vp.left; if (cl < 0 || cl > 40) return 'scheda della giornata fuori posto';
          const s = [...document.querySelectorAll('.rc-side')].find(x => { const q = x.getBoundingClientRect(); return q.left < vp.right - 1 && q.right > vp.left + 1; });
          return s ? 'una giornata accanto è sopra quella attuale' : ''; });
        if (bad) problemi.push(`${tag}: Per giornata: ${bad}`); }
      /* La giornata in breve: la scheda che scorre non deve animare la sua altezza (su iPhone la farebbe tremare) */
      const last = p.locator('#roundChips .rchip:not(.future)').last();
      if (await last.count()) { await last.click(); await p.waitForTimeout(1400);
        const gb = p.locator('#roundCard [data-fold="gb"]');
        if (await gb.count()) { await gb.scrollIntoViewIfNeeded(); await gb.click(); await p.waitForTimeout(60);
          const h1 = await p.evaluate(() => document.getElementById('roundCard').getBoundingClientRect().height); await p.waitForTimeout(600);
          const h2 = await p.evaluate(() => document.getElementById('roundCard').getBoundingClientRect().height);
          if (Math.abs(h1 - h2) > 1) problemi.push(`${tag}: La giornata in breve: la scheda cambia altezza a poco a poco (su iPhone trema)`);
          await gb.click(); await p.waitForTimeout(200); } } }
    /* toccare un punto qualsiasi (non un pulsante) non deve ridisegnare la pagina */
    for (const t of ['classifica', 'partite']) { await tap(`nav.tabs [data-tab="${t}"]`); await p.waitForTimeout(500);
      await p.evaluate(() => { const ch = document.querySelector('#app > *'); if (ch) ch.__mk = 1; });
      const tx = p.locator('#app h1, #app .eyebrow, #app h2').first(); if (await tx.count()) { try { await tx.click({ timeout: 2000 }); } catch (e) {} }
      await p.waitForTimeout(500);
      if (!(await p.evaluate(() => { const ch = document.querySelector('#app > *'); return !!(ch && ch.__mk); }))) problemi.push(`${tag}: ${t}: un tocco fuori dai pulsanti ridisegna tutta la pagina`); }
    await tap('nav.tabs [data-tab="rosa"]'); await p.waitForTimeout(400);
    /* la pagina squadra è divisa in sezioni: i giocatori stanno in "Rosa"; si provano tutte le sezioni */
    for (const rt of ['par', 'num', 'pan', 'ros']) { if (await p.locator(`#app [data-rtab="${rt}"]`).count()) { await tap(`#app [data-rtab="${rt}"]`); await p.waitForTimeout(350); } }
    if (await tap('#app [data-player]:visible')) { await p.waitForTimeout(400); await closeDlg(); }
    await c.close();
  }
  /* Proiezione: cambiando girone deve mostrare le squadre del girone nuovo, non quelle del precedente */
  if (GIRONI.length > 1) {
    const g0 = GIRONI[0], g1 = GIRONI.find(g => g.id !== g0.id && !/Terza/.test(g.cat)) || GIRONI[1];
    const c = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await c.addInitScript(([t, g]) => { try { localStorage.setItem('baggese-myteam', t); localStorage.setItem('baggese-follow', JSON.stringify([t])); localStorage.setItem('baggese-mygirone', g); } catch (e) {} }, [g0.teams[0][0], g0.id]);
    const p = await c.newPage(); p.on('pageerror', e => problemi.push(`Proiezione: errore JavaScript: ${e.message}`));
    await p.goto(BASE + '?collaudo=' + Date.now()); await p.waitForTimeout(2600);
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); });
    try {
      await p.click('nav.tabs [data-tab="classifica"]'); await p.waitForTimeout(600);
      if (await p.locator('[data-srt="prj"]').count()) {
        await p.click('[data-srt="prj"]'); await p.waitForSelector('.prjt .crow[data-tid]', { timeout: 10000 });
        const ids0 = new Set(g0.teams.map(t => t[0]));
        await p.click('[data-act="pickGirone"]'); await p.waitForTimeout(500); await p.click(`[data-gir="${g1.id}"]`); await p.waitForTimeout(1500);
        if (!(await p.locator('[data-srt="prj"][aria-pressed="true"]').count())) { await p.click('nav.tabs [data-tab="classifica"]').catch(() => {}); await p.waitForTimeout(500); if (await p.locator('[data-srt="prj"]').count()) await p.click('[data-srt="prj"]'); }
        await p.waitForSelector('.prjt .crow[data-tid]', { timeout: 10000 });
        const shown = await p.$$eval('.prjt .crow[data-tid]', rs => rs.map(r => r.getAttribute('data-tid')));
        const wrong = shown.filter(id => ids0.has(id) || !g1.teams.some(t => t[0] === id));
        if (wrong.length) problemi.push(`Proiezione: dopo il passaggio da ${g0.id} a ${g1.id} mostra squadre dell'altro girone (${wrong.slice(0, 3).join(', ')})`);
      }
    } catch (e) { problemi.push(`Proiezione: prova del cambio girone non riuscita (${e.message.split('\n')[0]})`); }
    await c.close();
  }
  await b.close();
  const uniq = [...new Set(problemi)];
  if (uniq.length) { console.log('COLLAUDO NON SUPERATO (' + uniq.length + ' problemi):\n- ' + uniq.join('\n- ')); process.exit(1); }
  console.log('Collaudo superato: ' + CONF.length + ' prove, ' + GIRONI.length + ' gironi, nessun problema.');
})();
