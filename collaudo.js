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
        if (bad) problemi.push(`${tag}: Per giornata: ${bad}`); } }
    await tap('nav.tabs [data-tab="rosa"]'); await p.waitForTimeout(400);
    if (await tap('#app [data-player]')) { await p.waitForTimeout(400); await closeDlg(); }
    await c.close();
  }
  await b.close();
  const uniq = [...new Set(problemi)];
  if (uniq.length) { console.log('COLLAUDO NON SUPERATO (' + uniq.length + ' problemi):\n- ' + uniq.join('\n- ')); process.exit(1); }
  console.log('Collaudo superato: ' + CONF.length + ' prove, ' + GIRONI.length + ' gironi, nessun problema.');
})();
