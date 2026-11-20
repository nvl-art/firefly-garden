const CACHE_NAME = "firefly-garden-v3";
const INDEX_URL = "./index.html";
const MANIFEST_URL = "./manifest.json";

// Install: cache the main game page.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(INDEX_URL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove older versions of this game's cache.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("firefly-garden-") &&
              key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: use the network first for pages,
// and cache-first for other same-origin GET requests.
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then(cache => cache.put(INDEX_URL, copy))
            );
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(INDEX_URL);
          return cached || new Response(
            "The game is unavailable offline. Please reconnect and try again.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain" }
            }
          );
        })
    );

    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok) {
          event.waitUntil(
            cache.put(request, response.clone())
          );
        }

        return response;
      } catch (error) {
        return new Response("Offline", { status: 503 });
      }
    })
  );
});
