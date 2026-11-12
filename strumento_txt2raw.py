import json, sys
src, out = sys.argv[1:3]
R = {"teams": [], "rounds": {}, "sc": {}, "rosa": {}}
for line in open(src, encoding="utf-8"):
    line = line.rstrip("\n")
    if not line: continue
    k, rest = line.split("|", 1)
    if k == "T":
        slug, tid, name = rest.split("|", 2); R["teams"].append({"slug": slug, "id": tid, "name": name})
    elif k == "M":
        r, date, tm, h, a, key = rest.split("|")
        R["rounds"].setdefault(r, []).append({"date": date, "cells": [tm, h, a], "slug": key + "/x"})
    elif k == "S":
        key, s = rest.split("|", 1)
        import re
        s = re.sub(r"(per [^;]+?) autogol di AUTOGOL", lambda m: m.group(1) + " in gol Autogol" if " in gol " not in m.group(1) else m.group(0), s)
        R["sc"][key] = {"s": s}
    elif k == "P":
        slug, rows = rest.split("|", 1); R["rosa"][slug] = rows
json.dump(R, open(out, "w"), ensure_ascii=False)
