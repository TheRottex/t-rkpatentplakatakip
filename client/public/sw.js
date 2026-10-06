const CACHE = "tpplaka-v5";
const ASSETS = ["/", "/manifest.json", "/turkpatenetanalogo.jpg"];

async function cacheAppShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
  const response = await fetch(new Request("/", { cache: "no-cache" }));
  if (!response.ok) throw new Error("Uygulama kabuğu alınamadı.");
  const html = await response.clone().text();
  await cache.put("/", response.clone());
  const assetPaths = Array.from(html.matchAll(/(?:src|href)="([^"]*\/assets\/[^\"]+)"/g), (match) => match[1]);
  await Promise.all(assetPaths.map(async (assetPath) => {
    try {
      const asset = await fetch(new Request(new URL(assetPath, self.location.origin), { cache: "no-cache" }));
      if (asset.ok) await cache.put(assetPath, asset);
    } catch {}
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
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
