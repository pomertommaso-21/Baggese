// Prova: legge alcune pagine di Tuttocampo e stampa nel log come sono fatte.
import { chromium } from 'playwright';
const BASE = 'https://www.tuttocampo.it/Lombardia/SecondaCategoria/GironeOMilano/';
const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', locale: 'it-IT' });
async function dump(path) {
  const url = BASE + path;
  try {
    const r = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /Partita|Squadra/.test(h)).slice(0, 40);
      const classes = {};
      document.querySelectorAll('[class]').forEach(e => String(e.className).split(/\s+/).forEach(c => { if (/match|result|risult|team|score|gol|round|giorn|row|table|class/i.test(c)) classes[c] = (classes[c] || 0) + 1; }));
      return { title: document.title, text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 5000), links, classes };
    });
    console.log('\n===== ' + path + ' status ' + (r && r.status()) + ' =====');
    console.log('TITLE', info.title);
    console.log('LINKS', JSON.stringify(info.links));
    console.log('CLASSES', JSON.stringify(info.classes));
    console.log('TEXT\n' + info.text);
  } catch (e) { console.log('\n===== ' + path + ' ERRORE ' + e.message); }
}
await dump('Risultati');
await dump('Classifica');
await browser.close();
