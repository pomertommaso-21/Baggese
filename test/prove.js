/* Prove dell'app, da far girare prima di ogni pubblicazione (anche nel collaudo online).
   Controllano le cose che non si devono mai rompere: scorrimento delle giornate, viste di Partite e Classifica,
   barra in basso, tocchi della Home, proiezione, modifiche tue contro dati di Tuttocampo, Impostazioni,
   rigori, giorno della partita, carriera, fluidità ed errori.
   Uso: node test/prove.js        (serve da sola la cartella del repository, non serve altro)
   Esce con codice 1 se una prova non passa. Con CI=1 la fluidità avvisa ma non blocca (le macchine online sono lente). */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TIPI = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.ics': 'text/calendar' };
const D0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
const esiti = []; let errori = [];
const ok = (cond, nome, info) => { esiti.push([!!cond, nome, info]); console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (cond || info === undefined ? '' : '  → ' + (typeof info === 'string' ? info : JSON.stringify(info)))); };
const avviso = (cond, nome, info) => { if (!cond && process.env.CI) { console.log('  ! ' + nome + '  → ' + JSON.stringify(info) + ' (solo avviso)'); return; } ok(cond, nome, info); };

function server() {
  return new Promise(res => { const s = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TIPI[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  }); s.listen(0, '127.0.0.1', () => res(s)); });
}

