const CACHE = "trilingua-20260928141347";
const AUDIO = "trilingua-audio", FUENTES = "trilingua-fuentes";
const BASE = ["./", "index.html", "manifest.webmanifest", "icon-192.png?v=2", "icon-512.png?v=2", "icon-512-maskable.png?v=2", "zafiroweb.png", "zafiroweb-escudo.png", "zafiroweb-intro.webp", "sonidos/cristal.wav", "sonidos/gota.wav", "sonidos/interruptor.wav", "sonidos/pop.wav", "sonidos/pop2.wav", "sonidos/seleccion.wav"];
// cache: "reload" = bajar todo de internet al instalar una versión nueva (GitHub guarda copias 10 min en el navegador)
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE.map(u => new Request(u, {cache: "reload"}))))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  // Los audios y las fuentes se conservan entre versiones (no cambian); solo se renueva el cache de la página.
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== AUDIO && k !== FUENTES && k !== "trilingua-estado").map(k => caches.delete(k)))));
  self.clients.claim();
});

// El iPhone pide los audios «por pedazos» (encabezado Range) y exige esa respuesta parcial (206).
// Se guarda el archivo entero y se entrega el pedazo pedido: así suenan con y sin internet.
async function conRango(pedido, respuesta){
  const rango = pedido.headers.get("range");
  if (!rango || !respuesta) return respuesta;
  const datos = await respuesta.arrayBuffer(), total = datos.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(rango) || [];
  let ini = m[1] ? parseInt(m[1], 10) : 0, fin = m[2] ? parseInt(m[2], 10) : total - 1;
  if (!m[1] && m[2]) { ini = Math.max(0, total - parseInt(m[2], 10)); fin = total - 1; }
  fin = Math.min(fin, total - 1);
  return new Response(datos.slice(ini, fin + 1), {status:206, statusText:"Partial Content", headers:{
    "Content-Type": respuesta.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${ini}-${fin}/${total}`,
    "Content-Length": String(fin - ini + 1), "Accept-Ranges": "bytes"}});
}
async function audio(pedido){
  const c = await caches.open(AUDIO);
  let r = await c.match(pedido.url);
  if (!r) { r = await fetch(pedido.url); if (r.ok) await c.put(pedido.url, r.clone()); }
  return conRango(pedido, r);
}
// La página: primero internet (para recibir actualizaciones), pero si tarda más de 3 s o no hay conexión, la copia guardada.
async function pagina(pedido){
  const c = await caches.open(CACHE);
  // no-cache: siempre pregunta a internet si hay versión nueva (sin esto, el navegador reusa la página vieja hasta 10 min)
  const red = fetch(new Request(pedido.url, {cache: "no-cache", credentials: "same-origin"})).then(res => { if (res.ok) c.put("index.html", res.clone()); return res; });
  const guardada = await c.match("index.html");
  if (!guardada) return red;
  const tiempo = new Promise(ok => setTimeout(() => ok(null), 3000));
  try { return (await Promise.race([red, tiempo])) || guardada; } catch { return guardada; }
}

// Recordatorio diario sin servidor (Android, app instalada): el navegador despierta al service worker
// cada tanto; si hoy no estudiaste, Felipe te manda una notificación.
self.addEventListener("periodicsync", e => { if (e.tag === "recordatorio") e.waitUntil(recordar()); });
async function recordar(){
  const c = await caches.open("trilingua-estado"), r = await c.match("estado"), est = r ? await r.json() : {};
  const d = new Date(), hoy = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  if (est.ultimo === hoy || d.getHours() < 12) return;
  const frases = ["Hoy no estudiaste. Yo tampoco hice nada, pero yo soy un pájaro.", "Tu racha está por morir. Como mis pulmones.",
    "¿Te olvidaste de mí? Mi ex también. Hacé tu unidad.", "Cinco minutos. Menos de lo que tardo en fumarme uno."];
  return self.registration.showNotification("Felipe 🐦", {body:(est.nombre ? est.nombre + ": " : "") + frases[Math.floor(Math.random() * frases.length)],
    icon:"icon-192.png", badge:"icon-192.png", tag:"recordatorio"});
}
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window"}).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow("./")));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  // El aviso de versión nueva y el APK siempre se buscan en internet (nunca del cache).
  if (/version\.json|\.apk$/.test(url.pathname)) return;
  if (url.pathname.includes("/audio/")) { e.respondWith(audio(r)); return; }
  if (r.mode === "navigate") { e.respondWith(pagina(r)); return; }
  // Fuentes de Google: se guardan para que la letra se vea igual sin internet.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FUENTES).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(r, copia)); }
    return res;
  })));
});
