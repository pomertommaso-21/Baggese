# Aggiungere gironi all'app

Stato al 12/11/2026
- Nell'app: Seconda Milano Girone O (data.json), Prima Lombardia Gironi A, B, G (prima-a/b/g.json), Terza Milano Girone C (terza-c.json).
- Seconda Categoria lombarda, altri 23 gironi (A–Z tranne O): lettura avviata e poi fermata. Tuttocampo rallenta se si chiedono troppe pagine di fila (circa 2.600 pagine in tutto). Nessun girone ancora salvato.

Come si fa
1. Lettura: strumento_leggi_seconda.js nel Chrome dell'utente (una pagina alla volta, con pause). I dati restano in localStorage come sl_<Girone>, uniti in seconda-lombardia.txt con un'intestazione "### <Girone>" per ognuno.
2. Costruzione: python3 strumento_build_seconda.py seconda-lombardia.txt crea seconda-<lettera>.json (codici SA…SZ, squadre sa_…sz_) e gironi.json per la costante GIRONI dell'app.
3. Stemmi: workflow GitHub temporaneo (vedi commit 1dad7bf) con gli id Tuttocampo delle squadre.
4. App: aggiungere i gironi a GIRONI in index.html e i codici in aggiorna_dati.py.
