# Uso: python3 build_girone.py raw_A.json PA "Prima Categoria Lombardia · Girone A" pa_quinto out.json
import json, re, sys, unicodedata, datetime as dt
raw, code, label, featured, outp = sys.argv[1:6]
R = json.load(open(raw, encoding="utf-8"))
pre = code.lower() + "_"
def n(s): return unicodedata.normalize("NFD", s).encode("ascii","ignore").decode().lower().replace("'", " ").strip()
def key(slug): return pre + re.sub(r"[^a-z0-9]", "", slug.lower())[:14]
teams = [{"id": key(t["slug"]), "name": t["name"], "tc": t["id"], "slug": t["slug"]} for t in R["teams"]]
BYN = {}
for t in teams: BYN[n(t["name"])] = t["id"]
def tid(name):
    k = n(name)
    if k in BYN: return BYN[k]
    for nm, i in BYN.items():
        if nm.startswith(k) or k.startswith(nm): return i
    raise SystemExit("squadra? " + name)
MON = {m: i+1 for i, m in enumerate(["GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO","LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"])}
ROLE = {"POR":"Portiere","DIF":"Difensore","CEN":"Centrocampista","ATT":"Attaccante"}
players, pl = [], {}
for t in teams:
    seen = set()
    for k, row in enumerate([r for r in R["rosa"].get(t["slug"], "").split("|") if r], 1):
        name, num, role, g, pr, y, r = row.split("~")
        if name in seen: continue
        seen.add(name); pid = f"{t['id']}_{k}"
        players.append({"id": pid, "teamId": t["id"], "name": name, "num": num, "role": ROLE.get(role, role.title() if role != "-" else ""), "tc": {"gol": int(g or 0), "pres": int(pr or 0), "y": int(y or 0), "r": int(r or 0)}})
        pl[(t["id"], n(name))] = pid
def find_pid(team, name):
    k = n(name)
    if (team, k) in pl: return pl[(team, k)]
    w = k.split()
    for (t, nm), pid in pl.items():
        if t == team and (nm.split() == w[::-1] or set(nm.split()) == set(w)): return pid
    return None
miss = []
def parse_list(team, txt):
    out = []; txt = txt.strip().rstrip(".").strip()
    items, depth, cur, i = [], 0, "", 0
    while i < len(txt):
        c = txt[i]
        if c == "(": depth += 1
        if c == ")": depth -= 1
        if depth == 0 and txt.startswith(", ", i): items.append(cur); cur = ""; i += 2; continue
        if depth == 0 and txt.startswith(" e ", i): items.append(cur); cur = ""; i += 3; continue
        cur += c; i += 1
    items.append(cur)
    for it in items:
        it = it.strip()
        if not it: continue
        m = re.match(r"^(.*?)\s*(?:\((.*)\))?\s*$", it)
        name, info = m.group(1).strip(), (m.group(2) or "")
        cnt = 1
        for w, c in (("doppietta",2),("tripletta",3),("poker",4)):
            if w in info: cnt = c
        mg = re.search(r"(\d+) gol", info)
        if mg: cnt = int(mg.group(1))
        mins = re.findall(r"(\d+)' (pt|st)", info)
        pens = 0; mp = re.search(r"(\d) su rigore", info)
        if mp: pens = int(mp.group(1))
        elif "su rigore" in info: pens = 1
        og = name.lower().startswith("autogol")
        for j in range(cnt):
            s = {"teamId": team}
            if og: s["og"] = True; s["name"] = "Autogol"
            else:
                pid = find_pid(team, name)
                if pid: s["playerId"] = pid
                else: s["name"] = name; miss.append((team, name))
            if j < len(mins): s["min"] = f"{mins[j][0]}' {'1T' if mins[j][1]=='pt' else '2T'}"
            if j < pens: s["pen"] = True
            out.append(s)
    return out
