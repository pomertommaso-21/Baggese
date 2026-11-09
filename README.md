# Baggese 2026/27

App personale per seguire il Girone O di Seconda Categoria Milano: risultati, calendario, classifica, rose e marcatori di tutte le squadre.

È una pagina web statica: nessun server, nessuna installazione.

## File

| File | Cosa contiene |
|---|---|
| `index.html` | L'app |
| `data.json` | I dati della stagione: squadre, 30 giornate, rose, classifica |
| `logos/` | Gli stemmi delle 16 squadre, già ritagliati e centrati tutti allo stesso modo (`t_baggese.png`, `t_corsico.png`…) |
| `icon.svg`, `icon-180.png` | Icone per il browser e per la schermata Home dell'iPhone |

Per cambiare uno stemma basta sostituire il file corrispondente in `logos/` con un PNG quadrato a sfondo trasparente.

## Pubblicarla con GitHub Pages

1. Crea un repository su GitHub e carica questi file nella cartella principale.
2. Vai in **Settings → Pages**, alla voce *Source* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, e salva.
3. Dopo un minuto l'app è online su `https://<tuo-utente>.github.io/<nome-repository>/`.

Sull'iPhone apri l'indirizzo in Safari, tocca **Condividi → Aggiungi alla schermata Home** e l'app si apre a tutto schermo come un'app vera.

Attenzione: con un repository pubblico (o GitHub Pages gratuito) chiunque abbia il link vede l'app e i nomi dei giocatori presenti in `data.json`.

## Dove finiscono le modifiche

- Al primo avvio l'app carica `data.json`.
- Le modifiche che fai nell'app (risultati inseriti, giocatori, testo incollato) restano salvate **nel browser di quel dispositivo**. Non si sincronizzano tra telefono e computer.
- **Gestione → Ricarica data.json** sostituisce i dati del dispositivo con quelli del file sul sito. Le modifiche fatte solo nel browser vanno perse.
- **Gestione → Scarica copia** salva i dati attuali in un file `data.json`.

## Aggiornare i dati per tutti i dispositivi

1. Aggiorna l'app su un dispositivo (inserisci i risultati o incolla il testo di Tuttocampo o del comunicato in **Gestione**).
2. **Gestione → Scarica copia** per ottenere il nuovo `data.json`.
3. Su GitHub sostituisci `data.json` con quello scaricato (*Add file → Upload files*).
4. Sugli altri dispositivi tocca **Ricarica data.json**.

## Fonti dei dati

Risultati, calendario, classifica e rose da Tuttocampo (aggiornati al 9 novembre 2026, dopo la 9ª giornata). Le presenze sulle schede Tuttocampo non sono sempre complete.
