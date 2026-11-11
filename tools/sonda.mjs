// Prova: controlla se i comunicati ufficiali del CRL Lombardia sono raggiungibili dai server di GitHub.
const urls = [
  'https://www.crlombardia.it/documenti/33747/comunicato-ufficiale-n-20',
  'https://www.crlombardia.it/',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Baggese app personale)' } });
    const t = await r.text();
    const title = (t.match(/<title>([^<]*)/i) || [])[1];
    const pdf = [...t.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map(m => m[1]).slice(0, 10);
    console.log('\n=====', u, r.status, title, '\nPDF', JSON.stringify(pdf), '\nTEXT', t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500));
  } catch (e) { console.log('\n=====', u, 'ERRORE', e.message); }
}