(async () => {
  const srv = await server(), BASE = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch();
  async function apri(o) { o = o || {};
    const c = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Rome', colorScheme: o.dark ? 'dark' : 'light' });
    if (o.ora) await c.clock.setFixedTime(new Date(o.ora));
    await c.addInitScript(([t, g, extra]) => { try { localStorage.setItem('baggese-myteam', t); localStorage.setItem('baggese-mygirone', g); (extra || []).forEach(k => localStorage.removeItem(k)); } catch (e) {} }, [o.team || 't_baggese', o.girone || 'O', o.togli]);
    if (o.dati) await c.route('**/data.json*', r => r.fulfill({ json: o.dati() }));
    await c.route(/open-meteo\.com/, r => o.meteo === false ? r.abort() : r.fulfill({ json: /geocoding/.test(r.request().url()) ? { results: [{ latitude: 45.46, longitude: 9.1 }] } : meteoFinto(r.request().url()) }));
    const p = await c.newPage();
    p.on('pageerror', e => errori.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FAILED|net::/.test(m.text())) errori.push('console: ' + m.text().slice(0, 140)); });
    await p.goto(BASE); await p.waitForTimeout(o.attesa || 2800);
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); });
    const cdp = await c.newCDPSession(p);
    p.trascina = async (x0, x1, y, passi, pausa) => { passi = passi || 16; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= passi; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / passi, y }] }); await p.waitForTimeout(16); }
      if (pausa) await p.waitForTimeout(pausa); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    p.tab = async t => { await p.evaluate(t => document.querySelector('nav.tabs [data-tab="' + t + '"]').click(), t); await p.waitForTimeout(1400); };
    p.premi = async (attr, val) => { await p.evaluate(([a, v]) => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); const x = document.createElement('button'); x.setAttribute(a, v); document.body.appendChild(x); x.click(); x.remove(); }, [attr, val]); await p.waitForTimeout(900); };
    p.cdp = cdp; p.ctx = c; return p; }
  function meteoFinto(u) { const d = (u.match(/start_date=([\d-]+)/) || [])[1] || '2026-01-01', t = [], T = [], P = [], W = [];
    for (let h = 0; h < 24; h++) { t.push(d + 'T' + String(h).padStart(2, '0') + ':00'); T.push(9); P.push(20); W.push(3); } return { hourly: { time: t, temperature_2m: T, precipitation_probability: P, weather_code: W } }; }
  const sezione = async (nome, fn) => { console.log(nome); try { await fn(); } catch (e) { ok(false, nome + ': si è fermata', e.message.split('\n')[0]); } };

  await sezione('Partite › Per giornata (scorrimento delle giornate)', async () => {
    const p = await apri(); await p.tab('partite'); await p.tap('[data-pv="round"]'); await p.waitForTimeout(1300);
    const st = () => p.evaluate(() => { const W = innerWidth, rc = document.getElementById('roundCard'), q = rc.getBoundingClientRect();
      return { r: +rc.dataset.r, left: Math.round(q.left), sel: +document.querySelector('.rchip[aria-pressed="true"]').dataset.round,
        lati: [...document.querySelectorAll('.rc-side')].every(s => { const z = s.getBoundingClientRect(); return z.left >= W - 1 || z.right <= 1; }) }; });
    const a = await st(), L = a.left, buono = s => s.left === L && s.lati && s.r === s.sel;
    ok(buono(a), 'giornata allineata e uguale al chip scelto', a);
    const passo = async (nome, fn, atteso) => { const s0 = await st(); await fn(); await p.waitForTimeout(1300); const s = await st(); ok(buono(s) && s.r === s0.r + atteso, nome, { da: s0.r, a: s.r, atteso: s0.r + atteso, s }); };
    const sw = d => p.trascina(200, 200 - d * 160, 420, 10);
    await passo('freccia avanti', () => p.click('#roundCard [data-rstep="1"]'), 1);
    await passo('freccia indietro', () => p.click('#roundCard [data-rstep="-1"]'), -1);
    await passo('scorrimento avanti', () => sw(1), 1);
    await passo('scorrimento indietro', () => sw(-1), -1);
    await passo('due scorrimenti di fila', async () => { await sw(1); await p.waitForTimeout(300); await sw(1); }, 2);
    await passo('due scorrimenti di fila indietro', async () => { await sw(-1); await p.waitForTimeout(300); await sw(-1); }, -2);
    await p.click('.rchip[data-round="3"]'); await p.waitForTimeout(1300); const c3 = await st(); ok(buono(c3) && c3.r === 3, 'tocco sul chip della 3ª', c3);
    await passo('scorrimento dopo il chip', () => sw(1), 1);
    await p.ctx.close(); });

  await sezione('Partite: passaggio tra le viste', async () => {
    const p = await apri(); await p.tab('partite');
    await p.evaluate(() => { window.__v = document.querySelector('#app .view'); window.__vt = 0; const o = document.startViewTransition; if (o) document.startViewTransition = function (f) { window.__vt++; return o.call(document, f); }; });
    const st = () => p.evaluate(() => { const sg = document.querySelector('#app .seg[aria-label="Vista partite"]'), i = sg.querySelector('.seg-ind').getBoundingClientRect(), on = sg.querySelector('[aria-pressed="true"]'), o = on.getBoundingClientRect();
      return { vista: on.dataset.pv, giornata: +((document.querySelector('#roundChips .rchip[aria-pressed="true"]') || {}).dataset || {}).round || 0, stessa: document.querySelector('#app .view') === __v, vt: __vt, pillola: Math.abs(i.left - o.left) < 2 && Math.abs(i.width - o.width) < 2 }; });
    const s0 = await st(); ok(s0.vista === 'mine' && s0.pillola, 'si parte dalla vista della squadra', s0);
    await p.trascina(330, 80, 500); await p.waitForTimeout(1300); const s1 = await st(); ok(s1.vista === 'round' && s1.stessa && !s1.vt && s1.pillola, 'scorrimento verso Per giornata, senza dissolvenza', s1);
    await p.trascina(330, 90, 400); await p.waitForTimeout(1300); const s2 = await st(); ok(s2.vista === 'round' && s2.giornata === s1.giornata + 1, 'sulla giornata lo scorrimento cambia giornata', s2);
    await p.trascina(90, 330, 400); await p.waitForTimeout(1300); const s3 = await st(); ok(s3.giornata === s1.giornata, 'e torna indietro', s3);
    await p.trascina(8, 280, 450); await p.waitForTimeout(1300); const s4 = await st(); ok(s4.vista === 'mine' && s4.pillola, 'dal bordo si torna alla vista della squadra', s4);
    await p.ctx.close(); });

  await sezione('Classifica: viste e pillola', async () => {
    const p = await apri(); await p.tab('classifica');
    await p.evaluate(() => { window.__v = document.querySelector('#app .view'); });
    const st = () => p.evaluate(() => { const sg = document.querySelector('.seg[aria-label="Classifica"]'), on = sg.querySelector('[aria-pressed="true"]'), i = sg.querySelector('.seg-ind');
      return { vista: on.dataset.cls, stessa: document.querySelector('#app .view') === __v, righe: document.querySelectorAll('#app .crow').length, marcatori: document.querySelectorAll('#app .mk').length, pillola: !!i && Math.abs(i.getBoundingClientRect().left - on.getBoundingClientRect().left) < 3 }; });
    await p.tap('[data-cls="marcatori"]'); await p.waitForTimeout(1200); let s = await st(); ok(s.vista === 'marcatori' && s.marcatori > 0 && s.stessa && s.pillola, 'tocco su Marcatori', s);
    await p.trascina(330, 90, 600); await p.waitForTimeout(1300); s = await st(); ok(s.vista === 'stats' && s.pillola, 'scorrimento verso Statistiche', s);
    await p.trascina(70, 300, 600); await p.waitForTimeout(1300); await p.trascina(70, 300, 600); await p.waitForTimeout(1300); s = await st(); ok(s.vista === 'squadre' && s.righe > 1 && s.pillola, 'scorrimento fino a Squadre', s);
    await p.evaluate(() => document.querySelector('[data-srt="prj"]').click()); await p.waitForTimeout(3500);
    const n = await p.evaluate(() => document.querySelectorAll('.prjt .crow').length); ok(n > 1, 'classifica ordinata per proiezione', n);
    await p.ctx.close(); });

  await sezione('Barra in basso', async () => {
    const p = await apri(); const cur = () => p.evaluate(() => document.querySelector('nav.tabs [aria-current="page"]').dataset.tab);
    const xy = t => p.evaluate(t => { const r = document.querySelector('nav.tabs [data-tab="' + t + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, t);
    for (const t of ['partite', 'classifica', 'rosa', 'gestione', 'home']) { await p.tap('nav.tabs [data-tab="' + t + '"]'); await p.waitForTimeout(900); ok(await cur() === t, 'tocco su ' + t); }
    let [x, y] = await xy('classifica'); const hx = (await xy('home'))[0]; await p.trascina(x, hx, y, 30, 250); await p.waitForTimeout(1000); ok(await cur() === 'home', 'trascinando la pillola fino a Home');
    await p.ctx.close(); });

  await sezione('Home: ogni tocco apre la sua scheda', async () => {
    const p = await apri();
    for (const [k, sel] of [['prossima partita', '.hm-mu'], ['ultimo risultato', '.hm-lr'], ['obiettivo', '.hm-goal'], ['capocannoniere', '.hm-sc .ldr-1'], ['bomber', '.hm-ln .plink'], ['forma', '.hm-fm .form-item']]) {
      await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); }); await p.waitForTimeout(300);
      const el = await p.$(sel); if (!el) { ok(false, k, 'elemento non trovato'); continue; }
      await el.scrollIntoViewIfNeeded(); await el.tap(); await p.waitForTimeout(700); ok(await p.evaluate(() => document.getElementById('dlg').open), k); }
    await p.ctx.close(); });

  await sezione('Proiezione punti uguale in Home e in Squadre', async () => {
    const p = await apri({ attesa: 5000 }); const h = await p.evaluate(() => (document.querySelector('[data-hmprj]') || {}).textContent);
    await p.tab('rosa'); await p.waitForTimeout(1500); const s = await p.evaluate(() => ((document.querySelector('[data-prjline]') || {}).textContent || '').match(/(\d+) punti/));
    ok(h && s && h === s[1], 'stessa proiezione', { home: h, squadre: s && s[1] }); await p.ctx.close(); });

  await sezione('Le tue modifiche contro i dati di Tuttocampo', async () => {
    let D = D0; const p = await apri({ dati: () => D }); const K = 'baggese-2026-27';
    const get = () => p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)), m = x => S.matches.find(y => y.id === x); return { m1: [m('m1_1').hg, m('m1_1').ag], m2: [m('m1_2').hg, m('m1_2').ag], tc: !!localStorage.getItem(K + '|tc'), rig: (m('m1_1').pens || []).length }; }, K);
    const s0 = await get(); ok(s0.tc, 'la copia di Tuttocampo è salvata');
    await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)), m = S.matches.find(y => y.id === 'm1_1'); m.hg = 9; m.pens = [{ playerId: 'p_bag_16', how: 'parato', keeperId: '', min: '30' }]; S.updatedAt = new Date().toISOString(); localStorage.setItem(K, JSON.stringify(S)); }, K);
    D = JSON.parse(JSON.stringify(D0)); D.updatedAt = new Date(Date.now() + 60000).toISOString(); D.matches.find(y => y.id === 'm1_2').hg = 7; D.matches.find(y => y.id === 'm1_1').ag = 5;
    await p.reload(); await p.waitForTimeout(3500); const s1 = await get();
    ok(s1.m1[0] == 9 && s1.m1[1] == s0.m1[1] && s1.rig === 1, 'la tua modifica vince sul dato nuovo', s1);
    ok(s1.m2[0] == 7, 'il resto arriva da Tuttocampo', s1);
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); }); await p.tab('gestione');
    await p.evaluate(() => document.querySelector('[data-act="tcSync"]').click()); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('[data-act="tcSyncGo"]').click()); await p.waitForTimeout(900);
    const s2 = await get(); ok(s2.m1[0] == D.matches.find(y => y.id === 'm1_1').hg && s2.m1[1] == 5 && s2.rig === 0, 'Sincronizza rimette i dati di Tuttocampo', s2);
    await p.ctx.close(); });

  await sezione('Impostazioni', async () => {
    const p = await apri(); await p.tab('gestione');
    for (const k of ['import', 'teams', 'set', 'code', 'backup']) { const v = await p.evaluate(k => { const d = document.querySelector('.gdet[data-gk="' + k + '"]'); d.querySelector('summary').click(); return new Promise(r => setTimeout(() => r(d.open && d.querySelector('.gdet-body').innerText.trim().length > 10), 300)); }, k); ok(v, 'si apre: ' + k); }
    for (const [a, v] of [['data-new', '1'], ['data-player', 'new'], ['data-act', 'follow']]) { await p.evaluate(([a, v]) => { const d = document.getElementById('dlg'); if (d.open) d.close(); document.querySelector('#app [' + a + '="' + v + '"]').click(); }, [a, v]); await p.waitForTimeout(700); ok(await p.evaluate(() => document.getElementById('dlg').open), 'apre la scheda: ' + a + '=' + v); }
    await p.evaluate(() => document.getElementById('dlg').close()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-themeset="dark"]').click()); await p.waitForTimeout(400); ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'tema scuro');
    await p.evaluate(() => document.querySelector('[data-themeset="auto"]').click()); await p.ctx.close(); });

  await sezione('Rigori nella modifica della partita', async () => {
    const m = D0.matches.find(x => x.homeId === 't_corsico' && x.awayId === 't_baggese' && x.hg !== '') || D0.matches.find(x => x.hg !== '');
    const p = await apri(); await p.premi('data-edit', m.id);
    if (!(await p.$('[data-pn="0"]'))) { await p.evaluate(() => document.querySelector('[data-act="addPen"]').click()); await p.waitForTimeout(400); }
    await p.evaluate(h => { const s = document.querySelector('[data-pn="0"]'), g = [...s.querySelectorAll('optgroup')].find(g => g.label.indexOf(h) >= 0) || s.querySelectorAll('optgroup')[0]; s.value = g.querySelectorAll('option')[0].value; s.dispatchEvent(new Event('change', { bubbles: true })); const k = document.querySelector('[data-pnk="0"]'); k.value = 'parato'; k.dispatchEvent(new Event('change', { bubbles: true })); }, 'Corsico'); await p.waitForTimeout(400);
    const g = await p.evaluate(() => { const g = document.querySelector('[data-pngk="0"]'); return g ? [...g.querySelectorAll('optgroup')].map(x => x.label).join(',') + ' ' + g.options.length : null; });
    ok(g && /Portieri/.test(g), 'parato: compare l’elenco dei portieri dell’altra squadra', g);
    await p.evaluate(() => { const k = document.querySelector('[data-pnk="0"]'); k.value = 'fuori'; k.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(400);
    ok(!(await p.$('[data-pngk="0"]')), 'fuori: il portiere sparisce'); await p.ctx.close(); });

  await sezione('Giorno della partita in Home', async () => {
    const nx = D0.matches.filter(m => (m.homeId === 't_baggese' || m.awayId === 't_baggese') && m.hg === '' && m.date && m.time).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    if (!nx) { ok(true, 'nessuna partita futura con orario: prova saltata'); return; }
    const ko = new Date(nx.date + 'T' + nx.time + ':00+01:00');
    let p = await apri({ ora: new Date(ko.getTime() - 3 * 36e5 - 10 * 6e4).toISOString() });
    let t = await p.evaluate(() => document.querySelector('.hm-nx').innerText.replace(/\n+/g, ' | '));
    ok(/GIORNO PARTITA/i.test(t) && /tra 3 h 10 min/.test(t) && /9°/.test(t) && /mappa/.test(t), 'conto alla rovescia, meteo e campo', t); await p.ctx.close();
    p = await apri({ ora: new Date(ko.getTime() - 3 * 36e5).toISOString(), meteo: false });
    t = await p.evaluate(() => document.querySelector('.hm-nx').innerText); ok(/non disponibile/.test(t), 'senza rete il meteo dice non disponibile'); await p.ctx.close();
    p = await apri({ ora: new Date(ko.getTime() - 4 * 864e5).toISOString() });
    t = await p.evaluate(() => document.querySelector('.hm-nx').innerText); ok(/PROSSIMA PARTITA/i.test(t) && !/mappa/.test(t), 'gli altri giorni la Home resta normale'); await p.ctx.close(); });

  await sezione('Carriera nella scheda del giocatore', async () => {
    const p = await apri({ togli: ['baggese-fold-car'] }); await p.premi('data-player', 'p_bag_16');
    ok(await p.evaluate(() => !!document.querySelector('#dlg .car-fd:not(.open)')), 'la tendina è chiusa');
    await p.evaluate(() => document.querySelector('#dlg [data-fold="car"]').click()); await p.waitForTimeout(800);
    const r = await p.evaluate(() => document.querySelectorAll('#dlg .car-fd.open .car-r').length); ok(r >= 1, 'si apre con la stagione in corso', r);
    await p.ctx.close(); });

  await sezione('Fluidità (telefono rallentato 4 volte)', async () => {
    const p = await apri({ togli: ['baggese-fold-live', 'baggese-fold-rec', 'baggese-fold-cal'] }); await p.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.tab('classifica'); await p.waitForTimeout(2000);
    const misura = async (nome, js) => { await p.evaluate(() => { window.__f = []; let l = performance.now(); window.__go = true; (function f(t) { window.__f.push(t - l); l = t; if (window.__go) requestAnimationFrame(f); })(performance.now()); });
      await p.evaluate(js); await p.waitForTimeout(900); const r = await p.evaluate(() => { window.__go = false; const f = window.__f.slice(1); return { max: Math.round(Math.max(...f)), oltre50: f.filter(x => x > 50).length }; });
      avviso(r.max < 70, 'senza scatti: ' + nome, r); await p.waitForTimeout(1500); };
    await misura('Classifica › Marcatori', () => document.querySelector('[data-cls="marcatori"]').click());
    await misura('Classifica › Statistiche', () => document.querySelector('[data-cls="stats"]').click());
    await misura('apertura di una tendina', () => document.querySelector('[data-fold="rec"]').click());
    await misura('Classifica › Squadre', () => document.querySelector('[data-cls="squadre"]').click());
    await p.ctx.close(); });

  ok(!errori.length, 'nessun errore JavaScript durante le prove', errori.slice(0, 5));
  await b.close(); srv.close();
  const no = esiti.filter(e => !e[0]);
  console.log('\n' + (no.length ? 'PROVE NON SUPERATE: ' + no.length + ' su ' + esiti.length : 'Prove superate: ' + esiti.length + ' su ' + esiti.length));
  process.exit(no.length ? 1 : 0);
})();
