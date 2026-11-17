"""Aggiunge alle partite i rigori parati e sbagliati letti con strumento_leggi_rigori.js.
Uso: python3 strumento_rigori_in_dati.py righe-rigori.txt <file del girone .json> [--scrivi]
Ogni rigore diventa {team, playerId?, how, keeperId?, min, src:"tc"} in matches[].pens:
- "Rigore parato (SQUADRA)": la squadra è quella del portiere; il portiere è il primo della sua formazione nel tabellino
  (riga K), altrimenti il portiere con più presenze; chi ha tirato non è indicato.
- "Rigore sbagliato da NOME (SQUADRA)": chi ha tirato è NOME di SQUADRA; com'è andato non è indicato ("sbagliato").
I rigori già messi da Tuttocampo (src "tc") vengono sostituiti; quelli inseriti a mano restano."""
import json, re, sys
from aggiorna_dati import Book, norm

def main():
    righe, fn = sys.argv[1], sys.argv[2]; scrivi = "--scrivi" in sys.argv
    d = json.load(open(fn)); book = Book(d)
    P = {p["id"]: p for p in d["players"]}
    K, R, seen = {}, [], {}
    for ln in open(righe, encoding="utf-8"):
        f = ln.rstrip("\n").split("|")
        if f[0] == "K": K.setdefault(f[1], {})[f[2]] = f[3]
        elif f[0] == "R": R.append(f)
        elif f[0] == "N": seen[f[2]] = f
    def match(N, h, a):
        th, ta = book.team(h), book.team(a)
        for m in d["matches"]:
            if str(m.get("round")) == str(N) and {m["homeId"], m["awayId"]} == {th, ta}: return m
        return None
    def by_surname(tid, nm, role=None):
        n = norm(nm); parts = n.split()
        ini = parts[0][0] if len(parts) > 1 and len(parts[0].rstrip(".")) == 1 else None
        sur = " ".join(parts[1:]) if ini else n
        c = [p for p in d["players"] if p["teamId"] == tid and (" " + norm(p["name"]) + " ").find(" " + sur + " ") >= 0]
        if ini and len(c) > 1: c = [p for p in c if any(w.startswith(ini) for w in norm(p["name"]).split() if w not in sur.split())]
        if role and len(c) > 1: c = [p for p in c if p.get("role") == role] or c
        return c[0]["id"] if len(c) == 1 else None
    def keeper(key, tid):
        for team, nm in K.get(key, {}).items():
            try:
                if book.team(team) == tid:
                    k = by_surname(tid, nm)
                    if k: return k
            except SystemExit: pass
        gks = [p for p in d["players"] if p["teamId"] == tid and p.get("role") == "Portiere"]
        gks.sort(key=lambda p: -((p.get("tc") or {}).get("pres") or 0))
        return gks[0]["id"] if gks else ""
    new, notes = {}, []
    for f in R:
        _, N, key, h, a, half, mn, ev = f[:8]
        m = match(N, h, a)
        if not m: notes.append(f"partita non trovata: {N}ª {h}–{a}"); continue
        team_txt = (re.search(r"\(([^)]+)\)\s*$", ev) or [None, ""])[1]
        try: tid = book.team(team_txt)
        except SystemExit: notes.append(f"squadra non riconosciuta: {team_txt}"); continue
        other = m["awayId"] if tid == m["homeId"] else m["homeId"]
        minute = ""
        if re.fullmatch(r"\d+(\+\d+)?", mn or ""):
            b = int(mn.split("+")[0]); minute = str(b + 45 if half.startswith("Secondo") else b) + ("+" + mn.split("+")[1] if "+" in mn else "")
        r = {"src": "tc"}
        if re.search(r"rigore parato", ev, re.I):
            kd = re.search(r"parato da ([^(]+)\(", ev)
            r.update(team=other, how="parato", keeperId=(by_surname(tid, kd.group(1).strip(), "Portiere") if kd else None) or keeper(key, tid))
        elif re.search(r"rigore sbagliato", ev, re.I):
            sd = re.search(r"sbagliato da ([^(]+)\(", ev)
            pid = by_surname(tid, sd.group(1).strip()) if sd else None
            r.update(team=tid, how="sbagliato")
            if pid: r["playerId"] = pid
            elif sd: notes.append(f"{N}ª {h}–{a}: tiratore non trovato in rosa: {sd.group(1).strip()}")
        else:
            notes.append(f"evento non capito: {ev}"); continue
        if minute: r["min"] = minute
        new.setdefault(m["id"], []).append(r)
        who = P.get(r.get("playerId") or "", {}).get("name") or "?"
        kp = P.get(r.get("keeperId") or "", {}).get("name") or ""
        print(f"{N}ª {h}–{a} · {minute or '-'}' · {r['how']} · tira {who} ({r['team']})" + (f" · para {kp}" if kp else ""))
    changed = 0
    for m in d["matches"]:
        old = [x for x in (m.get("pens") or []) if x.get("src") != "tc"]
        nv = old + new.get(m["id"], [])
        if (m.get("pens") or []) != nv:
            changed += 1
            if nv: m["pens"] = nv
            else: m.pop("pens", None)
    print(f"partite controllate {len(seen)}, con cronaca {sum(1 for x in seen.values() if x[5]=='cronaca')}, rigori {sum(len(v) for v in new.values())}, partite cambiate {changed}")
    for n in notes: print("NOTA:", n)
    if scrivi:
        d["updatedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds")
        json.dump(d, open(fn, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("salvato", fn)

if __name__ == "__main__": main()
