// The offline copy of the installed web app. The page itself is fetched fresh when there is a
// connection (and from the copy when there is none); everything else (scripts, styles, models,
// the orthophoto) is served from the copy at once and refreshed in the background, so that the
// next visit has the newest. Only this site's own files are kept.
// The app's own files are kept in a copy named after the build that registered this worker
// (sw.js?build=…): a new build starts a new copy and the old one is deleted. The data (the
// models, photographs and textures: tens of MB, changing seldom) has a copy of its own that
// outlives builds, so that a new version of the app does not download the whole city again;
// it is still refreshed in the background on every visit.
const CACHE = `cityscope-ar-${new URL(self.location.href).searchParams.get("build") ?? "dev"}`;
const DATA_CACHE = "cityscope-ar-data";
const isData = (url) => /\/(models|textures)\//.test(new URL(url).pathname);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE && name !== DATA_CACHE).map((name) => caches.delete(name))))
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
    caches.open(isData(request.url) ? DATA_CACHE : CACHE).then((cache) =>
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
