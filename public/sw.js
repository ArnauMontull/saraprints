// Service worker: guarda la app y las librerías del CDN para que abra rápido y sin cobertura.
// La API (/api/...) nunca se guarda. Al cambiar ficheros de la app, sube VERSION para forzar la actualización.
const VERSION = "saraprints-v2";
const APP = [
  "./",
  "index.html",
  "estilos.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/imagen.js",
  "js/render.js",
  "js/mathjax-config.js",
  "iconos/icono-192.png",
  "iconos/apple-touch-icon.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Red primero para la app (así se ven los cambios al desplegar) y caché primero para el CDN (versiones fijas)
self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  const esCdn = url.origin !== self.location.origin;
  ev.respondWith(
    caches.open(VERSION).then(async (cache) => {
      if (esCdn) {
        const guardada = await cache.match(ev.request);
        if (guardada) return guardada;
      }
      try {
        const resp = await fetch(ev.request);
        if (resp.ok || resp.type === "opaque") cache.put(ev.request, resp.clone());
        return resp;
      } catch (e) {
        const guardada = await cache.match(ev.request, { ignoreSearch: true });
        if (guardada) return guardada;
        throw e;
      }
    }),
  );
});
