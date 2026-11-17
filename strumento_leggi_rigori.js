/* Rigori parati e sbagliati di un girone, dalla "Cronaca partita" di Tuttocampo, dal Chrome dell'utente.
   Uso: aprire https://www.tuttocampo.it/robots.txt, incollare questo file, poi:
     RIGORI("SecondaCategoria/GironeOMilano", 1, 10)   // girone, prima e ultima giornata
   Una pagina alla volta con pausa; ogni pagina letta resta in localStorage ("lr_<girone>"), quindi si riprende.
   Righe in window.__lr.out:
     R|giornata|chiave|casa|ospite|tempo|minuto|evento      (solo gli eventi con "Rigore", non i gol su rigore)
     K|chiave|SQUADRA|primo della formazione (di solito il portiere)
     N|giornata|chiave|casa|ospite|cronaca sì/no            (una per partita, per sapere cosa è stato controllato) */
window.RIGORI = async function(gp, DA, A, PAUSA){
  PAUSA = PAUSA || 3000;
  const KEY = 'lr_'+gp, B = 'https://www.tuttocampo.it/Lombardia/'+gp+'/';
  const st = JSON.parse(localStorage.getItem(KEY) || '{}'); const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  window.__lr = {step:'', n:0, err:[], out:[]};
  const f = document.createElement('iframe'); f.style.cssText='position:fixed;left:0;top:0;width:1200px;height:900px;opacity:.01;pointer-events:none;z-index:-1;border:0'; document.body.appendChild(f);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function page(u, ready, read, max){
    if (st[u] !== undefined) return st[u];
    f.src = u; const t = Date.now(); let ok = false; await sleep(600); const path = u.replace('https://www.tuttocampo.it','');
    while (Date.now()-t < (max||25000)) { let v = false; try { const d = f.contentDocument; if (d && d.location.href.indexOf(path) >= 0) v = ready(d); } catch(e){} if (v) { ok = true; break; } await sleep(400); }
    if (!ok) __lr.err.push('lenta: '+u.split('/').slice(-3).join('/'));
    let r = null; try { r = read(f.contentDocument); } catch(e){ __lr.err.push(e.message); }
    f.src = 'about:blank'; __lr.n++; if (ok) { st[u] = r; save(); } await sleep(PAUSA); return r;
  }
  for (let N = DA; N <= A; N++) {
    __lr.step = 'giornata '+N;
    const links = await page(B+'Giornata'+N, d => d.querySelectorAll('a[href*="/Partita/"]').length > 2,
      d => [...new Set([...d.querySelectorAll('a[href*="/Partita/"]')].map(a => a.pathname))], 20000) || [];
    for (const p of links) {
      const key = (p.match(/Partita\/(\d+\.\d+)/)||[])[1]; __lr.step = 'giornata '+N+' partita '+key;
      const r = await page('https://www.tuttocampo.it'+p, d => /Tabellino|Pronostico partita/.test(d.body ? d.body.innerText : ''), d => {
        const t = d.body.innerText, out = [], ti = (d.title||'').split(':')[0].trim(), teams = ti.split(' - ');
        const ci = t.indexOf('Cronaca partita'); let cron = false;
        if (ci >= 0) { const end = t.indexOf('Tabellino', ci); const L = t.slice(ci, end > 0 ? end : ci+6000).split('\n').map(s => s.trim()).filter(Boolean);
          let half = '', min = '';
          L.forEach(s => { if (/^(Primo|Secondo) Tempo$|^Supplementari|^Pre Partita$/.test(s)) half = s;
            else if (/^\d+(\+\d+)?'$/.test(s) || s === '-') min = s.replace("'", '');
            else if (/[⚽🧤❌🟥🟨🔄🔼🔽]/u.test(s)) { cron = true; if (/rigore/i.test(s) && !/goal su rigore/i.test(s)) out.push('R|'+N+'|'+key+'|'+teams[0]+'|'+(teams[1]||'')+'|'+half+'|'+min+'|'+s); } }); }
        const ti2 = t.search(/\nMARCATORI:|\nTabellino [^\n]+ \d+ - \d+/);
        if (ti2 >= 0) { const T = t.slice(ti2, ti2+3000).split('\n').map(s => s.trim());
          T.forEach(s => { const m = s.match(/^([A-Z0-9À-Ý .'’&-]{3,}):\s*([^,]+),/); if (m && !/MARCATORI|ARBITRO|STADIO|ESPULSI|AMMONITI|NOTE/.test(m[1])) out.push('K|'+key+'|'+m[1].trim()+'|'+m[2].replace(/\s*\([^)]*\)/g,'').trim()); }); }
        out.push('N|'+N+'|'+key+'|'+teams[0]+'|'+(teams[1]||'')+'|'+(cron?'cronaca':'no'));
        return out; }, 25000) || [];
      __lr.out.push(...r);
    }
  }
  f.remove(); __lr.step = 'fatto'; return __lr.out.length;
};
