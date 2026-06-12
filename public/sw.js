// Kill-switch service worker.
// Any browser that still has an old SW registered for this scope will
// receive this one on next visit, which immediately wipes its caches,
// unregisters itself, and forces open tabs to reload to the network.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.map((n) => caches.delete(n)));
        await self.clients.claim();
        const wins = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(wins.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});

// Network-only passthrough while still active so nothing is served stale.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
