/* Baggese app: tiene una copia dell'app sul telefono.
   - pagina e dati: si mostra subito la copia salvata e intanto si scarica quella nuova
   - stemmi, font, icone: dalla copia salvata
   - richieste con ?t= (controllo aggiornamenti) e ?v= (ricarica dopo un aggiornamento): sempre dalla rete */
var C = "baggese-v1";
var CORE = ["./", "index.html", "data.json", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png",
  "Inter-Regular.woff", "Inter-Medium.woff", "Inter-SemiBold.woff", "Inter-Bold.woff", "Inter-ExtraBold.woff", "InterDisplay-Bold.woff", "InterDisplay-ExtraBold.woff"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.searchParams.has("t") || u.searchParams.has("v") || /\.ics$/.test(u.pathname)) return; // sempre dalla rete
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
