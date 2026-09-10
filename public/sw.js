// Minimal service worker. Its only job is to exist and control the page,
// which is one of the criteria Chrome/Android checks before it will fire
// `beforeinstallprompt` and let us show a native "Add to Home Screen" dialog.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler (no offline caching) — just needs to exist.
self.addEventListener("fetch", () => {});
