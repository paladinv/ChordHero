const CACHE_VERSION = "chord-hero-shell-v3";
const APP_SHELL = [
  "/", "/practice", "/trainer", "/right-hand", "/songs", "/library", "/chords", "/about",
  "/manifest.webmanifest", "/chord-hero-logo.svg", "/samples/guitar/manifest.json",
  "/audio/percussion/hi-hat-close.wav", "/samples/guitar/muted.mp3",
  "/samples/guitar/clean/40.mp3", "/samples/guitar/clean/42.mp3", "/samples/guitar/clean/45.mp3",
  "/samples/guitar/clean/48.mp3", "/samples/guitar/clean/54.mp3", "/samples/guitar/clean/60.mp3", "/samples/guitar/clean/63.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("chord-hero-") && key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const request = event.request;
  const isNavigation = request.mode === "navigate";
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (isNavigation ? caches.match("/") : Response.error()))
  );
});
