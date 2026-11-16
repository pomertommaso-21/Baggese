"""Ricontrollo di una giornata già caricata: dice quali pagine partita vale la pena rileggere su Tuttocampo.

Uso: python3 strumento_da_ricontrollare.py righe.txt
righe.txt contiene, per ogni girone, una riga "###<codice>" (O, SP, PA, PB, PG, TC) seguita dalle righe "M|..."
lette con RIGHE(...) di strumento_leggi_giornata.js.

Per ogni girone stampa le chiavi delle partite da rileggere (da passare a LEGGI come {solo: [...]}):
- partite che nei nostri dati non hanno ancora il risultato;
- partite con un risultato diverso da quello salvato (Tuttocampo l'ha corretto);
- partite con gol ma con marcatori mancanti o incompleti.
Le partite non ancora giocate su Tuttocampo e gli 0-0 non servono.
"""
import sys, re, json
import aggiorna_dati as A

def main():
    txt = open(sys.argv[1], encoding="utf-8").read()
    out = {}
    for code, body in re.findall(r"###(\w+)\n(.*?)(?=\n###|\Z)", txt, re.S):
        if code not in A.GIRONI: continue   # per esempio "###END" in fondo al file
        d = json.load(open(A.GIRONI[code], encoding="utf-8")); book = A.Book(d)
        keys, note = [], []
        for l in body.splitlines():
            if not l.startswith("M|"): continue
            _, r, _, _, c, o, k = l.split("|")
            mh = re.match(r"(.*?)\s+(\d+|-)$", c); ma = re.match(r"^(\d+|-)\s+(.*)$", o)
            if not mh or not ma or mh.group(2) == "-" or ma.group(1) == "-": continue
            gh, ga = int(mh.group(2)), int(ma.group(1))
            try: h, a = book.team(mh.group(1)), book.team(ma.group(2))
            except SystemExit: note.append(f"squadra non riconosciuta in {c} – {o}"); keys.append(k); continue
            ms = [m for m in d["matches"] if {m["homeId"], m["awayId"]} == {h, a} and str(m["round"]) == r]
            if not ms: note.append(f"partita non trovata: {c} – {o}"); keys.append(k); continue
            m = ms[0]; old = (m.get("hg"), m.get("ag"))
            if old[0] in ("", None): note.append(f"nuova: {mh.group(1)} {gh}–{ga} {ma.group(2)}"); keys.append(k) if gh + ga else None; continue
            if (int(old[0]), int(old[1])) != ((gh, ga) if m["homeId"] == h else (ga, gh)): note.append(f"risultato corretto: {mh.group(1)} {old[0]}–{old[1]} → {gh}–{ga} {ma.group(2)}")
            if gh + ga and len(m.get("scorers") or []) < gh + ga: keys.append(k)
            elif gh + ga and (int(old[0]), int(old[1])) != ((gh, ga) if m["homeId"] == h else (ga, gh)): keys.append(k)
        out[code] = sorted(set(keys), key=lambda x: float(x))
        print(f"{code}: da rileggere {out[code] or 'nessuna'}" + ("".join("\n   " + n for n in note)))
    print("JSON " + json.dumps(out))

if __name__ == "__main__":
    main()
