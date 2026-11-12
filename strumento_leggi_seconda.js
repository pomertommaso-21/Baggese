/* Lettura dei gironi di Seconda Categoria lombardi da Tuttocampo, dal Chrome dell'utente.
   Uso: aprire https://www.tuttocampo.it/robots.txt (pagina leggera dello stesso sito), incollare in console.
   Una pagina alla volta (N=1) con pausa: Tuttocampo rallenta se si chiedono troppe pagine di fila.
   Ogni girone finito resta in localStorage come "sl_<Girone>", e ogni pagina letta in "slp_<Girone>": si riprende da dove si era rimasti.
   Formato righe: T|slug|id  M|giornata|data|ora|casa gol|gol ospite|chiave  S|chiave|frase marcatori  P|slug|nome~num~ruolo~gol~pres~gialli~rossi|... */
window.__sl={cur:'',step:'',done:[],err:[],n:0,t0:Date.now()};
(async()=>{
 const LIST='GironeABergamo GironeBBergamo GironeCBergamo GironeDBrescia GironeEBrescia GironeFBrescia GironeGComo GironeHCremona GironeICremona GironeJLecco GironeKLegnano GironeLLodi GironeMLodi GironeNMantova GironePMilano GironeQMonzaBrianza GironeRMonzaBrianza GironeSPavia GironeTPavia GironeUSondrio GironeVVarese GironeZVarese'.split(' ');
 const N=1, PAUSA=4000, fr=[]; for(let i=0;i<N;i++){ const f=document.createElement('iframe'); f.style.cssText='position:fixed;left:0;top:0;width:1200px;height:900px;opacity:.01;pointer-events:none;z-index:-1;border:0'; document.body.appendChild(f); fr.push(f); }
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function load(f,u,ready,max){ f.src=u; const t=Date.now(); let last=-1; await sleep(500); const path=u.replace('https://www.tuttocampo.it',''); while(Date.now()-t<max){ let v=0; try{ const d=f.contentDocument; if(d&&d.location.href.indexOf(path)>=0) v=ready(d); }catch(e){} if(v===true) return true; if(typeof v==='number'&&v>0&&v===last) return true; last=v; await sleep(350); } return false; }
 let PG={}, PGK=''; const pgSave=()=>{ try{ localStorage.setItem(PGK,JSON.stringify(PG)); }catch(e){} };
 async function pool(urls, ready, fn, max){ let k=0; await Promise.all(fr.map(async f=>{ while(k<urls.length){ const j=k++; const u=urls[j];
   if(PG[u]){ fn(j,new DOMParser().parseFromString(PG[u],'text/html')); continue; }
   try{ let ok=await load(f,u,ready,max); if(!ok) __sl.err.push('timeout '+u.split('/').slice(-3).join('/')); const d=f.contentDocument; fn(j,d);
     if(ok){ const keep=[...d.querySelectorAll('table.team-players, tr')].filter(x=>!x.closest('table.team-players')||x.matches('table.team-players')).map(x=>x.matches('tr')?'<table>'+x.outerHTML+'</table>':x.outerHTML).join(''); const sc=(d.body.innerText.match(/(?:^|\n)\s*(Per [^\n]*? in gol[^\n]*)/)||[])[1]; PG[u]=keep+(sc?'<p>'+sc.replace(/</g,'&lt;')+'</p>':''); pgSave(); }
   }catch(e){ __sl.err.push(u.split('/').slice(-3).join('/')+':'+e.message);} f.src='about:blank'; __sl.n++; await sleep(PAUSA); } })); }
 for(const g of LIST){
  if(localStorage.getItem('sl_'+g)) { __sl.done.push(g); continue; }
  __sl.cur=g; PGK='slp_'+g; PG=JSON.parse(localStorage.getItem(PGK)||'{}'); const B='https://www.tuttocampo.it/Lombardia/SecondaCategoria/'+g+'/';
  const out=[]; const T={};
  __sl.step='cls'; await pool([B+'Classifica'],d=>d.querySelectorAll('a[href*="/'+g+'/Squadra/"]').length,(j,d)=>{ [...d.querySelectorAll('a[href*="/'+g+'/Squadra/"]')].forEach(a=>{ const m=a.getAttribute('href').match(/Squadra\/([^/]+)\/(\d+)/); if(m&&!T[m[1]]) T[m[1]]=m[2]; }); },25000);
  if(!Object.keys(T).length){ __sl.err.push('NO TEAMS '+g); continue; }
  Object.keys(T).forEach(k=>out.push('T|'+k+'|'+T[k]));
  const nt=Object.keys(T).length, nr=2*(nt%2?nt:nt-1), rows=[];
  __sl.step='giornate'; await pool(Array.from({length:nr},(_,i)=>B+'Giornata'+(i+1)),d=>[...d.querySelectorAll('tr')].filter(t=>/Partita\/\d/.test(t.innerHTML)).length,(j,d)=>{ let date=''; const r=j+1;
   [...d.querySelectorAll('tr')].forEach(t=>{ const tx=t.innerText.replace(/\s+/g,' ').trim();
    const dm=tx.match(/^(LUN|MAR|MER|GIO|VEN|SAB|DOM)[A-Z]*\.?\s+(\d+\s+[A-Z]+)/i); if(dm && !/Partita/.test(t.innerHTML)){ date=dm[2].toUpperCase(); return; }
    const a=[...t.querySelectorAll('a')].map(a=>a.getAttribute('href')).find(h=>/\/Partita\/\d+\.\d+/.test(h||''));
    if(a){ const c=[...t.cells].map(c=>c.innerText.replace(/\s+/g,' ').trim()); rows.push([r,'M|'+r+'|'+date+'|'+c[0]+'|'+c[1]+'|'+c[2]+'|'+a.match(/Partita\/(\d+\.\d+)/)[1]]); } }); },25000);
  rows.sort((a,b)=>a[0]-b[0]); rows.forEach(x=>out.push(x[1]));
  const played=rows.map(x=>x[1].split('|')).filter(c=>/\d$/.test(c[4])&&/^\d/.test(c[5])).filter(c=>(+c[4].match(/(\d+)$/)[1])+(+c[5].match(/^(\d+)/)[1])>0);
  __sl.step='partite'; await pool(played.map(c=>B+'Partita/'+c[6]+'/x'),d=>/Per [^\n]*? in gol/.test(d.body?d.body.innerText:''),(j,d)=>{ const m=d.body.innerText.match(/(?:^|\n)\s*(Per [^\n]*? in gol[^\n]*)/); out.push('S|'+played[j][6]+'|'+(m?m[1].trim():'')); },20000);
  const ts=Object.keys(T);
  __sl.step='rose'; await pool(ts.map(s=>B+'Squadra/'+s+'/'+T[s]+'/Rosa'),d=>d.querySelectorAll('table.team-players tbody tr').length,(j,d)=>{ const tb=d.querySelector('table.team-players'); const rr=tb?[...tb.querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.innerText.trim().replace(/\s*\((\d+)\)$/,'¤$1'))).filter(c=>c[1]):[];
    out.push('P|'+ts[j]+'|'+rr.map(c=>{ const nm=c[1].split('¤'); return [nm[0],nm[1]||c[0],c[3],c[4],c[5],c[6],c[7]].join('~'); }).join('|')); },25000);
  localStorage.setItem('sl_'+g,out.join('\n')); localStorage.removeItem(PGK); __sl.done.push(g);
 }
 fr.forEach(f=>f.remove()); __sl.cur='FINE'; })();
