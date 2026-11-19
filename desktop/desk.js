/* ===== Versione desktop (desktop.html) =====
   Si aggiunge in fondo al codice dell'app, dentro la stessa funzione: le funzioni ridefinite qui prendono il posto di quelle del telefono.
   La versione desktop si aggiorna solo quando lo chiede l'utente: index.html può cambiare, questo file no. */
document.documentElement.classList.add("dk");
/* Panoramica: colonna principale + colonna fissa con classifica e giornata */
function vHome(){
  var my=me(), myName=tname(my), myRow=tableRow(my);
  var gir=String(S.settings.girone||'').replace(/\s*Categoria\s*/i,' ').replace(/\s+/g,' ').trim();
  var h='<header class="top dk-top"><button type="button" class="crestbtn" data-act="pickTeam" aria-label="Cambia squadra preferita">'+crest(my,60)+'</button>'
    +'<div class="col grow"><span class="dk-eb">Panoramica · '+esc(gir)+'</span><h1>'+esc(myName)+'</h1></div>';
  if(myRow&&myRow.g) h+='<div class="dk-kpis">'+[[myRow.pos+'°','Posizione'],[myRow.pts,'Punti'],[myRow.v+'–'+myRow.n+'–'+myRow.p,'V · N · P'],[myRow.gf+':'+myRow.gs,'Gol fatti · subiti']]
    .map(function(k){ return '<div><b class="num">'+k[0]+'</b><span>'+k[1]+'</span></div>'; }).join('')+'</div>';
  h+='</header>';
  if (S.teams.length<2 && !S.matches.length) return h+'<div class="empty"><h2>Prepara il girone</h2><p>Apri Impostazioni per incollare squadre e risultati.</p></div>';
  var mine=S.matches.filter(function(m){return involves(m,my);}).sort(sortMatches);
  var next=mine.filter(function(m){return !played(m);})[0], last=mine.filter(played).slice(-1)[0];
  var hero=next?hmNext(next):'', lr='', tbc='', colC='';
  if(last){ var r=resultFor(last,my), cg=function(x){ return x.split('<br>').join(', ').replace(/ [A-ZÀ-Ý]\.(?=,| ×|<|$)/g,''); };
    var side=function(id){ return '<span class="dk-lr-t'+(id===my?' me':'')+'">'+crest(id,44)+'<b>'+esc(tname(id))+'</b><span>'+cg(tsc(last,id))+'</span></span>'; };
    lr='<section class="card dk-lr"><div class="card-head"><h2>Ultimo risultato</h2><span class="meta">'+(last.round?last.round+'ª · ':'')+esc(fmtDate(last.date))+'</span></div>'
      +'<button type="button" class="dk-lr-b" data-view="'+last.id+'">'+side(last.homeId)+'<span class="dk-lr-c"><b class="num">'+esc(last.hg)+'–'+esc(last.ag)+'</b><span class="res-pill r-'+r+'">'+resLabel(r)+'</span></span>'+side(last.awayId)+'</button></section>';
  }
  var colA='', colB='';
  var fc=formCard(my); if(fc){ var sl=streakLine(my); colA+=sl?fc.replace(/<\/section>$/,'<div class="dk-stk">'+sl+'</div></section>'):fc; }
  var top=topScorers(my,6);
  if(top.length) colA+='<section class="card"><div class="card-head"><h2>Marcatori</h2><button class="linkbtn" type="button" data-tab="classifica">Girone</button></div><div class="dk-sc">'
    +top.map(function(o,i){ return '<button type="button" class="dk-sc-r'+(i?'':' first')+'" data-player="'+o.p.id+'"><span class="num dk-sc-n">'+o.g+'</span><span class="ellipsis">'+esc(o.p.name)+'</span><span class="meta">'+esc(o.p.role||'')+'</span></button>'; }).join('')+'</div></section>';
  var up=mine.filter(function(m){return !played(m);}).slice(0,8);
  if(up.length) colB+='<section class="card"><div class="card-head"><h2>Prossime partite</h2><button class="linkbtn" type="button" data-tab="partite">Calendario</button></div><div class="dk-fx">'
    +up.map(function(m){ var opp=m.homeId===my?m.awayId:m.homeId, d=m.date?fmtDate(m.date).split(' '):['',''];
      return '<button type="button" class="dk-fx-r" data-view="'+m.id+'"><span class="dk-fx-d"><b class="num">'+esc(d[1]||'')+'</b><span>'+esc((d[2]||'')+'')+'</span></span>'+crest(opp,30)
        +'<span class="col grow"><b class="ellipsis">'+esc(tname(opp))+'</b><span class="meta">'+m.round+'ª · '+(m.homeId===my?'in casa':'in trasferta')+(m.time?' · '+esc(m.time):'')+'</span></span></button>'; }).join('')+'</div></section>';
  /* colonna fissa: classifica intera con la linea dell'obiettivo, poi la prossima giornata del girone */
  var tb=currentTable();
  if(tb.rows.length>1){ var GP=getGoal().pos;
    tbc='<section class="card dk-tb"><div class="card-head"><h2>Classifica</h2><button class="linkbtn" type="button" data-tab="classifica">Completa</button></div>'+goalChips(tb)
      +'<div class="dk-tb-h"><span>#</span><span>Squadra</span><span>G</span><span>DR</span><span>Pt</span></div><div class="list" style="--gc:'+getGoal().col+'">'
      +tb.rows.map(function(x){ var dr=(+x.gf||0)-(+x.gs||0); return (x.pos===GP+1?'<div class="pline">'+esc(getGoal().line)+'</div>':'')
        +'<button type="button" class="dk-tb-r'+(x.id===my?' me':'')+'" data-team="'+x.id+'"><span class="posn num">'+x.pos+'</span><span class="dk-tb-n">'+crest(x.id,22)+'<span class="ellipsis">'+esc(tname(x.id))+'</span></span><span class="num">'+x.g+'</span><span class="num">'+(dr>0?'+':dr<0?'−':'')+Math.abs(dr)+'</span><b class="num">'+x.pts+'</b></button>'; }).join('')+'</div></section>';
  }
  var nr=nextRound(), ms=S.matches.filter(function(m){return +m.round===nr;});
  if(ms.length) colC+='<section class="card dk-rd"><div class="card-head"><h2>'+nr+'ª giornata</h2><button class="linkbtn" type="button" data-act="dkRound" data-r="'+nr+'">Apri</button></div><div class="list">'+ms.map(function(m){ return boardRowSz(m,24); }).join('')+'</div></section>';
  var L=lastPlayedRound(); if(L) colC+='<button type="button" class="card dk-t11" data-top11="'+L+'"><span class="fold-ic">'+icon("trophy")+'</span><span class="col grow"><b>Top 11 della '+L+'ª giornata</b><span class="meta">Il migliore in ogni ruolo</span></span>'+icon("right")+'</button>';
  /* griglia a tre colonne con righe in comune: i bordi delle schede si allineano tra le colonne */
  return h+'<div class="dk-home"><div class="dk-hero">'+hero+'</div><div class="dk-tbw">'+tbc+'</div><div class="dk-lrw">'+lr+'</div><div class="dk-col dk-ca">'+colA+'</div><div class="dk-col dk-cb">'+colB+'</div><div class="dk-col dk-cc">'+colC+'</div></div>'+syncChip();
}
/* "Apri" sulla giornata della colonna: va in Partite › Per giornata su quella giornata */
document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest('[data-act="dkRound"]'); if(!b) return; e.preventDefault(); e.stopPropagation();
  var t=document.querySelector('nav.tabs [data-tab="partite"]'); if(t) t.click();
  setTimeout(function(){ var pv=document.querySelector('#app [data-pv="round"]'); if(pv) pv.click(); setTimeout(function(){ var c=document.querySelector('.rchip[data-round="'+b.getAttribute('data-r')+'"]'); if(c) c.click(); },450); },450); },true);
/* sul telefono la versione desktop rimanda all'app normale */
if(window.innerWidth<900 && !/[?&]d\b/.test(location.search) && !navigator.webdriver) location.replace("./"+location.hash);
