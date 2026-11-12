# Uso: python3 build_all.py seconda-lombardia.txt  -> seconda-<x>.json + gironi.json
import sys, re, json, subprocess, unicodedata
src = open(sys.argv[1], encoding="utf-8").read()
secs = re.split(r"^### (Girone\w+)\s*$", src, flags=re.M)
def norm(s): return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s).encode("ascii","ignore").decode().lower())
G = []
for i in range(1, len(secs), 2):
    g, body = secs[i], secs[i+1]
    m = re.match(r"Girone([A-Z])(\w+)", g); L, area = m.group(1), re.sub(r"(?<=[a-z])(?=[A-Z])", " ", m.group(2))
    code = "S" + L
    lines = [l for l in body.split("\n") if l.strip()]
    names = {}
    for l in lines:
        if l.startswith("M|"):
            c = l.split("|")
            for cell in (c[4], c[5]):
                nm = re.sub(r"^\s*[\d-]+\s+|\s+[\d-]+\s*$", "", cell).strip()
                names.setdefault(norm(nm), nm)
    out = []
    for l in lines:
        if l.startswith("T|"):
            _, slug, tid = l.split("|")
            nm = names.get(norm(slug)) or next((v for k, v in names.items() if k.startswith(norm(slug)) or norm(slug).startswith(k)), None) or re.sub(r"(?<=[a-z])(?=[A-Z0-9])", " ", slug)
            out.append(f"T|{slug}|{tid}|{nm}")
        else:
            out.append(l)
    open(f"{code}.txt", "w", encoding="utf-8").write("\n".join(out) + "\n")
    subprocess.run(["python3", "strumento_txt2raw.py", f"{code}.txt", f"raw{code}.json"], check=True)
    fname = f"seconda-{L.lower()}.json"
    raw = json.load(open(f"raw{code}.json"))
    feat = code.lower() + "_" + re.sub(r"[^a-z0-9]", "", raw["teams"][0]["slug"].lower())[:14]
    r = subprocess.run(["python3", "strumento_build_girone.py", f"raw{code}.json", code, f"Seconda Categoria {area} · Girone {L}", feat, fname,
                        f"https://www.tuttocampo.it/Lombardia/SecondaCategoria/{g}/Risultati"], capture_output=True, text=True)
    print(code, area, r.returncode, (r.stdout + r.stderr).strip().replace("\n", " | ")[:300])
    if r.returncode == 0:
        d = json.load(open(fname))
        G.append({"id": code, "cat": "Seconda", "area": area, "name": "Girone " + L, "file": fname, "tcs": {t["id"]: t["tc"] for t in d["teams"]},
                  "teams": [[t["id"], t["name"]] for t in sorted(d["teams"], key=lambda t: t["name"])]})
json.dump(G, open("gironi.json", "w"), ensure_ascii=False)
