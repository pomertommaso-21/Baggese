/* Baggese app: tiene una copia dell'app sul telefono.
   - pagina: subito la copia salvata (niente attesa), la versione nuova si scarica intanto
     e se arriva mentre c'e' ancora la schermata d'avvio l'app la usa subito
   - dati: si mostra subito la copia salvata e intanto si scarica quella nuova
   - stemmi, font, icone: dalla copia salvata
   - richieste con ?r= (controllo dei dati nuovi): passano dalla rete ma con l'"impronta" del file,
     quindi se non e' cambiato niente il server risponde "uguale" e non si riscarica nulla
   - richieste con ?t= e ?v=: sempre dalla rete */
var C = "baggese-v5";
var CORE = ["./", "index.html", "data.json", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png",
  "Inter-Regular.woff2", "Inter-Medium.woff2", "Inter-SemiBold.woff2", "Inter-Bold.woff2", "Inter-ExtraBold.woff2", "InterDisplay-Bold.woff2", "InterDisplay-ExtraBold.woff2"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.searchParams.has("t") || u.searchParams.has("v") || u.searchParams.has("r") || /\.ics$/.test(u.pathname)) return; // dalla rete
  var fresh = /\.(json|html)$/.test(u.pathname) || r.mode === "navigate" || u.pathname.endsWith("/");
  var key = r.mode === "navigate" ? new Request(u.origin + u.pathname) : r;
  e.respondWith(caches.open(C).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(r).then(function (res) { if (res && res.ok) c.put(key, res.clone()); return res; });
      if (hit) { if (fresh) e.waitUntil(net.catch(function () {})); return hit; }
      return net;
    });
  }));
});
