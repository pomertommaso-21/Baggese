#!/usr/bin/env python3
"""Aggiorna i dati di un girone (data.json e baggese.ics per il Girone O) con i dati letti da Tuttocampo.

Uso:
    python3 aggiorna_dati.py aggiornamento.json            # prova: mostra cosa cambierebbe
    python3 aggiorna_dati.py aggiornamento.json --scrivi   # applica le modifiche

Formato di aggiornamento.json (tutte le chiavi sono facoltative tranne "partite"):
{
  "girone": "O",
  "giornata": 10,
  "partite": [
    {"casa": "FC Corsico", "ospite": "Baggese", "gol_casa": 1, "gol_ospite": 2,
     "data": "2026-11-15", "ora": "14:30",
     "marcatori": "Per FC Corsico in gol Oltean Robert (su rigore); per Baggese in gol Montesano Alan (doppietta, 20' pt e 3' st)."}
  ],
  "classifica": [{"squadra": "Triestina 1946", "pos": 1, "pt": 24, "g": 10, "v": 7, "n": 3, "p": 0, "gf": 30, "gs": 10}],
  "giocatori": [{"squadra": "Baggese", "nome": "Montesano Alan", "gol": 9, "pres": 10, "gialli": 1, "rossi": 0}],
  "giocatori_fino_a": 10
}

- "girone": "O" = Seconda Categoria Milano Girone O (data.json, predefinito),
             "PB" = Prima Categoria Lombardia Girone B (prima-b.json).
- "marcatori" e' la frase "Sulla partita" della pagina della partita su Tuttocampo, copiata cosi' com'e'.
- "giocatori" sono i totali delle schede giocatore; "giocatori_fino_a" dice fino a quale giornata
  li comprendono (serve all'app per non contare due volte i gol).
"""
import datetime as dt
import json
import re
import sys
import unicodedata

DATA = "data.json"
ICS = "baggese.ics"
GIRONI = {"O": "data.json", "PB": "prima-b.json"}


def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


GENERIC = {"calcio", "fc", "f c", "ac", "as", "us", "asd", "a s d", "sport", "club", "football", "polisportiva", "ssd", "cda", "c d a", "1946", "1926"}


def words(s):
    return [w for w in norm(s).split() if w not in GENERIC and not w.isdigit()]


class Book:
    def __init__(self, d):
        self.d = d
        self.teams = d["teams"]
        self.players = d["players"]

    def team(self, name):
        n = norm(name)
        for t in self.teams:
            if norm(t["name"]) == n or norm(re.sub(r"^(t|pb)_", "", t["id"])) == n:
                return t["id"]
        w = set(words(name))
        best, score = None, 0
        for t in self.teams:
            tw = set(words(t["name"]))
            sc = len(w & tw)
            if sc > score:
                best, score = t["id"], sc
        if not best:
            raise SystemExit(f"Squadra non riconosciuta: {name!r}")
        return best

    def player(self, team_id, name):
        n = norm(name)
        parts = n.split()
        cands = [p for p in self.players if p["teamId"] == team_id]
        for p in cands:
            if norm(p["name"]) == n:
                return p["id"]
        # stesso nome con cognome e nome invertiti
        for p in cands:
            if sorted(norm(p["name"]).split()) == sorted(parts):
                return p["id"]
        return None


def parse_list(book, team, txt):
    """Interpreta 'Rossi Mario (doppietta, 20' pt e 3' st), Bianchi Luca e autogol di AUTOGOL'."""
    out = []
    txt = txt.strip().rstrip(".").strip()
    items, depth, cur, i = [], 0, "", 0
    while i < len(txt):
        c = txt[i]
        if c == "(":
            depth += 1
        if c == ")":
            depth -= 1
        if depth == 0 and txt.startswith(", ", i):
            items.append(cur); cur = ""; i += 2; continue
        if depth == 0 and txt.startswith(" e ", i):
            items.append(cur); cur = ""; i += 3; continue
        cur += c; i += 1
    items.append(cur)
    for it in items:
        it = it.strip()
        if not it:
            continue
        m = re.match(r"^(.*?)\s*(?:\((.*)\))?\s*$", it)
        name, info = m.group(1).strip(), (m.group(2) or "")
        cnt = 1
        for word, k in (("doppietta", 2), ("tripletta", 3), ("poker", 4), ("cinquina", 5)):
            if word in info:
                cnt = k
        mins = re.findall(r"(\d+)' (pt|st)", info)
        mp = re.search(r"(\d) su rigore", info)
        pens = int(mp.group(1)) if mp else (1 if "su rigore" in info else 0)
        og = name.lower().startswith("autogol")
        for j in range(cnt):
            s = {"teamId": team}
            if og:
                s["og"] = True
                s["name"] = "Autogol"
            else:
                pid = book.player(team, name)
                if pid:
                    s["playerId"] = pid
                else:
                    s["name"] = name
            if j < len(mins):
                s["min"] = f"{mins[j][0]}' {'1T' if mins[j][1] == 'pt' else '2T'}"
            if j < pens:
                s["pen"] = True
            out.append(s)
    return out


