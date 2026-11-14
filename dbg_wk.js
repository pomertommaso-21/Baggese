const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  for (const [g, team] of [['O', 't_baggese'], ['PB', null], ['TC', null]]) {
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.addInitScript(([g, team]) => { try { localStorage.setItem('baggese-mygirone', g); if (team) localStorage.setItem('baggese-myteam', team); } catch (e) {} }, [g, team]);
    const p = await c.newPage();
    p.on('pageerror', e => console.log(g, 'PAGEERROR', e.message, (e.stack||'').split('\n').slice(0,3).join(' | ')));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(g, 'CONSOLE', m.type(), m.text().slice(0, 200)); });
    await p.goto('http://localhost:8765/?t=' + Date.now()); await p.waitForTimeout(3000);
    console.log(g, 'dopo avvio: tab', await p.evaluate(() => document.documentElement.getAttribute('data-curtab')), 'h1', await p.evaluate(() => (document.querySelector('#app h1')||{}).textContent), 'dlg', await p.evaluate(() => document.getElementById('dlg').open));
    await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); }); await p.waitForTimeout(300);
    await p.evaluate(() => document.body.classList.remove('navhide')); await p.click('nav.tabs [data-tab="partite"]'); await p.waitForTimeout(900);
    console.log(g, 'dopo Partite: tab', await p.evaluate(() => document.documentElement.getAttribute('data-curtab')), 'pv', await p.locator('[data-pv]').count());
    await p.click('[data-pv="round"]'); await p.waitForTimeout(1500);
    console.log(g, 'dopo Per giornata: chips', await p.locator('.rchip').count(), 'roundCard', await p.locator('#roundCard').count(), 'testo', await p.evaluate(() => document.getElementById('app').innerText.slice(0, 300).replace(/\n/g, ' / ')));
    await c.close();
  }
  await b.close();
})();
