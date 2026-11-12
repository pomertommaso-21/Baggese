/* Aggiornamento leggero di UN girone dopo una giornata, dal Chrome dell'utente.
   Legge solo: la giornata appena giocata, le pagine partita con gol, la giornata dopo (orari) e la classifica.
   Uso: aprire https://www.tuttocampo.it/robots.txt (pagina leggera dello stesso sito), poi in console:
     LEGGI("SecondaCategoria/GironeOMilano", 10)      // girone, giornata giocata
   Una pagina alla volta con pausa; ogni pagina letta resta in localStorage ("lg_<girone>_<giornata>"),
   quindi se si ferma basta rilanciare: riparte da dove era. Risultato: window.__lg.out (righe di testo)
   Righe: M|giornata|data|ora|casa gol|gol ospite|chiave   S|chiave|frase marcatori   C|pos|squadra|celle della classifica */
window.LEGGI = async function(gp, N, PAUSA){
  PAUSA = PAUSA || 3000;
  const KEY = 'lg_'+gp+'_'+N, B = 'https://www.tuttocampo.it/Lombardia/'+gp+'/';
  const st = JSON.parse(localStorage.getItem(KEY) || '{}'); const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  window.__lg = {step:'', n:0, err:[], out:[]};
  const f = document.createElement('iframe'); f.style.cssText='position:fixed;left:0;top:0;width:1200px;height:900px;opacity:.01;pointer-events:none;z-index:-1;border:0'; document.body.appendChild(f);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function page(u, ready, read, max){
    if (st[u] !== undefined) return st[u];
    f.src = u; const t = Date.now(); let last = -1, ok = false; await sleep(500); const path = u.replace('https://www.tuttocampo.it','');
    while (Date.now()-t < (max||25000)) { let v = 0; try { const d = f.contentDocument; if (d && d.location.href.indexOf(path) >= 0) v = ready(d); } catch(e){}
      if (v === true || (typeof v === 'number' && v > 0 && v === last)) { ok = true; break; } last = v; await sleep(350); }
    if (!ok) __lg.err.push('lenta: '+u.split('/').slice(-2).join('/'));
    let r = null; try { r = read(f.contentDocument); } catch(e){ __lg.err.push(e.message); }
    f.src = 'about:blank'; __lg.n++; if (ok) { st[u] = r; save(); } await sleep(PAUSA); return r;
  }
  const rowsOf = (d, r) => { let date = ''; const out = [];
    [...d.querySelectorAll('tr')].forEach(t => { const tx = t.innerText.replace(/\s+/g,' ').trim();
      const dm = tx.match(/^(LUN|MAR|MER|GIO|VEN|SAB|DOM)[A-Z]*\.?\s+(\d+\s+[A-Z]+)/i); if (dm && !/Partita/.test(t.innerHTML)) { date = dm[2].toUpperCase(); return; }
      const a = [...t.querySelectorAll('a')].map(a => a.getAttribute('href')).find(h => /\/Partita\/\d+\.\d+/.test(h||''));
      if (a) { const c = [...t.cells].map(c => c.innerText.replace(/\s+/g,' ').trim()); out.push('M|'+r+'|'+date+'|'+c[0]+'|'+c[1]+'|'+c[2]+'|'+a.match(/Partita\/(\d+\.\d+)/)[1]); } });
    return out; };
  const hasRows = d => [...d.querySelectorAll('tr')].filter(t => /Partita\/\d/.test(t.innerHTML)).length;
  __lg.step = 'giornata'; const M = await page(B+'Giornata'+N, hasRows, d => rowsOf(d, N)) || [];
  __lg.step = 'partite'; const S = [];
  for (const l of M) { const c = l.split('|'); const hg = (c[4].match(/(\d+)$/)||[])[1], ag = (c[5].match(/^(\d+)/)||[])[1];
    if (hg === undefined || ag === undefined || +hg + +ag === 0) continue;
    const s = await page(B+'Partita/'+c[6]+'/x', d => /Per [^\n]*? in gol/.test(d.body ? d.body.innerText : ''), d => { const m = d.body.innerText.match(/(?:^|\n)\s*(Per [^\n]*? in gol[^\n]*)/); return m ? m[1].trim() : ''; }, 20000);
    S.push('S|'+c[6]+'|'+(s||'')); }
  __lg.step = 'giornata dopo'; const M2 = await page(B+'Giornata'+(N+1), hasRows, d => rowsOf(d, N+1)) || [];
  __lg.step = 'classifica'; const C = await page(B+'Classifica', d => d.querySelectorAll('table tr a[href*="/Squadra/"]').length, d => {
    const t = [...d.querySelectorAll('table')].find(t => t.querySelector('a[href*="/Squadra/"]')); if (!t) return [];
    return [...t.querySelectorAll('tr')].filter(r => r.querySelector('a[href*="/Squadra/"]')).map(r => 'C|'+[...r.cells].map(c => c.innerText.replace(/\s+/g,' ').trim()).join('|')); }) || [];
  f.remove(); __lg.step = 'fine'; __lg.out = [].concat(M, S, M2, C);
  return __lg.out.length + ' righe lette' + (__lg.err.length ? ', avvisi: ' + __lg.err.join('; ') : '');
};
'pronto: LEGGI("SecondaCategoria/GironeOMilano", N)'
