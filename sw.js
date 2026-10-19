// The offline copy of the installed web app. The page itself is fetched fresh when there is a
// connection (and from the copy when there is none); everything else (scripts, styles, models,
// the orthophoto) is served from the copy at once and refreshed in the background, so that the
// next visit has the newest. Only this site's own files are kept.
// The copy is named after the build that registered this worker (sw.js?build=…), so that a new
// build starts a new copy and the old one is deleted.
const CACHE = `cityscope-ar-${new URL(self.location.href).searchParams.get("build") ?? "dev"}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((kept) => {
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => kept);
        return kept ?? fresh;
      }),
    ),
  );
});
