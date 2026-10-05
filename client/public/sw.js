const CACHE = "tpplaka-v4";
const ASSETS = ["/", "/manifest.json", "/turkpatenetanalogo.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-cache" }))
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("/"))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (!response.ok || !url.pathname.startsWith("/assets/")) return response;
      return caches.open(CACHE)
        .then((cache) => cache.put(event.request, response.clone()))
        .then(() => response);
    });
  }));
});
