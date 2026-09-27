const CACHE = "trilingua-20260927121607";
const BASE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put("index.html", copia)); return res; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === "opaque") { const copia = res.clone(); caches.open(CACHE).then(c => c.put(r, copia)); }
    return res;
  })));
});
