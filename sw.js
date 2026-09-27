const CACHE = "trilingua-20260927153844";
const BASE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  // El cache de audios se conserva entre versiones (los archivos no cambian: su nombre es el hash del texto).
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "trilingua-audio").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  // Audios: se piden enteros (sin rango) para poder guardarlos y que anden sin internet.
  if (new URL(r.url).pathname.includes("/audio/")) {
    e.respondWith(caches.open("trilingua-audio").then(c => c.match(r.url).then(hit => hit ||
      fetch(r.url).then(res => { if (res.ok) c.put(r.url, res.clone()); return res; }))));
    return;
  }
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
