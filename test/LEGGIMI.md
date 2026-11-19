# Prove dell'app

`index.html` è il sorgente dell'app: si modifica direttamente questo file.

Prima di ogni pubblicazione:

```
node test/prove.js
```

Le prove si servono da sole la cartella e controllano quello che non si deve mai rompere:
- lo scorrimento delle giornate;
- il passaggio tra le viste di Partite e Classifica;
- la barra in basso;
- i tocchi della Home;
- la proiezione;
- le tue modifiche contro i dati di Tuttocampo;
- le Impostazioni;
- i rigori;
- il giorno della partita;
- la carriera;
- la fluidità con il telefono rallentato;
- gli errori.

Girano anche nel collaudo online (`.github/workflows/collaudo.yml`), con `CI=1`: lì la fluidità avvisa ma non blocca.

Per una modifica che non deve cambiare l'aspetto (pulizia, riordino):

```
node test/foto.js /tmp/prima        # prima della modifica
node test/foto.js /tmp/dopo         # dopo
node test/foto.js --confronta /tmp/prima /tmp/dopo
```

Le foto sono 42: le schermate principali in chiaro e in scuro, su iPhone grande e piccolo e su computer, più le schede di partita, giocatore, Top 11 e modifica. L'ora è fissa, così due giri sulla stessa app danno foto identiche pixel per pixel.
