# Righe lette da Tuttocampo (M/S/C) -> aggiornamento.json, uno per girone
import sys, json, re
MESI = {'GENNAIO':1,'FEBBRAIO':2,'MARZO':3,'APRILE':4,'MAGGIO':5,'GIUGNO':6,'LUGLIO':7,'AGOSTO':8,'SETTEMBRE':9,'OTTOBRE':10,'NOVEMBRE':11,'DICEMBRE':12}
def data(s):
    m = re.match(r'(\d+)\s+([A-Z]+)', s or '')
    if not m: return None
    mo = MESI[m.group(2)]; y = 2026 if mo >= 8 else 2027
    return f'{y}-{mo:02d}-{int(m.group(1)):02d}'
src, code, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
L = [l.strip() for l in open(src, encoding='utf-8') if l.strip()]
S = {l.split('|')[1]: l.split('|', 2)[2] for l in L if l.startswith('S|')}
byr = {}
for l in L:
    if not l.startswith('M|'): continue
    _, r, d, ora, c, o, k = l.split('|')
    mh = re.match(r'(.*?)\s+(\d+|-)$', c); ma = re.match(r'^(\d+|-)\s+(.*)$', o)
    casa, gh = mh.group(1), mh.group(2); gv, osp = ma.group(1), ma.group(2)
    p = {'casa': casa, 'ospite': osp}
    if data(d): p['data'] = data(d)
    if re.match(r'^\d{1,2}:\d{2}$', ora): p['ora'] = ora
    if gh != '-' and gv != '-':
        p['gol_casa'] = int(gh); p['gol_ospite'] = int(gv)
        if S.get(k): p['marcatori'] = re.sub(r'\.\s+Da segnalare.*$', '.', S[k])
    byr.setdefault(int(r), []).append(p)
C = []
for i, l in enumerate([l for l in L if l.startswith('C|')]):
    c = l.split('|')[1:]
    # celle: pos | (vuota) | squadra | pt | g | v | n | p | gf | gs | dr
    name = re.sub(r'\s*\(-\d+\)\s*$', '', c[2]); nums = c[3:10]
    C.append({'squadra': name, 'pos': i + 1, 'pt': int(nums[0]), 'g': int(nums[1]), 'v': int(nums[2]), 'n': int(nums[3]), 'p': int(nums[4]), 'gf': int(nums[5]), 'gs': int(nums[6])})
rs = sorted(byr)
for j, r in enumerate(rs):
    up = {'girone': code, 'giornata': r, 'partite': byr[r]}
    if j == 0 and C: up['classifica'] = C
    json.dump(up, open(f'{outdir}/agg-{code}-{r}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{outdir}/agg-{code}-{r}.json', len(byr[r]), 'partite,', sum(1 for p in byr[r] if 'gol_casa' in p), 'giocate')
