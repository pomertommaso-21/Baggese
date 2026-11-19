"""Crea desktop.html, la versione per computer, partendo dall'app (index.html) e dal livello desktop (cartella desktop/).
La versione desktop si aggiorna SOLO quando l'utente lo chiede: si rilancia questo strumento in quel momento,
così prende le novità dell'app di quel giorno. Uso: python3 strumento_desktop.py"""
import re, pathlib
R = pathlib.Path(__file__).parent
s = (R / 'index.html').read_text()
css = (R / 'desktop' / 'desk.css').read_text()
js = (R / 'desktop' / 'desk.js').read_text()
s = re.sub(r'<script>/\*desk-redirect.*?/\*/desk-redirect\*/</script>\n?', '', s, flags=re.S)
i = s.rindex('</style>')
s = s[:i] + '\n' + css + s[i:]
end = '\n})();\n</script>'
k = s.rindex(end)
s = s[:k] + '\n' + js + s[k:]
s = re.sub(r'<title>([^<]*)</title>', lambda m: '<title>' + m.group(1) + ' · Desktop</title>', s, count=1)
(R / 'desktop.html').write_text(s)
print('desktop.html creato:', len(s) // 1024, 'KB')
