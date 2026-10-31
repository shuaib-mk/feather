const CACHE = "feather-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.includes("/api/")) return; // network-only
  if (e.request.method !== "GET") return;
  // Navigations are network-first: a new deploy's index.html (with its new
  // hashed bundle) must win over a shell cached by an older deployment.
  // Serving a cached shell stale-while-revalidate kept pre-deploy code alive
  // for a whole session after the batch-2 follow-up deployed (2026-10-31).
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => {
    const network = fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; }).catch(() => cached);
    return cached || network;
  }));
});