def parse_scorers(book, home, away, sentence):
    """'Per X in gol ...; per Y in gol ...' -> lista marcatori con la squadra giusta."""
    out = []
    s = sentence.strip()
    for m in re.finditer(r"[Pp]er (.+?) in gol (.+?)(?=;\s*[Pp]er |$)", s):
        team = book.team(m.group(1))
        if team not in (home, away):
            raise SystemExit(f"Nei marcatori compare {m.group(1)!r}, che non gioca questa partita")
        out += parse_list(book, team, m.group(2))
    return out


def write_ics(d):
    my = d["settings"]["myTeamId"]
    T = {t["id"]: t["name"] for t in d["teams"]}

    def esc(t):
        return str(t).replace("\\", "\\\\").replace(";", r"\;").replace(",", r"\,").replace("\n", r"\n")

    now = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M00Z")
    L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baggese app//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
         "X-WR-CALNAME:" + esc(T[my]), "X-WR-TIMEZONE:Europe/Rome", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"]
    played = lambda m: m.get("hg") not in ("", None)
    ms = sorted([m for m in d["matches"] if my in (m["homeId"], m["awayId"]) and m.get("date")], key=lambda m: (m.get("round") or 999, m["date"]))
    for m in ms:
        day = dt.date.fromisoformat(m["date"])
        summ = T[m["homeId"]] + " – " + T[m["awayId"]] + ((" " + str(m["hg"]) + "–" + str(m["ag"])) if played(m) else "")
        L += ["BEGIN:VEVENT", "UID:%s-%s@baggese-app" % (m["id"], re.sub(r"\W", "", d["settings"]["season"])), "DTSTAMP:" + now,
              "SUMMARY:" + esc(summ), "DESCRIPTION:" + esc(("%sª giornata · " % m["round"] if m.get("round") else "") + d["settings"]["girone"])]
        tm = re.match(r"^(\d{1,2})[:.](\d{2})$", m.get("time") or "")
        if tm:
            s = dt.datetime.combine(day, dt.time(int(tm[1]), int(tm[2])))
            e = s + dt.timedelta(minutes=105)
            L += ["DTSTART;TZID=Europe/Rome:" + s.strftime("%Y%m%dT%H%M00"), "DTEND;TZID=Europe/Rome:" + e.strftime("%Y%m%dT%H%M00")]
        else:
            L += ["DTSTART;VALUE=DATE:" + day.strftime("%Y%m%d"), "DTEND;VALUE=DATE:" + (day + dt.timedelta(days=1)).strftime("%Y%m%d")]
        L.append("END:VEVENT")
    L.append("END:VCALENDAR")
    open(ICS, "w", newline="").write("\r\n".join(L) + "\r\n")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    global DATA
    up = json.load(open(sys.argv[1], encoding="utf-8"))
    write = "--scrivi" in sys.argv
    g = str(up.get("girone", "O")).upper()
    if g not in GIRONI:
        raise SystemExit(f"Girone sconosciuto: {g} (validi: {', '.join(GIRONI)})")
    DATA = GIRONI[g]
    d = json.load(open(DATA, encoding="utf-8"))
    book = Book(d)
    T = {t["id"]: t["name"] for t in d["teams"]}
    rnd = up.get("giornata")
    report = []

    for p in up.get("partite", []):
        h, a = book.team(p["casa"]), book.team(p["ospite"])
        ms = [m for m in d["matches"] if m["homeId"] == h and m["awayId"] == a and (rnd is None or m["round"] == rnd)]
        if len(ms) != 1:
            raise SystemExit(f"Partita non trovata in calendario: {T[h]} – {T[a]} (giornata {rnd})")
        m = ms[0]
        line = f"{m['round']}ª {T[h]} – {T[a]}:"
        if p.get("gol_casa") is not None and p.get("gol_ospite") is not None:
            new = (int(p["gol_casa"]), int(p["gol_ospite"]))
            old = (m.get("hg"), m.get("ag"))
            if old != new:
                line += f" risultato {old[0] if old[0] != '' else '-'}–{old[1] if old[1] != '' else '-'} → {new[0]}–{new[1]}"
            m["hg"], m["ag"] = new
        for k_in, k_out in (("data", "date"), ("ora", "time")):
            if p.get(k_in) and p[k_in] != m.get(k_out):
                line += f" {k_out} {m.get(k_out) or '-'} → {p[k_in]}"
                m[k_out] = p[k_in]
        if p.get("marcatori"):
            sc = parse_scorers(book, h, a, p["marcatori"])
            nh = sum(1 for s in sc if s["teamId"] == h)
            na = sum(1 for s in sc if s["teamId"] == a)
            if (nh, na) != (m["hg"], m["ag"]):
                line += f" ATTENZIONE: marcatori {nh}–{na} non tornano col risultato, li salvo comunque"
            unknown = [s["name"] for s in sc if "name" in s and not s.get("og")]
            if unknown:
                line += " (non in rosa: " + ", ".join(unknown) + ")"
            if sc != m.get("scorers"):
                line += f" marcatori aggiornati ({len(sc)})"
            m["scorers"] = sc
        report.append(line if not line.endswith(":") else line + " nessuna modifica")

    if up.get("classifica"):
        rows = []
        for r in up["classifica"]:
            rows.append({"teamId": book.team(r["squadra"]), "pos": int(r["pos"]), "pts": int(r["pt"]), "g": int(r["g"]),
                         "v": int(r.get("v", 0)), "n": int(r.get("n", 0)), "p": int(r.get("p", 0)),
                         "gf": int(r.get("gf", 0)), "gs": int(r.get("gs", 0))})
        cr = rnd or max((m["round"] for m in d["matches"] if m.get("hg") not in ("", None)), default=0)
        if d.get("tcRound") is None and d.get("imported"):
            d["tcRound"] = d["imported"].get("round")  # i totali dei giocatori restano quelli di prima
        d["imported"] = {"at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "round": cr,
                         "source": f"Tuttocampo, dopo la {cr}ª giornata", "rows": rows}
        report.append(f"Classifica aggiornata dopo la {cr}ª giornata ({len(rows)} squadre)")

    if up.get("giocatori"):
        n = 0
        for g in up["giocatori"]:
            tid = book.team(g["squadra"])
            pid = book.player(tid, g["nome"])
            if not pid:
                report.append(f"Giocatore non in rosa, ignorato: {g['nome']} ({T[tid]})")
                continue
            p = next(x for x in d["players"] if x["id"] == pid)
            new = {"gol": int(g.get("gol", 0)), "pres": int(g.get("pres", 0)), "y": int(g.get("gialli", 0)), "r": int(g.get("rossi", 0))}
            if p.get("tc") != new:
                p["tc"] = new
                n += 1
        d["tcRound"] = up.get("giocatori_fino_a", rnd)
        report.append(f"Schede giocatore aggiornate: {n} (comprendono fino alla {d['tcRound']}ª giornata)")

    if d.get("tcRound") is None and d.get("imported"):
        d["tcRound"] = d["imported"].get("round")
    d["updatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    print("\n".join(report) or "Niente da aggiornare")
    if write:
        json.dump(d, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if DATA == "data.json":
            write_ics(d)
            print(f"\nScritti {DATA} e {ICS}.")
        else:
            print(f"\nScritto {DATA}.")
    else:
        print("\nProva: nessun file modificato. Aggiungi --scrivi per salvare.")


if __name__ == "__main__":
    main()
