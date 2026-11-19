/* Foto delle schermate principali, per confrontare l'aspetto prima e dopo una modifica che non deve cambiare niente.
   Uso: node test/foto.js <cartella>        poi:  node test/foto.js --confronta <cartella prima> <cartella dopo>
   Ora del telefono fissa e meteo finto, così due giri sulla stessa app danno foto identiche. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TIPI = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const ORA = '2026-11-19T10:00:00+01:00';

async function confronta(a, b) {
  const br = await chromium.launch(), p = await br.newPage(); let diversi = 0;
  for (const f of fs.readdirSync(a).filter(f => f.endsWith('.png'))) {
    if (!fs.existsSync(path.join(b, f))) { console.log('  manca dopo: ' + f); diversi++; continue; }
    const n = await p.evaluate(async ([x, y]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [A, B] = await Promise.all([load(x), load(y)]); if (A.width !== B.width || A.height !== B.height) return 'misure diverse ' + A.width + 'x' + A.height + ' / ' + B.width + 'x' + B.height;
      const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d');
      g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
      let k = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) k++; return k; },
      [fs.readFileSync(path.join(a, f)).toString('base64'), fs.readFileSync(path.join(b, f)).toString('base64')]);
    if (n !== 0) { diversi++; console.log('  DIVERSA ' + f + ': ' + n + (typeof n === 'number' ? ' pixel' : '')); }
  }
  await br.close(); console.log(diversi ? diversi + ' foto diverse' : 'Tutte le foto sono identiche'); process.exit(diversi ? 1 : 0);
}

async function foto(out) {
  fs.mkdirSync(out, { recursive: true });
  const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TIPI[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch(); let n = 0;
  const giri = [['393', 393, 852, 'light'], ['393s', 393, 852, 'dark'], ['375', 375, 667, 'light'], ['pc', 1280, 820, 'light']];
  for (const [tag, w, h, sch] of giri) {
    const mob = w < 700;
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob, serviceWorkers: 'block', colorScheme: sch, timezoneId: 'Europe/Rome', reducedMotion: 'reduce' });
    await c.clock.setFixedTime(new Date(ORA));
    await c.addInitScript(() => { try { localStorage.setItem('baggese-myteam', 't_baggese'); localStorage.setItem('baggese-mygirone', 'O'); } catch (e) {} });
    await c.route(/open-meteo/, r => r.abort());
    const p = await c.newPage(); await p.goto(BASE); await p.waitForTimeout(3500);
    await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    const scatta = async nome => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(out, tag + '-' + nome + '.png'), fullPage: true }); n++; };
    const tab = async t => { await p.evaluate(t => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); window.scrollTo(0, 0); document.querySelector('nav.tabs [data-tab="' + t + '"]').click(); }, t); await p.waitForTimeout(1500); };
    const premi = async (a, v) => { await p.evaluate(([a, v]) => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); const x = document.createElement('button'); x.setAttribute(a, v); document.body.appendChild(x); x.click(); x.remove(); }, [a, v]); await p.waitForTimeout(1200); };
    await scatta('home');
    await tab('partite'); await scatta('partite');
    await p.evaluate(() => document.querySelector('#app [data-pv="round"]').click()); await p.waitForTimeout(1500); await scatta('giornata');
    await tab('classifica'); await scatta('classifica');
    await p.evaluate(() => document.querySelector('[data-cls="marcatori"]').click()); await p.waitForTimeout(1500); await scatta('marcatori');
    await p.evaluate(() => document.querySelector('[data-cls="stats"]').click()); await p.waitForTimeout(1500); await scatta('statistiche');
    await tab('rosa'); await scatta('squadre');
    await tab('gestione'); await scatta('impostazioni');
    if (tag === '393' || tag === '393s') {
      const dlg = async nome => { await p.waitForTimeout(700); const d = await p.$('#dlg'); await d.screenshot({ path: path.join(out, tag + '-' + nome + '.png') }); n++; };
      await premi('data-view', 'm10_2'); await dlg('partita');
      await premi('data-view', 'm11_8'); await dlg('partita-futura');
      await premi('data-player', 'p_bag_16'); await dlg('giocatore');
      await premi('data-top11', '10'); await dlg('top11');
      await premi('data-edit', 'm10_2'); await dlg('modifica-partita');
    }
    await c.close();
  }
  await b.close(); srv.close(); console.log(n + ' foto in ' + out);
}

const a = process.argv.slice(2);
if (a[0] === '--confronta') confronta(a[1], a[2]); else foto(a[0] || 'foto');