def scorers(sent):
    out = []
    s = re.sub(r"\s*Da segnalare.*$", "", sent or "")
    for part in re.split(r";\s*(?=per )", s):
        m = re.match(r"^[Pp]er (.+?) in gol (.*)$", part.strip())
        if not m: continue
        out += parse_list(tid(m.group(1).strip()), m.group(2).replace(" e autogol di AUTOGOL", ", Autogol"))
    return out
matches = []; warn = []
for r in sorted(R["rounds"], key=int):
    for i, x in enumerate(R["rounds"][r], 1):
        c = x["cells"]
        mh = re.match(r"^(.*?)\s+(\d+|-)$", c[1].strip()); ma = re.match(r"^(\d+|-)\s+(.*)$", c[2].strip())
        home, hg = mh.group(1).strip(), mh.group(2); ag, away = ma.group(1), ma.group(2).strip()
        tm = c[0] if re.match(r"^\d{1,2}:\d{2}$", c[0]) else ""
        dm = re.match(r"(\d+) ([A-Z]+)", x.get("date") or "")
        date = ""
        if dm:
            mo = MON[dm.group(2)]; date = f"{2026 if mo >= 8 else 2027}-{mo:02d}-{int(dm.group(1)):02d}"
        m = {"id": f"m{r}_{i}", "round": int(r), "date": date, "time": tm, "homeId": tid(home), "awayId": tid(away),
             "hg": int(hg) if hg.isdigit() else None, "ag": int(ag) if ag.isdigit() else None, "scorers": [], "cards": []}
        if m["hg"] is not None:
            sc = scorers(R["sc"].get(x["slug"].split("/")[0], {}).get("s", ""))
            m["scorers"] = sc
            nh = sum(1 for s in sc if s["teamId"] == m["homeId"]); na = sum(1 for s in sc if s["teamId"] == m["awayId"])
            if sc and (nh, na) != (m["hg"], m["ag"]): warn.append(f"{r}.{i} {home}-{away} {m['hg']}-{m['ag']} marcatori {nh}-{na}")
        matches.append(m)
st = {t["id"]: {"teamId": t["id"], "pts": 0, "g": 0, "v": 0, "n": 0, "p": 0, "gf": 0, "gs": 0} for t in teams}
last = 0
for m in matches:
    if m["hg"] is None: continue
    last = max(last, m["round"])
    for me, gf, gs in ((m["homeId"], m["hg"], m["ag"]), (m["awayId"], m["ag"], m["hg"])):
        x = st[me]; x["g"] += 1; x["gf"] += gf; x["gs"] += gs
        if gf > gs: x["v"] += 1; x["pts"] += 3
        elif gf == gs: x["n"] += 1; x["pts"] += 1
        else: x["p"] += 1
rows = sorted(st.values(), key=lambda x: (-x["pts"], -(x["gf"]-x["gs"]), -x["gf"]))
for k, x in enumerate(rows, 1): x["pos"] = k
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=1))).replace(microsecond=0).isoformat()
out = {"settings": {"season": "2026/27", "girone": label, "myTeamId": featured, "tcLink": (sys.argv[6] if len(sys.argv)>6 else "https://www.tuttocampo.it/Lombardia/PrimaCategoria/Girone" + code[-1] + "/Risultati")},
       "teams": [{"id": t["id"], "name": t["name"]} for t in teams], "matches": matches, "players": players,
       "imported": {"at": now, "round": last, "source": f"Tuttocampo, dopo la {last}ª giornata", "rows": [{k: x[k] for k in ("teamId","pos","pts","g","v","n","p","gf","gs")} for x in rows]},
       "tcRound": last, "updatedAt": now}
json.dump(out, open(outp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump([{"id": t["id"], "name": t["name"], "tc": t["tc"]} for t in teams], open(outp.replace(".json", ".teams.json"), "w"), ensure_ascii=False)
print("teams", len(teams), "players", len(players), "matches", len(matches), "played", sum(1 for m in matches if m["hg"] is not None), "ultima", last)
print("marcatori non in rosa:", len(miss), miss[:8]); print("avvisi:", warn)
for x in rows: print(x["pos"], [t["name"] for t in teams if t["id"] == x["teamId"]][0], x["pts"], x["g"])
